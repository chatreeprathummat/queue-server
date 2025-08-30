import { Router } from 'express';
const router: Router = Router();
const { 
    getPatientByHN,
    getPatientList
} = require('../controllers/OracleController') as any;

// ดึงข้อมูลผู้ป่วยโดยระบุ HN (รองรับทั้ง URL parameter และ query parameter)
router.get('/patient-by-hn/:hn', getPatientByHN);

// ดึงรายการผู้ป่วยทั้งหมด (สำหรับค้นหา)
router.post('/patient-list', getPatientList);

export default router; 