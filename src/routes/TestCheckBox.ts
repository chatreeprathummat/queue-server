import { Router } from 'express';
const {
    saveTestForm,
    uploadFile,
    downloadFile,
    getSuppliers,
    getDocumentTypes,
    getTestForms,
    getTestFormAttachments
} = require('../controllers/TestCheckBoxController');
const { upload } = require('../services/testCheckBoxService');

const router = Router();

// ========================================
// API Endpoints สำหรับ TestCheckBox
// ========================================

// ดึงข้อมูลพื้นฐาน
router.get('/test-suppliers', getSuppliers);
router.get('/test-document-types', getDocumentTypes);
router.get('/test-forms', getTestForms);

// ดึงข้อมูลไฟล์แนบของฟอร์ม
router.get('/test-form-attachments/:formId', getTestFormAttachments);

// บันทึกข้อมูลฟอร์มทดสอบ
router.post('/save-test-form', saveTestForm);

// อัพโหลดไฟล์
router.post('/test-upload-file', upload, uploadFile);

// ดาวน์โหลดไฟล์
router.get('/test-download-file/:attachmentId', downloadFile);

export default router;
