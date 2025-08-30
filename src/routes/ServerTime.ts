import { Router } from 'express';
const router: Router = Router();
const { 
    getCurrentDateTime,
    getTimezoneInfo
} = require('../controllers/ServerTimeController') as any;

// ========================================
// Routes สำหรับ Server Time Management
// ========================================

// ดึงวันที่และเวลาปัจจุบันจาก server
router.get('/server/current-datetime', getCurrentDateTime);

// ดึงข้อมูล timezone และการตั้งค่าของ server
router.get('/server/timezone-info', getTimezoneInfo);

export default router; 