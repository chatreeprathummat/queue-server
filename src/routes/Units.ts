import { Router } from 'express';
const router: Router = Router();
const { 
    getUnits,
    createUnit
} = require('../controllers/UnitsController') as any;

// ========================================
// Routes สำหรับ Server Time Management
// ========================================

// ดึงข้อมูลหน่วยนับ
router.get('/units', getUnits);

// สร้างหน่วยนับใหม่
router.post('/units', createUnit);

export default router; 