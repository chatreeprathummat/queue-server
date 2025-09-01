import { Router } from 'express';
const router: Router = Router();

const {
  screenRoomSummary,
  screenRoomByStatus,
  screenRoomWaitCalled,
  screenRoomWaitingXRLabAndMissCalled,
  roomCallingPollAndPop,
  drugPreparingList,
  rxCounterDisplay,
  rxCallingPollAndPopBoth,
  rxCallingPollAndPopSingle,
  getMarqueeByOpdPost
} = require('../controllers/QueueController');

// หน้าห้องตรวจ ทุกสถานะ รอเรียกตรวจ, รอ XR LAB, เรียกไม่พบ
router.get('/display/room/summary/:opdCode/:roomCode', screenRoomSummary);

// หน้าห้องตรวจ แบบระบุรหัสห้องตรวจ
router.post('/display/room/status', screenRoomByStatus);

// หน้าห้องตรวจ เฉพาะสถานะรอเรียกตรวจ
router.get('/display/room/waitcalled/:opdCode/:roomCode', screenRoomWaitCalled); 

// หน้าห้องตรวจ เฉพาะสถานะรอ XR LAB และเรียกไม่พบ
router.get('/display/room/xrlabandmisscall/:opdCode/:roomCode', screenRoomWaitingXRLabAndMissCalled); 

// ห้องตรวจดึง “ตัวแรกตามลำดับ” แล้วลบทิ้ง ในคำสั่งเดียว
router.post('/display/room/calling', roomCallingPollAndPop);

// List จัดยา
router.get('/display/rx/prepare/:opdCode', drugPreparingList);

// List คิวรอรเียกรับยา
router.get('/display/rx/wait/:opdCode', rxCounterDisplay);

// เรียกรับยาตามช่อง: 1 เส้น/1 จอ → คืนข้อมูล 2 ช่องพร้อมกัน
router.post('/display/rx/calling', rxCallingPollAndPopBoth);

// เรียกรับยาตามช่อง: ระบุช่อง → ทำงานอิสระ
router.post('/display/rx/calling/single', rxCallingPollAndPopSingle);

// ข้อความประชาสัมพันธ์
router.get('/marquee/:opdCode', getMarqueeByOpdPost);

module.exports = router;
