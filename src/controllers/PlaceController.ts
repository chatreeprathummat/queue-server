import { Request, Response } from 'express';

/*
 * State Transition Rules Summary:
 * - อนุมัติ/ปฏิเสธ: PENDING_APPROVAL, REQUEST_INFO
 * - ขอข้อมูลเพิ่ม: PENDING_APPROVAL, REQUEST_INFO  
 * - แก้ไข: CANCELLED_BY_HEAD, REQUEST_INFO
 * - ยกเลิก: PENDING_APPROVAL, CANCELLED_BY_HEAD, REQUEST_INFO
 */

// Import with require for modules without type declarations
const ManagementDB = require('../services/ManagementDB').default as any;
const { logger } = require('../services/logging') as any;
const DocumentUtils = require('../services/documentUtils') as any;
const { wrapController } = require("../services/logging/controllers/requestLogger") as any; 
const Joi = require('joi') as any;
const moment = require('moment') as any;

// Helper function to convert undefined to null for MySQL
const sanitizeForMySQL = (value: any): any => {
    return value === undefined ? null : value;
};

// Helper function to sanitize item data
const sanitizeItemData = (item: any) => {
    // แปลง request_date (YYYY-MM-DD) เป็น datetime
    let requestDate = null;
    if (item.request_date && typeof item.request_date === 'string') {
        // ตรวจสอบรูปแบบ YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(item.request_date)) {
            // แปลงเป็น datetime โดยใส่เวลาปัจจุบันของ server
            const currentTime = moment().format('HH:mm:ss');
            requestDate = `${item.request_date} ${currentTime}`;
            console.log(`[Date Conversion] ${item.request_date} -> ${requestDate}`);
        }
    }
    
    return {
        ...item,
        item_code: sanitizeForMySQL(item.item_code), // รหัสสินค้า (ไม่บังคับ)
        hn: sanitizeForMySQL(item.hn),
        patient_name: sanitizeForMySQL(item.patient_name),
        note: sanitizeForMySQL(item.note),
        request_date: requestDate || sanitizeForMySQL(item.request_date),
        item_type: item.item_type || 'เพื่อใช้'
    };
};

// Interface definitions
interface RequisitionItem {
    item_sequence: number; // ลำดับของรายการที่ frontend ส่งมาหรือรับมา
    item_code?: string; // รหัสสินค้า (ไม่บังคับ)
    description: string;
    item_type?: string;
    hn?: string;
    patient_name?: string;
    unit: string;
    quantity: number;
    price: number;
    note?: string;
    request_date?: string;
}

interface RequisitionDocument {
    document_type_id: number;
    other_document_name?: string;
    is_required?: boolean;
}

interface CreateRequisitionRequest {
    departmentCode: string;
    materialCategory: string;
    urgency?: string;
    reason?: string;
    items: RequisitionItem[];
    documents?: RequisitionDocument[];
}

interface RequestItem {
    itemId: string;
    description: string;
    unit: string;
    quantity: number;
    price: number;
    note?: string;
    type?: string;
    hn?: string;
    patientName?: string;
    requestDate?: string;
}

interface RequestImage {
    fileName?: string;
    path?: string;
    type?: string;
    size?: number;
    originalname?: string;
}

interface CreateRequestWithItemsRequest {
    date: string;
    department: string;
    requesterName: string;
    category: string;
    items: RequestItem[];
    images?: RequestImage[];
    priority?: string;
    purpose?: string;
    notes?: string;
    username?: string;
}

interface UpdateStatusRequest {
    stageCode: string;
    notes?: string;
    userID?: number;
    username?: string;
    isSelected?: boolean;
}

interface UpdateSelectionRequest {
    items: Array<{
        itemID: number;
        isSelected: boolean;
    }>;
}

interface UploadAttachmentRequest {
    requestID: string;
    itemID?: string;
    documentType?: string;
    description?: string;
    username?: string;
}

// Extend Express Request interface
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                username: string;
                current_place: string;
            };
            file?: any;
            files?: any[];
        }
    }
}

// ฟังก์ชั่นดึงรายการหมวดหมู่สินค้า
export const getItemCategories = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {     
        const db = ManagementDB.getInstance();      
        try {
                             
            // ดึงข้อมูลหมวดหมู่สินค้า
            const result = await db.executeQuery(`
                SELECT *
                FROM tbl_inv_categories
                ORDER BY display_order
            `);
                   
            // แปลงผลลัพธ์ให้เป็น array
            let itemCategories = result;
            if (!Array.isArray(result)) {
                // ถ้าเป็น object เดียว ให้แปลงเป็น array
                itemCategories = [result];
            }                           
            const itemCategoriesArray = itemCategories.map((itemCategory: any) => {
                return {
                    category_id: itemCategory.id,
                    category_code: itemCategory.category_code,
                    category_name: itemCategory.category_name
                }
            });       
            res.status(200).json({
                success: true,
                message: 'ดึงข้อมูลหมวดหมู่สินค้าเรียบร้อยแล้ว',
                data: itemCategoriesArray
            });           
        } catch (error: any) {
            console.error('Error getting item categories:', error);
            
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลหมวดหมู่สินค้า',
                error: error.message
            });
        }
                   
    } catch (error: any) {
        console.error('Error getting item categories:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลหมวดหมู่สินค้า',
            error: error.message
        });
    }
}, 10000);

// ดึงข้อมูลเอกสารแนบ
export const placeDocumentList = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const db = ManagementDB.getInstance();

        const sqlDocumentTypes = `
            SELECT id, doc_type_code, doc_type_name, description,is_active FROM tbl_inv_document_types
            WHERE is_active = 1
            ORDER BY display_order
        `;
        
        const documentTypes = await db.executeQuery(sqlDocumentTypes);
        
        res.json({
            success: true,
            data: documentTypes.map((type: any) => ({
                id: type.id,
                code: type.doc_type_code,
                name: type.doc_type_name,
                description: type.description
            }))
        });
        
    } catch (error: any) {
        console.log('Document list error:', error.message);
        
        console.error('Error fetching document types:', error);
        res.status(500).json({
            status: "error",
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลเอกสารแนบ",
            error: error.message
        });
    }
}, 10000);

// ฟังก์ชันสร้างคำขอเบิกใหม่
export const placeCreateRequest = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== CREATE REQUEST ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('======================');

        // Validate input
        const schema = Joi.object({
            departmentCode: Joi.string().required(),
            materialCategory: Joi.string().required(),
            urgency: Joi.string().valid('normal', 'high', 'urgent').default('normal'),
            reason: Joi.string().allow(null, ''),
            created_by_user_id: Joi.string().max(15).required(),
            items: Joi.array().items(
                Joi.object({
                    item_sequence: Joi.number().integer().min(1).required(), // ลำดับที่ frontend ต้องส่งมา
                    item_code: Joi.string().allow(null, ''), // รหัสสินค้า (ไม่บังคับ)
                    description: Joi.string().required(),
                    item_type: Joi.string().valid('เพื่อใช้', 'เพื่อจำหน่าย').default('เพื่อใช้'),
                    hn: Joi.string().when('item_type', {
                        is: 'เพื่อจำหน่าย',
                        then: Joi.string().required(),
                        otherwise: Joi.string().allow(null, '')
                    }),
                    patient_name: Joi.string().when('item_type', {
                        is: 'เพื่อจำหน่าย',
                        then: Joi.string().required(),
                        otherwise: Joi.string().allow(null, '')
                    }),
                    unit: Joi.string().required(),
                    quantity: Joi.number().positive().required(),
                    price: Joi.number().min(0).required(),
                    note: Joi.string().allow(null, ''),
                    request_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null) // รับเป็น YYYY-MM-DD string
                })
            ).min(1).required(),
            documents: Joi.array().items(
                Joi.object({
                    document_type_id: Joi.number().integer().required(),
                    other_document_name: Joi.string().allow(null, ''),
                    is_required: Joi.boolean().default(false)
                })
            ).optional()
        }).unknown(true);

        const { error, value } = schema.validate(req.body);

        if (error) {
            console.log('Validation error:', error.details[0].message);
            
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const { 
            departmentCode = 'COM',
            materialCategory,
            urgency = 'normal',
            reason = '',
            created_by_user_id,
            items,
            documents = []
        } = value;

        const db = ManagementDB.getInstance();

        // ใช้ executeTransaction เพื่อจัดการ rollback อัตโนมัติ
        const result = await db.executeTransaction(async (connection: any) => {

        console.log('=== TRANSACTION DEBUG ===');
        console.log('Transaction connection established:', !!connection);
        console.log('=========================');

        // 1. ใช้ username ที่ส่งมาจาก middleware authentication
        const requestUsername: string = created_by_user_id;
        
        console.log('=== DOCUMENT NUMBER GENERATION DEBUG ===');
        console.log('Generating document number for type: RQ');
        const requisitionId: string = await DocumentUtils.generateDocumentNumber(connection, 'RQ');
        console.log('Generated requisitionId:', requisitionId);
        console.log('========================================');
        
        // 2. บันทึกข้อมูลคำขอเบิก header (บันทึกเป็น REQ_DRAFT เท่านั้น)
        console.log('=== HEADER INSERT DEBUG ===');
        const headerParams = [requisitionId, departmentCode, requestUsername, materialCategory, urgency, reason, created_by_user_id];
        console.log('Header insert params:', headerParams);
        
        // บันทึกเป็น REQ_DRAFT (ยังไม่ส่งขออนุมัติ)
        await connection.execute(
            `INSERT INTO tbl_inv_requisitions 
             (id, department_code, request_username, request_date, material_category, urgency, reason, current_status, created_by_user_id, date_created) 
             VALUES (?, ?, ?, NOW(), ?, ?, ?, 'REQ_DRAFT', ?, NOW())`,
            headerParams
        );
        console.log('Header inserted as REQ_DRAFT successfully');
        console.log('===========================');
        
        // 3. บันทึกรายการสินค้า
        const createdItemIds: number[] = [];
        
        console.log('=== ITEMS PROCESSING DEBUG ===');
        console.log('Total items to process:', items.length);
        
        for (const item of items) {
            console.log('--- Processing item ---');
            console.log('Original item:', JSON.stringify(item, null, 2));
            
            const sanitizedItem = sanitizeItemData(item);
            console.log('Sanitized item:', JSON.stringify(sanitizedItem, null, 2));
            
            let itemResult: any;
            try {
                const itemParams = [
                    requisitionId,
                    sanitizedItem.item_sequence,
                    sanitizedItem.item_code, // รหัสสินค้า (ไม่บังคับ)
                    sanitizedItem.description, 
                    sanitizedItem.item_type,
                    sanitizedItem.hn, 
                    sanitizedItem.patient_name, 
                    sanitizedItem.unit,
                    sanitizedItem.quantity, 
                    sanitizedItem.price, 
                    sanitizedItem.note, 
                    sanitizedItem.request_date,
                    created_by_user_id
                ];
                console.log('Item insert params:', itemParams);
                
                [itemResult] = await connection.execute(
                    `INSERT INTO tbl_inv_requisition_items 
                     (requisition_id, item_sequence, item_code, description, item_type, hn, patient_name, unit, quantity, price, note, request_date, created_by_user_id, date_created, current_status, status_comment, status_updated_at, status_updated_by) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'REQ_DRAFT', ?, NOW(), ?)`,
                    [...itemParams, `สร้างรายการใหม่: ${sanitizedItem.description}`, created_by_user_id]
                );
                
                console.log('Item insert result:', itemResult);
            } catch (dbError: any) {
                console.log('=== DATABASE ERROR DEBUG ===');
                console.log('DB Error code:', dbError.code);
                console.log('DB Error message:', dbError.message);
                console.log('DB Error sqlMessage:', dbError.sqlMessage);
                console.log('============================');
                
                if (dbError.code === 'ER_DUP_ENTRY' && dbError.sqlMessage?.includes('uk_requisition_item_sequence')) {
                    throw new Error(`ลำดับรายการ ${sanitizedItem.item_sequence} ซ้ำกัน กรุณาใช้ลำดับที่ไม่ซ้ำกัน`);
                }
                throw dbError;
            }
            
            const itemId = itemResult.insertId;
            createdItemIds.push(itemId);
            
            // สถานะเริ่มต้นถูกตั้งค่าเป็น REQ_DRAFT ตอน INSERT แล้ว
            const initialStatus = 'REQ_DRAFT';
            
            // บันทึก Event Log สำหรับการสร้าง
            await connection.execute(
                `INSERT INTO tbl_inv_item_event_logs 
                 (item_id, event_type, new_status_code, event_description, 
                  ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                 VALUES (?, 'CREATE', ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    itemId, initialStatus,
                    `สร้างรายการขอเบิก: ${sanitizedItem.description} จำนวน ${sanitizedItem.quantity} ${sanitizedItem.unit} (โดย ${requestUsername})`,
                    req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                    JSON.stringify({
                        requisition_id: requisitionId,
                        item_type: sanitizedItem.item_type,
                        quantity: sanitizedItem.quantity,
                        price: sanitizedItem.price,
                        changed_by_username: requestUsername
                    }),
                    created_by_user_id
                ]
            );
        }
        
        // 4. บันทึกประเภทเอกสารแนบ (ใช้ตาราง tbl_inv_attachments แทน)
        if (documents && documents.length > 0) {
            for (const doc of documents) {
                // บันทึกการเลือกประเภทเอกสารใน tbl_inv_attachments
                await connection.execute(
                    `INSERT INTO tbl_inv_attachments 
                     (reference_type, reference_id, doc_type_id, file_name, file_path, attachment_status, uploaded_by_user_id, uploaded_by_role, upload_date, created_by_user_id, date_created) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())`,
                    [
                        'REQUEST', 
                        requisitionId, 
                        doc.document_type_id,
                        `document_type_${doc.document_type_id}`, // placeholder file name
                        '/pending', // placeholder path
                        'PENDING',
                        created_by_user_id,
                        'DEPT_USER',
                        created_by_user_id
                    ]
                );
            }
            
            // Log การเลือกเอกสารแนบ
            if (createdItemIds.length > 0) {
                const documentList = documents.map((doc: any) => 
                    sanitizeForMySQL(doc.other_document_name) || `เอกสารประเภท ID ${doc.document_type_id}`
                ).join(', ');
                
                await connection.execute(
                    `INSERT INTO tbl_inv_item_event_logs 
                     (item_id, event_type, event_description, additional_data, created_by_user_id, date_created) 
                     VALUES (?, 'DOCUMENT_ATTACHED', ?, ?, ?, NOW())`,
                    [
                        createdItemIds[0],
                        `เลือกเอกสารแนบสำหรับคำขอเบิก: ${documentList} (โดย ${requestUsername})`,
                        JSON.stringify({
                            action: 'attach_documents',
                            document_count: documents.length,
                            documents: documents,
                            changed_by_username: requestUsername
                        }),
                        created_by_user_id
                    ]
                );
            }
        }
        
        // บันทึกประวัติสถานะ (เป็น REQ_DRAFT เท่านั้น)
        await connection.execute(
            `INSERT INTO tbl_inv_status_logs 
             (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
             VALUES (?, NULL, 'REQ_DRAFT', ?, ?, NOW())`,
            [requisitionId, 'สร้างคำขอเบิกใหม่ (ยังไม่ส่งขออนุมัติ)', created_by_user_id]
        );

        return {
            requisitionId,
            status: 'REQ_DRAFT',
            itemsCreated: createdItemIds.length
        };
    }, 'placeCreateRequest');

    console.log('=== CREATE REQUEST SUCCESS DEBUG ===');
    console.log('Final result:', JSON.stringify(result, null, 2));
    console.log('=====================================');
    
    res.status(201).json({
        success: true,
        message: 'สร้างคำขอเบิกเรียบร้อยแล้ว (สถานะ: REQ_DRAFT - ยังไม่ส่งขออนุมัติ)',
        data: result
    });
    
} catch (error: any) {
            console.log('Create error:', error.message);
    
    console.error('Error creating requisition:', error);
    
    res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้างคำขอเบิก',
        error: error.message
    });
}
}, 30000);

// ฟังก์ชันแก้ไขคำขอเบิกสำหรับพนักงานหน่วยงาน (แก้ไขได้เฉพาะ CANCELLED_BY_HEAD, REQUEST_INFO)
export const placeUpdateRequest = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== UPDATE REQUEST ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('======================');

        // ดึง requisitionId จาก path parameter หรือ query parameter
        const requisitionId = req.params.reqId || req.params.requisitionId || req.query.reqId as string;
        
        console.log('=== REQUISITION ID DEBUG ===');
        console.log('req.params.reqId:', req.params.reqId);
        console.log('req.params.requisitionId:', req.params.requisitionId);
        console.log('req.query.reqId:', req.query.reqId);
        console.log('Final requisitionId:', requisitionId);
        console.log('RequisitionId type:', typeof requisitionId);
        console.log('===============================');

        // ตรวจสอบว่ามี requisitionId หรือไม่
        if (!requisitionId) {
            console.log('=== REQUISITION ID ERROR ===');
            console.log('No requisitionId found in request');
            console.log('===============================');
            
            res.status(400).json({
                success: false,
                message: "ไม่พบ requisitionId ในคำขอ"
            });
            return;
        }

        const schema = Joi.object({
            departmentCode: Joi.string().optional(),
            materialCategory: Joi.string().optional(),
            urgency: Joi.string().valid('normal', 'high', 'urgent').optional(),
            reason: Joi.string().allow(null, '').optional(),
            updated_by_user_id: Joi.string().max(15).required(),
            items: Joi.array().items(
                Joi.object({
                    // สำหรับ add: ใช้ item_sequence (ลำดับที่ frontend กำหนด)
                    item_sequence: Joi.number().integer().min(1).when('action', { is: 'add', then: Joi.required(), otherwise: Joi.optional() }),
                    // สำหรับ update: ใช้ item_id (primary key ของ item ที่ต้องการแก้ไข)
                    item_id: Joi.number().integer().when('action', { is: 'update', then: Joi.required(), otherwise: Joi.optional() }),
                    action: Joi.string().valid('update', 'add').default('add'),
                    description: Joi.string().required(),
                    item_type: Joi.string().valid('เพื่อใช้', 'เพื่อจำหน่าย').default('เพื่อใช้'),
                    hn: Joi.string().allow(null, ''),
                    patient_name: Joi.string().allow(null, ''),
                    unit: Joi.string().required(),
                    quantity: Joi.number().positive().required(),
                    price: Joi.number().min(0).required(),
                    note: Joi.string().allow(null, ''),
                    request_date: Joi.date().iso().allow(null)
                })
            ).optional(),
            documents: Joi.array().items(
                Joi.object({
                    document_type_id: Joi.number().integer().required(),
                    other_document_name: Joi.string().allow(null, ''),
                    is_required: Joi.boolean().default(false)
                })
            ).optional()
        }).unknown(true);

        console.log('=== UPDATE VALIDATION DEBUG ===');
        console.log('Schema validation starting...');
        const { error, value } = schema.validate(req.body);
        console.log('Validation error:', error);
        console.log('Validation value:', JSON.stringify(value, null, 2));
        console.log('===============================');

        if (error) {
            console.log('=== UPDATE VALIDATION ERROR ===');
            console.log('Error details:', error.details);
            console.log('Error message:', error.details[0].message);
            console.log('==============================');
            
            // สร้าง error message ที่เข้าใจง่าย
            const errorDetail = error.details[0];
            let friendlyMessage = "ข้อมูลไม่ถูกต้อง";
            let specificError = errorDetail.message;
            
            // แปลง error message ให้เข้าใจง่าย
            if (errorDetail.path && errorDetail.path.length > 0) {
                const fieldPath = errorDetail.path.join('.');
                const fieldName = errorDetail.path[errorDetail.path.length - 1];
                
                if (errorDetail.type === 'any.required') {
                    friendlyMessage = `ข้อมูลที่จำเป็นไม่ครบถ้วน`;
                    specificError = `กรุณาระบุ ${fieldName} ให้ครบถ้วน`;
                } else if (errorDetail.type === 'any.only') {
                    friendlyMessage = `ข้อมูลไม่ถูกต้อง`;
                    if (fieldName === 'item_type') {
                        specificError = `ประเภทสินค้า "${errorDetail.context.value}" ไม่ถูกต้อง กรุณาเลือก: เพื่อใช้, เพื่อจำหน่าย`;
                    } else if (fieldName === 'action') {
                        specificError = `การกระทำ "${errorDetail.context.value}" ไม่ถูกต้อง กรุณาเลือก: add หรือ update`;
                    } else if (fieldName === 'urgency') {
                        specificError = `ระดับความเร่งด่วน "${errorDetail.context.value}" ไม่ถูกต้อง กรุณาเลือก: normal, high, หรือ urgent`;
                    } else {
                        specificError = `ค่า "${errorDetail.context.value}" ไม่ถูกต้องสำหรับ ${fieldName} กรุณาเลือกจาก: ${errorDetail.context.valids.join(', ')}`;
                    }
                } else if (errorDetail.type === 'number.positive') {
                    friendlyMessage = `ข้อมูลตัวเลขไม่ถูกต้อง`;
                    specificError = `${fieldName} ต้องเป็นจำนวนที่มากกว่า 0`;
                } else if (errorDetail.type === 'number.base') {
                    friendlyMessage = `ข้อมูลตัวเลขไม่ถูกต้อง`;
                    specificError = `${fieldName} ต้องเป็นตัวเลขเท่านั้น`;
                } else if (errorDetail.type === 'string.empty') {
                    friendlyMessage = `ข้อมูลที่จำเป็นว่างเปล่า`;
                    specificError = `กรุณาระบุ ${fieldName}`;
                }
                
                // เพิ่มข้อมูลตำแหน่งของ error
                if (fieldPath.includes('items')) {
                    const itemIndex = errorDetail.path[1];
                    specificError += ` (รายการที่ ${parseInt(itemIndex) + 1})`;
                }
            }
            
            res.status(400).json({
                success: false,
                message: friendlyMessage,
                error: specificError,
                field: errorDetail.path ? errorDetail.path.join('.') : 'unknown',
                original_error: errorDetail.message
            });
            return;
        }

        const { 
            departmentCode, materialCategory, urgency, reason, updated_by_user_id,
            items = [], documents = []
        } = value;

        // Debug logging
        console.log('=== DEBUG UPDATE REQUEST ===');
        console.log('req.params:', req.params);
        console.log('req.query:', req.query);
        console.log('requisitionId:', requisitionId);
        console.log('requisitionId type:', typeof requisitionId);
        console.log('departmentCode:', departmentCode);
        console.log('materialCategory:', materialCategory);
        console.log('urgency:', urgency);
        console.log('reason:', reason);
        console.log('updated_by_user_id:', updated_by_user_id);
        console.log('items:', JSON.stringify(items, null, 2));
        console.log('documents:', JSON.stringify(documents, null, 2));
        console.log('============================');

        // ตรวจสอบ requisitionId อีกครั้ง
        if (!requisitionId || requisitionId === 'undefined') {
            console.log('=== REQUISITION ID VALIDATION ERROR ===');
            console.log('Invalid requisitionId detected');
            console.log('req.params:', req.params);
            console.log('req.query:', req.query);
            console.log('======================================');
            
            res.status(400).json({
                success: false,
                message: "ไม่พบ requisitionId ที่ถูกต้อง",
                debug: {
                    params: req.params,
                    query: req.query,
                    requisitionId: requisitionId
                }
            });
            return;
        }

        const db = ManagementDB.getInstance();
        
        console.log('=== UPDATE DATABASE CONNECTION DEBUG ===');
        console.log('Database instance created:', !!db);
        console.log('Starting transaction...');
        console.log('========================================');

        // ใช้ executeTransaction เพื่อจัดการ rollback อัตโนมัติ
        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบว่าคำขอเบิกมีอยู่จริง
            const [existingReq] = await connection.execute(
                `SELECT * FROM tbl_inv_requisitions WHERE id = ?`,
                [requisitionId]
            );
            
            if (existingReq.length === 0) {
                throw new Error('ไม่พบคำขอเบิกดังกล่าว');
            }
            
            // ตรวจสอบสถานะของ items - ใช้ item-level status
            const [itemsStatus] = await connection.execute(
                `SELECT ri.item_id, ri.description, ri.is_cancelled, sic.current_status_code
                 FROM tbl_inv_requisition_items ri
                 LEFT JOIN tbl_inv_status_item_current sic ON ri.item_id = sic.item_id
                 WHERE ri.requisition_id = ? AND ri.is_cancelled = 0`,
                [requisitionId]
            );
            
            if (itemsStatus.length === 0) {
                throw new Error('ไม่พบรายการที่สามารถแก้ไขได้ หรือรายการทั้งหมดถูกยกเลิกแล้ว');
            }
            
            // State Transition Rules: แก้ไขได้เฉพาะ CANCELLED_BY_HEAD, REQUEST_INFO
            const editableStatuses = ['REQ_CANCELLED_BY_DEPT_HEAD', 'REQ_DEPT_REQUEST_INFO'];
            const editableItems = itemsStatus.filter((item: any) => 
                editableStatuses.includes(item.current_status_code)
            );
            
            if (editableItems.length === 0) {
                const statusNames: Record<string, string> = {
                    'REQ_PENDING_DEPT_APPROVAL': 'รอหัวหน้าหน่วยงานอนุมัติ (ไม่สามารถแก้ไขได้)',
                    'REQ_APPROVED_BY_HEAD': 'หัวหน้าหน่วยงานอนุมัติแล้ว (ไม่สามารถแก้ไขได้)',
                    'STOCK_PENDING_RECEIVE': 'ส่งไปแผนกพัสดุแล้ว (ไม่สามารถแก้ไขได้)',
                    'REQ_ITEM_APPROVED': 'รายการได้รับการอนุมัติ (ไม่สามารถแก้ไขได้)',
                    'STOCK_RECEIVED': 'แผนกพัสดุรับแล้ว (ไม่สามารถแก้ไขได้)',
                    'REQ_CANCELLED_BY_DEPT': 'ยกเลิกแล้ว (ไม่สามารถแก้ไขได้)'
                };
                
                const statusCounts = itemsStatus.reduce((acc: any, item: any) => {
                    const statusName = statusNames[item.current_status_code] || `${item.current_status_code} (ไม่สามารถแก้ไขได้)`;
                    acc[statusName] = (acc[statusName] || 0) + 1;
                    return acc;
                }, {});
                
                const statusList = Object.entries(statusCounts)
                    .map(([status, count]) => `${status} (${count} รายการ)`)
                    .join(', ');
                
                throw new Error(`ไม่สามารถแก้ไขได้ เนื่องจากรายการอยู่ในสถานะ: ${statusList}`);
            }

            const currentReq = existingReq[0];
            const requestUsername = currentReq.request_username || updated_by_user_id;

            // อัพเดท header
            const updateFields = [];
            const updateValues = [];
            const headerChanges = [];
            
            if (departmentCode !== undefined && departmentCode !== currentReq.department_code) {
                updateFields.push('department_code = ?');
                updateValues.push(sanitizeForMySQL(departmentCode));
                headerChanges.push(`แผนก: ${currentReq.department_code} → ${departmentCode}`);
            }
            if (materialCategory !== undefined && materialCategory !== currentReq.material_category) {
                updateFields.push('material_category = ?');
                updateValues.push(sanitizeForMySQL(materialCategory));
                headerChanges.push(`หมวดวัสดุ: ${currentReq.material_category} → ${materialCategory}`);
            }
            if (urgency !== undefined && urgency !== currentReq.urgency) {
                updateFields.push('urgency = ?');
                updateValues.push(sanitizeForMySQL(urgency));
                headerChanges.push(`ความเร่งด่วน: ${currentReq.urgency} → ${urgency}`);
            }
            if (reason !== undefined && reason !== currentReq.reason) {
                updateFields.push('reason = ?');
                updateValues.push(sanitizeForMySQL(reason));
                headerChanges.push(`เหตุผล: ${currentReq.reason || 'ไม่ระบุ'} → ${reason || 'ไม่ระบุ'}`);
            }
            
            if (updateFields.length > 0) {
                updateFields.push('updated_by_user_id = ?');
                updateFields.push('date_updated = NOW()');
                updateValues.push(updated_by_user_id);
                updateValues.push(requisitionId);
                
                await connection.execute(
                    `UPDATE tbl_inv_requisitions SET ${updateFields.join(', ')} WHERE id = ?`,
                    updateValues
                );
                
                // Log header changes
                await connection.execute(
                    `INSERT INTO tbl_inv_status_logs 
                     (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                     VALUES (?, NULL, NULL, ?, ?, NOW())`,
                    [requisitionId, `แก้ไขข้อมูลหลัก: ${headerChanges.join(', ')}`, updated_by_user_id]
                );
            }

            // จัดการ documents
            if (documents.length > 0) {
                // ลบเอกสารเดิม
                await connection.execute(
                    `DELETE FROM tbl_inv_requisition_document_types WHERE requisition_id = ?`,
                    [requisitionId]
                );
                
                // เพิ่มเอกสารใหม่
                for (const doc of documents) {
                    await connection.execute(
                        `INSERT INTO tbl_inv_requisition_document_types 
                         (requisition_id, document_type_id, other_document_name, is_required) 
                         VALUES (?, ?, ?, ?)`,
                        [requisitionId, doc.document_type_id, sanitizeForMySQL(doc.other_document_name), doc.is_required || false]
                    );
                }
                
                // Log การแก้ไขเอกสาร
                const documentList = documents.map((doc: any) => 
                    sanitizeForMySQL(doc.other_document_name) || `เอกสารประเภท ID ${doc.document_type_id}`
                ).join(', ');
                
                await connection.execute(
                    `INSERT INTO tbl_inv_status_logs 
                     (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                     VALUES (?, NULL, NULL, ?, ?, NOW())`,
                    [requisitionId, `แก้ไขเอกสารแนบ: ${documentList}`, updated_by_user_id]
                );
            }

            // จัดการ items
            const processedItemIds = [];
            const itemChanges = [];
            
            for (const item of items) {
                const sanitizedItem = sanitizeItemData(item);
                console.log('Processing item:', JSON.stringify(sanitizedItem, null, 2));
                
                if (sanitizedItem.action === 'add') {
                    let finalSequence = sanitizedItem.item_sequence;
                    let sequenceChanged = false;
                    
                    // ตรวจสอบว่า item_sequence ที่ส่งมาซ้ำกับที่มีอยู่แล้วหรือไม่
                    const [existingItem] = await connection.execute(
                        `SELECT item_id FROM tbl_inv_requisition_items 
                         WHERE requisition_id = ? AND item_sequence = ?`,
                        [requisitionId, sanitizedItem.item_sequence]
                    );
                    
                    if (existingItem.length > 0) {
                        // หาลำดับถัดไปที่ว่าง
                        const [maxSequence] = await connection.execute(
                            `SELECT COALESCE(MAX(item_sequence), 0) as max_seq FROM tbl_inv_requisition_items WHERE requisition_id = ?`,
                            [requisitionId]
                        );
                        finalSequence = maxSequence[0].max_seq + 1;
                        sequenceChanged = true;
                    }
                    
                    // เพิ่ม item ใหม่ ใช้ finalSequence (อาจจะเปลี่ยนจากที่ frontend ส่งมาถ้าซ้ำ)
                    const insertParams = [
                        requisitionId, 
                        finalSequence, 
                        sanitizedItem.description, 
                        sanitizedItem.item_type,
                        sanitizedItem.hn, 
                        sanitizedItem.patient_name, 
                        sanitizedItem.unit,
                        sanitizedItem.quantity, 
                        sanitizedItem.price, 
                        sanitizedItem.note, 
                        sanitizedItem.request_date
                    ];
                    
                    console.log('Insert params for add:', insertParams);
                    console.log('Using final sequence:', finalSequence, sequenceChanged ? '(เปลี่ยนจาก ' + sanitizedItem.item_sequence + ')' : '(ตามที่ส่งมา)');
                    
                    // INSERT ข้อมูล (ใช้ finalSequence ที่ประมวลผลแล้ว)
                    const [itemResult] = await connection.execute(
                        `INSERT INTO tbl_inv_requisition_items 
                         (requisition_id, item_sequence, description, item_type, hn, patient_name, unit, quantity, price, note, request_date, created_by_user_id, date_created) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                        [...insertParams, updated_by_user_id]
                    );
                    
                    const newId = itemResult.insertId;
                    processedItemIds.push(newId);
                    
                    // สร้าง message ตามการเปลี่ยนแปลง
                    const baseMessage = `เพิ่ม: ${sanitizedItem.description} จำนวน ${sanitizedItem.quantity} ${sanitizedItem.unit}`;
                    const sequenceMessage = sequenceChanged ? 
                        ` (เปลี่ยนลำดับจาก ${sanitizedItem.item_sequence} เป็น ${finalSequence} เนื่องจากซ้ำ)` : 
                        ` (ลำดับ ${finalSequence})`;
                    itemChanges.push(baseMessage + sequenceMessage);
                    
                    // บันทึก status ใหม่
                    const currentUrgency = urgency || currentReq.urgency || 'normal';
                    const priorityLevel = currentUrgency === 'urgent' ? 'URGENT' : currentUrgency === 'high' ? 'HIGH' : 'NORMAL';
                    const newItemStatus = 'REQ_DEPT_REQUEST_INFO'; // item ใหม่ในการแก้ไขต้องรอตรวจสอบ
                    
                    await connection.execute(
                        `INSERT INTO tbl_inv_status_item_current 
                         (item_id, current_status_code, current_status_since, last_comment, priority_level, created_by_user_id, date_created) 
                         VALUES (?, ?, NOW(), ?, ?, ?, NOW())`,
                        [newId, newItemStatus, `เพิ่มรายการใหม่: ${sanitizedItem.description}`, priorityLevel, updated_by_user_id]
                    );
                    
                    // Log item creation
                    await connection.execute(
                        `INSERT INTO tbl_inv_item_event_logs 
                         (item_id, event_type, new_status_code, event_description, ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                         VALUES (?, 'CREATE', ?, ?, ?, ?, ?, ?, NOW())`,
                        [
                            newId, newItemStatus, `เพิ่มรายการในการแก้ไข: ${sanitizedItem.description}`,
                            req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                            JSON.stringify({
                                action: 'add_in_update',
                                requisition_id: requisitionId,
                                item_type: sanitizedItem.item_type,
                                quantity: sanitizedItem.quantity,
                                price: sanitizedItem.price
                            }),
                            updated_by_user_id
                        ]
                    );
                    
                } else if (sanitizedItem.action === 'update' && sanitizedItem.item_id) {
                    // ดึงข้อมูลเดิมพร้อมตรวจสอบสถานะ (ใช้ item_id พร้อม validation requisition_id)
                    const [oldItem] = await connection.execute(
                        `SELECT * FROM tbl_inv_requisition_items 
                         WHERE item_id = ? AND requisition_id = ?`,
                        [sanitizedItem.item_id, requisitionId]
                    );
                    
                    if (oldItem.length === 0) {
                        throw new Error(`ไม่พบรายการ item_id ${sanitizedItem.item_id} ในคำขอเบิกนี้ ไม่สามารถแก้ไขได้`);
                    }
                    
                    const old = oldItem[0];
                    
                    // ตรวจสอบสถานะ - ไม่อนุญาตให้แก้ไขรายการที่ยกเลิกแล้ว
                    if (old.is_cancelled === 1) {
                        throw new Error(`ไม่สามารถแก้ไขรายการ "${old.description}" ได้ เนื่องจากถูกยกเลิกแล้ว`);
                    }
                    
                    const changes = [];
                    
                    if (old.description !== sanitizedItem.description) changes.push(`คำอธิบาย: ${old.description} → ${sanitizedItem.description}`);
                    if (old.quantity !== sanitizedItem.quantity) changes.push(`จำนวน: ${old.quantity} → ${sanitizedItem.quantity}`);
                    if (old.price !== sanitizedItem.price) changes.push(`ราคา: ${old.price} → ${sanitizedItem.price}`);
                    if (old.unit !== sanitizedItem.unit) changes.push(`หน่วย: ${old.unit} → ${sanitizedItem.unit}`);
                    
                    // แก้ไข item เดิม - ใช้ item_id เป็นหลัก พร้อม validation requisition_id
                    const [updateResult] = await connection.execute(
                        `UPDATE tbl_inv_requisition_items 
                         SET description = ?, item_type = ?, hn = ?, patient_name = ?, 
                             unit = ?, quantity = ?, price = ?, note = ?, request_date = ?,
                             updated_by_user_id = ?, date_updated = NOW()
                         WHERE item_id = ? AND requisition_id = ?`,
                        [
                            sanitizedItem.description, 
                            sanitizedItem.item_type, 
                            sanitizedItem.hn,
                            sanitizedItem.patient_name, 
                            sanitizedItem.unit, 
                            sanitizedItem.quantity, 
                            sanitizedItem.price,
                            sanitizedItem.note, 
                            sanitizedItem.request_date,
                            updated_by_user_id,
                            old.item_id,  // ใช้ item_id จากการ query
                            requisitionId  // เพิ่ม validation requisition_id
                        ]
                    );
                    
                    if (updateResult.affectedRows > 0 && changes.length > 0) {
                        processedItemIds.push(old.item_id);
                        itemChanges.push(`แก้ไข ${old.description}: ${changes.join(', ')}`);
                        
                        // Log item update
                        await connection.execute(
                            `INSERT INTO tbl_inv_item_event_logs 
                             (item_id, event_type, event_description, ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                             VALUES (?, 'UPDATE', ?, ?, ?, ?, ?, NOW())`,
                            [
                                old.item_id, `แก้ไขรายการ: ${changes.join(', ')}`,
                                req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                                JSON.stringify({
                                action: 'update',
                                item_sequence: sanitizedItem.item_sequence,
                                changes: changes,
                                    old_values: {
                                        description: old.description,
                                        quantity: old.quantity,
                                        price: old.price,
                                        unit: old.unit
                                    },
                                    new_values: {
                                        description: sanitizedItem.description,
                                        quantity: sanitizedItem.quantity,
                                        price: sanitizedItem.price,
                                        unit: sanitizedItem.unit
                                    }
                                }),
                                updated_by_user_id
                            ]
                        );
                    }
                    
                }
            }
            
            // Log รวมการเปลี่ยนแปลง items
            if (itemChanges.length > 0) {
                await connection.execute(
                    `INSERT INTO tbl_inv_status_logs 
                     (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                     VALUES (?, 'REQ_DRAFT', 'REQ_DRAFT', ?, ?, NOW())`,
                    [requisitionId, `แก้ไขรายการ: ${itemChanges.join(' | ')}`, updated_by_user_id]
                );
            }

            return {
                requisitionId,
                itemsProcessed: processedItemIds.length,
                changes: {
                    header: headerChanges,
                    items: itemChanges
                }
            };
        }, 'placeUpdateRequest');
        
        res.json({
            success: true,
            message: 'แก้ไขคำขอเบิกเรียบร้อยแล้ว',
            data: result
        });
        
    } catch (error: any) {
        // จำแนกประเภท error
        const businessLogicErrors = [
            'ไม่พบคำขอเบิกหรือไม่อยู่ในสถานะที่แก้ไขได้',
            'ลำดับรายการ',  // error ที่เริ่มต้นด้วยข้อความนี้
            'ไม่พบรายการลำดับที่',
            'ไม่สามารถแก้ไขรายการ'
        ];
        
        const isBusinessLogicError = businessLogicErrors.some(pattern => 
            error.message.includes(pattern)
        );
        
        console.log('Update error:', error.message);
        
        if (isBusinessLogicError) {
            res.status(400).json({
                success: false,
                message: error.message,
                type: 'validation_error'
            });
        } else {
            console.error('Error updating requisition:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการแก้ไขคำขอเบิก',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);


// ฟังก์ชันยกเลิกคำขอเบิก (ยกเลิกได้เฉพาะ PENDING_APPROVAL, CANCELLED_BY_HEAD, REQUEST_INFO)
export const placeCancelRequest = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== CANCEL REQUEST ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('=====================');

        // ดึง requisitionId จาก path parameter หรือ query parameter
        const requisitionId = req.params.reqId || req.params.requisitionId || req.query.reqId as string;
        
        const schema = Joi.object({
            cancel_type: Joi.string().valid('full', 'selective').default('full'),
            reason: Joi.string().required(),
            cancelled_by_user_id: Joi.string().max(15).required(),
            items: Joi.array().items(
                Joi.object({
                    item_id: Joi.number().integer().required(),
                    reason: Joi.string().required()
                })
            ).when('cancel_type', { is: 'selective', then: Joi.required(), otherwise: Joi.optional() })
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            console.log('Validation error:', error.details[0].message);
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const { cancel_type, reason, cancelled_by_user_id, items = [] } = value;

        const db = ManagementDB.getInstance();

        // ใช้ executeTransaction เพื่อจัดการ rollback อัตโนมัติ
        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบว่าคำขอเบิกมีอยู่จริง
            const [existingReq] = await connection.execute(
                `SELECT * FROM tbl_inv_requisitions WHERE id = ?`,
                [requisitionId]
            );
            
            if (existingReq.length === 0) {
                throw new Error('ไม่พบคำขอเบิกดังกล่าว');
            }
            
            // ตรวจสอบสถานะของ items - ใช้ item-level status
            const [itemsStatus] = await connection.execute(
                `SELECT ri.item_id, ri.description, ri.is_cancelled, sic.current_status_code
                 FROM tbl_inv_requisition_items ri
                 LEFT JOIN tbl_inv_status_item_current sic ON ri.item_id = sic.item_id
                 WHERE ri.requisition_id = ? AND ri.is_cancelled = 0`,
                [requisitionId]
            );
            
            if (itemsStatus.length === 0) {
                throw new Error('ไม่พบรายการที่สามารถยกเลิกได้ หรือรายการทั้งหมดถูกยกเลิกแล้ว');
            }
            
            // State Transition Rules: ยกเลิกได้เฉพาะ PENDING_APPROVAL, CANCELLED_BY_HEAD, REQUEST_INFO
            const cancellableStatuses = ['REQ_PENDING_DEPT_APPROVAL', 'REQ_CANCELLED_BY_DEPT_HEAD', 'REQ_DEPT_REQUEST_INFO'];
            const cancellableItems = itemsStatus.filter((item: any) => 
                cancellableStatuses.includes(item.current_status_code)
            );
            
            if (cancellableItems.length === 0) {
                const statusNames: Record<string, string> = {
                    'REQ_APPROVED_BY_HEAD': 'หัวหน้าหน่วยงานอนุมัติแล้ว (ไม่สามารถยกเลิกได้)',
                    'STOCK_PENDING_RECEIVE': 'ส่งไปแผนกพัสดุแล้ว (ไม่สามารถยกเลิกได้)',
                    'REQ_ITEM_APPROVED': 'รายการได้รับการอนุมัติ (ไม่สามารถยกเลิกได้)',
                    'STOCK_RECEIVED': 'แผนกพัสดุรับแล้ว (ไม่สามารถยกเลิกได้)',
                    'REQ_CANCELLED_BY_DEPT': 'ยกเลิกแล้ว (ไม่สามารถยกเลิกซ้ำได้)'
                };
                
                const statusCounts = itemsStatus.reduce((acc: any, item: any) => {
                    const statusName = statusNames[item.current_status_code] || `${item.current_status_code} (ไม่สามารถยกเลิกได้)`;
                    acc[statusName] = (acc[statusName] || 0) + 1;
                    return acc;
                }, {});
                
                const statusList = Object.entries(statusCounts)
                    .map(([status, count]) => `${status} (${count} รายการ)`)
                    .join(', ');
                
                throw new Error(`ไม่สามารถยกเลิกได้ เนื่องจากรายการอยู่ในสถานะ: ${statusList}`);
            }

            const currentReq = existingReq[0];
            const oldStatus = currentReq.current_status;
            let newStatus = oldStatus;
            let cancelledItems = [];

            console.log('Cancel type:', cancel_type, 'Items to process:', items.length);

            if (cancel_type === 'full') {
                // ยกเลิกทั้งหมด
                newStatus = 'REQ_CANCELLED_BY_DEPT';

                // อัพเดทสถานะ requisition พร้อมบันทึกข้อมูลการยกเลิก
                await connection.execute(
                    `UPDATE tbl_inv_requisitions 
                     SET current_status = ?, is_cancelled = 1, cancelled_by_user_id = ?, 
                         date_cancelled = NOW(), cancel_reason = ?, updated_by_user_id = ?, date_updated = NOW() 
                     WHERE id = ?`,
                    [newStatus, cancelled_by_user_id, reason, cancelled_by_user_id, requisitionId]
                );

                // ดึง items และอัพเดทสถานะ
                const [allItems] = await connection.execute(
                    `SELECT item_id, description FROM tbl_inv_requisition_items 
                     WHERE requisition_id = ? AND is_cancelled = 0`,
                    [requisitionId]
                );

                for (const item of allItems) {
                    // อัพเดทฟิลด์ is_cancelled พร้อมบันทึกผู้ยกเลิกและวันที่
                    await connection.execute(
                        `UPDATE tbl_inv_requisition_items 
                         SET is_cancelled = 1, cancelled_by_user_id = ?, date_cancelled = NOW(), 
                             cancel_reason = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE item_id = ?`,
                        [cancelled_by_user_id, reason, cancelled_by_user_id, item.item_id]
                    );

                    // อัพเดทสถานะใน status table
                    await connection.execute(
                        `UPDATE tbl_inv_status_item_current 
                         SET current_status_code = ?, current_status_since = NOW(), 
                             last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE item_id = ?`,
                        ['REQ_CANCELLED_BY_DEPT', `ยกเลิกคำขอเบิกทั้งหมด: ${reason}`, cancelled_by_user_id, item.item_id]
                    );

                    // Log item cancellation
                    await connection.execute(
                        `INSERT INTO tbl_inv_item_event_logs 
                         (item_id, event_type, new_status_code, event_description, 
                          ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                         VALUES (?, 'CANCELED', ?, ?, ?, ?, ?, ?, NOW())`,
                        [
                            item.item_id, 'REQ_CANCELLED_BY_DEPT',
                            `ยกเลิกรายการพร้อมคำขอเบิก: ${item.description} (โดย ${cancelled_by_user_id})`,
                            req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                            JSON.stringify({
                                action: 'full_cancel',
                                reason: reason,
                                cancelled_by: cancelled_by_user_id,
                                changed_by_username: cancelled_by_user_id
                            }),
                            cancelled_by_user_id
                        ]
                    );

                    cancelledItems.push({
                        item_id: item.item_id,
                        description: item.description,
                        reason: reason
                    });
                }

                // บันทึกประวัติการยกเลิกทั้งหมด
                await connection.execute(
                    `INSERT INTO tbl_inv_status_logs 
                     (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                     VALUES (?, ?, ?, ?, ?, NOW())`,
                    [
                        requisitionId, oldStatus, newStatus, `ยกเลิกคำขอเบิกทั้งหมด: ${reason}`, cancelled_by_user_id
                    ]
                );

            } else if (cancel_type === 'selective') {
                // ยกเลิกเฉพาะรายการ
                console.log('Processing selective cancellation for', items.length, 'items');
                
                // ตรวจสอบ item_id ทั้งหมดก่อนเริ่มยกเลิก
                const notFoundItems = [];
                const validItems = [];
                
                for (const item of items) {
                    console.log('Checking item_id:', item.item_id);
                    
                    // ตรวจสอบว่า item นี้อยู่ใน requisition นี้จริงและยังไม่ถูกยกเลิก
                    const [existingItem] = await connection.execute(
                        `SELECT item_id, description, is_cancelled FROM tbl_inv_requisition_items 
                         WHERE item_id = ? AND requisition_id = ?`,
                        [item.item_id, requisitionId]
                    );
                    
                    if (existingItem.length === 0) {
                        notFoundItems.push({
                            item_id: item.item_id,
                            reason: `ไม่พบรายการ item_id ${item.item_id} ในคำขอเบิก ${requisitionId}`
                        });
                    } else if (existingItem[0].is_cancelled === 1) {
                        notFoundItems.push({
                            item_id: item.item_id,
                            reason: `รายการ "${existingItem[0].description}" (item_id: ${item.item_id}) ถูกยกเลิกไปแล้ว`
                        });
                    } else {
                        validItems.push({
                            ...item,
                            itemData: existingItem[0]
                        });
                    }
                }
                
                // หากมี item_id ที่ไม่พบหรือไม่ถูกต้อง ให้แจ้ง error
                if (notFoundItems.length > 0) {
                    const errorMessages = notFoundItems.map(item => item.reason).join('\n');
                    throw new Error(`ไม่สามารถยกเลิกได้:\n${errorMessages}`);
                }
                
                // หากไม่มี item ที่ถูกต้องเลย
                if (validItems.length === 0) {
                    throw new Error('ไม่พบรายการที่สามารถยกเลิกได้');
                }
                
                console.log('Valid items to cancel:', validItems.length);
                
                // ดำเนินการยกเลิกรายการที่ถูกต้อง
                for (const item of validItems) {
                    const itemData = item.itemData;
                    
                    console.log('Cancelling item:', itemData.description);

                    // อัพเดทฟิลด์ is_cancelled พร้อมบันทึกผู้ยกเลิกและวันที่
                    const updateResult = await connection.execute(
                        `UPDATE tbl_inv_requisition_items 
                         SET is_cancelled = 1, cancelled_by_user_id = ?, date_cancelled = NOW(), 
                             cancel_reason = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE item_id = ?`,
                        [cancelled_by_user_id, item.reason, cancelled_by_user_id, item.item_id]
                    );

                    console.log('Item update result:', updateResult[0]);

                    // อัพเดทสถานะ item เป็น cancelled
                    await connection.execute(
                        `UPDATE tbl_inv_status_item_current 
                         SET current_status_code = ?, current_status_since = NOW(), 
                             last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE item_id = ?`,
                        ['REQ_CANCELLED_BY_DEPT', `ยกเลิกรายการ: ${item.reason}`, cancelled_by_user_id, item.item_id]
                    );

                    // Log item cancellation
                    await connection.execute(
                        `INSERT INTO tbl_inv_item_event_logs 
                         (item_id, event_type, new_status_code, event_description, 
                          ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                         VALUES (?, 'CANCELED', ?, ?, ?, ?, ?, ?, NOW())`,
                        [
                            item.item_id, 'REQ_CANCELLED_BY_DEPT',
                            `ยกเลิกรายการ: ${item.reason} (โดย ${cancelled_by_user_id})`,
                            req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                            JSON.stringify({
                                action: 'selective_cancel',
                                item_id: item.item_id,
                                reason: item.reason,
                                cancelled_by: cancelled_by_user_id,
                                changed_by_username: cancelled_by_user_id
                            }),
                            cancelled_by_user_id
                        ]
                    );

                    // เพิ่มรายการที่ยกเลิกเข้า array
                    cancelledItems.push({
                        item_id: item.item_id,
                        description: itemData.description,
                        reason: item.reason
                    });
                }

                // ตรวจสอบว่ามีรายการที่ใช้งานได้เหลืออยู่หรือไม่
                const [remainingItems] = await connection.execute(
                    `SELECT COUNT(*) as active_count FROM tbl_inv_requisition_items 
                     WHERE requisition_id = ? AND is_cancelled = 0`,
                    [requisitionId]
                );

                console.log('Remaining active items:', remainingItems[0].active_count);

                // หากไม่มีรายการที่ใช้งานได้เหลืออยู่ ให้ยกเลิกคำขอเบิกอัตโนมัติ
                if (remainingItems[0].active_count === 0) {
                    console.log('Auto-cancelling requisition - no active items left');
                    
                    newStatus = 'REQ_CANCELLED_BY_DEPT';
                    
                    // อัพเดทสถานะ requisition เป็นยกเลิก
                    await connection.execute(
                        `UPDATE tbl_inv_requisitions 
                         SET current_status = ?, is_cancelled = 1, cancelled_by_user_id = ?, 
                             date_cancelled = NOW(), cancel_reason = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE id = ?`,
                        [newStatus, cancelled_by_user_id, `ยกเลิกอัตโนมัติ: รายการทั้งหมดถูกยกเลิกแล้ว`, cancelled_by_user_id, requisitionId]
                    );

                    // บันทึกประวัติการยกเลิกอัตโนมัติ
                    await connection.execute(
                        `INSERT INTO tbl_inv_status_logs 
                         (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                         VALUES (?, ?, ?, ?, ?, NOW())`,
                        [
                            requisitionId, oldStatus, newStatus, 
                            `ยกเลิกคำขอเบิกอัตโนมัติ: รายการทั้งหมดถูกยกเลิกแล้ว (เหตุผลรายการสุดท้าย: ${reason})`, 
                            cancelled_by_user_id
                        ]
                    );
                }
            }

            // ตรวจสอบว่าเป็น auto close หรือไม่
            let autoClosedRequisition = cancel_type === 'full';
            if (cancel_type === 'selective') {
                const [finalCheck] = await connection.execute(
                    `SELECT COUNT(*) as active_count FROM tbl_inv_requisition_items 
                     WHERE requisition_id = ? AND is_cancelled = 0`,
                    [requisitionId]
                );
                autoClosedRequisition = finalCheck[0].active_count === 0;
            }

            // บันทึกประวัติการยกเลิก
            await connection.execute(
                `INSERT INTO tbl_inv_status_logs 
                 (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    requisitionId, oldStatus, newStatus, 
                    `หัวหน้าหน่วยงาน${cancel_type === 'full' ? 'ปฏิเสธคำขอเบิกทั้งหมด' : `ปฏิเสธรายการเฉพาะ (${cancelledItems.length} รายการ)`}: ${reason}`,
                    cancelled_by_user_id
                ]
            );

            return {
                requisitionId,
                status: newStatus,
                reject_type: cancel_type,
                rejected_items: cancelledItems,
                total_rejected: cancelledItems.length,
                autoClosedRequisition: autoClosedRequisition
            };
        }, 'placeCancelRequest');
        
        res.json({
            success: true,
            message: 'ยกเลิกคำขอเบิกเรียบร้อยแล้ว',
            data: result
        });
        
    } catch (error: any) {
        console.log('Cancel error:', error.message);
        
        const businessLogicErrors = [
            'ไม่พบคำขอเบิกหรือไม่อยู่ในสถานะที่ยกเลิกได้',
            'ไม่พบรายการ',
            'ถูกยกเลิกไปแล้ว'
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
            console.error('Error canceling requisition:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการยกเลิกคำขอเบิก',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// ดึงข้อมูลคำขอเบิกทั้งหมด
export const placeGetRequest = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const db = ManagementDB.getInstance();
        const { page = 1, itemsPerPage = 20 } = req.query;
        const limit: number = parseInt(itemsPerPage as string);
        const offset: number = (parseInt(page as string) - 1) * limit;

        const sqlRequisitions = `
            SELECT * FROM tbl_inv_requisitions 
            ORDER BY request_date DESC 
            LIMIT ? OFFSET ?
        `;
        
        const requisitions = await db.executeQuery(sqlRequisitions, [limit, offset]);
        
        res.json({
            success: true,
            data: { requests: requisitions }
        });
        
    } catch (error: any) {
        console.log('Get request error:', error.message);
        
        console.error('Error fetching requisitions:', error);
        res.status(500).json({
            status: "error",
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
}, 8000);



// ========================================
// ฟังก์ชันสำหรับหัวหน้าหน่วยงาน
// ========================================

// ฟังก์ชันอนุมัติคำขอเบิกโดยหัวหน้าหน่วยงาน (อนุมัติ/ปฏิเสธได้เฉพาะ PENDING_APPROVAL, REQUEST_INFO)
export const headApproveRequest = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== HEAD APPROVE REQUEST ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('============================');

        const requisitionId = req.params.reqId || req.params.requisitionId || req.query.reqId as string;
        
        if (!requisitionId) {
            res.status(400).json({
                success: false,
                message: "ไม่พบ requisitionId ในคำขอ"
            });
            return;
        }

        const schema = Joi.object({
            comment: Joi.string().allow(null, ''),
            approved_by_user_id: Joi.string().max(15).required(),
            items: Joi.array().items(
                Joi.object({
                    item_id: Joi.number().integer().required(),
                    is_approved: Joi.boolean().default(true),
                    comment: Joi.string().allow(null, ''),
                    approved_quantity: Joi.number().positive().optional() // จำนวนที่อนุมัติ (อาจต่างจากที่ขอ)
                })
            ).optional()
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

        const { comment = '', approved_by_user_id, items = [] } = value;
        
        // ตรวจสอบว่ามี items ที่ต้องดำเนินการหรือไม่
        if (items.length === 0) {
            res.status(400).json({
                success: false,
                message: "กรุณาระบุรายการที่ต้องการอนุมัติหรือปฏิเสธ",
                type: 'validation_error'
            });
            return;
        }
        
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบว่าคำขอเบิกมีอยู่จริง
            const [existingReq] = await connection.execute(
                `SELECT * FROM tbl_inv_requisitions WHERE id = ?`,
                [requisitionId]
            );
            
            if (existingReq.length === 0) {
                throw new Error('ไม่พบคำขอเบิกดังกล่าว');
            }

            const currentReq = existingReq[0];
            const oldStatus = currentReq.current_status;
            
            // ตรวจสอบสถานะของแต่ละ item ที่ต้องการอนุมัติ
            const itemIds = items.map((item: any) => item.item_id);
            console.log('=== ITEM STATUS CHECK ===');
            console.log('Item IDs to check:', itemIds);
            
            const [itemsStatus] = await connection.execute(
                `SELECT ri.item_id, ri.description, ri.is_cancelled, sic.current_status_code
                 FROM tbl_inv_requisition_items ri
                 LEFT JOIN tbl_inv_status_item_current sic ON ri.item_id = sic.item_id
                 WHERE ri.requisition_id = ? AND ri.item_id IN (${itemIds.map(() => '?').join(',')})`,
                [requisitionId, ...itemIds]
            );
            
            console.log('Items status from DB:', JSON.stringify(itemsStatus, null, 2));
            console.log('========================');
            
            // State Transition Rules: อนุมัติ/ปฏิเสธได้เฉพาะ PENDING_APPROVAL, REQUEST_INFO
            for (const requestedItem of items) {
                const itemStatus = itemsStatus.find((item: any) => item.item_id === requestedItem.item_id);
                
                if (!itemStatus) {
                    throw new Error(`ไม่พบรายการ item_id ${requestedItem.item_id} ในคำขอเบิกนี้`);
                }
                
                if (itemStatus.is_cancelled === 1) {
                    throw new Error(`รายการ "${itemStatus.description}" (item_id: ${requestedItem.item_id}) ถูกยกเลิกแล้ว ไม่สามารถอนุมัติได้`);
                }
                
                const currentStatus = itemStatus.current_status_code;
                const isApproval = requestedItem.is_approved;
                
                // กำหนด State Transition Rules
                if (isApproval) {
                    // อนุมัติได้: รออนุมัติ, ขอข้อมูลเพิ่ม
                    const approvableStatuses = [
                        'REQ_PENDING_DEPT_APPROVAL',    // รอหัวหน้าอนุมัติ
                        'REQ_DEPT_REQUEST_INFO'         // หัวหน้าขอข้อมูลเพิ่ม (แก้ไขแล้วส่งกลับมา)
                    ];
                    
                    if (!approvableStatuses.includes(currentStatus)) {
                        const errorMessages: Record<string, string> = {
                            'REQ_ITEM_APPROVED': 'อนุมัติแล้ว ไม่สามารถอนุมัติซ้ำได้',
                            'STOCK_PENDING_RECEIVE': 'ส่งไปแผนกพัสดุแล้ว ไม่สามารถอนุมัติซ้ำได้',
                            'REQ_CANCELLED_BY_DEPT_HEAD': 'ปฏิเสธแล้ว ไม่สามารถอนุมัติได้',
                            'STOCK_RECEIVED': 'แผนกพัสดุรับแล้ว ไม่สามารถอนุมัติซ้ำได้',
                            'REQ_CANCELLED_BY_DEPT': 'ยกเลิกแล้ว ไม่สามารถอนุมัติได้'
                        };
                        
                        const errorMsg = errorMessages[currentStatus] || `อยู่ในสถานะ "${currentStatus}" ไม่สามารถอนุมัติได้`;
                        throw new Error(`รายการ "${itemStatus.description}" (item_id: ${requestedItem.item_id}) ${errorMsg}`);
                    }
                } else {
                    // ปฏิเสธได้: รออนุมัติ, ขอข้อมูลเพิ่ม
                    const rejectableStatuses = [
                        'REQ_PENDING_DEPT_APPROVAL',    // รอหัวหน้าอนุมัติ
                        'REQ_DEPT_REQUEST_INFO'         // หัวหน้าขอข้อมูลเพิ่ม
                    ];
                    
                    if (!rejectableStatuses.includes(currentStatus)) {
                        const errorMessages: Record<string, string> = {
                            'REQ_ITEM_APPROVED': 'อนุมัติแล้ว ไม่สามารถปฏิเสธได้',
                            'STOCK_PENDING_RECEIVE': 'ส่งไปแผนกพัสดุแล้ว ไม่สามารถปฏิเสธได้',
                            'REQ_CANCELLED_BY_DEPT_HEAD': 'ปฏิเสธแล้ว ไม่สามารถปฏิเสธซ้ำได้',
                            'STOCK_RECEIVED': 'แผนกพัสดุรับแล้ว ไม่สามารถปฏิเสธได้',
                            'REQ_CANCELLED_BY_DEPT': 'ยกเลิกแล้ว ไม่สามารถปฏิเสธได้'
                        };
                        
                        const errorMsg = errorMessages[currentStatus] || `อยู่ในสถานะ "${currentStatus}" ไม่สามารถปฏิเสธได้`;
                        throw new Error(`รายการ "${itemStatus.description}" (item_id: ${requestedItem.item_id}) ${errorMsg}`);
                    }
                }
            }
            
            // เตรียมตัวแปรสำหรับเก็บผลลัพธ์
            let approvedItems: any[] = [];
            let rejectedItems: any[] = [];

            // ดึงข้อมูล items ที่จะประมวลผล (ใช้ข้อมูลจาก itemsStatus ที่ query ไว้แล้ว)

            // จัดการเฉพาะ item ที่ระบุในคำขอ (ไม่อนุมัติทั้งหมดอัตโนมัติ)
            for (const requestedItem of items) {
                // ค้นหาข้อมูล item จากฐานข้อมูลที่ตรวจสอบไว้แล้ว
                const itemStatus = itemsStatus.find((item: any) => item.item_id === requestedItem.item_id);
                
                // ดึงข้อมูลเพิ่มเติมของ item (เช่น quantity)
                const [itemDetail] = await connection.execute(
                    `SELECT item_id, description, quantity FROM tbl_inv_requisition_items 
                     WHERE item_id = ? AND requisition_id = ?`,
                    [requestedItem.item_id, requisitionId]
                );
                
                const itemData = itemDetail[0];
                
                const isApproved = requestedItem.is_approved;
                const itemComment = requestedItem.comment || '';
                const approvedQuantity = requestedItem.approved_quantity || itemData.quantity;
                
                if (isApproved) {
                    // อนุมัติ item และส่งต่อไปยังแผนกพัสดุทันที
                    const newItemStatus = 'STOCK_PENDING_RECEIVE';
                    
                    // อัพเดทจำนวนที่อนุมัติ (ถ้าต่างจากที่ขอ)
                    if (approvedQuantity && approvedQuantity !== itemData.quantity) {
                        await connection.execute(
                            `UPDATE tbl_inv_requisition_items 
                             SET note = CONCAT(COALESCE(note, ''), ' | อนุมัติจำนวน: ${approvedQuantity}'), 
                                 updated_by_user_id = ?, date_updated = NOW() 
                             WHERE item_id = ?`,
                            [approved_by_user_id, itemData.item_id]
                        );
                    }

                    // อัพเดทสถานะ item ให้ส่งต่อไปแผนกพัสดุ
                    await connection.execute(
                        `UPDATE tbl_inv_status_item_current 
                         SET current_status_code = ?, current_status_since = NOW(), 
                             last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE item_id = ?`,
                        [newItemStatus, `หัวหน้าอนุมัติและส่งต่อแผนกพัสดุ: ${itemComment || comment}`, approved_by_user_id, itemData.item_id]
                    );

                    // Log event การอนุมัติและส่งต่อ
                    await connection.execute(
                        `INSERT INTO tbl_inv_item_event_logs 
                         (item_id, event_type, new_status_code, event_description, 
                          ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                         VALUES (?, 'APPROVE', ?, ?, ?, ?, ?, ?, NOW())`,
                        [
                            itemData.item_id, newItemStatus,
                            `หัวหน้าหน่วยงานอนุมัติและส่งต่อแผนกพัสดุ: ${itemData.description}${approvedQuantity !== itemData.quantity ? ` (จำนวนที่อนุมัติ: ${approvedQuantity})` : ''} (โดย ${approved_by_user_id})`,
                            req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                            JSON.stringify({
                                action: 'head_approve_and_forward',
                                original_quantity: itemData.quantity,
                                approved_quantity: approvedQuantity,
                                comment: itemComment || comment,
                                forwarded_to: 'STOCK_DEPARTMENT',
                                changed_by_username: approved_by_user_id
                            }),
                            approved_by_user_id
                        ]
                    );

                    approvedItems.push({
                        item_id: itemData.item_id,
                        description: itemData.description,
                        original_quantity: itemData.quantity,
                        approved_quantity: approvedQuantity,
                        status: newItemStatus
                    });

                } else {
                    // ปฏิเสธ item
                    const newItemStatus = 'REQ_CANCELLED_BY_DEPT_HEAD';
                    
                    await connection.execute(
                        `UPDATE tbl_inv_status_item_current 
                         SET current_status_code = ?, current_status_since = NOW(), 
                             last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE item_id = ?`,
                        [newItemStatus, `หัวหน้าปฏิเสธ: ${itemComment}`, approved_by_user_id, itemData.item_id]
                    );

                    // Log event
                    await connection.execute(
                        `INSERT INTO tbl_inv_item_event_logs 
                         (item_id, event_type, new_status_code, event_description, 
                          ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                         VALUES (?, 'REJECT', ?, ?, ?, ?, ?, ?, NOW())`,
                        [
                            itemData.item_id, newItemStatus,
                            `หัวหน้าหน่วยงานปฏิเสธรายการ: ${itemData.description} (โดย ${approved_by_user_id})`,
                            req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                            JSON.stringify({
                                action: 'head_reject_item',
                                reason: itemComment || 'ไม่ระบุเหตุผล',
                                changed_by_username: approved_by_user_id
                            }),
                            approved_by_user_id
                        ]
                    );

                    rejectedItems.push({
                        item_id: itemData.item_id,
                        description: itemData.description,
                        reason: itemComment
                    });
                }
            }

            // ตรวจสอบสถานะ Requisition หลังจากการอนุมัติ
            const [itemStatusCount] = await connection.execute(
                `SELECT 
                    COUNT(*) as total_items,
                    SUM(CASE WHEN is_cancelled = 0 THEN 1 ELSE 0 END) as active_items,
                    SUM(CASE WHEN is_cancelled = 1 THEN 1 ELSE 0 END) as cancelled_items
                 FROM tbl_inv_requisition_items 
                 WHERE requisition_id = ?`,
                [requisitionId]
            );

            const statusCount = itemStatusCount[0];
            // กำหนดสถานะใหม่ของ Requisition ตามผลการดำเนินการ
            let finalRequisitionStatus = oldStatus;
            
            if (approvedItems.length > 0 && rejectedItems.length === 0) {
                // อนุมัติทั้งหมดที่ระบุ
                finalRequisitionStatus = 'REQ_APPROVED_BY_HEAD';
            } else if (approvedItems.length === 0 && rejectedItems.length > 0) {
                // ปฏิเสธทั้งหมดที่ระบุ
                finalRequisitionStatus = 'REQ_CANCELLED_BY_DEPT_HEAD';
            } else if (approvedItems.length > 0 && rejectedItems.length > 0) {
                // มีทั้งอนุมัติและปฏิเสธ
                finalRequisitionStatus = 'REQ_APPROVED_BY_HEAD';
            }

            // อัพเดทสถานะ Requisition ขั้นสุดท้าย
            await connection.execute(
                `UPDATE tbl_inv_requisitions 
                 SET current_status = ?, updated_by_user_id = ?, date_updated = NOW() 
                 WHERE id = ?`,
                [finalRequisitionStatus, approved_by_user_id, requisitionId]
            );

            // บันทึกประวัติการอนุมัติ
            await connection.execute(
                `INSERT INTO tbl_inv_status_logs 
                 (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    requisitionId, oldStatus, finalRequisitionStatus, 
                    `หัวหน้าหน่วยงานดำเนินการคำขอเบิก - รายการที่อนุมัติ: ${approvedItems.length}, รายการที่ปฏิเสธ: ${rejectedItems.length}${comment ? ` | หมายเหตุ: ${comment}` : ''}`,
                    approved_by_user_id
                ]
            );

            return {
                requisitionId,
                status: finalRequisitionStatus,
                approved_items: approvedItems,
                rejected_items: rejectedItems,
                total_approved: approvedItems.length,
                total_rejected: rejectedItems.length
            };
        }, 'headApproveRequest');

        res.json({
            success: true,
            message: 'อนุมัติคำขอเบิกเรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        console.log('Head approve error:', error.message);
        
        const businessLogicErrors = [
            'ไม่พบคำขอเบิกหรือไม่อยู่ในสถานะที่อนุมัติได้',
            'ไม่พบรายการ'
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
            console.error('Error approving requisition:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการอนุมัติคำขอเบิก',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// ฟังก์ชันขอข้อมูลเพิ่มเติมโดยหัวหน้าหน่วยงาน (ขอได้เฉพาะ PENDING_APPROVAL, REQUEST_INFO)
export const headRequestMoreInfo = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== HEAD REQUEST MORE INFO ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('==============================');

        const requisitionId = req.params.reqId || req.params.requisitionId || req.query.reqId as string;
        
        if (!requisitionId) {
            res.status(400).json({
                success: false,
                message: "ไม่พบ requisitionId ในคำขอ"
            });
            return;
        }

        const schema = Joi.object({
            reason: Joi.string().required(),
            requested_by_user_id: Joi.string().max(15).required(),
            additional_info_needed: Joi.array().items(Joi.string()).optional(),
            deadline: Joi.date().iso().optional(),
            items: Joi.array().items(
                Joi.object({
                    item_id: Joi.number().integer().required(),
                    info_needed: Joi.string().required()
                })
            ).optional()
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

        const { 
            reason, 
            requested_by_user_id, 
            additional_info_needed = [], 
            deadline,
            items = [] 
        } = value;
        
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบสถานะปัจจุบันของ requisition
            const [existingReq] = await connection.execute(
                `SELECT * FROM tbl_inv_requisitions WHERE id = ?`,
                [requisitionId]
            );
            
            if (existingReq.length === 0) {
                throw new Error('ไม่พบคำขอเบิกดังกล่าว');
            }
            
            const requisitionData = existingReq[0];
            const allowedRequisitionStatuses = [
                'REQ_PENDING_DEPT_APPROVAL',    // รอหัวหน้าอนุมัติ
                'REQ_APPROVED_BY_HEAD',         // อนุมัติแล้วบางส่วน
                'REQ_DEPT_REQUEST_INFO'         // หัวหน้าขอข้อมูลเพิ่ม
            ];
            
            if (!allowedRequisitionStatuses.includes(requisitionData.current_status)) {
                const statusMessages: Record<string, string> = {
                    'REQ_CANCELLED_BY_DEPT_HEAD': 'ปฏิเสธแล้ว ไม่สามารถขอข้อมูลเพิ่มได้',
                    'REQ_CANCELLED_BY_DEPT': 'ยกเลิกแล้ว ไม่สามารถขอข้อมูลเพิ่มได้'
                };
                
                const errorMsg = statusMessages[requisitionData.current_status] || `อยู่ในสถานะ "${requisitionData.current_status}" ไม่สามารถขอข้อมูลเพิ่มได้`;
                throw new Error(`คำขอเบิก ${errorMsg}`);
            }

            const oldStatus = requisitionData.current_status;
            
            const affectedItems = [];
            
            // ตรวจสอบและอัพเดทเฉพาะ items ที่ระบุ หรือทั้งหมดถ้าไม่ระบุ
            const itemsToProcess = items.length > 0 ? items : [];
            
            if (items.length === 0) {
                // ถ้าไม่ระบุ items แปลว่าขอข้อมูลทั้งคำขอเบิก
                const [allItems] = await connection.execute(
                    `SELECT item_id, description FROM tbl_inv_requisition_items 
                     WHERE requisition_id = ? AND is_cancelled = 0`,
                    [requisitionId]
                );
                
                for (const itemData of allItems) {
                    itemsToProcess.push({
                        item_id: itemData.item_id,
                        info_needed: reason
                    });
                }
            }

            // State Transition Rules: ขอข้อมูลเพิ่มได้เฉพาะ PENDING_APPROVAL, REQUEST_INFO
            for (const item of itemsToProcess) {
                const [existingItem] = await connection.execute(
                    `SELECT ri.item_id, ri.description, ri.is_cancelled, sic.current_status_code
                     FROM tbl_inv_requisition_items ri
                     LEFT JOIN tbl_inv_status_item_current sic ON ri.item_id = sic.item_id
                     WHERE ri.item_id = ? AND ri.requisition_id = ?`,
                    [item.item_id, requisitionId]
                );
                
                if (existingItem.length === 0) {
                    throw new Error(`ไม่พบรายการ item_id ${item.item_id} ในคำขอเบิก ${requisitionId}`);
                }
                
                const itemData = existingItem[0];
                
                if (itemData.is_cancelled === 1) {
                    throw new Error(`รายการ "${itemData.description}" (item_id: ${item.item_id}) ถูกยกเลิกไปแล้ว`);
                }
                
                // ขอข้อมูลเพิ่มได้: รออนุมัติ, ขอข้อมูลเพิ่มอยู่แล้ว
                const infoRequestableStatuses = [
                    'REQ_PENDING_DEPT_APPROVAL',    // รอหัวหน้าอนุมัติ
                    'REQ_DEPT_REQUEST_INFO'         // หัวหน้าขอข้อมูลเพิ่ม (สามารถขอเพิ่มได้อีก)
                ];
                
                if (!infoRequestableStatuses.includes(itemData.current_status_code)) {
                    const errorMessages: Record<string, string> = {
                        'REQ_ITEM_APPROVED': 'อนุมัติแล้ว ไม่สามารถขอข้อมูลเพิ่มได้',
                        'STOCK_PENDING_RECEIVE': 'ส่งไปแผนกพัสดุแล้ว ไม่สามารถขอข้อมูลเพิ่มได้',
                        'REQ_CANCELLED_BY_DEPT_HEAD': 'ปฏิเสธแล้ว ไม่สามารถขอข้อมูลเพิ่มได้',
                        'STOCK_RECEIVED': 'แผนกพัสดุรับแล้ว ไม่สามารถขอข้อมูลเพิ่มได้',
                        'REQ_CANCELLED_BY_DEPT': 'ยกเลิกแล้ว ไม่สามารถขอข้อมูลเพิ่มได้'
                    };
                    
                    const errorMsg = errorMessages[itemData.current_status_code] || `อยู่ในสถานะ "${itemData.current_status_code}" ไม่สามารถขอข้อมูลเพิ่มได้`;
                    throw new Error(`รายการ "${itemData.description}" (item_id: ${item.item_id}) ${errorMsg}`);
                }
            }

            // อัพเดทสถานะเฉพาะ items ที่ระบุ
            for (const item of itemsToProcess) {
                const [itemDetail] = await connection.execute(
                    `SELECT item_id, description FROM tbl_inv_requisition_items 
                     WHERE item_id = ? AND requisition_id = ?`,
                    [item.item_id, requisitionId]
                );
                
                const itemData = itemDetail[0];
                const itemInfoNeeded = item.info_needed;
                
                const newItemStatus = 'REQ_DEPT_REQUEST_INFO';
                
                await connection.execute(
                    `UPDATE tbl_inv_status_item_current 
                     SET current_status_code = ?, current_status_since = NOW(), 
                         last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                     WHERE item_id = ?`,
                    [newItemStatus, `ต้องการข้อมูลเพิ่ม: ${itemInfoNeeded}`, requested_by_user_id, itemData.item_id]
                );

                // Log event
                await connection.execute(
                    `INSERT INTO tbl_inv_item_event_logs 
                     (item_id, event_type, new_status_code, event_description, 
                      ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                     VALUES (?, 'INFO_REQ', ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        itemData.item_id, newItemStatus,
                        `หัวหน้าหน่วยงานขอข้อมูลเพิ่มเติม: ${itemData.description} (โดย ${requested_by_user_id})`,
                        req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                        JSON.stringify({
                            action: 'request_more_info',
                            reason: reason,
                            info_needed: itemInfoNeeded,
                            additional_info_needed: additional_info_needed,
                            deadline: deadline,
                            changed_by_username: requested_by_user_id
                        }),
                        requested_by_user_id
                    ]
                );

                affectedItems.push({
                    item_id: itemData.item_id,
                    description: itemData.description,
                    info_needed: itemInfoNeeded
                });
            }

            // ตรวจสอบว่าต้องอัพเดทสถานะ requisition หรือไม่
            let newStatus = oldStatus;
            
            // ถ้าขอข้อมูลทั้งหมด หรือ item ที่เหลือทั้งหมดต้องการข้อมูลเพิ่ม
            if (items.length === 0 || affectedItems.length > 0) {
                // ตรวจสอบว่ามี item อื่นที่ไม่ต้องการข้อมูลเพิ่มหรือไม่
                const [allItemsStatus] = await connection.execute(
                    `SELECT COUNT(*) as total_items,
                            SUM(CASE WHEN current_status_code = 'REQ_DEPT_REQUEST_INFO' THEN 1 ELSE 0 END) as info_requested_items
                     FROM tbl_inv_status_item_current sic
                     JOIN tbl_inv_requisition_items ri ON sic.item_id = ri.item_id 
                     WHERE ri.requisition_id = ? AND ri.is_cancelled = 0`,
                    [requisitionId]
                );
                
                const statusCount = allItemsStatus[0];
                
                // ถ้าทุก item ต้องการข้อมูลเพิ่ม ให้เปลี่ยนสถานะ requisition
                if (statusCount.info_requested_items === statusCount.total_items) {
                    newStatus = 'REQ_DEPT_REQUEST_INFO';
                    
                    await connection.execute(
                        `UPDATE tbl_inv_requisitions 
                         SET current_status = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE id = ?`,
                        [newStatus, requested_by_user_id, requisitionId]
                    );
                }
            }

            // บันทึกประวัติการขอข้อมูลเพิ่ม
            const additionalInfoText = additional_info_needed.length > 0 ? ` | ข้อมูลที่ต้องการ: ${additional_info_needed.join(', ')}` : '';
            const affectedItemsList = affectedItems.map(item => item.description).join(', ');
            
            await connection.execute(
                `INSERT INTO tbl_inv_status_logs 
                 (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    requisitionId, oldStatus, newStatus, 
                    `หัวหน้าหน่วยงานขอข้อมูลเพิ่มเติม${items.length > 0 ? ` (${affectedItems.length} รายการ: ${affectedItemsList})` : ''}: ${reason}${deadline ? ` | กำหนดส่ง: ${moment(deadline).format('DD/MM/YYYY HH:mm')}` : ''}${additionalInfoText}`,
                    requested_by_user_id
                ]
            );

            return {
                requisitionId,
                status: newStatus,
                reason: reason,
                affected_items: affectedItems,
                additional_info_needed: additional_info_needed,
                deadline: deadline,
                total_items: affectedItems.length,
                is_selective: items.length > 0
            };
        }, 'headRequestMoreInfo');

        res.json({
            success: true,
            message: 'ส่งคำขอข้อมูลเพิ่มเติมเรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        console.log('Head request more info error:', error.message);
        
        const businessLogicErrors = [
            'ไม่พบคำขอเบิกหรือไม่อยู่ในสถานะที่สามารถขอข้อมูลเพิ่มได้'
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
            console.error('Error requesting more info:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการขอข้อมูลเพิ่มเติม',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);

// ฟังก์ชันปฏิเสธคำขอเบิกโดยหัวหน้าหน่วยงาน (ปฏิเสธได้เฉพาะ PENDING_APPROVAL, REQUEST_INFO)
export const headRejectRequest = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== HEAD REJECT REQUEST ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('==========================');

        const requisitionId = req.params.reqId || req.params.requisitionId || req.query.reqId as string;
        
        if (!requisitionId) {
            res.status(400).json({
                success: false,
                message: "ไม่พบ requisitionId ในคำขอ"
            });
            return;
        }

        const schema = Joi.object({
            reason: Joi.string().required(),
            rejected_by_user_id: Joi.string().max(15).required(),
            reject_type: Joi.string().valid('full', 'selective').default('full'),
            items: Joi.array().items(
                Joi.object({
                    item_id: Joi.number().integer().required(),
                    reason: Joi.string().required()
                })
            ).when('reject_type', { is: 'selective', then: Joi.required(), otherwise: Joi.optional() })
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

        const { reason, rejected_by_user_id, reject_type, items = [] } = value;
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบสถานะปัจจุบันของ requisition
            const [existingReq] = await connection.execute(
                `SELECT * FROM tbl_inv_requisitions WHERE id = ?`,
                [requisitionId]
            );
            
            if (existingReq.length === 0) {
                throw new Error('ไม่พบคำขอเบิกดังกล่าว');
            }
            
            const requisitionData = existingReq[0];
            const allowedRequisitionStatuses = [
                'REQ_PENDING_DEPT_APPROVAL',    // รอหัวหน้าอนุมัติ
                'REQ_DEPT_REQUEST_INFO',        // หัวหน้าขอข้อมูลเพิ่ม
                'REQ_APPROVED_BY_HEAD'          // อนุมัติแล้วบางส่วน
            ];
            
            if (!allowedRequisitionStatuses.includes(requisitionData.current_status)) {
                const statusMessages: Record<string, string> = {
                    'REQ_CANCELLED_BY_DEPT_HEAD': 'ปฏิเสธแล้ว ไม่สามารถปฏิเสธซ้ำได้',
                    'REQ_CANCELLED_BY_DEPT': 'ยกเลิกแล้ว ไม่สามารถปฏิเสธได้'
                };
                
                const errorMsg = statusMessages[requisitionData.current_status] || `อยู่ในสถานะ "${requisitionData.current_status}" ไม่สามารถปฏิเสธได้`;
                throw new Error(`คำขอเบิก ${errorMsg}`);
            }

            const oldStatus = requisitionData.current_status;
            let newStatus = oldStatus;
            let rejectedItems: any[] = [];

            if (reject_type === 'full') {
                // ปฏิเสธทั้งหมด
                newStatus = 'REQ_CANCELLED_BY_DEPT_HEAD';

                // อัพเดทสถานะ requisition พร้อมบันทึกข้อมูลการปฏิเสธ
                await connection.execute(
                    `UPDATE tbl_inv_requisitions 
                     SET current_status = ?, is_cancelled = 1, cancelled_by_user_id = ?, 
                         date_cancelled = NOW(), cancel_reason = ?, updated_by_user_id = ?, date_updated = NOW() 
                     WHERE id = ?`,
                    [newStatus, rejected_by_user_id, reason, rejected_by_user_id, requisitionId]
                );

                // ดึง items และอัพเดทสถานะ
                const [allItems] = await connection.execute(
                    `SELECT item_id, description FROM tbl_inv_requisition_items 
                     WHERE requisition_id = ? AND is_cancelled = 0`,
                    [requisitionId]
                );

                for (const item of allItems) {
                    // อัพเดทฟิลด์ is_cancelled
                    await connection.execute(
                        `UPDATE tbl_inv_requisition_items 
                         SET is_cancelled = 1, cancelled_by_user_id = ?, date_cancelled = NOW(), 
                             cancel_reason = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE item_id = ?`,
                        [rejected_by_user_id, reason, rejected_by_user_id, item.item_id]
                    );

                    // อัพเดทสถานะ item
                    await connection.execute(
                        `UPDATE tbl_inv_status_item_current 
                         SET current_status_code = ?, current_status_since = NOW(), 
                             last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE item_id = ?`,
                        ['REQ_CANCELLED_BY_DEPT_HEAD', `หัวหน้าปฏิเสธ: ${reason}`, rejected_by_user_id, item.item_id]
                    );

                    // Log item rejection
                    await connection.execute(
                        `INSERT INTO tbl_inv_item_event_logs 
                         (item_id, event_type, new_status_code, event_description, 
                          ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                         VALUES (?, 'REJECT', ?, ?, ?, ?, ?, ?, NOW())`,
                        [
                            item.item_id, 'REJECT',
                            `หัวหน้าหน่วยงานปฏิเสธคำขอเบิก: ${item.description} (โดย ${rejected_by_user_id})`,
                            req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                            JSON.stringify({
                                action: 'head_reject_full',
                                reason: reason,
                                changed_by_username: rejected_by_user_id
                            }),
                            rejected_by_user_id
                        ]
                    );

                    rejectedItems.push({
                        item_id: item.item_id,
                        description: item.description,
                        reason: reason
                    });
                }

            } else if (reject_type === 'selective') {
                // ปฏิเสธเฉพาะรายการ
                const validItems = [];
                
                // State Transition Rules: ปฏิเสธได้เฉพาะ PENDING_APPROVAL, REQUEST_INFO
                for (const item of items) {
                    const [existingItem] = await connection.execute(
                        `SELECT ri.item_id, ri.description, ri.is_cancelled, sic.current_status_code
                         FROM tbl_inv_requisition_items ri
                         LEFT JOIN tbl_inv_status_item_current sic ON ri.item_id = sic.item_id
                         WHERE ri.item_id = ? AND ri.requisition_id = ?`,
                        [item.item_id, requisitionId]
                    );
                    
                    if (existingItem.length === 0) {
                        throw new Error(`ไม่พบรายการ item_id ${item.item_id} ในคำขอเบิก ${requisitionId}`);
                    }
                    
                    const itemData = existingItem[0];
                    
                    if (itemData.is_cancelled === 1) {
                        throw new Error(`รายการ "${itemData.description}" (item_id: ${item.item_id}) ถูกยกเลิกไปแล้ว`);
                    }
                    
                    // ปฏิเสธได้: รออนุมัติ, ขอข้อมูลเพิ่ม
                    const rejectableStatuses = [
                        'REQ_PENDING_DEPT_APPROVAL',    // รอหัวหน้าอนุมัติ
                        'REQ_DEPT_REQUEST_INFO'         // หัวหน้าขอข้อมูลเพิ่ม
                    ];
                    
                    if (!rejectableStatuses.includes(itemData.current_status_code)) {
                        const errorMessages: Record<string, string> = {
                            'REQ_ITEM_APPROVED': 'อนุมัติแล้ว ไม่สามารถปฏิเสธได้',
                            'STOCK_PENDING_RECEIVE': 'ส่งไปแผนกพัสดุแล้ว ไม่สามารถปฏิเสธได้',
                            'REQ_CANCELLED_BY_DEPT_HEAD': 'ปฏิเสธแล้ว ไม่สามารถปฏิเสธซ้ำได้',
                            'STOCK_RECEIVED': 'แผนกพัสดุรับแล้ว ไม่สามารถปฏิเสธได้',
                            'REQ_CANCELLED_BY_DEPT': 'ยกเลิกแล้ว ไม่สามารถปฏิเสธได้'
                        };
                        
                        const errorMsg = errorMessages[itemData.current_status_code] || `อยู่ในสถานะ "${itemData.current_status_code}" ไม่สามารถปฏิเสธได้`;
                        throw new Error(`รายการ "${itemData.description}" (item_id: ${item.item_id}) ${errorMsg}`);
                    }
                    
                    validItems.push({
                        ...item,
                        itemData: itemData
                    });
                }

                if (validItems.length === 0) {
                    throw new Error('ไม่พบรายการที่สามารถปฏิเสธได้');
                }

                // ปฏิเสธรายการที่ถูกต้อง
                for (const item of validItems) {
                    const itemData = item.itemData;

                    // อัพเดทฟิลด์ is_cancelled
                    await connection.execute(
                        `UPDATE tbl_inv_requisition_items 
                         SET is_cancelled = 1, cancelled_by_user_id = ?, date_cancelled = NOW(), 
                             cancel_reason = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE item_id = ?`,
                        [rejected_by_user_id, item.reason, rejected_by_user_id, item.item_id]
                    );

                    // อัพเดทสถานะ item
                    await connection.execute(
                        `UPDATE tbl_inv_status_item_current 
                         SET current_status_code = ?, current_status_since = NOW(), 
                             last_comment = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE item_id = ?`,
                        ['REQ_CANCELLED_BY_DEPT_HEAD', `หัวหน้าปฏิเสธ: ${item.reason}`, rejected_by_user_id, item.item_id]
                    );

                    // Log item rejection
                    await connection.execute(
                        `INSERT INTO tbl_inv_item_event_logs 
                         (item_id, event_type, new_status_code, event_description, 
                          ip_address, user_agent, additional_data, created_by_user_id, date_created) 
                         VALUES (?, 'REJECT', ?, ?, ?, ?, ?, ?, NOW())`,
                        [
                            item.item_id, 'REJECT',
                            `หัวหน้าหน่วยงานปฏิเสธรายการ: ${itemData.description} (โดย ${rejected_by_user_id})`,
                            req.ip || 'unknown', req.get('User-Agent') || 'unknown',
                            JSON.stringify({
                                action: 'head_reject_selective',
                                item_id: item.item_id,
                                reason: item.reason,
                                changed_by_username: rejected_by_user_id
                            }),
                            rejected_by_user_id
                        ]
                    );

                    rejectedItems.push({
                        item_id: item.item_id,
                        description: itemData.description,
                        reason: item.reason
                    });
                }

                // ตรวจสอบว่ามีรายการที่ใช้งานได้เหลืออยู่หรือไม่
                const [remainingItems] = await connection.execute(
                    `SELECT COUNT(*) as active_count FROM tbl_inv_requisition_items 
                     WHERE requisition_id = ? AND is_cancelled = 0`,
                    [requisitionId]
                );

                // หากไม่มีรายการเหลือ ให้ปฏิเสธคำขอเบิกอัตโนมัติ
                if (remainingItems[0].active_count === 0) {
                    newStatus = 'REQ_CANCELLED_BY_DEPT_HEAD';
                    
                    await connection.execute(
                        `UPDATE tbl_inv_requisitions 
                         SET current_status = ?, is_cancelled = 1, cancelled_by_user_id = ?, 
                             date_cancelled = NOW(), cancel_reason = ?, updated_by_user_id = ?, date_updated = NOW() 
                         WHERE id = ?`,
                        [newStatus, rejected_by_user_id, `ปฏิเสธอัตโนมัติ: รายการทั้งหมดถูกปฏิเสธแล้ว`, rejected_by_user_id, requisitionId]
                    );
                }
            }

            // ตรวจสอบว่าเป็น auto close หรือไม่
            let autoClosedRequisition = reject_type === 'full';
            if (reject_type === 'selective') {
                const [finalCheck] = await connection.execute(
                    `SELECT COUNT(*) as active_count FROM tbl_inv_requisition_items 
                     WHERE requisition_id = ? AND is_cancelled = 0`,
                    [requisitionId]
                );
                autoClosedRequisition = finalCheck[0].active_count === 0;
            }

            // บันทึกประวัติการปฏิเสธ
            await connection.execute(
                `INSERT INTO tbl_inv_status_logs 
                 (requisition_id, previous_status, new_status, comment, created_by_user_id, date_created) 
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    requisitionId, oldStatus, newStatus, 
                    `หัวหน้าหน่วยงานปฏิเสธคำขอเบิกทั้งหมด: ${reason}`,
                    rejected_by_user_id
                ]
            );

            return {
                requisitionId,
                status: newStatus,
                reject_type: reject_type,
                rejected_items: rejectedItems,
                total_rejected: rejectedItems.length,
                autoClosedRequisition: autoClosedRequisition
            };
        }, 'headRejectRequest');

        res.json({
            success: true,
            message: 'ปฏิเสธคำขอเบิกเรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        console.log('Head reject error:', error.message);
        
        const businessLogicErrors = [
            'ไม่พบคำขอเบิกหรือไม่อยู่ในสถานะที่ปฏิเสธได้',
            'ไม่พบรายการ',
            'ถูกยกเลิกไปแล้ว'
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
            console.error('Error rejecting requisition:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการปฏิเสธคำขอเบิก',
                error: error.message,
                type: 'server_error'
            });
        }
    }
}, 30000);