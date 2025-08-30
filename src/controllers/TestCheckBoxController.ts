import { Request, Response } from 'express';

// Import modules
const ManagementDB = require('../services/ManagementDB').default as any;
const { safeLogger } = require('../services/logging') as any;
const { wrapController } = require("../services/logging/controllers/requestLogger") as any;
const Joi = require('joi') as any;
const moment = require('moment') as any;
const { upload, saveUploadedFile, deleteFile, fileExists } = require('../services/testCheckBoxService') as any;

// Interface definitions สำหรับ TestCheckBox
interface TestFormData {
    pr_number: string;
    item_name: string;
    supplier_type: 'SELECTED' | 'CUSTOM';
    supplier_id?: number;
    custom_supplier_name?: string;
    created_by_user_id: string;
}

interface TestDocumentItem {
    document_id: string;
    document_name: string;
    document_description?: string;
    is_required: boolean;
    is_selected: boolean;
}

interface TestAttachment {
    file_name: string;
    original_file_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    file_extension: string;
    upload_method: 'UPLOAD' | 'SCAN';
    document_item_id: number;
}

interface SaveTestFormRequest {
    form_data: TestFormData;
    document_items: TestDocumentItem[];
    attachments: TestAttachment[];
}

// Extend Request interface for multer
interface MulterRequest extends Request {
    file?: any;
    files?: any;
}

// Helper function
const sanitizeForMySQL = (value: any): any => {
    return value === undefined ? null : value;
};

// ========================================
// ฟังก์ชันดึงข้อมูลพื้นฐาน
// ========================================

// ดึงรายการผู้จำหน่ายจากฐานข้อมูล
export const getSuppliers = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== GET SUPPLIERS ===');
        
        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();
        
        try {
            // ตรวจสอบการเชื่อมต่อฐานข้อมูล
            console.log('Database connection established');
            
            // ตรวจสอบจำนวนข้อมูลทั้งหมดในตาราง
            const [totalCount] = await connection.execute(`
                SELECT COUNT(*) as total FROM tbl_inv_suppliers1
            `);
            console.log('Total suppliers in table:', totalCount && totalCount[0] ? totalCount[0].total : 0);
            
            // ตรวจสอบจำนวนข้อมูลที่ active
            const [activeCount] = await connection.execute(`
                SELECT COUNT(*) as active FROM tbl_inv_suppliers1 WHERE is_active = 1
            `);
            console.log('Active suppliers in table:', activeCount && activeCount[0] ? activeCount[0].active : 0);
                   
            // ดึงข้อมูลผู้จำหน่าย
            const [suppliers] = await connection.execute(`
                SELECT 
                    supplier_id,
                    supplier_code,
                    supplier_name,
                    supplier_type,
                    tax_id,
                    phone,
                    email,
                    contact_person
                FROM tbl_inv_suppliers1 
                WHERE is_active = 1
                ORDER BY supplier_name ASC
            `);
            
            console.log('Raw suppliers result:', suppliers);
            console.log('Suppliers type:', typeof suppliers);
            console.log('Suppliers is array:', Array.isArray(suppliers));
            console.log('Suppliers length:', suppliers ? suppliers.length : 'undefined');
           
            const suppliersArray = Array.isArray(suppliers) ? suppliers.map((supplier: any) => {
                return {
                    supplier_id: supplier.supplier_id,
                    supplier_code: supplier.supplier_code,
                    supplier_name: supplier.supplier_name,
                    supplier_type: supplier.supplier_type,
                    tax_id: supplier.tax_id,
                    phone: supplier.phone,
                    email: supplier.email,
                    contact_person: supplier.contact_person
                }
            }) : [];

            console.log('Processed suppliers array:', suppliersArray);
            console.log('Final array length:', suppliersArray.length);
            
            res.status(200).json({
                success: true,
                message: 'ดึงข้อมูลผู้จำหน่ายเรียบร้อยแล้ว',
                data: suppliersArray
            });
            
        } finally {
            connection.release();
        }
                   
    } catch (error: any) {
        console.error('Error getting suppliers:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้จำหน่าย',
            error: error.message
        });
    }
}, 60000);


// ดึงรายการประเภทสินค้า

// ดึงรายการประเภทเอกสารจากฐานข้อมูล
export const getDocumentTypes = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== GET DOCUMENT TYPES ===');
        
        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();
        
        try {
            const [documentTypes] = await connection.execute(`
                SELECT 
                    id,
                    document_code,
                    document_name,
                    document_description,
                    is_required,
                    display_order
                FROM tbl_in_test_document_types 
                WHERE is_active = 1
                ORDER BY display_order ASC, document_name ASC
            `);
            
            res.status(200).json({
                success: true,
                message: 'ดึงข้อมูลประเภทเอกสารเรียบร้อยแล้ว',
                data: documentTypes
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error: any) {
        console.error('Error getting document types:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทเอกสาร',
            error: error.message
        });
    }
}, 30000);

// ดึงข้อมูลทดสอบที่บันทึกไว้
export const getTestForms = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== GET TEST FORMS ===');
        
        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();
        
        try {
            const [forms] = await connection.execute(`
                SELECT 
                    f.id,
                    f.pr_number,
                    f.item_name,
                    f.supplier_type,
                    f.supplier_id,
                    f.custom_supplier_name,
                    f.total_documents,
                    f.total_files,
                    f.created_by_user_id,
                    f.date_created,
                    s.supplier_name,
                    s.supplier_code
                FROM tbl_in_test_forms f
                LEFT JOIN tbl_inv_suppliers1 s ON f.supplier_id = s.supplier_id
                ORDER BY f.date_created DESC
                LIMIT 50
            `);
            
            res.status(200).json({
                success: true,
                message: 'ดึงข้อมูลฟอร์มทดสอบเรียบร้อยแล้ว',
                data: forms
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error: any) {
        console.error('Error getting test forms:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลฟอร์มทดสอบ',
            error: error.message
        });
    }
}, 30000);

// ดึงข้อมูลไฟล์แนบของฟอร์มทดสอบ
export const getTestFormAttachments = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== GET TEST FORM ATTACHMENTS ===');
        
        const { formId } = req.params;
        
        if (!formId) {
            res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสฟอร์ม'
            });
            return;
        }

        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();
        
        try {
            // ดึงข้อมูลฟอร์ม
            const [forms] = await connection.execute(
                'SELECT * FROM tbl_in_test_forms WHERE id = ?',
                [formId]
            );

            if (forms.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลฟอร์ม'
                });
                return;
            }

            const form = forms[0];

            // ดึงข้อมูลรายการเอกสารและไฟล์แนบ
            const [documentItems] = await connection.execute(`
                SELECT 
                    di.id,
                    di.document_id,
                    di.document_name,
                    di.document_description,
                    di.is_required,
                    di.is_selected,
                    di.file_count,
                    di.created_by_user_id,
                    di.date_created,
                    COUNT(a.id) as actual_file_count
                FROM tbl_in_test_document_items di
                LEFT JOIN tbl_in_test_attachments a ON di.id = a.document_item_id
                WHERE di.form_id = ?
                GROUP BY di.id
                ORDER BY di.id ASC
            `, [formId]);

            // ดึงข้อมูลไฟล์แนบของฟอร์ม
            const [attachments] = await connection.execute(
                `SELECT 
                    a.id,
                    a.form_id,
                    a.document_item_id,
                    a.file_name,
                    a.original_file_name,
                    a.file_path,
                    a.file_size,
                    a.mime_type,
                    a.file_extension,
                    a.upload_method,
                    a.page_number,
                    a.uploaded_by_user_id,
                    di.document_name,
                    di.document_id
                FROM tbl_in_test_attachments a
                JOIN tbl_in_test_document_items di ON a.document_item_id = di.id
                WHERE a.form_id = ?
                ORDER BY a.document_item_id, a.page_number ASC`,
                [formId]
            );

            // จัดกลุ่มไฟล์ตาม document_item
            const attachmentsByDocument: { [key: number]: any[] } = {};
            attachments.forEach((attachment: any) => {
                if (!attachmentsByDocument[attachment.document_item_id]) {
                    attachmentsByDocument[attachment.document_item_id] = [];
                }
                attachmentsByDocument[attachment.document_item_id].push(attachment);
            });

            // เพิ่มข้อมูลไฟล์แนบให้แต่ละรายการเอกสาร
            const documentItemsWithFiles = documentItems.map((item: any) => ({
                ...item,
                files: attachmentsByDocument[item.id] || [],
                file_count_mismatch: item.file_count !== (attachmentsByDocument[item.id]?.length || 0)
            }));

            res.status(200).json({
                success: true,
                message: 'ดึงข้อมูลไฟล์แนบเรียบร้อยแล้ว',
                data: {
                    form: {
                        id: form.id,
                        pr_number: form.pr_number,
                        item_name: form.item_name,
                        supplier_type: form.supplier_type,
                        total_documents: form.total_documents,
                        total_files: form.total_files,
                        created_by_user_id: form.created_by_user_id,
                        date_created: form.date_created
                    },
                    document_items: documentItemsWithFiles,
                    attachments: attachments,
                    summary: {
                        total_documents: documentItems.length,
                        total_files: attachments.length,
                        documents_with_files: documentItemsWithFiles.filter((item: any) => item.files.length > 0).length,
                        documents_without_files: documentItemsWithFiles.filter((item: any) => item.files.length === 0).length,
                        files_with_mismatch: documentItemsWithFiles.filter((item: any) => item.file_count_mismatch).length
                    }
                }
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error: any) {
        console.error('Error getting test form attachments:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์แนบ',
            error: error.message
        });
    }
}, 30000);

// ========================================
// ฟังก์ชันหลักสำหรับ TestCheckBox
// ========================================

// บันทึกข้อมูลฟอร์มทดสอบ
export const saveTestForm = wrapController(async (req: MulterRequest, res: Response): Promise<void> => {
    try {
        console.log('=== SAVE TEST FORM ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('Files:', req.files);
        console.log('========================');

        const schema = Joi.object({
            form_data: Joi.object({
                pr_number: Joi.string().max(50).required(),
                item_name: Joi.string().max(255).required(),
                supplier_type: Joi.string().valid('SELECTED', 'CUSTOM').required(),
                supplier_id: Joi.number().integer().when('supplier_type', { 
                    is: 'SELECTED', 
                    then: Joi.required() 
                }),
                custom_supplier_name: Joi.string().max(200).when('supplier_type', { 
                    is: 'CUSTOM', 
                    then: Joi.required() 
                }),
                created_by_user_id: Joi.string().max(15).required()
            }).required(),
            document_items: Joi.array().items(Joi.object({
                document_id: Joi.string().max(20).required(),
                document_name: Joi.string().max(100).required(),
                document_description: Joi.string().allow(null, ''),
                is_required: Joi.boolean().required(),
                is_selected: Joi.boolean().required()
            })).required(),
            attachments: Joi.array().items(Joi.object({
                file_name: Joi.string().max(255).required(),
                original_file_name: Joi.string().max(255).required(),
                file_path: Joi.string().max(500).required(),
                file_size: Joi.number().integer().min(0).required(),
                mime_type: Joi.string().max(100).required(),
                file_extension: Joi.string().max(20).required(),
                upload_method: Joi.string().valid('UPLOAD', 'SCAN').required(),
                document_item_id: Joi.number().integer().required()
            })).required()
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

        const data = value as SaveTestFormRequest;
        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // 1. บันทึกข้อมูลฟอร์มหลัก
            const [formResult] = await connection.execute(
                `INSERT INTO tbl_in_test_forms (
                    pr_number, item_name, supplier_type, supplier_id, 
                    custom_supplier_name, created_by_user_id
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    data.form_data.pr_number,
                    data.form_data.item_name,
                    data.form_data.supplier_type,
                    sanitizeForMySQL(data.form_data.supplier_id),
                    sanitizeForMySQL(data.form_data.custom_supplier_name),
                    data.form_data.created_by_user_id
                ]
            );

            const formId = formResult.insertId;

            // 2. บันทึกรายการเอกสาร
            const documentItems: Array<{id: number, document_id: string, document_name: string}> = [];
            for (const docItem of data.document_items) {
                const [docResult] = await connection.execute(
                    `INSERT INTO tbl_in_test_document_items (
                        form_id, document_id, document_name, document_description,
                        is_required, is_selected, created_by_user_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        formId,
                        docItem.document_id,
                        docItem.document_name,
                        sanitizeForMySQL(docItem.document_description),
                        docItem.is_required ? 1 : 0,
                        docItem.is_selected ? 1 : 0,
                        data.form_data.created_by_user_id
                    ]
                );
                
                documentItems.push({
                    id: docResult.insertId,
                    document_id: docItem.document_id,
                    document_name: docItem.document_name
                });
            }

            // 3. บันทึกไฟล์แนบ (ถ้ามี)
            const attachmentIds: number[] = [];
            for (const attachment of data.attachments) {
                const [attResult] = await connection.execute(
                    `INSERT INTO tbl_in_test_attachments (
                        form_id, document_item_id, file_name, original_file_name,
                        file_path, file_size, mime_type, file_extension,
                        upload_method, uploaded_by_user_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        formId,
                        attachment.document_item_id,
                        attachment.file_name,
                        attachment.original_file_name,
                        attachment.file_path,
                        attachment.file_size,
                        attachment.mime_type,
                        attachment.file_extension,
                        attachment.upload_method,
                        data.form_data.created_by_user_id
                    ]
                );
                attachmentIds.push(attResult.insertId);
            }

            // 4. อัปเดตจำนวนเอกสารและไฟล์ในฟอร์มหลัก
            await connection.execute(
                `UPDATE tbl_in_test_forms 
                 SET total_documents = (
                     SELECT COUNT(*) FROM tbl_in_test_document_items 
                     WHERE form_id = ? AND is_selected = 1
                 ),
                 total_files = (
                     SELECT COUNT(*) FROM tbl_in_test_attachments 
                     WHERE form_id = ?
                 )
                 WHERE id = ?`,
                [formId, formId, formId]
            );

            // 5. อัปเดตจำนวนไฟล์ในแต่ละรายการเอกสาร
            for (const docItem of documentItems) {
                await connection.execute(
                    `UPDATE tbl_in_test_document_items 
                     SET file_count = (
                         SELECT COUNT(*) FROM tbl_in_test_attachments 
                         WHERE document_item_id = ?
                     )
                     WHERE id = ?`,
                    [docItem.id, docItem.id]
                );
            }

            return {
                formId,
                documentItems,
                attachmentIds
            };
        }, 'saveTestForm');

        res.status(200).json({
            success: true,
            message: 'บันทึกข้อมูลฟอร์มทดสอบเรียบร้อยแล้ว',
            data: {
                form_id: result.formId,
                document_items: result.documentItems,
                document_items_count: result.documentItems.length,
                attachments_count: result.attachmentIds.length
            }
        });

    } catch (error: any) {
        console.error('Error saving test form:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
            error: error.message
        });
    }
}, 60000);

// อัพโหลดไฟล์
export const uploadFile = wrapController(async (req: MulterRequest, res: Response): Promise<void> => {
    try {
        console.log('=== UPLOAD FILE ===');
        console.log('File:', req.file);
        console.log('Body:', req.body);
        
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'ไม่พบไฟล์ที่อัพโหลด'
            });
            return;
        }

        const file = req.file;
        const { document_item_id, uploaded_by_user_id, prNumber, documentCode } = req.body;

        if (!document_item_id || !uploaded_by_user_id) {
            res.status(400).json({
                success: false,
                message: 'ข้อมูลไม่ครบถ้วน'
            });
            return;
        }

        const db = ManagementDB.getInstance();

        const result = await db.executeTransaction(async (connection: any) => {
            // ตรวจสอบว่า document_item_id มีอยู่จริง
            if (document_item_id == 0) {
                throw new Error('กรุณาบันทึกฟอร์มก่อนอัพโหลดไฟล์');
            }

            // ดึงข้อมูล document_item และ form
            const [documentItems] = await connection.execute(
                `SELECT di.*, f.pr_number 
                 FROM tbl_in_test_document_items di
                 JOIN tbl_in_test_forms f ON di.form_id = f.id
                 WHERE di.id = ?`,
                [document_item_id]
            );

            if (documentItems.length === 0) {
                throw new Error('ไม่พบรายการเอกสารที่ระบุ');
            }

            const documentItem = documentItems[0];
            const formId = documentItem.form_id;

            // นับจำนวนไฟล์ที่มีอยู่แล้วสำหรับ document_item นี้
            const [existingFiles] = await connection.execute(
                'SELECT COUNT(*) as count FROM tbl_in_test_attachments WHERE document_item_id = ?',
                [document_item_id]
            );

            const pageNumber = existingFiles[0].count + 1;

            // ใช้ชื่อไฟล์ที่ multer middleware สร้างให้แล้ว
            const newFileName = file.filename;
            const fileExtension = file.originalname.split('.').pop()?.toLowerCase() || 'pdf';

            console.log(`📁 ใช้ชื่อไฟล์จาก multer: ${newFileName}`);
            console.log(`📄 เอกสาร: ${documentItem.document_name} (ID: ${document_item_id})`);
            console.log(`📊 หน้า: ${pageNumber}`);

            // บันทึกข้อมูลไฟล์ลงฐานข้อมูล
            const [attachmentResult] = await connection.execute(
                `INSERT INTO tbl_in_test_attachments (
                    form_id, document_item_id, file_name, original_file_name,
                    file_path, file_size, mime_type, file_extension,
                    upload_method, uploaded_by_user_id, page_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    formId,
                    document_item_id,
                    newFileName,
                    file.originalname,
                    file.path,
                    file.size,
                    file.mimetype,
                    fileExtension,
                    'UPLOAD',
                    uploaded_by_user_id,
                    pageNumber
                ]
            );

            // อัปเดตจำนวนไฟล์ใน document_item
            await connection.execute(
                `UPDATE tbl_in_test_document_items 
                 SET file_count = (
                     SELECT COUNT(*) FROM tbl_in_test_attachments 
                     WHERE document_item_id = ?
                 )
                 WHERE id = ?`,
                [document_item_id, document_item_id]
            );

            // อัปเดตจำนวนไฟล์ในฟอร์มหลัก
            await connection.execute(
                `UPDATE tbl_in_test_forms 
                 SET total_files = (
                     SELECT COUNT(*) FROM tbl_in_test_attachments 
                     WHERE form_id = ?
                 )
                 WHERE id = ?`,
                [formId, formId]
            );

            console.log(`✅ บันทึกไฟล์สำเร็จ: ${newFileName} (ID: ${attachmentResult.insertId})`);

            return {
                attachment_id: attachmentResult.insertId,
                file_name: newFileName,
                original_file_name: file.originalname,
                file_size: file.size,
                mime_type: file.mimetype,
                file_path: file.path,
                document_item_id: document_item_id,
                page_number: pageNumber
            };
        }, 'uploadFile');

        res.status(200).json({
            success: true,
            message: 'อัพโหลดไฟล์เรียบร้อยแล้ว',
            data: result
        });

    } catch (error: any) {
        console.error('Error uploading file:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัพโหลดไฟล์',
            error: error.message
        });
    }
}, 30000);



// ดาวน์โหลดไฟล์
export const downloadFile = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== DOWNLOAD FILE ===');
        
        const { attachmentId } = req.params;
        const { action = 'view' } = req.query; // 'view' หรือ 'print'
        
        if (!attachmentId) {
            res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสไฟล์แนบ'
            });
            return;
        }

        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();

        try {
            const [attachments] = await connection.execute(
                'SELECT * FROM tbl_in_test_attachments WHERE id = ?',
                [attachmentId]
            );

            if (attachments.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'ไม่พบไฟล์แนบ'
                });
                return;
            }

            const attachment = attachments[0];
            
            if (!fileExists(attachment.file_path)) {
                res.status(404).json({
                    success: false,
                    message: 'ไฟล์ไม่พบในระบบ'
                });
                return;
            }



            // บันทึกการเข้าถึงไฟล์
            await connection.execute(
                `INSERT INTO tbl_in_test_file_access_logs (
                    attachment_id, action, accessed_by_user_id, ip_address, user_agent
                ) VALUES (?, ?, ?, ?, ?)`,
                [
                    attachmentId,
                    action,
                    req.headers['x-user-id'] || 'anonymous',
                    req.ip || req.connection.remoteAddress || 'unknown',
                    req.headers['user-agent'] || 'unknown'
                ]
            );

            // ถ้าเป็นการพิมพ์ ให้อัปเดตจำนวนการพิมพ์
            if (action === 'print') {
                await connection.execute(
                    `UPDATE tbl_in_test_attachments 
                     SET print_count = COALESCE(print_count, 0) + 1,
                         last_printed_at = CURRENT_TIMESTAMP,
                         last_printed_by = ?
                     WHERE id = ?`,
                    [req.headers['x-user-id'] || 'anonymous', attachmentId]
                );
            }

            // ส่งไฟล์ให้ดาวน์โหลดหรือแสดง
            console.log(`📁 ส่งไฟล์: ${attachment.file_path}`);
            console.log(`📄 MIME Type: ${attachment.mime_type}`);
            console.log(`📊 Action: ${action}`);
            console.log(`📏 File Size: ${attachment.file_size} bytes`);
            console.log(`🔍 File Exists: ${fileExists(attachment.file_path)}`);
            
            // ตั้งค่า headers
            res.setHeader('Content-Type', attachment.mime_type);
            res.setHeader('Content-Disposition', `inline; filename="${attachment.original_file_name}"`);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Range');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            
            // ส่งไฟล์
            res.sendFile(attachment.file_path, (err) => {
                if (err) {
                    console.error('❌ Error sending file:', err);
                    res.status(500).json({
                        success: false,
                        message: 'เกิดข้อผิดพลาดในการส่งไฟล์',
                        error: err.message
                    });
                } else {
                    console.log('✅ ส่งไฟล์สำเร็จ');
                }
            });

        } finally {
            connection.release();
        }

    } catch (error: any) {
        console.error('Error downloading file:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์',
            error: error.message
        });
    }
}, 30000);
