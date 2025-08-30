import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Import with require for modules without type declarations
const ManagementDB = require('../services/ManagementDB').default as any;
const { logger } = require('../services/logging') as any;
const { wrapController } = require("../services/logging/controllers/requestLogger") as any;
const Joi = require('joi') as any;
const moment = require('moment') as any;

// Helper function to convert undefined to null for MySQL
const sanitizeForMySQL = (value: any): any => {
    return value === undefined ? null : value;
};

// Interface definitions
interface CreateQuotationRequest {
    company_name: string;
    quotation_number: string;
    quotation_date: string;
    total_amount: number;
    currency?: string;
    notes?: string;
    created_by_user_id: string;
}

interface UpdateQuotationRequest {
    company_name?: string;
    quotation_number?: string;
    quotation_date?: string;
    total_amount?: number;
    currency?: string;
    notes?: string;
    status?: string;
}

interface AttachmentInfo {
    file_name: string;
    original_file_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    file_extension: string;
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

// ฟังก์ชันสร้างใบเสนอราคาใหม่
export const createQuotation = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== CREATE QUOTATION ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('=======================');

        // Validate input
        const schema = Joi.object({
            company_name: Joi.string().required(),
            quotation_number: Joi.string().required(),
            quotation_date: Joi.date().iso().required(),
            total_amount: Joi.number().min(0).required(),
            currency: Joi.string().default('THB'),
            notes: Joi.string().allow(null, ''),
            created_by_user_id: Joi.string().max(15).required()
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
            company_name,
            quotation_number,
            quotation_date,
            total_amount,
            currency = 'THB',
            notes = '',
            created_by_user_id
        } = value;

        const db = ManagementDB.getInstance();

        // ใช้ executeTransaction เพื่อจัดการ rollback อัตโนมัติ
        const result = await db.executeTransaction(async (connection: any) => {
            console.log('=== TRANSACTION DEBUG ===');
            console.log('Transaction connection established:', !!connection);
            console.log('=========================');

            // บันทึกข้อมูลใบเสนอราคา
            console.log('=== QUOTATION INSERT DEBUG ===');
            const headerParams = [
                company_name,
                quotation_number, 
                quotation_date, 
                total_amount, 
                currency, 
                sanitizeForMySQL(notes), 
                'ACTIVE', 
                created_by_user_id
            ];
            console.log('Header insert params:', headerParams);
            
            const [headerResult] = await connection.execute(
                `INSERT INTO quotation_records 
                 (company_name, quotation_number, quotation_date, total_amount, currency, notes, status, created_by_user_id, date_created) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                headerParams
            );
            console.log('Header inserted successfully');
            console.log('===========================');
            
            const quotationId = headerResult.insertId;

            return {
                quotationId,
                status: 'ACTIVE'
            };
        }, 'createQuotation');

        console.log('=== CREATE QUOTATION SUCCESS DEBUG ===');
        console.log('Final result:', JSON.stringify(result, null, 2));
        console.log('======================================');
        
        res.status(201).json({
            success: true,
            message: 'สร้างใบเสนอราคาเรียบร้อยแล้ว',
            data: result
        });
        
    } catch (error: any) {
        console.log('Create quotation error:', error.message);
        console.error('Error creating quotation:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างใบเสนอราคา',
            error: error.message
        });
    }
}, 30000);

// ฟังก์ชันดึงรายการใบเสนอราคา
export const getQuotations = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== GET QUOTATIONS ===');
        
        const { company_name, status, page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        
        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();
        
        try {
            // สร้าง WHERE clause
            let whereClause = 'WHERE 1=1';
            const params: any[] = [];
            
            if (company_name) {
                whereClause += ' AND company_name LIKE ?';
                params.push(`%${company_name}%`);
            }
            
            if (status) {
                whereClause += ' AND status = ?';
                params.push(status);
            }
            
            // ดึงข้อมูลใบเสนอราคา
            const [quotations] = await connection.execute(
                `SELECT 
                    quotation_id,
                    company_name,
                    quotation_number,
                    quotation_date,
                    total_amount,
                    currency,
                    notes,
                    status,
                    created_by_user_id,
                    date_created,
                    updated_by_user_id,
                    date_updated,
                    (SELECT COUNT(*) FROM quotation_files WHERE quotation_id = q.quotation_id AND is_deleted = 0) as attachment_count
                FROM quotation_records q
                ${whereClause}
                ORDER BY date_created DESC
                LIMIT ? OFFSET ?`,
                [...params, Number(limit), offset]
            );
            
            // นับจำนวนทั้งหมด
            const [countResult] = await connection.execute(
                `SELECT COUNT(*) as total
                FROM quotation_records q
                ${whereClause}`,
                params
            );
            
            const total = countResult[0].total;
            const totalPages = Math.ceil(total / Number(limit));
            
            res.status(200).json({
                success: true,
                message: 'ดึงข้อมูลใบเสนอราคาเรียบร้อยแล้ว',
                data: {
                    quotations,
                    pagination: {
                        current_page: Number(page),
                        total_pages: totalPages,
                        total_items: total,
                        items_per_page: Number(limit)
                    }
                }
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error: any) {
        console.error('Error getting quotations:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบเสนอราคา',
            error: error.message
        });
    }
}, 30000);

// ฟังก์ชันดึงข้อมูลใบเสนอราคาเดียว
export const getQuotationById = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== GET QUOTATION BY ID ===');
        
        const { quotationId } = req.params;
        
        if (!quotationId) {
            res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสใบเสนอราคา'
            });
            return;
        }
        
        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();
        
        try {
            // ดึงข้อมูลใบเสนอราคา
            const [quotations] = await connection.execute(
                `SELECT * FROM quotation_records WHERE quotation_id = ?`,
                [quotationId]
            );
            
            if (quotations.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลใบเสนอราคา'
                });
                return;
            }
            
            const quotation = quotations[0];
            
            // ดึงไฟล์แนบ
            const [attachments] = await connection.execute(
                `SELECT * FROM quotation_files 
                WHERE quotation_id = ? AND is_deleted = 0 
                ORDER BY upload_date DESC`,
                [quotationId]
            );
            
            res.status(200).json({
                success: true,
                message: 'ดึงข้อมูลใบเสนอราคาเรียบร้อยแล้ว',
                data: {
                    quotation,
                    attachments
                }
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error: any) {
        console.error('Error getting quotation by ID:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบเสนอราคา',
            error: error.message
        });
    }
}, 30000);

// ฟังก์ชันอัปโหลดไฟล์แนบ
export const uploadAttachment = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== UPLOAD ATTACHMENT ===');
        
        const { quotationId } = req.params;
        const { uploaded_by_user_id } = req.body;
        
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'ไม่พบไฟล์ที่อัปโหลด'
            });
            return;
        }
        
        if (!quotationId || !uploaded_by_user_id) {
            res.status(400).json({
                success: false,
                message: 'ข้อมูลไม่ครบถ้วน'
            });
            return;
        }
        
        const file = req.file;
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const mimeType = file.mimetype;
        
        // ตรวจสอบประเภทไฟล์ที่อนุญาต
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(mimeType)) {
            res.status(400).json({
                success: false,
                message: 'ประเภทไฟล์ไม่ถูกต้อง (อนุญาตเฉพาะ PDF, JPEG, PNG, GIF)'
            });
            return;
        }
        
        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();
        
        try {
            // ตรวจสอบว่าใบเสนอราคามีอยู่จริง
            const [quotations] = await connection.execute(
                'SELECT quotation_id FROM quotation_records WHERE quotation_id = ?',
                [quotationId]
            );
            
            if (quotations.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลใบเสนอราคา'
                });
                return;
            }
            
            // สร้างโฟลเดอร์สำหรับเก็บไฟล์ถ้ายังไม่มี
            const uploadDir = path.join(__dirname, '../../../uploads/quotations');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            // ย้ายไฟล์ไปยังโฟลเดอร์ที่กำหนด
            const fileName = `${Date.now()}_${file.originalname}`;
            const filePath = path.join(uploadDir, fileName);
            
            // อ่านไฟล์และเขียนลงตำแหน่งใหม่
            const fileBuffer = fs.readFileSync(file.path);
            fs.writeFileSync(filePath, fileBuffer);
            
            // ลบไฟล์ชั่วคราว
            fs.unlinkSync(file.path);
            
            // บันทึกข้อมูลไฟล์แนบ
            const [result] = await connection.execute(
                `INSERT INTO quotation_files 
                 (quotation_id, file_name, original_file_name, file_path, file_size, mime_type, file_extension, uploaded_by_user_id, created_by_user_id, date_created) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    quotationId,
                    fileName,
                    file.originalname,
                    filePath,
                    file.size,
                    mimeType,
                    fileExtension,
                    uploaded_by_user_id,
                    uploaded_by_user_id
                ]
            );
            
            res.status(201).json({
                success: true,
                message: 'อัปโหลดไฟล์เรียบร้อยแล้ว',
                data: {
                    attachment_id: result.insertId,
                    file_name: fileName,
                    original_file_name: file.originalname,
                    file_size: file.size,
                    mime_type: mimeType,
                    file_path: filePath
                }
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error: any) {
        console.error('Error uploading attachment:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์',
            error: error.message
        });
    }
}, 30000);

// ฟังก์ชันลบไฟล์แนบ
export const deleteAttachment = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== DELETE ATTACHMENT ===');
        
        const { attachmentId } = req.params;
        const { deleted_by_user_id, delete_reason } = req.body;
        
        if (!attachmentId || !deleted_by_user_id) {
            res.status(400).json({
                success: false,
                message: 'ข้อมูลไม่ครบถ้วน'
            });
            return;
        }
        
        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();
        
        try {
            // ตรวจสอบว่าไฟล์แนบมีอยู่จริง
            const [attachments] = await connection.execute(
                'SELECT * FROM quotation_files WHERE attachment_id = ? AND is_deleted = 0',
                [attachmentId]
            );
            
            if (attachments.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลไฟล์แนบ'
                });
                return;
            }
            
            const attachment = attachments[0];
            
            // อัปเดตสถานะการลบ (soft delete)
            await connection.execute(
                `UPDATE quotation_files 
                 SET is_deleted = 1, deleted_by_user_id = ?, date_deleted = NOW(), delete_reason = ?, updated_by_user_id = ?, date_updated = NOW()
                 WHERE attachment_id = ?`,
                [deleted_by_user_id, sanitizeForMySQL(delete_reason), deleted_by_user_id, attachmentId]
            );
            
            // ลบไฟล์จริง (ถ้าต้องการ)
            // fs.unlinkSync(attachment.file_path);
            
            res.status(200).json({
                success: true,
                message: 'ลบไฟล์แนบเรียบร้อยแล้ว'
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error: any) {
        console.error('Error deleting attachment:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบไฟล์แนบ',
            error: error.message
        });
    }
}, 30000);

// ฟังก์ชันดึงรายการผู้จำหน่าย (ไม่ใช้แล้ว แต่เก็บไว้เพื่อความเข้ากันได้)
export const getSuppliers = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== GET SUPPLIERS ===');
        
        // ส่งข้อมูล dummy กลับไป
        res.status(200).json({
            success: true,
            message: 'ดึงข้อมูลผู้จำหน่ายเรียบร้อยแล้ว',
            data: []
        });
        
    } catch (error: any) {
        console.error('Error getting suppliers:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้จำหน่าย',
            error: error.message
        });
    }
}, 30000);

// ฟังก์ชันดาวน์โหลดไฟล์
export const downloadAttachment = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== DOWNLOAD ATTACHMENT ===');
        
        const { attachmentId } = req.params;
        
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
            // ดึงข้อมูลไฟล์แนบ
            const [attachments] = await connection.execute(
                'SELECT * FROM quotation_files WHERE attachment_id = ? AND is_deleted = 0',
                [attachmentId]
            );
            
            if (attachments.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลไฟล์แนบ'
                });
                return;
            }
            
            const attachment = attachments[0];
            
            // ตรวจสอบว่าไฟล์มีอยู่จริง
            if (!fs.existsSync(attachment.file_path)) {
                res.status(404).json({
                    success: false,
                    message: 'ไม่พบไฟล์ในระบบ'
                });
                return;
            }
            
            // ส่งไฟล์
            res.setHeader('Content-Type', attachment.mime_type);
            res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_file_name}"`);
            
            const fileStream = fs.createReadStream(attachment.file_path);
            fileStream.pipe(res);
            
        } finally {
            connection.release();
        }
        
    } catch (error: any) {
        console.error('Error downloading attachment:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์',
            error: error.message
        });
    }
}, 30000);

// ฟังก์ชันอัปโหลดไฟล์จาก Electron Scanner
export const uploadFromScanner = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== UPLOAD FROM SCANNER ===');
        
        const { quotationId, uploaded_by_user_id, fileData } = req.body;
        
        if (!quotationId || !uploaded_by_user_id || !fileData) {
            res.status(400).json({
                success: false,
                message: 'ข้อมูลไม่ครบถ้วน'
            });
            return;
        }
        
        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();
        
        try {
            // ตรวจสอบว่าใบเสนอราคามีอยู่จริง
            const [quotations] = await connection.execute(
                'SELECT quotation_id FROM quotation_records WHERE quotation_id = ?',
                [quotationId]
            );
            
            if (quotations.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลใบเสนอราคา'
                });
                return;
            }
            
            // สร้างโฟลเดอร์สำหรับเก็บไฟล์ถ้ายังไม่มี
            const uploadDir = path.join(__dirname, '../../../uploads/quotations');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            // แปลง base64 เป็นไฟล์
            const fileBuffer = Buffer.from(fileData.base64, 'base64');
            const fileName = `${Date.now()}_${fileData.name}`;
            const filePath = path.join(uploadDir, fileName);
            
            // เขียนไฟล์ลงระบบ
            fs.writeFileSync(filePath, fileBuffer);
            
            // ตรวจสอบประเภทไฟล์
            const fileExtension = path.extname(fileData.name).toLowerCase();
            let mimeType = 'application/octet-stream';
            
            if (fileExtension === '.pdf') {
                mimeType = 'application/pdf';
            } else if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
                mimeType = 'image/jpeg';
            } else if (fileExtension === '.png') {
                mimeType = 'image/png';
            } else if (fileExtension === '.tiff' || fileExtension === '.tif') {
                mimeType = 'image/tiff';
            }
            
            // บันทึกข้อมูลไฟล์แนบ
            const [result] = await connection.execute(
                `INSERT INTO quotation_files 
                 (quotation_id, file_name, original_file_name, file_path, file_size, mime_type, file_extension, uploaded_by_user_id, created_by_user_id, date_created) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    quotationId,
                    fileName,
                    fileData.name,
                    filePath,
                    fileBuffer.length,
                    mimeType,
                    fileExtension,
                    uploaded_by_user_id,
                    uploaded_by_user_id
                ]
            );
            
            res.status(201).json({
                success: true,
                message: 'อัปโหลดไฟล์จาก Scanner เรียบร้อยแล้ว',
                data: {
                    attachment_id: result.insertId,
                    file_name: fileName,
                    original_file_name: fileData.name,
                    file_size: fileBuffer.length,
                    mime_type: mimeType,
                    file_path: filePath
                }
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error: any) {
        console.error('Error uploading from scanner:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์จาก Scanner',
            error: error.message
        });
    }
}, 30000);

// ฟังก์ชันดึงไฟล์จาก Electron Scanner
export const getScannerFiles = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== GET SCANNER FILES ===');
        
        // เรียก API ของ Electron Scanner
        const response = await fetch('http://localhost:3001/api/files');
        
        if (!response.ok) {
            throw new Error('ไม่สามารถเชื่อมต่อกับ Electron Scanner ได้');
        }
        
        const result = await response.json();
        
        res.status(200).json({
            success: true,
            message: 'ดึงข้อมูลไฟล์จาก Scanner เรียบร้อยแล้ว',
            data: result
        });
        
    } catch (error: any) {
        console.error('Error getting scanner files:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์จาก Scanner',
            error: error.message
        });
    }
}, 30000);

// ฟังก์ชันดึงรายการไฟล์ที่อัปโหลดล่าสุด
export const getUploadedFiles = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== GET UPLOADED FILES ===');
        
        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();
        
        try {
            // ดึงไฟล์แนบล่าสุด 10 รายการ
            const [attachments] = await connection.execute(`
                SELECT 
                    attachment_id,
                    quotation_id,
                    file_name,
                    original_file_name,
                    file_path,
                    file_size,
                    mime_type,
                    file_extension,
                    uploaded_by_user_id,
                    date_created
                FROM quotation_files 
                ORDER BY date_created DESC 
                LIMIT 10
            `);
            
            // ตรวจสอบไฟล์ในระบบ
            const uploadDir = path.join(__dirname, '../../../uploads/quotations');
            const filesWithStatus = await Promise.all(
                (attachments as any[]).map(async (attachment: any) => {
                    const fileExists = fs.existsSync(attachment.file_path);
                    return {
                        ...attachment,
                        file_exists: fileExists,
                        file_size_formatted: formatFileSize(attachment.file_size)
                    };
                })
            );
            
            res.status(200).json({
                success: true,
                message: 'ดึงข้อมูลไฟล์ที่อัปโหลดเรียบร้อยแล้ว',
                data: {
                    upload_directory: uploadDir,
                    total_files: filesWithStatus.length,
                    files: filesWithStatus
                }
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error: any) {
        console.error('Error getting uploaded files:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์',
            error: error.message
        });
    }
}, 30000);

// ฟังก์ชันลบใบเสนอราคา
export const deleteQuotation = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== DELETE QUOTATION ===');
        
        const { quotationId } = req.params;
        const { deleted_by_user_id, delete_reason } = req.body;
        
        if (!quotationId || !deleted_by_user_id) {
            res.status(400).json({
                success: false,
                message: 'ข้อมูลไม่ครบถ้วน'
            });
            return;
        }
        
        const db = ManagementDB.getInstance();
        const connection = await db.getConnection();
        
        try {
            // ตรวจสอบว่าใบเสนอราคามีอยู่จริง
            const [quotations] = await connection.execute(
                'SELECT quotation_id FROM quotation_records WHERE quotation_id = ?',
                [quotationId]
            );
            
            if (quotations.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลใบเสนอราคา'
                });
                return;
            }
            
            // ดึงข้อมูลไฟล์แนบ
            const [attachments] = await connection.execute(
                'SELECT file_path FROM quotation_files WHERE quotation_id = ?',
                [quotationId]
            );
            
            // ลบไฟล์ในระบบ
            for (const attachment of attachments as any[]) {
                if (attachment.file_path && fs.existsSync(attachment.file_path)) {
                    try {
                        fs.unlinkSync(attachment.file_path);
                        console.log(`Deleted file: ${attachment.file_path}`);
                    } catch (error) {
                        console.error(`Error deleting file: ${attachment.file_path}`, error);
                    }
                }
            }
            
            // ลบข้อมูลจากฐานข้อมูล (ทำ soft delete)
            await connection.execute(
                `UPDATE quotation_records 
                 SET status = 'CANCELLED',
                     updated_by_user_id = ?,
                     date_updated = NOW()
                 WHERE quotation_id = ?`,
                [deleted_by_user_id, quotationId]
            );
            
            // ลบไฟล์แนบ (soft delete)
            await connection.execute(
                `UPDATE quotation_files 
                 SET is_deleted = 1, 
                     deleted_by_user_id = ?, 
                     date_deleted = NOW(), 
                     delete_reason = ?,
                     updated_by_user_id = ?,
                     date_updated = NOW()
                 WHERE quotation_id = ?`,
                [deleted_by_user_id, delete_reason || 'ลบโดยผู้ใช้', deleted_by_user_id, quotationId]
            );
            
            res.status(200).json({
                success: true,
                message: 'ลบใบเสนอราคาเรียบร้อยแล้ว',
                data: {
                    quotation_id: quotationId,
                    deleted_files: attachments.length
                }
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error: any) {
        console.error('Error deleting quotation:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบใบเสนอราคา',
            error: error.message
        });
    }
}, 30000);

// Helper function สำหรับจัดรูปแบบขนาดไฟล์
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
