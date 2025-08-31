import { Router } from 'express';
const router: Router = Router();

const {
  screenRoomSummary,
  screenRoomByStatus,
  roomCallingPollAndPop,
  drugPreparingList,
  rxCounterDisplay,
  rxCallingPollAndPopBoth,
  rxCallingPollAndPopSingle
} = require('../controllers/QueueController');

// หน้าจอหน้าห้องตรวจ
router.get('/display/:opdCode/:roomCode', screenRoomSummary);               // รวม (01/03/04)
router.get('/display/:opdCode/:roomCode/:statusId', screenRoomByStatus); // แยกตามสถานะ

// ห้องตรวจดึง “ตัวแรกตามลำดับ” แล้วลบทิ้ง ในคำสั่งเดียว
router.post('/room/calling/:opdCode/:roomCode', roomCallingPollAndPop);

// List จัดยา
router.get('/rx/prepare/:opdCode', drugPreparingList);

// List คิวรอรเียกรับยา
router.get('/rx/wait/:opdCode', rxCounterDisplay);

// เรียกรับยาตามช่อง: 1 เส้น/1 จอ → คืนข้อมูล 2 ช่องพร้อมกัน
router.get('/rx/calling/:opdCode/:displayCode', rxCallingPollAndPopBoth);

// เรียกรับยาตามช่อง: ระบุช่อง → ทำงานอิสระ
router.post('/rx/calling/opd/:opdCode/display/:displayCode/channel/:channelCode', rxCallingPollAndPopSingle);


















// // หน้าห้องรับยา
// router.get('/display/rx/opd/:opdCode', rxCounterDisplay);

// // เรียกคิวกำลังเรียกรับยาจาก display.id + channel
// router.post('/rx/call', callRxByDisplayId);

// // ลบคิวกำลังเรียกรับยาออกจากจอแสดงผลตาม display.id
// router.delete('/rx/display/:id', removeRxDisplayById);

// // คิวเรียกเข้าห้องตรวจ (บันทึกลง tbl_queue_display)
// router.post('/room/call', callRoomByTransactionId);

// ลบคิวเรียกเข้าห้องตรวจออกจากจอแสดงผลตาม display.id (ต้องส่ง roomCode)
// router.delete('/room/display/:id', removeRoomDisplayById);

module.exports = router;
