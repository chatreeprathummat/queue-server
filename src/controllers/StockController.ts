import { Request, Response } from 'express';

// Import modules
const ManagementDB = require('../services/ManagementDB').default as any;
const { safeLogger  } = require('../services/logging') as any;
const DocumentUtils = require('../services/documentUtils') as any;
const { wrapController } = require("../services/logging/controllers/requestLogger") as any; 
const Joi = require('joi') as any;
const moment = require('moment') as any;

// Interface definitions สำหรับ Stock Department (โครงสร้างใหม่)
interface SupplierData {
    type: 'official' | 'suggested';  // ระบุประเภทผู้จำหน่าย
    
    // สำหรับผู้จำหน่ายที่มีรหัสแล้ว (type: 'official')
    supplier_id?: number;
    
    // สำหรับผู้จำหน่ายใหม่ (type: 'suggested')
    suggested_supplier_name?: string;
    contact_person?: string;
    contact_phone?: string;
    contact_email?: string;
    address?: string;
    tax_id?: string;
    
    // ข้อมูลราคาและรายละเอียด (ใช้ร่วมกัน)
    quoted_unit_price?: number;
    quoted_total_price?: number;
    quotation_ref?: string;
    quotation_date?: string;
    delivery_lead_time?: number;
    payment_terms?: string;
    warranty_period?: string;
    supplier_notes?: string;
    internal_notes?: string;
    is_recommended?: boolean;
    recommendation_reason?: string;
    supplier_rank?: number;
    quote_status?: string;
    quote_valid_until?: string;
}

interface DocumentData {
    document_type_id: number;
    document_name: string;
    description?: string;
    file_data?: string;  // base64 encoded file data
    file_name?: string;
    mime_type?: string;
}

interface CreateDraftPRRequest {
    // ข้อมูลจำเป็นสำหรับระบุ item ต้นฉบับ
    source_requisition_id: string;       // รหัสคำขอเบิก
    source_item_sequence: number;        // ลำดับ item ใน requisition
    source_item_id: number;              // รหัส item ต้นฉบับ
    
    // ข้อมูลเพิ่มเติมจากพัสดุ (เฉพาะข้อมูลใหม่ที่พัสดุเพิ่มเติม)
    detailed_specification?: string;     // รายละเอียดเพิ่มเติมจากพัสดุ
    approved_quantity?: number;          // จำนวนที่อนุมัติจากพัสดุ
    estimated_unit_price?: number;       // ราคาต่อหน่วยประมาณการ
    estimated_total_price?: number;      // ราคารวมประมาณการ
    
    // ข้อมูล PR ที่พัสดุกรอก
    purpose?: string;                    // วัตถุประสงค์การขอซื้อ
    requested_delivery_date?: string;    // วันที่ต้องการรับสินค้า
    delivery_location?: string;          // สถานที่ส่งมอบ
    special_requirements?: string;       // ข้อกำหนดพิเศษ
    priority_level?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; // ความสำคัญ
    
    // ข้อมูลผู้จำหน่าย (ไม่จำเป็น - สามารถเพิ่มหลังจากสร้าง draft-pr แล้ว)
    suppliers?: SupplierData[];
    
    // ประเภทเอกสารที่ต้องการ (ไม่ใช่ไฟล์จริง - เพียงระบุประเภทที่ต้องการ)
    documents?: { document_type_id: number }[];
    
    // ผู้สร้าง
    created_by_user_id: string;
    
    // หมายเหตุ: ข้อมูลเก่าจาก requisition item จะดึงจากฐานข้อมูลอัตโนมัติ
    // ไม่ต้องส่งมาจาก frontend: item_description, unit, requested_quantity, 
    // item_type, hn, patient_name, original_note, request_date
}

// Helper function
const sanitizeForMySQL = (value: any): any => {
    return value === undefined ? null : value;
};

// ========================================
// ฟังก์ชันสำหรับพนักงานพัสดุ (STOCK_STAFF)
// ========================================

// สร้างร่าง PR สำหรับ item เดียว
export const stockCreateDraftPR = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== STOCK CREATE DRAFT PR ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('=============================');

        const schema = Joi.object({
            source_requisition_id: Joi.string().required(), // รหัสคำขอซื้อ
            source_item_sequence: Joi.number().integer().min(1).required(), // ลำดับรายการสินค้าในคำขอซื้อ
            source_item_id: Joi.number().integer().required(), // รหัสสินค้า
            
            // ข้อมูลเพิ่มเติมจากพัสดุ
            detailed_specification: Joi.string().allow(null, ''), // รายละเอียดเพิ่มเติมจากพัสดุ
            approved_quantity: Joi.number().min(0).optional(), // จำนวนที่อนุมัติจากพัสดุ
            estimated_unit_price: Joi.number().min(0).optional(), // ราคาต่อหน่วยประมาณการจากพัสดุ
            estimated_total_price: Joi.number().min(0).optional(), // ราคารวมประมาณการจากพัสดุ
            
            // ข้อมูล PR
            purpose: Joi.string().allow(null, ''), // วัตถุประสงค์การขอซื้อความเห็นจากพัสดุ
            requested_delivery_date: Joi.date().iso().allow(null), // วันที่ต้องการรับสินค้าจากพัสดุ
            delivery_location: Joi.string().allow(null, ''), // สถานที่ส่งมอบจากพัสดุ
            special_requirements: Joi.string().allow(null, ''), // ข้อกำหนดพิเศษจากพัสดุ
            priority_level: Joi.string().valid('LOW', 'NORMAL', 'HIGH', 'URGENT').default('NORMAL'), // ความสำคัญจากพัสดุ
            
            // ข้อมูลผู้จำหน่ายหลายราย (ไม่จำเป็น)
            suppliers: Joi.array().items(Joi.object({
                type: Joi.string().valid('official', 'suggested').required(),
                // สำหรับผู้จำหน่ายที่มีรหัสแล้ว
                supplier_id: Joi.number().integer().when('type', { is: 'official', then: Joi.required() }),
                // สำหรับผู้จำหน่ายรายใหม่
                suggested_supplier_name: Joi.string().when('type', { is: 'suggested', then: Joi.required() }),
                contact_person: Joi.string().allow(null, ''),
                contact_phone: Joi.string().allow(null, ''),
                contact_email: Joi.string().email().allow(null, ''),
                address: Joi.string().allow(null, ''),
                tax_id: Joi.string().allow(null, ''),
                // ข้อมูลใบเสนอราคา
                quotation_ref: Joi.string().allow(null, ''),
                quotation_date: Joi.date().iso().allow(null),
                payment_terms: Joi.string().allow(null, ''),
                // ข้อมูลอื่นๆ ที่ไม่จำเป็นในการสร้าง draft-pr
                quoted_unit_price: Joi.number().min(0).optional(),
                quoted_total_price: Joi.number().min(0).optional(),
                delivery_lead_time: Joi.number().integer().min(0).optional(),
                warranty_period: Joi.string().allow(null, ''),
                supplier_notes: Joi.string().allow(null, ''),
                internal_notes: Joi.string().allow(null, ''),
                is_recommended: Joi.boolean().default(false),
                recommendation_reason: Joi.string().allow(null, ''),
                supplier_rank: Joi.number().integer().min(1).optional(),
                quote_status: Joi.string().valid('PENDING','RECEIVED','EXPIRED','REJECTED').default('PENDING'),
                quote_valid_until: Joi.date().iso().optional()
            })).optional(),
            
            // เอกสารแนบ (ไม่จำเป็น)
            documents: Joi.array().items(Joi.object({
                document_type_id: Joi.number().integer().required() // ประเภทเอกสารเชื่อมตาราง tbl_inv_document_types
                // ไม่ต้องมี document_name, file_data, etc. ในการสร้าง draft-pr
            })).optional(),
            
            created_by_user_id: Joi.string().max(15).required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const data = value as CreateDraftPRRequest;
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบว่า item มีอยู่และอยู่ในสถานะที่รับได้
            const [itemCheck] = await connection.execute(
                `SELECT ri.*, r.current_status, r.department_code, r.request_username
                 FROM tbl_inv_requisition_items ri
                 JOIN tbl_inv_requisitions r ON ri.requisition_id = r.id
                 WHERE ri.item_id = ? AND ri.requisition_id = ? AND ri.item_sequence = ? 
                   AND ri.is_cancelled = 0 AND r.current_status = 'REQ_APPROVED_BY_HEAD'`,
                [data.source_item_id, data.source_requisition_id, data.source_item_sequence]
            );

            if (itemCheck.length === 0) {
                throw new Error('ไม่พบรายการสินค้าหรือไม่อยู่ในสถานะที่รับได้');
            }

            const originalItem = itemCheck[0];

            // ตรวจสอบว่ามี draft-pr สำหรับ item นี้อยู่แล้วหรือไม่
            const [existingDraft] = await connection.execute(
                `SELECT id FROM tbl_inv_draft_pr 
                 WHERE source_requisition_id = ? AND source_item_sequence = ? AND is_cancelled = 0`,
                [data.source_requisition_id, data.source_item_sequence]
            );

            if (existingDraft.length > 0) {
                throw new Error(`มีร่าง PR สำหรับรายการนี้อยู่แล้ว (${existingDraft[0].id})`);
            }

            // สร้าง draft-pr id
            const draftPRId: string = await DocumentUtils.generateDocumentNumber(connection, 'DPR');

            // คำนวณจำนวนผู้จำหน่ายแต่ละประเภท
            let totalOfficialSuppliers = 0;
            let totalSuggestedSuppliers = 0;
            if (data.suppliers) {
                totalOfficialSuppliers = data.suppliers.filter(s => s.type === 'official').length;
                totalSuggestedSuppliers = data.suppliers.filter(s => s.type === 'suggested').length;
            }

            // บันทึกข้อมูล draft-pr (เพิ่มฟิลด์ที่ขาดหายไป)
            await connection.execute(
                `INSERT INTO tbl_inv_draft_pr 
                 (id, source_requisition_id, source_item_sequence, source_item_id,
                  item_description, detailed_specification, unit, requested_quantity, approved_quantity,
                  estimated_unit_price, estimated_total_price,
                  item_type, hn, patient_name, original_note, request_date,
                  purpose, requested_delivery_date, delivery_location, special_requirements,
                  current_status, priority_level,
                  total_suppliers_count, total_official_suppliers, total_suggested_suppliers,
                  created_by_user_id, date_created) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    draftPRId, 
                    data.source_requisition_id, 
                    data.source_item_sequence, 
                    data.source_item_id,
                    
                    // ข้อมูลจาก original item
                    originalItem.description,
                    sanitizeForMySQL(data.detailed_specification),
                    originalItem.unit,
                    originalItem.quantity,
                    sanitizeForMySQL(data.approved_quantity || originalItem.quantity), // approved_quantity จาก request หรือใช้ quantity เดิม
                    
                    // ข้อมูลราคาจากพัสดุ
                    sanitizeForMySQL(data.estimated_unit_price),
                    sanitizeForMySQL(data.estimated_total_price),
                    
                    // ข้อมูลเดิมจาก item
                    sanitizeForMySQL(originalItem.item_type),
                    sanitizeForMySQL(originalItem.hn),
                    sanitizeForMySQL(originalItem.patient_name),
                    sanitizeForMySQL(originalItem.note),
                    sanitizeForMySQL(originalItem.request_date),
                    
                    // ข้อมูล PR
                    sanitizeForMySQL(data.purpose),
                    sanitizeForMySQL(data.requested_delivery_date),
                    sanitizeForMySQL(data.delivery_location),
                    sanitizeForMySQL(data.special_requirements),
                    
                    // สถานะและความสำคัญ
                    'STOCK_DRAFT_PR_PENDING',
                    data.priority_level || 'NORMAL', // priority_level จาก request หรือ default
                    
                    // ข้อมูลสรุปผู้จำหน่าย
                    totalOfficialSuppliers + totalSuggestedSuppliers,
                    totalOfficialSuppliers,
                    totalSuggestedSuppliers,
                    
                    data.created_by_user_id
                ]
            );

            // อัพเดทสถานะ original item
            await connection.execute(
                `UPDATE tbl_inv_status_item_current 
                 SET current_status_code = 'STOCK_DRAFT_PR_PENDING', current_status_since = NOW(), 
                     last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                 WHERE item_id = ?`,
                [`สร้างร่าง PR: ${data.detailed_specification || originalItem.description} (${draftPRId})`, data.created_by_user_id, data.source_item_id]
            );

            // Log event
            await connection.execute(
                `INSERT INTO tbl_inv_item_event_logs 
                 (item_id, event_type, new_status_code, event_description, 
                  ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                 VALUES (?, 'CREATE', 'STOCK_DRAFT_PR_PENDING', ?, ?, ?, ?, ?, NOW())`,
                [
                    data.source_item_id, 
                    `พนักงานพัสดุสร้างร่าง PR: ${data.detailed_specification || originalItem.description} (โดย ${data.created_by_user_id})`,
                    req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                    JSON.stringify({
                        action: 'create_draft_pr',
                        draft_pr_id: draftPRId,
                        estimated_total_price: data.estimated_total_price,
                        suppliers_count: data.suppliers ? data.suppliers.length : 0,
                        documents_count: data.documents ? data.documents.length : 0,
                        created_by_user_id: data.created_by_user_id
                    }),
                    data.created_by_user_id
                ]
            );

            // บันทึกผู้จำหน่าย (ถ้ามี) - ใช้ตารางใหม่
            let suppliersAdded = 0;
            let officialSuppliersAdded = 0;
            let suggestedSuppliersAdded = 0;
            let lowestPrice = null;
            let highestPrice = null;
            let recommendedSupplierId = null;
            let suppliersSkipped = []; // เก็บรายการผู้จำหน่ายที่ข้าม

            if (data.suppliers && data.suppliers.length > 0) {
                for (const supplier of data.suppliers) {
                    if (supplier.type === 'official') {
                        // ผู้จำหน่ายที่มีรหัสแล้ว
                        const [supplierCheck] = await connection.execute(
                            `SELECT id, supplier_name FROM tbl_inv_suppliers WHERE id = ? AND is_active = 1`,
                            [supplier.supplier_id]
                        );
                        
                        if (supplierCheck.length === 0) {
                            const skipReason = `ผู้จำหน่าย ID ${supplier.supplier_id} ไม่พบในระบบหรือไม่ได้ใช้งาน`;
                            console.warn(`⚠️ ${skipReason}`);
                            suppliersSkipped.push({
                                type: 'official',
                                supplier_id: supplier.supplier_id,
                                reason: skipReason
                            });
                            continue;
                        }
                        
                        // บันทึกลงตาราง official suppliers
                        await connection.execute(
                            `INSERT INTO tbl_inv_draft_pr_official_suppliers 
                             (draft_pr_id, supplier_id, quoted_unit_price, quoted_total_price, quotation_ref, quotation_date,
                              delivery_lead_time, payment_terms, warranty_period, supplier_notes, internal_notes,
                              is_recommended, recommendation_reason, supplier_rank, quote_status, quote_valid_until,
                              contact_person, contact_phone, contact_email, added_by_user_id) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                draftPRId,
                                supplier.supplier_id,
                                sanitizeForMySQL(supplier.quoted_unit_price),
                                sanitizeForMySQL(supplier.quoted_total_price),
                                sanitizeForMySQL(supplier.quotation_ref),
                                sanitizeForMySQL(supplier.quotation_date),
                                sanitizeForMySQL(supplier.delivery_lead_time),
                                sanitizeForMySQL(supplier.payment_terms),
                                sanitizeForMySQL(supplier.warranty_period),
                                sanitizeForMySQL(supplier.supplier_notes),
                                sanitizeForMySQL(supplier.internal_notes),
                                supplier.is_recommended || false,
                                sanitizeForMySQL(supplier.recommendation_reason),
                                sanitizeForMySQL(supplier.supplier_rank),
                                supplier.quote_status || 'PENDING',
                                sanitizeForMySQL(supplier.quote_valid_until),
                                sanitizeForMySQL(supplier.contact_person),
                                sanitizeForMySQL(supplier.contact_phone),
                                sanitizeForMySQL(supplier.contact_email),
                                data.created_by_user_id
                            ]
                        );

                        // บันทึก log
                        await connection.execute(
                            `INSERT INTO tbl_inv_draft_pr_supplier_logs 
                             (draft_pr_id, supplier_type, supplier_entry_id, supplier_reference_id, supplier_name,
                              action_type, new_data, changed_by_user_id, change_reason) 
                             VALUES (?, 'OFFICIAL', LAST_INSERT_ID(), ?, ?, 'ADD', ?, ?, ?)`,
                            [
                                draftPRId,
                                supplier.supplier_id,
                                supplierCheck[0].supplier_name,
                                JSON.stringify(supplier),
                                data.created_by_user_id,
                                `เพิ่มผู้จำหน่ายที่มีรหัสแล้ว: ${supplierCheck[0].supplier_name}`
                            ]
                        );

                        officialSuppliersAdded++;
                        
                    } else {
                        // ผู้จำหน่ายที่ยังไม่มีรหัส - บันทึกลงตาราง suggested suppliers
                        await connection.execute(
                            `INSERT INTO tbl_inv_draft_pr_suggested_suppliers 
                             (draft_pr_id, suggested_supplier_name, contact_person, contact_phone, contact_email, address, tax_id,
                              quoted_unit_price, quoted_total_price, quotation_ref, quotation_date,
                              delivery_lead_time, payment_terms, warranty_period, supplier_notes, internal_notes,
                              is_recommended, recommendation_reason, supplier_rank, quote_status, quote_valid_until,
                              suggested_by_user_id) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                draftPRId,
                                supplier.suggested_supplier_name,
                                sanitizeForMySQL(supplier.contact_person),
                                sanitizeForMySQL(supplier.contact_phone),
                                sanitizeForMySQL(supplier.contact_email),
                                sanitizeForMySQL(supplier.address),
                                sanitizeForMySQL(supplier.tax_id),
                                sanitizeForMySQL(supplier.quoted_unit_price),
                                sanitizeForMySQL(supplier.quoted_total_price),
                                sanitizeForMySQL(supplier.quotation_ref),
                                sanitizeForMySQL(supplier.quotation_date),
                                sanitizeForMySQL(supplier.delivery_lead_time),
                                sanitizeForMySQL(supplier.payment_terms),
                                sanitizeForMySQL(supplier.warranty_period),
                                sanitizeForMySQL(supplier.supplier_notes),
                                sanitizeForMySQL(supplier.internal_notes),
                                supplier.is_recommended || false,
                                sanitizeForMySQL(supplier.recommendation_reason),
                                sanitizeForMySQL(supplier.supplier_rank),
                                supplier.quote_status || 'PENDING',
                                sanitizeForMySQL(supplier.quote_valid_until),
                                data.created_by_user_id
                            ]
                        );

                        // บันทึก log
                        await connection.execute(
                            `INSERT INTO tbl_inv_draft_pr_supplier_logs 
                             (draft_pr_id, supplier_type, supplier_entry_id, supplier_reference_id, supplier_name,
                              action_type, new_data, changed_by_user_id, change_reason) 
                             VALUES (?, 'SUGGESTED', LAST_INSERT_ID(), NULL, ?, 'ADD', ?, ?, ?)`,
                            [
                                draftPRId,
                                supplier.suggested_supplier_name,
                                JSON.stringify(supplier),
                                data.created_by_user_id,
                                `เพิ่มผู้จำหน่ายใหม่ (ยังไม่มีรหัส): ${supplier.suggested_supplier_name}`
                            ]
                        );

                        suggestedSuppliersAdded++;
                    }

                    // คำนวณราคาต่ำสุด/สูงสุด
                    if (supplier.quoted_total_price) {
                        if (lowestPrice === null || supplier.quoted_total_price < lowestPrice) {
                            lowestPrice = supplier.quoted_total_price;
                        }
                        if (highestPrice === null || supplier.quoted_total_price > highestPrice) {
                            highestPrice = supplier.quoted_total_price;
                        }
                    }

                    // เก็บผู้จำหน่ายที่แนะนำ
                    if (supplier.is_recommended) {
                        recommendedSupplierId = supplier.type === 'official' ? supplier.supplier_id : null;
                    }

                    suppliersAdded++;
                }

                // อัพเดทข้อมูลสรุปในตาราง draft-pr หลังจากเพิ่มผู้จำหน่าย
                await connection.execute(
                    `UPDATE tbl_inv_draft_pr 
                     SET total_suppliers_count = ?, 
                         total_official_suppliers = ?, 
                         total_suggested_suppliers = ?,
                         lowest_quoted_price = ?, 
                         highest_quoted_price = ?,
                         recommended_supplier_id = ?,
                         updated_by_user_id = ?, 
                         date_updated = NOW() 
                     WHERE id = ?`,
                    [
                        suppliersAdded, 
                        officialSuppliersAdded, 
                        suggestedSuppliersAdded,
                        lowestPrice, 
                        highestPrice,
                        recommendedSupplierId,
                        data.created_by_user_id, 
                        draftPRId
                    ]
                );
            }

            // บันทึกเอกสารแนบ (ถ้ามี) - เฉพาะการระบุประเภทเอกสาร
            let documentsAdded = 0;
            let requiredDocuments = [];
            if (data.documents && data.documents.length > 0) {
                for (const document of data.documents) {
                    // ตรวจสอบว่า document_type_id มีอยู่จริงในระบบ
                    const [docTypeCheck] = await connection.execute(
                        `SELECT id, name, code FROM tbl_inv_document_types WHERE id = ? AND is_active = 1`,
                        [document.document_type_id]
                    );
                    
                    if (docTypeCheck.length === 0) {
                        console.warn(`⚠️ ข้ามประเภทเอกสาร ID ${document.document_type_id} เพราะไม่พบในระบบหรือไม่ได้ใช้งาน`);
                        continue;
                    }

                    // บันทึกความต้องการเอกสาร (ยังไม่มีไฟล์จริง)
                    await connection.execute(
                        `INSERT INTO tbl_inv_draft_pr_documents 
                         (draft_pr_id, document_type_id, file_name, file_path, description, uploaded_by_user_id) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            draftPRId,
                            document.document_type_id,
                            `${docTypeCheck[0].code}_${draftPRId}_placeholder.pdf`, // placeholder filename
                            `pending-upload/${draftPRId}/${docTypeCheck[0].code}`, // placeholder path
                            `ต้องการเอกสาร: ${docTypeCheck[0].name} (รอการอัพโหลดไฟล์จริง)`,
                            data.created_by_user_id
                        ]
                    );
                    
                    requiredDocuments.push({
                        document_type_id: document.document_type_id,
                        document_type_code: docTypeCheck[0].code,
                        document_type_name: docTypeCheck[0].name
                    });
                    
                    console.log(`📄 เพิ่มความต้องการเอกสาร: ${docTypeCheck[0].name} (${docTypeCheck[0].code})`);
                    documentsAdded++;
                }
            }

            // บันทึกประวัติ
            const supplierInfo = suppliersAdded > 0 ? ` พร้อมผู้จำหน่าย ${suppliersAdded} รายการ (Official: ${officialSuppliersAdded}, Suggested: ${suggestedSuppliersAdded})` : '';
            const documentInfo = documentsAdded > 0 ? ` และต้องการเอกสาร ${documentsAdded} ประเภท` : '';
            await connection.execute(
                `INSERT INTO tbl_inv_status_logs 
                 (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                 VALUES (?, 'REQ_APPROVED_BY_HEAD', 'STOCK_DRAFT_PR_PENDING', ?, ?, NOW())`,
                [
                    data.source_requisition_id,
                    `พนักงานพัสดุสร้างร่าง PR สำหรับรายการลำดับ ${data.source_item_sequence}: ${data.detailed_specification || originalItem.description} (${draftPRId})${supplierInfo}${documentInfo}`,
                    data.created_by_user_id
                ]
            );

            return {
                draftPRId,
                source_requisition_id: data.source_requisition_id,
                source_item_sequence: data.source_item_sequence,
                source_item_id: data.source_item_id,
                original_item_description: originalItem.description,
                detailed_specification: data.detailed_specification,
                original_quantity: originalItem.quantity,
                approved_quantity: data.approved_quantity || originalItem.quantity,
                status: 'STOCK_DRAFT_PR_PENDING',
                priority_level: data.priority_level || 'NORMAL',
                estimated_total_price: data.estimated_total_price,
                suppliers_summary: {
                    total_added: suppliersAdded,
                    official_suppliers: officialSuppliersAdded,
                    suggested_suppliers: suggestedSuppliersAdded,
                    lowest_price: lowestPrice,
                    highest_price: highestPrice,
                    has_recommended: recommendedSupplierId !== null,
                    total_sent: data.suppliers ? data.suppliers.length : 0,
                    suppliers_skipped: suppliersSkipped
                },
                documents_summary: {
                    required_document_types: documentsAdded,
                    total_documents_sent: data.documents ? data.documents.length : 0,
                    required_documents: requiredDocuments,
                    note: documentsAdded > 0 ? "บันทึกความต้องการเอกสารเรียบร้อยแล้ว (รอการอัพโหลดไฟล์จริงในอนาคต)" : "ไม่ได้ระบุประเภทเอกสารที่ต้องการ"
                },
                next_steps: [
                    "รอหัวหน้าพัสดุอนุมัติร่าง PR",
                    "สามารถเพิ่มผู้จำหน่ายเพิ่มเติมได้ผ่าน API stockAddDraftPRSupplier",
                    documentsAdded > 0 ? "สามารถอัพโหลดไฟล์เอกสารจริงได้ทีหลัง (ระบบกำลังพัฒนา)" : "สามารถเพิ่มเอกสารได้ทีหลัง"
                ]
            };
        }, 'stockCreateDraftPR');

        res.status(201).json({
            success: true,
            message: `สร้างร่าง PR เรียบร้อยแล้ว (${result.draftPRId}) | จำนวนที่อนุมัติ: ${result.approved_quantity}/${result.original_quantity} | ผู้จำหน่าย: ${result.suppliers_summary.total_added} ราย | ความสำคัญ: ${result.priority_level}`,
            data: result,
            api_info: {
                created_draft_pr_id: result.draftPRId,
                current_status: "STOCK_DRAFT_PR_PENDING",
                next_approval: "หัวหน้าพัสดุ",
                can_add_more_suppliers: true,
                can_attach_documents: true
            }
        });

    } catch (error: any) {
        console.error('Error creating draft PR:', error);
        
        const businessLogicErrors = [
            'ไม่พบรายการสินค้าหรือไม่อยู่ในสถานะที่รับได้',
            'มีร่าง PR สำหรับรายการนี้อยู่แล้ว'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการสร้างร่าง PR',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// ปฏิเสธรายการโดยพนักงานพัสดุ
export const stockRejectItem = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== STOCK REJECT ITEM ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('========================');

        const schema = Joi.object({
            source_requisition_id: Joi.string().required(),
            source_item_sequence: Joi.number().integer().min(1).required(),
            source_item_id: Joi.number().integer().required(),
            reason: Joi.string().required(),
            rejected_by_user_id: Joi.string().max(15).required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const { source_requisition_id, source_item_sequence, source_item_id, reason, rejected_by_user_id } = value;
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบว่า item มีอยู่และอยู่ในสถานะที่ปฏิเสธได้
            const [itemCheck] = await connection.execute(
                `SELECT ri.*, r.current_status
                 FROM tbl_inv_requisition_items ri
                 JOIN tbl_inv_requisitions r ON ri.requisition_id = r.id
                 WHERE ri.item_id = ? AND ri.requisition_id = ? AND ri.item_sequence = ? 
                   AND ri.is_cancelled = 0 AND r.current_status = 'REQ_APPROVED_BY_HEAD'`,
                [source_item_id, source_requisition_id, source_item_sequence]
            );

            if (itemCheck.length === 0) {
                throw new Error('ไม่พบรายการสินค้าหรือไม่อยู่ในสถานะที่ปฏิเสธได้');
            }

            const originalItem = itemCheck[0];

            // อัพเดทสถานะ item ตาม workflow ที่ถูกต้อง (88: STOCK_PENDING_RECEIVE → STOCK_REJECTED_BY_STOCK → REQ_CANCELLED_BY_DEPT_HEAD)
            await connection.execute(
                `UPDATE tbl_inv_status_item_current 
                 SET current_status_code = 'REQ_CANCELLED_BY_DEPT_HEAD', current_status_since = NOW(), 
                     last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                 WHERE item_id = ?`,
                [`พัสดุปฏิเสธ: ${reason}`, rejected_by_user_id, source_item_id]
            );

            // Log event ตาม workflow ที่ถูกต้อง
            await connection.execute(
                `INSERT INTO tbl_inv_item_event_logs 
                 (item_id, event_type, new_status_code, event_description, 
                  ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                 VALUES (?, 'REJECT', 'REQ_CANCELLED_BY_DEPT_HEAD', ?, ?, ?, ?, ?, NOW())`,
                [
                    source_item_id, 
                    `แผนกพัสดุปฏิเสธรายการ: ${originalItem.description} เหตุผล: ${reason} (โดย ${rejected_by_user_id})`,
                    req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                    JSON.stringify({
                        action: 'stock_reject_item',
                        reason: reason,
                        item_sequence: source_item_sequence,
                        workflow: 'STOCK_PENDING_RECEIVE -> STOCK_REJECTED_BY_STOCK -> REQ_CANCELLED_BY_DEPT_HEAD',
                        created_by_user_id: rejected_by_user_id
                    }),
                    rejected_by_user_id
                ]
            );

            // บันทึกประวัติ
            await connection.execute(
                `INSERT INTO tbl_inv_status_logs 
                 (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                 VALUES (?, 'REQ_APPROVED_BY_HEAD', 'REQ_CANCELLED_BY_DEPT_HEAD', ?, ?, NOW())`,
                [
                    source_requisition_id,
                    `แผนกพัสดุปฏิเสธรายการลำดับ ${source_item_sequence} (${originalItem.description}): ${reason}`,
                    rejected_by_user_id
                ]
            );

            return {
                source_requisition_id,
                source_item_sequence,
                source_item_id,
                item_description: originalItem.description,
                status: 'REQ_CANCELLED_BY_DEPT_HEAD',
                reason: reason
            };
        }, 'stockRejectItem');

        res.json({
            success: true,
            message: 'ปฏิเสธรายการเรียบร้อยแล้ว จะส่งกลับไปยังหน่วยงานขอเบิก',
            data: result
        });

    } catch (error: any) {
        console.error('Error rejecting item:', error);
        
        const businessLogicErrors = [
            'ไม่พบรายการสินค้าหรือไม่อยู่ในสถานะที่ปฏิเสธได้'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการปฏิเสธรายการ',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// ดึงรายการ items ที่รอพัสดุดำเนินการ
export const stockGetPendingItems = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const db = ManagementDB.getInstance();
        const { page = 1, itemsPerPage = 20 } = req.query;
        const limit: number = parseInt(itemsPerPage as string);
        const offset: number = (parseInt(page as string) - 1) * limit;

        // ดึงรายการ items ที่รอพัสดุดำเนินการ
        const sqlItems = `
            SELECT ri.*, r.department_code, r.request_username, r.urgency, r.material_category,
                   d.DepartmentName,
                   sic.current_status_code, sic.current_status_since, sic.last_comment,
                   sm.status_name_th, sm.status_color
            FROM tbl_inv_requisition_items ri
            JOIN tbl_inv_requisitions r ON ri.requisition_id = r.id
            JOIN tbl_inv_status_item_current sic ON ri.item_id = sic.item_id
            LEFT JOIN tbl_inv_departments d ON r.department_code = d.DepartmentCode
            LEFT JOIN tbl_inv_status_master sm ON sic.current_status_code = sm.status_code
            WHERE r.current_status = 'REQ_APPROVED_BY_HEAD' 
              AND ri.is_cancelled = 0
              AND sic.current_status_code IN ('STOCK_PENDING_RECEIVE', 'STOCK_DRAFT_PR_PENDING')
            ORDER BY r.urgency DESC, ri.request_date ASC, ri.item_sequence ASC
            LIMIT ? OFFSET ?
        `;
        
        const items = await db.executeQuery(sqlItems, [limit, offset]);
        
        console.log('=== DEBUG stockGetPendingItems ===');
        console.log('Items query result type:', typeof items);
        console.log('Items is array?:', Array.isArray(items));
        console.log('Items length:', items?.length);
        console.log('First item sample:', items?.[0]);
        console.log('=====================================');
        
        // ตรวจสอบว่า items เป็น array และไม่ใช่ undefined
        if (!Array.isArray(items)) {
            console.warn('Items query returned non-array result:', items);
            res.json({
                success: true,
                data: { 
                    items: [],
                    pagination: {
                        page: parseInt(page as string),
                        itemsPerPage: limit,
                        total: 0
                    }
                }
            });
            return;
        }
        
        // ดูว่ามี draft-pr อยู่แล้วหรือไม่
        const itemsWithDraft = await Promise.all(
            items.map(async (item: any) => {
                try {
                    const draftCheckResult = await db.executeQuery(
                        `SELECT id, detailed_specification, current_status FROM tbl_inv_draft_pr 
                         WHERE source_requisition_id = ? AND source_item_sequence = ? AND is_cancelled = 0`,
                        [item.requisition_id, item.item_sequence]
                    );
                    
                    // ป้องกัน undefined และตรวจสอบว่าเป็น array
                    const draftCheck = Array.isArray(draftCheckResult) ? draftCheckResult : [];
                    
                    return {
                        ...item,
                        has_draft_pr: draftCheck.length > 0,
                        draft_pr: draftCheck.length > 0 ? draftCheck[0] : null
                    };
                } catch (draftError: any) {
                    console.warn(`Warning: Could not check draft-pr for item ${item.item_id}:`, draftError);
                    // ถ้าเกิด error ให้ fallback เป็นไม่มี draft-pr
                    return {
                        ...item,
                        has_draft_pr: false,
                        draft_pr: null,
                        draft_check_error: draftError.message
                    };
                }
            })
        );
        
        res.json({
            success: true,
            data: { 
                items: itemsWithDraft,
                pagination: {
                    page: parseInt(page as string),
                    itemsPerPage: limit,
                    total: items.length
                }
            }
        });

    } catch (error: any) {
        console.error('Error fetching pending items:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการที่รอดำเนินการ',
            error: error.message
        });
    }
}, 8000);

// ========================================
// ฟังก์ชันสำหรับหัวหน้าพัสดุ (STOCK_MANAGER)
// ========================================

// อนุมัติร่าง PR โดยหัวหน้าพัสดุ
export const stockManagerApproveDraftPR = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== STOCK MANAGER APPROVE DRAFT PR ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('=====================================');

        const draftPRId = req.params.draftPRId || req.query.draftPRId as string;
        
        const schema = Joi.object({
            comment: Joi.string().allow(null, ''),
            approved_by_user_id: Joi.string().max(15).required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const { comment = '', approved_by_user_id } = value;
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบสถานะ draft-pr
            const [draftPRCheck] = await connection.execute(
                `SELECT * FROM tbl_inv_draft_pr 
                 WHERE id = ? AND current_status = 'STOCK_DRAFT_PR_PENDING' AND is_cancelled = 0`,
                [draftPRId]
            );

            if (draftPRCheck.length === 0) {
                throw new Error('ไม่พบร่าง PR หรือไม่อยู่ในสถานะที่อนุมัติได้');
            }

            const draftPR = draftPRCheck[0];

            // อัพเดทสถานะและข้อมูลการอนุมัติ (ใช้ฟิลด์ที่มีจริง)
            await connection.execute(
                `UPDATE tbl_inv_draft_pr 
                 SET current_status = 'STOCK_DRAFT_PR_APPROVED',
                     updated_by_user_id = ?, date_updated = NOW()
                 WHERE id = ?`,
                [approved_by_user_id, draftPRId]
            );

            // อัพเดทสถานะ original item
            await connection.execute(
                `UPDATE tbl_inv_status_item_current 
                 SET current_status_code = 'PURCHASE_PENDING_RECEIVE', current_status_since = NOW(), 
                     last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                 WHERE item_id = ?`,
                [`หัวหน้าพัสดุอนุมัติร่าง PR และส่งไปจัดซื้อ: ${comment}`, approved_by_user_id, draftPR.source_item_id]
            );

            // Log event ตาม workflow ที่ถูกต้อง (93: STOCK_DRAFT_PR_APPROVED → PURCHASE_PENDING_RECEIVE)
            await connection.execute(
                `INSERT INTO tbl_inv_item_event_logs 
                 (item_id, event_type, new_status_code, event_description, 
                  ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                 VALUES (?, 'APPROVE', 'PURCHASE_PENDING_RECEIVE', ?, ?, ?, ?, ?, NOW())`,
                [
                    draftPR.source_item_id, 
                    `หัวหน้าพัสดุอนุมัติร่าง PR และส่งไปแผนกจัดซื้อ: ${draftPR.detailed_specification || 'รายการ ID ' + draftPR.source_item_id}${comment ? ` หมายเหตุ: ${comment}` : ''} (โดย ${approved_by_user_id})`,
                    req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                    JSON.stringify({
                        action: 'stock_manager_approve_draft_pr',
                        draft_pr_id: draftPRId,
                        forwarded_to: 'PURCHASE_DEPARTMENT',
                        estimated_total_price: draftPR.estimated_total_price,
                        comment: comment,
                        workflow: 'STOCK_DRAFT_PR_PENDING -> STOCK_DRAFT_PR_APPROVED -> PURCHASE_PENDING_RECEIVE',
                        created_by_user_id: approved_by_user_id
                    }),
                    approved_by_user_id
                ]
            );

            // บันทึกประวัติ
            await connection.execute(
                `INSERT INTO tbl_inv_status_logs 
                 (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                 VALUES (?, 'STOCK_DRAFT_PR_PENDING', 'PURCHASE_PENDING_RECEIVE', ?, ?, NOW())`,
                [
                    draftPR.source_requisition_id,
                    `หัวหน้าพัสดุอนุมัติร่าง PR และส่งไปแผนกจัดซื้อ: ${draftPR.detailed_specification || 'รายการ ID ' + draftPR.source_item_id} (${draftPRId})${comment ? ` | หมายเหตุ: ${comment}` : ''}`,
                    approved_by_user_id
                ]
            );

            return {
                draftPRId,
                detailed_specification: draftPR.detailed_specification,
                source_requisition_id: draftPR.source_requisition_id,
                source_item_sequence: draftPR.source_item_sequence,
                status: 'STOCK_DRAFT_PR_APPROVED',
                forwarded_to: 'PURCHASE_DEPARTMENT',
                approved_by: approved_by_user_id,
                approved_date: new Date(),
                estimated_total_price: draftPR.estimated_total_price
            };
        }, 'stockManagerApproveDraftPR');

        res.json({
            success: true,
            message: 'อนุมัติร่าง PR และส่งไปแผนกจัดซื้อเรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        console.error('Error approving draft PR:', error);
        
        const businessLogicErrors = [
            'ไม่พบร่าง PR หรือไม่อยู่ในสถานะที่อนุมัติได้'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการอนุมัติร่าง PR',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// ปฏิเสธร่าง PR โดยหัวหน้าพัสดุ
export const stockManagerRejectDraftPR = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== STOCK MANAGER REJECT DRAFT PR ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('====================================');

        const draftPRId = req.params.draftPRId || req.query.draftPRId as string;
        
        const schema = Joi.object({
            reason: Joi.string().required(),
            rejected_by_user_id: Joi.string().max(15).required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const { reason, rejected_by_user_id } = value;
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบสถานะ draft-pr
            const [draftPRCheck] = await connection.execute(
                `SELECT * FROM tbl_inv_draft_pr 
                 WHERE id = ? AND current_status = 'STOCK_DRAFT_PR_PENDING' AND is_cancelled = 0`,
                [draftPRId]
            );

            if (draftPRCheck.length === 0) {
                throw new Error('ไม่พบร่าง PR หรือไม่อยู่ในสถานะที่ปฏิเสธได้');
            }

            const draftPR = draftPRCheck[0];

            // อัพเดทสถานะการปฏิเสธ (ใช้ฟิลด์ที่มีจริง)
            await connection.execute(
                `UPDATE tbl_inv_draft_pr 
                 SET current_status = 'STOCK_REJECTED_BY_STOCK',
                     updated_by_user_id = ?, date_updated = NOW()
                 WHERE id = ?`,
                [rejected_by_user_id, draftPRId]
            );

            // อัพเดทสถานะ original item - หัวหน้าพัสดุปฏิเสธ = กลับไปให้พนักงานพัสดุแก้ไข
            await connection.execute(
                `UPDATE tbl_inv_status_item_current 
                 SET current_status_code = 'STOCK_REJECTED_BY_STOCK', current_status_since = NOW(), 
                     last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                 WHERE item_id = ?`,
                [`หัวหน้าพัสดุปฏิเสธร่าง PR: ${reason} (กลับไปพนักงานพัสดุแก้ไข)`, rejected_by_user_id, draftPR.source_item_id]
            );

            // Log event - หัวหน้าพัสดุปฏิเสธ = กลับไปพนักงานพัสดุ
            await connection.execute(
                `INSERT INTO tbl_inv_item_event_logs 
                 (item_id, event_type, new_status_code, event_description, 
                  ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                 VALUES (?, 'REJECT', 'STOCK_REJECTED_BY_STOCK', ?, ?, ?, ?, ?, NOW())`,
                [
                    draftPR.source_item_id, 
                    `หัวหน้าพัสดุปฏิเสธร่าง PR: ${draftPR.detailed_specification || 'รายการ ID ' + draftPR.source_item_id} เหตุผล: ${reason} กลับไปให้พนักงานพัสดุแก้ไข (โดย ${rejected_by_user_id})`,
                    req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                    JSON.stringify({
                        action: 'stock_manager_reject_draft_pr',
                        draft_pr_id: draftPRId,
                        rejection_reason: reason,
                        workflow: 'STOCK_DRAFT_PR_PENDING -> STOCK_REJECTED_BY_STOCK (กลับพนักงานพัสดุ)',
                        returned_to: 'STOCK_STAFF',
                        created_by_user_id: rejected_by_user_id
                    }),
                    rejected_by_user_id
                ]
            );

            // บันทึกประวัติ
            await connection.execute(
                `INSERT INTO tbl_inv_status_logs 
                 (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                 VALUES (?, 'STOCK_DRAFT_PR_PENDING', 'STOCK_REJECTED_BY_STOCK', ?, ?, NOW())`,
                [
                    draftPR.source_requisition_id,
                    `หัวหน้าพัสดุปฏิเสธร่าง PR และส่งกลับไปให้พนักงานพัสดุแก้ไข: ${draftPR.detailed_specification || 'รายการ ID ' + draftPR.source_item_id} (${draftPRId}) | เหตุผล: ${reason}`,
                    rejected_by_user_id
                ]
            );

            return {
                draftPRId,
                detailed_specification: draftPR.detailed_specification,
                source_requisition_id: draftPR.source_requisition_id,
                source_item_sequence: draftPR.source_item_sequence,
                status: 'STOCK_REJECTED_BY_STOCK',
                returned_to: 'STOCK_STAFF',
                rejected_by: rejected_by_user_id,
                rejected_date: new Date(),
                rejection_reason: reason
            };
        }, 'stockManagerRejectDraftPR');

        res.json({
            success: true,
            message: 'ปฏิเสธร่าง PR และส่งกลับไปยังหน่วยงานเรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        console.error('Error rejecting draft PR:', error);
        
        const businessLogicErrors = [
            'ไม่พบร่าง PR หรือไม่อยู่ในสถานะที่ปฏิเสธได้'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการปฏิเสธร่าง PR',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// ขอข้อมูลเพิ่มเติมสำหรับร่าง PR โดยหัวหน้าพัสดุ
export const stockManagerRequestMoreInfo = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== STOCK MANAGER REQUEST MORE INFO ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('======================================');

        const draftPRId = req.params.draftPRId || req.query.draftPRId as string;
        
        const schema = Joi.object({
            requested_info: Joi.string().required(),
            requested_by_user_id: Joi.string().max(15).required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const { requested_info, requested_by_user_id } = value;
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบสถานะ draft-pr
            const [draftPRCheck] = await connection.execute(
                `SELECT * FROM tbl_inv_draft_pr 
                 WHERE id = ? AND current_status = 'STOCK_DRAFT_PR_PENDING' AND is_cancelled = 0`,
                [draftPRId]
            );

            if (draftPRCheck.length === 0) {
                throw new Error('ไม่พบร่าง PR หรือไม่อยู่ในสถานะที่ขอข้อมูลเพิ่มได้');
            }

            const draftPR = draftPRCheck[0];

            // อัพเดทสถานะขอข้อมูลเพิ่ม (ใช้ฟิลด์ที่มีจริง)
            await connection.execute(
                `UPDATE tbl_inv_draft_pr 
                 SET current_status = 'STOCK_REQUEST_INFO',
                     updated_by_user_id = ?, date_updated = NOW()
                 WHERE id = ?`,
                [requested_by_user_id, draftPRId]
            );

            // อัพเดทสถานะ original item - หัวหน้าพัสดุขอข้อมูลเพิ่ม = กลับไปให้พนักงานพัสดุแก้ไข
            await connection.execute(
                `UPDATE tbl_inv_status_item_current 
                 SET current_status_code = 'STOCK_REQUEST_INFO', current_status_since = NOW(), 
                     last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                 WHERE item_id = ?`,
                [`หัวหน้าพัสดุขอข้อมูลเพิ่มเติม: ${requested_info} (กลับไปพนักงานพัสดุ)`, requested_by_user_id, draftPR.source_item_id]
            );

            // Log event - หัวหน้าพัสดุขอข้อมูลเพิ่ม = กลับไปพนักงานพัสดุ
            await connection.execute(
                `INSERT INTO tbl_inv_item_event_logs 
                 (item_id, event_type, new_status_code, event_description, 
                  ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                 VALUES (?, 'REQUEST_INFO', 'STOCK_REQUEST_INFO', ?, ?, ?, ?, ?, NOW())`,
                [
                    draftPR.source_item_id, 
                    `หัวหน้าพัสดุขอข้อมูลเพิ่มเติมสำหรับร่าง PR: ${draftPR.detailed_specification || 'รายการ ID ' + draftPR.source_item_id} ข้อมูลที่ต้องการ: ${requested_info} กลับไปให้พนักงานพัสดุ (โดย ${requested_by_user_id})`,
                    req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                    JSON.stringify({
                        action: 'stock_manager_request_more_info',
                        draft_pr_id: draftPRId,
                        requested_info: requested_info,
                        workflow: 'STOCK_DRAFT_PR_PENDING -> STOCK_REQUEST_INFO (กลับพนักงานพัสดุ)',
                        returned_to: 'STOCK_STAFF',
                        created_by_user_id: requested_by_user_id
                    }),
                    requested_by_user_id
                ]
            );

            // บันทึกประวัติ
            await connection.execute(
                `INSERT INTO tbl_inv_status_logs 
                 (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                 VALUES (?, 'STOCK_DRAFT_PR_PENDING', 'STOCK_REQUEST_INFO', ?, ?, NOW())`,
                [
                    draftPR.source_requisition_id,
                    `หัวหน้าพัสดุขอข้อมูลเพิ่มเติมสำหรับร่าง PR และส่งกลับไปให้พนักงานพัสดุ: ${draftPR.detailed_specification || 'รายการ ID ' + draftPR.source_item_id} (${draftPRId}) | ข้อมูลที่ต้องการ: ${requested_info}`,
                    requested_by_user_id
                ]
            );

            return {
                draftPRId,
                detailed_specification: draftPR.detailed_specification,
                source_requisition_id: draftPR.source_requisition_id,
                source_item_sequence: draftPR.source_item_sequence,
                status: 'STOCK_REQUEST_INFO',
                requested_by: requested_by_user_id,
                requested_date: new Date(),
                requested_info: requested_info,
                next_action: 'รอพนักงานพัสดุเพิ่มข้อมูลหรือแก้ไขร่าง PR'
            };
        }, 'stockManagerRequestMoreInfo');

        res.json({
            success: true,
            message: 'ขอข้อมูลเพิ่มเติมสำหรับร่าง PR เรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        console.error('Error requesting more info for draft PR:', error);
        
        const businessLogicErrors = [
            'ไม่พบร่าง PR หรือไม่อยู่ในสถานะที่ขอข้อมูลเพิ่มได้'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการขอข้อมูลเพิ่มเติม',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// ดึงรายการ draft-pr ที่รอหัวหน้าพัสดุอนุมัติ
export const stockManagerGetPendingDraftPRs = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const db = ManagementDB.getInstance();
        const { page = 1, itemsPerPage = 20 } = req.query;
        const limit: number = parseInt(itemsPerPage as string);
        const offset: number = (parseInt(page as string) - 1) * limit;

        const sqlDrafts = `
            SELECT dp.*, 
                   r.department_code, r.request_username, r.urgency, r.material_category,
                   d.DepartmentName,
                   sm.status_name_th, sm.status_color
            FROM tbl_inv_draft_pr dp
            JOIN tbl_inv_requisitions r ON dp.source_requisition_id = r.id
            LEFT JOIN tbl_inv_departments d ON r.department_code = d.DepartmentCode
            LEFT JOIN tbl_inv_status_master sm ON dp.current_status = sm.status_code
            WHERE dp.current_status = 'STOCK_DRAFT_PR_PENDING' AND dp.is_cancelled = 0
            ORDER BY dp.date_created ASC
            LIMIT ? OFFSET ?
        `;
        
        const drafts = await db.executeQuery(sqlDrafts, [limit, offset]);
        
        console.log('=== DEBUG stockManagerGetPendingDraftPRs ===');
        console.log('Drafts query result type:', typeof drafts);
        console.log('Drafts is array?:', Array.isArray(drafts));
        console.log('Drafts length:', drafts?.length);
        console.log('First draft sample:', drafts?.[0]);
        console.log('===========================================');
        
        // เพิ่มข้อมูลผู้จำหน่ายสำหรับแต่ละ draft-pr
        const draftsWithSuppliers = await Promise.all(
            (Array.isArray(drafts) ? drafts : []).map(async (draft: any) => {
                try {
                    // ดึงผู้จำหน่าย Official
                    const officialSuppliers = await db.executeQuery(
                        `SELECT os.*, s.supplier_name, s.supplier_code 
                         FROM tbl_inv_draft_pr_official_suppliers os
                         JOIN tbl_inv_suppliers s ON os.supplier_id = s.id
                         WHERE os.draft_pr_id = ? AND os.is_removed = 0
                         ORDER BY os.is_recommended DESC, os.supplier_rank ASC`,
                        [draft.id]
                    );
                    
                    // ดึงผู้จำหน่าย Suggested
                    const suggestedSuppliers = await db.executeQuery(
                        `SELECT * FROM tbl_inv_draft_pr_suggested_suppliers 
                         WHERE draft_pr_id = ? AND is_removed = 0
                         ORDER BY is_recommended DESC, supplier_rank ASC`,
                        [draft.id]
                    );
                    
                    return {
                        ...draft,
                        suppliers_summary: {
                            total_official: Array.isArray(officialSuppliers) ? officialSuppliers.length : 0,
                            total_suggested: Array.isArray(suggestedSuppliers) ? suggestedSuppliers.length : 0,
                            total_suppliers: (Array.isArray(officialSuppliers) ? officialSuppliers.length : 0) + 
                                          (Array.isArray(suggestedSuppliers) ? suggestedSuppliers.length : 0),
                            has_recommended: [...(Array.isArray(officialSuppliers) ? officialSuppliers : []), 
                                            ...(Array.isArray(suggestedSuppliers) ? suggestedSuppliers : [])]
                                           .some((s: any) => s.is_recommended),
                            official_suppliers: Array.isArray(officialSuppliers) ? officialSuppliers : [],
                            suggested_suppliers: Array.isArray(suggestedSuppliers) ? suggestedSuppliers : []
                        }
                    };
                } catch (supplierError: any) {
                    console.warn(`Warning: Could not fetch suppliers for draft-pr ${draft.id}:`, supplierError);
                    return {
                        ...draft,
                        suppliers_summary: {
                            total_official: 0,
                            total_suggested: 0,
                            total_suppliers: 0,
                            has_recommended: false,
                            official_suppliers: [],
                            suggested_suppliers: [],
                            supplier_fetch_error: supplierError.message
                        }
                    };
                }
            })
        );
        
        res.json({
            success: true,
            data: { 
                draft_prs: draftsWithSuppliers,
                pagination: {
                    page: parseInt(page as string),
                    itemsPerPage: limit,
                    total: draftsWithSuppliers.length
                }
            }
        });

    } catch (error: any) {
        console.error('Error fetching pending draft PRs:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลร่าง PR',
            error: error.message
        });
    }
}, 8000);

// ============================================
// ฟังก์ชันจัดการผู้จำหน่ายใน Draft-PR
// ============================================

// เพิ่มผู้จำหน่ายใน draft-pr
export const stockAddDraftPRSupplier = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const { draftPrId } = req.params;
        
        const schema = Joi.object({
            supplier_id: Joi.number().integer().required(),
            quoted_unit_price: Joi.number().min(0).optional(),
            quoted_total_price: Joi.number().min(0).optional(),
            quotation_ref: Joi.string().max(100).allow(null, ''),
            quotation_date: Joi.date().iso().optional(),
            delivery_lead_time: Joi.number().integer().min(0).optional(),
            payment_terms: Joi.string().max(100).allow(null, ''),
            warranty_period: Joi.string().max(100).allow(null, ''),
            supplier_notes: Joi.string().allow(null, ''),
            evaluation_score: Joi.number().min(0).max(10).optional(),
            evaluation_criteria: Joi.object().optional(),
            is_recommended: Joi.boolean().default(false),
            recommendation_reason: Joi.string().allow(null, ''),
            supplier_rank: Joi.number().integer().min(1).optional(),
            quote_status: Joi.string().valid('PENDING','RECEIVED','EXPIRED','REJECTED').default('PENDING'),
            quote_valid_until: Joi.date().iso().optional(),
            contact_person: Joi.string().max(100).allow(null, ''),
            contact_phone: Joi.string().max(20).allow(null, ''),
            contact_email: Joi.string().email().max(100).allow(null, ''),
            added_by_user_id: Joi.string().max(15).required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบว่า draft-pr มีอยู่จริง
            const [draftPrCheck] = await connection.execute(
                `SELECT id, current_status FROM tbl_inv_draft_pr WHERE id = ?`,
                [draftPrId]
            );
            
            if (draftPrCheck.length === 0) {
                throw new Error('ไม่พบร่าง PR ดังกล่าว');
            }

            // ตรวจสอบว่า supplier มีอยู่จริง
            const [supplierCheck] = await connection.execute(
                `SELECT id, supplier_name FROM tbl_inv_suppliers WHERE id = ? AND is_active = 1`,
                [value.supplier_id]
            );
            
            if (supplierCheck.length === 0) {
                throw new Error('ไม่พบผู้จำหน่ายหรือผู้จำหน่ายไม่ได้ใช้งาน');
            }

            // ตรวจสอบว่าผู้จำหน่ายนี้เพิ่มเข้า draft-pr นี้แล้วหรือยัง
            const [existingSupplier] = await connection.execute(
                `SELECT id FROM tbl_inv_draft_pr_official_suppliers 
                 WHERE draft_pr_id = ? AND supplier_id = ? AND is_removed = 0`,
                [draftPrId, value.supplier_id]
            );
            
            if (existingSupplier.length > 0) {
                throw new Error(`ผู้จำหน่าย "${supplierCheck[0].supplier_name}" ถูกเพิ่มเข้าร่าง PR นี้แล้ว`);
            }

            // เพิ่มผู้จำหน่าย
            const insertParams = [
                draftPrId,
                value.supplier_id,
                value.quoted_unit_price || null,
                value.quoted_total_price || null,
                value.quotation_ref || null,
                value.quotation_date || null,
                value.delivery_lead_time || null,
                value.payment_terms || null,
                value.warranty_period || null,
                value.supplier_notes || null,
                value.is_recommended || false,
                value.recommendation_reason || null,
                value.supplier_rank || null,
                value.quote_status || 'PENDING',
                value.quote_valid_until || null,
                value.contact_person || null,
                value.contact_phone || null,
                value.contact_email || null,
                value.added_by_user_id
            ];

            const [insertResult] = await connection.execute(
                `INSERT INTO tbl_inv_draft_pr_official_suppliers 
                 (draft_pr_id, supplier_id, quoted_unit_price, quoted_total_price, quotation_ref, quotation_date,
                  delivery_lead_time, payment_terms, warranty_period, supplier_notes, 
                  is_recommended, recommendation_reason, supplier_rank, quote_status,
                  quote_valid_until, contact_person, contact_phone, contact_email, 
                  created_by_user_id, date_created) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                insertParams
            );

            const supplierId = insertResult.insertId;

            return {
                supplier_entry_id: supplierId,
                draft_pr_id: draftPrId,
                supplier_name: supplierCheck[0].supplier_name,
                is_recommended: value.is_recommended,
                quoted_total_price: value.quoted_total_price
            };
        }, 'stockAddDraftPRSupplier');

        res.json({
            success: true,
            message: 'เพิ่มผู้จำหน่ายในร่าง PR เรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        const businessLogicErrors = [
            'ไม่พบร่าง PR ดังกล่าว',
            'ไม่พบผู้จำหน่าย',
            'ถูกเพิ่มเข้าร่าง PR นี้แล้ว'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            console.error('Error adding supplier to draft-PR:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มผู้จำหน่าย',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// อัพเดทข้อมูลผู้จำหน่ายใน draft-pr
export const stockUpdateDraftPRSupplier = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const { draftPrId, supplierEntryId } = req.params;
        
        const schema = Joi.object({
            quoted_unit_price: Joi.number().min(0).optional(),
            quoted_total_price: Joi.number().min(0).optional(),
            quotation_ref: Joi.string().max(100).allow(null, ''),
            quotation_date: Joi.date().iso().optional(),
            delivery_lead_time: Joi.number().integer().min(0).optional(),
            payment_terms: Joi.string().max(100).allow(null, ''),
            warranty_period: Joi.string().max(100).allow(null, ''),
            supplier_notes: Joi.string().allow(null, ''),
            evaluation_score: Joi.number().min(0).max(10).optional(),
            evaluation_criteria: Joi.object().optional(),
            is_recommended: Joi.boolean().optional(),
            recommendation_reason: Joi.string().allow(null, ''),
            supplier_rank: Joi.number().integer().min(1).optional(),
            quote_status: Joi.string().valid('PENDING','RECEIVED','EXPIRED','REJECTED').optional(),
            quote_valid_until: Joi.date().iso().optional(),
            contact_person: Joi.string().max(100).allow(null, ''),
            contact_phone: Joi.string().max(20).allow(null, ''),
            contact_email: Joi.string().email().max(100).allow(null, ''),
            updated_by_user_id: Joi.string().max(15).required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ดึงข้อมูลเดิม
            const [oldData] = await connection.execute(
                `SELECT dps.*, s.supplier_name 
                 FROM tbl_inv_draft_pr_suppliers dps
                 JOIN tbl_inv_suppliers s ON dps.supplier_id = s.id
                 WHERE dps.id = ? AND dps.draft_pr_id = ? AND dps.is_removed = 0`,
                [supplierEntryId, draftPrId]
            );
            
            if (oldData.length === 0) {
                throw new Error('ไม่พบรายการผู้จำหน่ายในร่าง PR นี้');
            }

            const oldRecord = oldData[0];

            // สร้าง update query
            const updateFields: string[] = [];
            const updateValues: any[] = [];
            const changes: string[] = [];

            Object.entries(value).forEach(([key, val]) => {
                if (key !== 'updated_by_user_id' && val !== undefined) {
                    // แปลง evaluation_criteria เป็น JSON string
                    if (key === 'evaluation_criteria' && val) {
                        val = JSON.stringify(val);
                    }
                    
                    updateFields.push(`${key} = ?`);
                    updateValues.push(val);
                    
                    // ตรวจสอบการเปลี่ยนแปลง
                    let oldVal = oldRecord[key];
                    if (key === 'evaluation_criteria' && oldVal) {
                        try {
                            oldVal = JSON.parse(oldVal);
                        } catch(e) {}
                    }
                    
                    if (oldVal !== val) {
                        changes.push(`${key}: ${oldVal} → ${val}`);
                    }
                }
            });

            if (updateFields.length === 0) {
                throw new Error('ไม่มีข้อมูลที่ต้องการอัพเดท');
            }

            // เพิ่ม updated_by_user_id และ date_updated
            updateFields.push('updated_by_user_id = ?', 'date_updated = NOW()');
            updateValues.push(value.updated_by_user_id, supplierEntryId);

            // อัพเดทข้อมูล
            await connection.execute(
                `UPDATE tbl_inv_draft_pr_suppliers 
                 SET ${updateFields.join(', ')} 
                 WHERE id = ?`,
                updateValues
            );

            // บันทึก log
            if (changes.length > 0) {
                await connection.execute(
                    `INSERT INTO tbl_inv_draft_pr_supplier_logs 
                     (draft_pr_id, supplier_id, action_type, old_data, new_data, changed_by_user_id, change_reason, date_changed) 
                     VALUES (?, ?, 'UPDATE', ?, ?, ?, ?, NOW())`,
                    [
                        draftPrId,
                        oldRecord.supplier_id,
                        JSON.stringify(oldRecord),
                        JSON.stringify(value),
                        value.updated_by_user_id,
                        `แก้ไขข้อมูลผู้จำหน่าย: ${changes.join(', ')}`
                    ]
                );
            }

            return {
                supplier_entry_id: supplierEntryId,
                draft_pr_id: draftPrId,
                supplier_name: oldRecord.supplier_name,
                changes: changes,
                updated_fields: updateFields.length - 2 // ลบ updated_by และ date_updated
            };
        }, 'stockUpdateDraftPRSupplier');

        res.json({
            success: true,
            message: 'อัพเดทข้อมูลผู้จำหน่ายเรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        const businessLogicErrors = [
            'ไม่พบร่าง PR ดังกล่าว'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            console.error('Error updating supplier in draft-PR:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูลผู้จำหน่าย',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// ลบผู้จำหน่ายออกจาก draft-pr
export const stockRemoveDraftPRSupplier = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const { draftPrId, supplierEntryId } = req.params;
        
        const schema = Joi.object({
            remove_reason: Joi.string().required(),
            removed_by_user_id: Joi.string().max(15).required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบข้อมูลเดิม
            const [oldData] = await connection.execute(
                `SELECT dps.*, s.supplier_name 
                 FROM tbl_inv_draft_pr_suppliers dps
                 JOIN tbl_inv_suppliers s ON dps.supplier_id = s.id
                 WHERE dps.id = ? AND dps.draft_pr_id = ? AND dps.is_removed = 0`,
                [supplierEntryId, draftPrId]
            );
            
            if (oldData.length === 0) {
                throw new Error('ไม่พบรายการผู้จำหน่ายในร่าง PR นี้');
            }

            const oldRecord = oldData[0];

            // ตรวจสอบว่าต้องมีผู้จำหน่ายอย่างน้อย 1 เจ้า
            const [supplierCount] = await connection.execute(
                `SELECT COUNT(*) as active_count FROM tbl_inv_draft_pr_suppliers 
                 WHERE draft_pr_id = ? AND is_removed = 0`,
                [draftPrId]
            );

            if (supplierCount[0].active_count <= 1) {
                throw new Error('ไม่สามารถลบได้ เนื่องจากต้องมีผู้จำหน่ายอย่างน้อย 1 เจ้า');
            }

            // ทำการลบ (soft delete)
            await connection.execute(
                `UPDATE tbl_inv_draft_pr_suppliers 
                 SET is_removed = 1, removed_by_user_id = ?, date_removed = NOW(), remove_reason = ?
                 WHERE id = ?`,
                [value.removed_by_user_id, value.remove_reason, supplierEntryId]
            );

            // บันทึก log
            await connection.execute(
                `INSERT INTO tbl_inv_draft_pr_supplier_logs 
                 (draft_pr_id, supplier_id, action_type, old_data, changed_by_user_id, change_reason, date_changed) 
                 VALUES (?, ?, 'REMOVE', ?, ?, ?, NOW())`,
                [
                    draftPrId,
                    oldRecord.supplier_id,
                    JSON.stringify(oldRecord),
                    value.removed_by_user_id,
                    `ลบผู้จำหน่าย: ${value.remove_reason}`
                ]
            );

            return {
                supplier_entry_id: supplierEntryId,
                draft_pr_id: draftPrId,
                supplier_name: oldRecord.supplier_name,
                remove_reason: value.remove_reason
            };
        }, 'stockRemoveDraftPRSupplier');

        res.json({
            success: true,
            message: 'ลบผู้จำหน่ายออกจากร่าง PR เรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        const businessLogicErrors = [
            'ไม่พบรายการผู้จำหน่ายในร่าง PR นี้',
            'ต้องมีผู้จำหน่ายอย่างน้อย 1 เจ้า'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            console.error('Error removing supplier from draft-PR:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบผู้จำหน่าย',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// ดูรายการผู้จำหน่ายทั้งหมดใน draft-pr
export const stockGetDraftPRSuppliers = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const { draftPrId } = req.params;
        
        const db = ManagementDB.getInstance();

        // เรียกใช้ stored procedure แทนการ query ปกติ
        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบว่า draft-pr มีอยู่จริง
            const [draftPrCheck] = await connection.execute(
                `SELECT id FROM tbl_inv_draft_pr WHERE id = ?`,
                [draftPrId]
            );
            
            if (draftPrCheck.length === 0) {
                throw new Error('ไม่พบร่าง PR ดังกล่าว');
            }

            // เรียกใช้ stored procedure
            const [procedureResults] = await connection.execute(
                `CALL GetDraftPRSuppliersWithSummary(?)`,
                [draftPrId]
            );

            // stored procedure จะคืนค่า 2 result sets
            const draftPRInfo = procedureResults[0] ? procedureResults[0][0] : null;
            const suppliers = procedureResults[1] || [];

            // แปลง evaluation_criteria JSON
            const processedSuppliers = suppliers.map((supplier: any) => {
                let evaluationCriteria = null;
                if (supplier.evaluation_criteria) {
                    try {
                        evaluationCriteria = JSON.parse(supplier.evaluation_criteria);
                    } catch (e) {
                        evaluationCriteria = supplier.evaluation_criteria;
                    }
                }

                return {
                    ...supplier,
                    evaluation_criteria: evaluationCriteria
                };
            });

            return {
                draft_pr: draftPRInfo,
                suppliers: processedSuppliers,
                total_suppliers: processedSuppliers.length,
                recommended_suppliers: processedSuppliers.filter((s: any) => s.is_recommended).length,
                quotes_received: processedSuppliers.filter((s: any) => s.quote_status === 'RECEIVED').length
            };
        }, 'stockGetDraftPRSuppliers');

        res.json({
            success: true,
            message: 'ดึงข้อมูลผู้จำหน่ายเรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        const businessLogicErrors = [
            'ไม่พบร่าง PR ดังกล่าว'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            console.error('Error fetching suppliers for draft-PR:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้จำหน่าย',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// ============================================
// ฟังก์ชันใหม่สำหรับใช้ Stored Procedures
// ============================================

// เปรียบเทียบราคาผู้จำหน่าย
export const stockCompareDraftPRPrices = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const { draftPrId } = req.params;
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบว่า draft-pr มีอยู่จริง
            const [draftPrCheck] = await connection.execute(
                `SELECT id, detailed_specification FROM tbl_inv_draft_pr WHERE id = ?`,
                [draftPrId]
            );
            
            if (draftPrCheck.length === 0) {
                throw new Error('ไม่พบร่าง PR ดังกล่าว');
            }

            // เรียกใช้ stored procedure สำหรับเปรียบเทียบราคา
            const [priceComparison] = await connection.execute(
                `CALL CompareDraftPRSupplierPrices(?)`,
                [draftPrId]
            );

            return {
                draft_pr: draftPrCheck[0],
                price_comparison: priceComparison[0] || [],
                summary: {
                    total_suppliers: (priceComparison[0] || []).length,
                    has_prices: (priceComparison[0] || []).filter((s: any) => s.quoted_total_price).length,
                    has_scores: (priceComparison[0] || []).filter((s: any) => s.total_score).length
                }
            };
        }, 'stockCompareDraftPRPrices');

        res.json({
            success: true,
            message: 'เปรียบเทียบราคาเรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        const businessLogicErrors = [
            'ไม่พบร่าง PR ดังกล่าว'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            console.error('Error comparing supplier prices:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเปรียบเทียบราคา',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// แนะนำผู้จำหน่ายที่ดีที่สุด
export const stockRecommendBestSupplier = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const { draftPrId } = req.params;
        
        const schema = Joi.object({
            criteria: Joi.string().valid('PRICE', 'QUALITY', 'SPEED', 'BALANCED').default('BALANCED'),
            recommended_by_user_id: Joi.string().max(15).required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const { criteria, recommended_by_user_id } = value;
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบว่า draft-pr มีอยู่จริง
            const [draftPrCheck] = await connection.execute(
                `SELECT id, detailed_specification FROM tbl_inv_draft_pr WHERE id = ?`,
                [draftPrId]
            );
            
            if (draftPrCheck.length === 0) {
                throw new Error('ไม่พบร่าง PR ดังกล่าว');
            }

            // เรียกใช้ stored procedure สำหรับแนะนำผู้จำหน่าย
            const [recommendationResult] = await connection.execute(
                `CALL RecommendBestSupplier(?, ?)`,
                [draftPrId, criteria]
            );

            const recommendation = recommendationResult[0] ? recommendationResult[0][0] : null;

            // อัพเดท user ที่ทำการแนะนำ (เนื่องจาก stored procedure ใช้ 'SYSTEM')
            if (recommendation && recommendation.recommended_supplier_id) {
                await connection.execute(
                    `UPDATE tbl_inv_draft_pr_suppliers 
                     SET updated_by_user_id = ?, 
                         recommendation_reason = CONCAT(recommendation_reason, ' โดย: ', ?)
                     WHERE draft_pr_id = ? AND supplier_id = ? AND is_recommended = 1`,
                    [recommended_by_user_id, recommended_by_user_id, draftPrId, recommendation.recommended_supplier_id]
                );
            }

            return {
                draft_pr: draftPrCheck[0],
                recommendation: recommendation,
                criteria_used: criteria,
                recommended_by: recommended_by_user_id
            };
        }, 'stockRecommendBestSupplier');

        res.json({
            success: true,
            message: 'ระบบแนะนำผู้จำหน่ายเรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        const businessLogicErrors = [
            'ไม่พบร่าง PR ดังกล่าว'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            console.error('Error recommending best supplier:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการแนะนำผู้จำหน่าย',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// อัพเดทข้อมูลสรุปผู้จำหน่ายแบบ Manual
export const stockUpdateDraftPRSummary = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const { draftPrId } = req.params;
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบว่า draft-pr มีอยู่จริง
            const [draftPrCheck] = await connection.execute(
                `SELECT id, detailed_specification FROM tbl_inv_draft_pr WHERE id = ?`,
                [draftPrId]
            );
            
            if (draftPrCheck.length === 0) {
                throw new Error('ไม่พบร่าง PR ดังกล่าว');
            }

            // เรียกใช้ stored procedure สำหรับอัพเดทข้อมูลสรุป
            await connection.execute(
                `CALL UpdateDraftPRSupplierSummary(?)`,
                [draftPrId]
            );

            // ดึงข้อมูลหลังการอัพเดท
            const [updatedData] = await connection.execute(
                `SELECT total_suppliers_count, recommended_supplier_id, lowest_quoted_price, highest_quoted_price,
                        s.supplier_name as recommended_supplier_name
                 FROM tbl_inv_draft_pr dp
                 LEFT JOIN tbl_inv_suppliers s ON dp.recommended_supplier_id = s.id
                 WHERE dp.id = ?`,
                [draftPrId]
            );

            return {
                draft_pr: draftPrCheck[0],
                summary: updatedData[0] || {},
                message: 'อัพเดทข้อมูลสรุปเรียบร้อยแล้ว'
            };
        }, 'stockUpdateDraftPRSummary');

        res.json({
            success: true,
            message: 'อัพเดทข้อมูลสรุปผู้จำหน่ายเรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        const businessLogicErrors = [
            'ไม่พบร่าง PR ดังกล่าว'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            console.error('Error updating draft-PR summary:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูลสรุป',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000); 