import { Router } from 'express';
const router: Router = Router();
const {
    createQuotation,
    getQuotations,
    getQuotationById,
    uploadAttachment,
    deleteAttachment,
    getSuppliers,
    downloadAttachment,
    uploadFromScanner,
    getScannerFiles,
    getUploadedFiles,
    deleteQuotation
} = require('../controllers/ScanDocumentController') as any;

// สร้างใบเสนอราคาใหม่
router.post('/create-quotation', createQuotation);

// ดึงรายการใบเสนอราคา
router.get('/quotations', getQuotations);

// ดึงข้อมูลใบเสนอราคาเดียว
router.get('/quotation/:quotationId', getQuotationById);

// อัปโหลดไฟล์แนบ
router.post('/quotation/:quotationId/upload', uploadAttachment);

// ลบไฟล์แนบ
router.delete('/attachment/:attachmentId', deleteAttachment);

// ดึงรายการผู้จำหน่าย
router.get('/suppliers', getSuppliers);

// ดาวน์โหลดไฟล์
router.get('/attachment/:attachmentId/download', downloadAttachment);

// อัปโหลดไฟล์จาก Electron Scanner
router.post('/upload-from-scanner', uploadFromScanner);

// ดึงไฟล์จาก Electron Scanner
router.get('/scanner-files', getScannerFiles);

// ดึงรายการไฟล์ที่อัปโหลดล่าสุด
router.get('/uploaded-files', getUploadedFiles);

// ลบใบเสนอราคา
router.delete('/quotation/:quotationId', deleteQuotation);

export default router;
