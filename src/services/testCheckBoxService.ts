import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
const multer = require('multer');

// Interface definitions
interface UploadedFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
}

interface FileUploadResult {
    success: boolean;
    file_name?: string;
    original_file_name?: string;
    file_path?: string;
    file_size?: number;
    mime_type?: string;
    file_extension?: string;
    error?: string;
}

// ========================================
// File Upload Configuration
// ========================================

// สร้างโฟลเดอร์สำหรับเก็บไฟล์ทดสอบ
const TEST_UPLOAD_DIR = path.join(__dirname, '../../uploads/test');
if (!fs.existsSync(TEST_UPLOAD_DIR)) {
    fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
}

// ตรวจสอบประเภทไฟล์ที่อนุญาต
const fileFilter = (req: Request, file: any, cb: Function) => {
    const allowedMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`ประเภทไฟล์ ${file.mimetype} ไม่ได้รับอนุญาต`), false);
    }
};

// สร้าง multer instance พื้นฐาน
const basicUpload = multer({
    storage: multer.diskStorage({
        destination: (req: Request, file: any, cb: Function) => {
            cb(null, TEST_UPLOAD_DIR);
        },
        filename: (req: Request, file: any, cb: Function) => {
            // สร้างชื่อไฟล์ชั่วคราวก่อน
            const timestamp = Date.now();
            const extension = path.extname(file.originalname);
            const tempFilename = `temp_${timestamp}_${Math.random().toString(36).substring(2, 8)}${extension}`;
            cb(null, tempFilename);
        }
    }),
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 10 // จำนวนไฟล์สูงสุด
    }
});

// สร้าง middleware ที่ custom สำหรับอัพโหลดไฟล์
export const upload = (req: Request, res: Response, next: Function) => {
    basicUpload.single('file')(req, res, (err: any) => {
        if (err) {
            return next(err);
        }
        
        if (req.file) {
            // เปลี่ยนชื่อไฟล์หลังจากได้ข้อมูลจาก form data แล้ว
            const file = req.file;
            const { prNumber, documentCode, document_item_id } = req.body;
            
            // สร้างชื่อไฟล์ใหม่
            const now = new Date();
            const dateStr = now.getFullYear().toString() +
                           (now.getMonth() + 1).toString().padStart(2, '0') +
                           now.getDate().toString().padStart(2, '0') +
                           now.getHours().toString().padStart(2, '0') +
                           now.getMinutes().toString().padStart(2, '0') +
                           now.getSeconds().toString().padStart(2, '0') +
                           now.getMilliseconds().toString().padStart(3, '0');
            
            const prNumberForFile = prNumber || 'PR-UNKNOWN';
            const documentCodeForFile = documentCode || 'DOC';
            
            const extension = path.extname(file.originalname);
            const newFilename = `${prNumberForFile}-${documentCodeForFile}-${dateStr}${extension}`;
            
            // เปลี่ยนชื่อไฟล์
            const oldPath = file.path;
            const newPath = path.join(path.dirname(oldPath), newFilename);
            
            try {
                fs.renameSync(oldPath, newPath);
                file.filename = newFilename;
                file.path = newPath;
                
                console.log(`📁 เปลี่ยนชื่อไฟล์: ${oldPath} -> ${newPath}`);
                console.log(`📄 ข้อมูล: PR=${prNumberForFile}, Code=${documentCodeForFile}`);
            } catch (renameError) {
                console.error('❌ เกิดข้อผิดพลาดในการเปลี่ยนชื่อไฟล์:', renameError);
                // ถ้าเปลี่ยนชื่อไม่ได้ ให้ใช้ชื่อเดิม
            }
        }
        
        next();
    });
};

// ========================================
// File Management Functions
// ========================================

// บันทึกไฟล์ที่อัพโหลด
export const saveUploadedFile = async (file: UploadedFile, documentItemId: number, userId: string): Promise<FileUploadResult> => {
    try {
        // ตรวจสอบว่าไฟล์มีอยู่จริง
        if (!fs.existsSync(file.path)) {
            return {
                success: false,
                error: 'ไฟล์ไม่พบในระบบ'
            };
        }

        // อ่านข้อมูลไฟล์
        const stats = fs.statSync(file.path);
        const fileExtension = path.extname(file.originalname).toLowerCase().replace('.', '');

        return {
            success: true,
            file_name: file.filename,
            original_file_name: file.originalname,
            file_path: file.path,
            file_size: stats.size,
            mime_type: file.mimetype,
            file_extension: fileExtension
        };

    } catch (error: any) {
        return {
            success: false,
            error: `เกิดข้อผิดพลาดในการบันทึกไฟล์: ${error.message}`
        };
    }
};

// ลบไฟล์จากระบบ
export const deleteFile = async (filePath: string): Promise<boolean> => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error: any) {
        console.error('Error deleting file:', error);
        return false;
    }
};

// ตรวจสอบไฟล์มีอยู่จริง
export const fileExists = (filePath: string): boolean => {
    return fs.existsSync(filePath);
};

// อ่านไฟล์เป็น base64
export const readFileAsBase64 = (filePath: string): string | null => {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const fileBuffer = fs.readFileSync(filePath);
        return fileBuffer.toString('base64');
    } catch (error: any) {
        console.error('Error reading file as base64:', error);
        return null;
    }
};

// ========================================
// Document Type Management
// ========================================

// ประเภทเอกสารที่ใช้ในระบบทดสอบ
export const getDocumentTypes = () => {
    return [
        {
            id: '1',
            name: 'ใบเสนอราคา',
            description: 'ใบเสนอราคาสินค้าหรือบริการ',
            is_required: true
        },
        {
            id: '2',
            name: 'ใบรับรองคุณภาพ',
            description: 'เอกสารรับรองคุณภาพสินค้า',
            is_required: true
        },
        {
            id: '3',
            name: 'ใบอนุญาตประกอบการ',
            description: 'หนังสือรับรองการจดทะเบียนบริษัท',
            is_required: false
        },
        {
            id: '4',
            name: 'แคตตาล็อกสินค้า',
            description: 'รายละเอียดและข้อมูลเทคนิคสินค้า',
            is_required: false
        },
        {
            id: '5',
            name: 'ใบรับประกันสินค้า',
            description: 'เอกสารรับประกันคุณภาพสินค้า',
            is_required: false
        },
        {
            id: '6',
            name: 'ใบรับรองมาตรฐาน',
            description: 'ใบรับรองมาตรฐาน ISO หรือมาตรฐานอื่นๆ',
            is_required: false
        }
    ];
};

// ========================================
// Validation Functions
// ========================================

// ตรวจสอบข้อมูลฟอร์ม
export const validateFormData = (formData: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!formData.pr_number || formData.pr_number.trim() === '') {
        errors.push('กรุณากรอกเลขที่ PR');
    }

    if (!formData.item_name || formData.item_name.trim() === '') {
        errors.push('กรุณากรอกชื่อรายการ');
    }

    if (!formData.supplier_type) {
        errors.push('กรุณาเลือกประเภทผู้จำหน่าย');
    } else {
        if (formData.supplier_type === 'SELECTED' && !formData.supplier_id) {
            errors.push('กรุณาเลือกผู้จำหน่ายจากรายการ');
        }
        if (formData.supplier_type === 'CUSTOM' && (!formData.custom_supplier_name || formData.custom_supplier_name.trim() === '')) {
            errors.push('กรุณากรอกชื่อผู้จำหน่าย');
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

// ตรวจสอบข้อมูลเอกสาร
export const validateDocumentItems = (documentItems: any[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!documentItems || documentItems.length === 0) {
        errors.push('กรุณาเลือกเอกสารอย่างน้อย 1 รายการ');
        return { isValid: false, errors: errors };
    }

    const selectedItems = documentItems.filter(item => item.is_selected);
    if (selectedItems.length === 0) {
        errors.push('กรุณาเลือกเอกสารอย่างน้อย 1 รายการ');
    }

    // ตรวจสอบเอกสารที่จำเป็น
    const requiredItems = documentItems.filter(item => item.is_required && item.is_selected);
    for (const item of requiredItems) {
        if (!item.document_name || item.document_name.trim() === '') {
            errors.push(`กรุณากรอกชื่อเอกสารสำหรับ ${item.document_name || 'เอกสารที่จำเป็น'}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

// ตรวจสอบไฟล์แนบ
export const validateAttachments = (attachments: any[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    for (const attachment of attachments) {
        if (!attachment.file_name || attachment.file_name.trim() === '') {
            errors.push('กรุณาเลือกไฟล์แนบ');
            continue;
        }

        if (!attachment.original_file_name || attachment.original_file_name.trim() === '') {
            errors.push('ไม่พบชื่อไฟล์เดิม');
            continue;
        }

        if (!attachment.file_path || !fileExists(attachment.file_path)) {
            errors.push(`ไฟล์ ${attachment.original_file_name} ไม่พบในระบบ`);
            continue;
        }

        if (!attachment.mime_type) {
            errors.push(`ไม่พบประเภทไฟล์สำหรับ ${attachment.original_file_name}`);
            continue;
        }

        if (!attachment.file_size || attachment.file_size <= 0) {
            errors.push(`ขนาดไฟล์ไม่ถูกต้องสำหรับ ${attachment.original_file_name}`);
            continue;
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

// ========================================
// Utility Functions
// ========================================

// แปลงขนาดไฟล์เป็นรูปแบบที่อ่านง่าย
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// สร้างชื่อไฟล์ที่ไม่ซ้ำกัน
export const generateUniqueFileName = (originalName: string): string => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(originalName);
    return `${timestamp}_${randomString}${extension}`;
};

// ตรวจสอบประเภทไฟล์ที่อนุญาต
export const isAllowedFileType = (mimeType: string): boolean => {
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    return allowedTypes.includes(mimeType);
};

// ดึงนามสกุลไฟล์จาก MIME type
export const getFileExtensionFromMimeType = (mimeType: string): string => {
    const mimeToExt: { [key: string]: string } = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
    };
    return mimeToExt[mimeType] || 'unknown';
}; 