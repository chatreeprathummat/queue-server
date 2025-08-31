import { Request, Response } from 'express';
import Joi from 'joi';
const moment = require('moment-timezone');
const ManagementDB = require('../services/ManagementDB').default as any;
const { wrapController } = require("../services/logging/controllers/requestLogger") as any;

// แปลงค่าอะไรก็ได้ให้เป็น array (กรณี DB คืนแถวเดียว)
const asArray = (x: any) => Array.isArray(x) ? x : (x ? [x] : []);

// วันที่ พ.ศ. แบบสั้น เช่น 30/08/2568
const todayBE = () => {
  const m = moment().tz('Asia/Bangkok');
  return `${m.format('DD/MM')}/${m.year() + 543}`;
};

type QueueItem = {
  id: number;
  queueText: string;
  hn: string;
  patientName: string;
  // statusId: AllowedStatus;
  statusName:string;
  createdAt: string; // 'YYYY-MM-DD HH:mm:ss' หรือ string ว่าง
};

/** =========================
 *  1. หน้าจอหน้าห้องตรวจ
 *  =========================
 *  - รวมทุกสถานะที่ต้องการใน 1 เส้นทาง
 *  - และมีเส้นทางย่อย แยกตามสถานะ (01,03,04)
 */
/** 1.1 API รวม: /display/opd/:opdCode/room/:roomCode */
export const screenRoomSummary = wrapController(async (req: Request, res: Response) => {
  // ✅ validate params (ไม่ใช่ body)
  const schema = Joi.object({
    opdCode:  Joi.string().trim().max(10).required()
      .messages({ 'any.required':'ต้องระบุ OPD', 'string.empty':'OPD ห้ามว่าง' }),
    roomCode: Joi.string().trim().max(2).required()
      .messages({ 'any.required':'ต้องระบุรหัสห้องตรวจ', 'string.empty':'รหัสห้องตรวจห้ามว่าง' }),
  });

  const { error, value } = schema.validate(req.params, { abortEarly:false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'พารามิเตอร์ไม่ถูกต้อง',
      errors: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    });
  }

  const { opdCode, roomCode } = value;     // ← ใช้ค่าที่ผ่านการ validate แล้ว
  const db = ManagementDB.getInstance();

  // ── แพทย์ประจำห้อง (วันนี้)
  const sqlDoctor = `
    SELECT 
      COALESCE(doctor_name, '') AS doctor_name,
      COALESCE(depend_name, '') AS doctor_specialty
    FROM tbl_queue_room
    WHERE opd_code = ? AND room_code = ? AND work_date = CURDATE()
    ORDER BY id DESC
    LIMIT 1
  `;

  // ── ดึงคิวสถานะหลัก 01/03/04 ของวันนี้
  const baseQueue = `
    SELECT 
    q.q_id,
    q.q_queue_text,
    q.q_hn,
    CONCAT(q.q_prename, q.q_name, ' ', q.q_surname) AS pt_name,
    q.q_queue_status_id,
    s.s_queue_status_name_display AS status_name,
    q.q_date_created
FROM tbl_queue_transaction q
LEFT JOIN tbl_queue_status s 
       ON q.q_queue_status_id = s.s_queue_status_id
WHERE q.q_date = CURDATE()
  AND q.q_opd_code = ?
  AND q.q_room_code = ?
  AND q.q_queue_status_id IN ('01','03','04')
ORDER BY 
    CAST(SUBSTRING(q.q_queue_text, 2, 1) AS UNSIGNED),
    CAST(SUBSTRING(q.q_queue_text, 4, 1) AS UNSIGNED),
    q.q_date_created,
    CAST(SUBSTRING(q.q_queue_text, 5, 2) AS UNSIGNED);
  `;

  // ยิง query
  const [doctorRow] = await db.executeQuery(sqlDoctor, [opdCode, roomCode]);
  const allQueues = await db.executeQuery(baseQueue, [opdCode, roomCode]);

  // ปรับเป็น array เสมอ
  const rows = asArray(allQueues);

  // mapper: กัน null แบบจุดต่อจุด (ไม่ใช้ safeString)
  const mapItem = (r: any): QueueItem => ({
    id: Number(r.q_id ?? 0),
    queueText: String(r.q_queue_text || ''),
    hn: String(r.q_hn || ''), // << สำคัญ: ถ้า null จะได้เป็น "" ไม่หลุดไป FE
    patientName: String(r.pt_name || ''),
    // statusId: String(r.q_queue_status_id || '') as AllowedStatus,
    statusName: String(r.status_name || ''),
    createdAt: r.q_date_created ? moment(r.q_date_created).format('YYYY-MM-DD HH:mm:ss') : ''
  });

  // แยกตามสถานะเพื่อส่งให้ FE
  const waiting      = rows.filter((r: any) => r.q_queue_status_id === '01').map(mapItem); // รอเรียก
  const waitingXRLab = rows.filter((r: any) => r.q_queue_status_id === '04').map(mapItem); // รอผล/รอ X-ray/Lab
  const missCalled   = rows.filter((r: any) => r.q_queue_status_id === '03').map(mapItem); // เรียกไม่พบ

  // ตอบกลับ
  return res.json({
    success: true,
    dateTH_BE: todayBE(),
    opdCode: opdCode,
    roomCode: roomCode,
    doctorName: String(doctorRow?.doctor_name || ''),
    doctorSpecialty: String(doctorRow?.doctor_specialty || ''),
    queues: {
      waiting,               // 01
      waiting_xray_lab: waitingXRLab, // 04
      miss_called: missCalled // 03
    }
  });
}, 10000);

/** 1.2 แยกสถานะ: /display/opd/:opdCode/room/:roomCode/status/:statusId  (statusId = 01|03|04) */
export const screenRoomByStatus = wrapController(async (req: Request, res: Response) => {
  
  const schema = Joi.object({
    opdCode:  Joi.string().trim().required()
      .messages({ 'any.required':'ต้องระบุ OPD', 'string.empty':'OPD ห้ามว่าง' }),
    roomCode: Joi.string().trim().required()
      .messages({ 'any.required':'ต้องระบุรหัสห้องตรวจ', 'string.empty':'รหัสห้องตรวจห้ามว่าง' }),
    statusId: Joi.string().trim().required()
      .messages({ 'any.required':'ต้องระบุรหัสสถานะ', 'string.empty':'รหัสสถานะห้ามว่าง' }),
  });

  const { error, value } = schema.validate(req.params, { abortEarly:false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'พารามิเตอร์ไม่ถูกต้อง',
      errors: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    });
  }

  const { opdCode, roomCode, statusId } = value;     // ← ใช้ค่าที่ผ่านการ validate แล้ว
  const db = ManagementDB.getInstance();

  // กันสถานะผิด (ถ้า FE ส่งมาผิด จะเลือก '01' แทน — หรือจะเปลี่ยนเป็น 400 ก็ได้)
  // const allowed: AllowedStatus[] = ['01', '03', '04'];
  // const status: AllowedStatus = allowed.includes(statusId as AllowedStatus)
  //   ? (statusId as AllowedStatus)
  //   : '01';

  const sql = `
    SELECT 
    q.q_id,
    q.q_queue_text,
    q.q_hn,
    CONCAT(q.q_prename, q.q_name, ' ', q.q_surname) AS pt_name,
    q.q_queue_status_id,
    s.s_queue_status_name_display AS status_name,
    q.q_date_created
FROM tbl_queue_transaction q
LEFT JOIN tbl_queue_status s 
       ON q.q_queue_status_id = s.s_queue_status_id
WHERE q.q_date = CURDATE()
  AND q.q_opd_code = ?
  AND q.q_room_code = ?
  AND q.q_queue_status_id = ?
ORDER BY 
    CAST(SUBSTRING(q.q_queue_text, 2, 1) AS UNSIGNED),
    CAST(SUBSTRING(q.q_queue_text, 4, 1) AS UNSIGNED),
    q.q_date_created,
    CAST(SUBSTRING(q.q_queue_text, 5, 2) AS UNSIGNED);
  `;

  const raw = await db.executeQuery(sql, [opdCode, roomCode, statusId]);
  const rows = asArray(raw);

  const data: QueueItem[] = rows.map((r: any) => ({
    id: Number(r.q_id ?? 0),
    queueText: String(r.q_queue_text || ''),
    hn: String(r.q_hn || ''), // << ไม่ให้เป็น null
    patientName: String(r.pt_name || ''),
    // statusId: String(r.q_queue_status_id || '') as AllowedStatus,
     statusName:String(r.status_name || ''),
    createdAt: r.q_date_created ? moment(r.q_date_created).format('YYYY-MM-DD HH:mm:ss') : ''
  }));

  // ชื่อสถานะของเส้นนี้ (เอาจากแถวแรก ถ้ามี)
const routeStatusName = rows[0]?.status_name || '';

  return res.json({
    success: true,
    dateTH_BE: todayBE(),
    opdCode: opdCode,
    roomCode: roomCode,
    statusName: routeStatusName,
    // statusId: status,
    data
  });
}, 10000);


/**
 * POST /api/queue/display/calling/opd/:opdCode/room/:roomCode
 * - เส้นเดียว จบทั้ง "เช็ค" และ "ดึง"
 * - ถ้าไม่มีอะไรใหม่: ตอบ 304 (หรือ 204) เบามาก
 * - ถ้ามีของใหม่: POP + DELETE (atomic) แล้วคืน JSON
 *
 * กลไก:
 * 1) อ่าน If-None-Match จาก FE (ETag รอบก่อน)
 * 2) คำนวณ ETag ปัจจุบันจากสรุปเบา ๆ ของตาราง display (COUNT, MAX(id), MAX(ts))
 * 3) ถ้า ETag ตรงกัน → 304 Not Modified (ไม่มี payload)
 * 4) ถ้า ETag เปลี่ยน → เข้า transaction: SELECT ... FOR UPDATE + DELETE → คืนข้อมูลคิว และแนบ ETag ใหม่
 */
export const roomCallingPollAndPop = wrapController(async (req: Request, res: Response) => {

  const schema = Joi.object({
    opdCode:  Joi.string().trim().max(10).required()
      .messages({ 'any.required':'ต้องระบุ OPD', 'string.empty':'OPD ห้ามว่าง' }),
    roomCode: Joi.string().trim().max(2).required()
      .messages({ 'any.required':'ต้องระบุรหัสห้องตรวจ', 'string.empty':'รหัสห้องตรวจห้ามว่าง' }),
  });

  const { error, value } = schema.validate(req.params, { abortEarly:false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'พารามิเตอร์ไม่ถูกต้อง',
      errors: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    });
  }

  const { opdCode, roomCode } = value;     // ← ใช้ค่าที่ผ่านการ validate แล้ว
  const db = ManagementDB.getInstance();

  // ------------------------------------------------------------------
  // STEP 1: คำนวณ "ลายเซ็น" (signature) ของคิวในห้องนี้แบบเบา ๆ
  //   - ไม่ดึงทั้งตาราง (ประหยัดแบนด์วิธ/CPU)
  //   - ควรวาง index: (opd_code, room_code, datetime_stamp), (opd_code, room_code, id)
  // ------------------------------------------------------------------
  const sigSql = `
    SELECT 
      COUNT(*)       AS cnt,
      COALESCE(MAX(id), 0) AS max_id,
      COALESCE(MAX(datetime_stamp), '1970-01-01 00:00:00') AS max_ts
    FROM tbl_queue_display
    WHERE opd_code = ? 
      AND room_code = ?
  `;
  const [sigRow] = await db.executeQuery(sigSql, [opdCode, roomCode]) as any[];
  const cnt   = Number(sigRow?.cnt ?? 0);
  const maxId = Number(sigRow?.max_id ?? 0);
  const maxTs = String(sigRow?.max_ts ?? '1970-01-01 00:00:00');

  // สร้าง ETag ปัจจุบันจาก signature (ง่าย ติดตามการเปลี่ยนแปลงได้ดี)
  const currentETag = `"${cnt}:${maxId}:${maxTs}"`;
  res.setHeader('ETag', currentETag);          // ให้ FE เก็บไว้ใช้รอบต่อไป
  res.setHeader('Cache-Control', 'no-store');  // บังคับ conditional request ทำงานถูกต้อง

  // ------------------------------------------------------------------
  // STEP 2: ถ้า FE ส่ง If-None-Match มาและ "ตรง" กับ ETag ปัจจุบัน → ไม่มีอะไรใหม่
  //   - ตอบ 304 Not Modified เพื่อไม่ส่ง body เลย (เบาสุด)
  //   - หมายเหตุ: ถ้าอยากใช้ 204 ก็ได้ แต่ 304 เข้าคอนเซ็ปต์ conditional GET/POST ได้ดี
  // ------------------------------------------------------------------
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && ifNoneMatch === currentETag) {
    return res.status(304).end();
  }

  // ถ้า signature ชี้ว่า "ไม่มีคิวเลย" (cnt=0) ก็คืนเบา ๆ ไปเลย
  if (cnt === 0) {
    // 204 = No Content (ไม่มี body)
    return res.status(204).end();
  }

  // ------------------------------------------------------------------
  // STEP 3: มีอะไรใหม่ → ทำ POP+DELETE แบบ atomic
  //   - เลือกคิวแรกของห้องวันนี้ (จัดลำดับเหมือนเดิม)
  //   - ล็อกแถวด้วย FOR UPDATE กันโดนหลายหน้าจอแย่ง
  //   - ลบออกจาก display หลังเลือกได้
  //   - คืนข้อมูลคิว + อัปเดต ETag ใหม่หลังลบ (เพื่อให้รอบถัดไปตรวจจับได้ถูก)
  // ------------------------------------------------------------------
  const popped = await db.executeTransaction(async (conn: any) => {
    // เลือกคิวตัวแรก
    const [rows] = await conn.execute(
      `
      SELECT 
        d.id,
        d.opd_code,
        d.room_code,
        d.room_no,
        d.queue_text,
        d.queue_status_id,
        d.channel,
        d.doctor_code,
        d.display_id,
        d.datetime_stamp,
        r.doctor_name,
        r.depend_name
      FROM tbl_queue_display d
      LEFT JOIN tbl_queue_room r 
             ON d.opd_code = r.opd_code
            AND d.room_code = r.room_code
            AND r.work_date = CURDATE()
      WHERE d.opd_code = ?
        AND d.room_code = ?
      ORDER BY
          CAST(SUBSTRING(d.queue_text, 2, 1) AS UNSIGNED),
          CAST(SUBSTRING(d.queue_text, 4, 1) AS UNSIGNED),
          d.datetime_stamp,
          CAST(SUBSTRING(d.queue_text, 5, 2) AS UNSIGNED)
      LIMIT 1
      FOR UPDATE;
      `,
      [opdCode, roomCode]
    );

    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;

    // ลบตัวที่หยิบ (atomic)
    await conn.execute(`DELETE FROM tbl_queue_display WHERE id = ? LIMIT 1`, [row.id]);
    return row;
  });

  // ไม่มีแถวให้หยิบ (race condition ระหว่างคำนวณ ETag กับ POP) → ตอบเบา ๆ
  if (!popped) {
    return res.status(204).end();
  }

  // ------------------------------------------------------------------
  // STEP 4: คำนวณ ETag ใหม่หลังลบ (ให้ FE เก็บเป็น baseline รอบหน้า)
  // ------------------------------------------------------------------
  const [afterRow] = await db.executeQuery(sigSql, [opdCode, roomCode]) as any[];
  const aCnt   = Number(afterRow?.cnt ?? 0);
  const aMaxId = Number(afterRow?.max_id ?? 0);
  const aMaxTs = String(afterRow?.max_ts ?? '1970-01-01 00:00:00');
  const afterETag = `"${aCnt}:${aMaxId}:${aMaxTs}"`;
  res.setHeader('ETag', afterETag);

  // ------------------------------------------------------------------
  // STEP 5: ส่งข้อมูลคิวที่ถูก "เรียก" กลับแบบเล็ก กระชับ
  // ------------------------------------------------------------------
  const result = {
    id: Number(popped.id ?? 0),
    queueText: String(popped.queue_text || ''),
    doctorCode: String(popped.doctor_code || ''),
    doctorName: String(popped.doctor_name || ''),
    doctorDependName: String(popped.depend_name || ''),
    dateTimeStamp: popped.datetime_stamp 
      ? moment(popped.datetime_stamp).format('YYYY-MM-DD HH:mm:ss') 
      : ''
  };

  return res.status(200).json({
    success: true,
    opdCode,
    roomCode,
    data: result
  });
}, 8000);


/** ===========================================
 *  หน้าจอ List รายการกำลังเตรียมยา (สถานะ 11)
 *  ===========================================
 *  - เรียงตามตัวอักษาร และรันคิว
 */
export const drugPreparingList = wrapController(async (req: Request, res: Response) => {

  const schema = Joi.object({
    opdCode: Joi.string().trim().max(10).required()
      .messages({ 'any.required':'ต้องระบุ OPD', 'string.empty':'OPD ห้ามว่าง' }),
  });

  const { error, value } = schema.validate(req.params, { abortEarly:false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'พารามิเตอร์ไม่ถูกต้อง',
      errors: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    });
  }

  const { opdCode } = value;     // ← ใช้ค่าที่ผ่านการ validate แล้ว
  const db = ManagementDB.getInstance();

  const sql = `
    SELECT 
      q.q_id, 
      q.q_queue_text, 
      q.q_hn,
      CONCAT(q.q_prename, q.q_name, ' ', q.q_surname) AS pt_name,
      q.q_queue_status_id,
      s.s_queue_status_name_display AS status_name,
      q.q_room_to_drugprepare_datecreated AS date_to_drug
    FROM tbl_queue_transaction q
    LEFT JOIN tbl_queue_status s 
       ON q.q_queue_status_id = s.s_queue_status_id
    WHERE q.q_date = CURDATE()
      AND q.q_opd_code = ?
      AND q.q_queue_status_id = '11'
    ORDER BY CAST(SUBSTRING(q.q_queue_text, 2, 1) AS UNSIGNED),
             CAST(SUBSTRING(q.q_queue_text, 4, 3) AS UNSIGNED)
  `;

  const raw = await db.executeQuery(sql, [opdCode]);
  const rows = asArray(raw);

  // ใช้ Pick<> สร้างชนิดย่อยสำหรับ endpoint นี้เพื่อไม่จำเป็นต่อส่งข้อมูล response type ครบชุด
  type QueuePreparingItem = Pick<QueueItem,
  'id' | 'queueText'
>;

const data: QueuePreparingItem[] = rows.map((r: any) => ({
  id: Number(r.q_id ?? 0),
  queueText: String(r.q_queue_text || ''),
  // hn: String(r.q_hn || ''), // << ไม่ให้เป็น null
  // patientName: String(r.pt_name || ''),
  // statusId: String(r.q_queue_status_id || '') as AllowedStatus,
  //  statusName:String(r.status_name || ''),
  createdAt: r.date_to_drug ? moment(r.date_to_drug).format('YYYY-MM-DD HH:mm:ss') : ''
}));

  return res.json({
    success: true,
    dateTH_BE: todayBE(),
    opdCode: opdCode,
    data
  });
}, 10000);


/** ===========================================
 *  List รายการรอเรียกรับยา และ เรียกไม่พบ
 *  ===========================================
 *  - เรียงตามเวลาส่งห้องรับยา
 */
export const rxCounterDisplay = wrapController(async (req: Request, res: Response) => {
  // 1) validate params
  const schema = Joi.object({
    opdCode: Joi.string().trim().required()
      .messages({ 'any.required':'ต้องระบุ OPD', 'string.empty':'OPD ห้ามว่าง' }),
  });
  const { error, value } = schema.validate(req.params, { abortEarly:false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'พารามิเตอร์ไม่ถูกต้อง',
      errors: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    });
  }
  const { opdCode } = value;

  const db = ManagementDB.getInstance();

  // 2) query: ดึงเฉพาะ 21(รอเรียก), 23(เรียกไม่พบ) และ "ไม่ดึงคิวด่วน"
  //    เรียงลำดับตามตัวอย่าง (row_seq -> เวลา -> queue_text)
  const sql = `
    SELECT
      a.q_id,
      a.q_queue_text,
      a.q_queue_status_id,
      a.status_name,
      a.q_drugperpare_to_rx_datecreated,
      a.row_seq
    FROM (
      SELECT
        q.q_id,
        q.q_queue_text,
        q.q_queue_status_id,
        CASE
          WHEN q.q_queue_status_id = '21' THEN s.s_queue_status_name_display
          WHEN q.q_queue_status_id = '23' THEN s.s_queue_status_name_display
          ELSE s.s_queue_status_name_display
        END AS status_name,
        q.q_drugperpare_to_rx_datecreated,
        CASE
          -- หมายเหตุ: ตัด express ออกไปแล้ว (q_isdrug_express = 0) จึงเหลือกรณีด้านล่าง
          WHEN q.q_queue_status_id='21' AND q.q_isdrug_express = 0 THEN 3
          WHEN q.q_queue_status_id='23' AND q.q_isdrug_express = 0 THEN 4
          ELSE 99
        END AS row_seq
      FROM tbl_queue_transaction q
      LEFT JOIN tbl_queue_status s
        ON q.q_queue_status_id = s.s_queue_status_id
      WHERE q.q_date = CURDATE()
        AND q.q_opd_code = ?
        AND q.q_queue_status_id IN ('21','23')
        AND q.q_isdrug_express = 0   -- ไม่ดึงคิวด่วน
      GROUP BY
        q.q_id, q.q_queue_text, q.q_queue_status_id,
        s.s_queue_status_name_display,
        q.q_drugperpare_to_rx_datecreated,
        q.q_isdrug_express
    ) AS a
    ORDER BY
      a.row_seq,
      a.q_drugperpare_to_rx_datecreated,
      CAST(SUBSTRING(a.q_queue_text, 4, 1) AS UNSIGNED),
      CAST(SUBSTRING(a.q_queue_text, 5, 2) AS UNSIGNED);
  `;

  const raw = await db.executeQuery(sql, [opdCode]);
  const rows = Array.isArray(raw) ? raw : (raw ? [raw] : []);

  // 3) response type (ส่งน้อย อ่านง่าย)
  type RxWaitItem = Pick<QueueItem, 'id' | 'queueText'>;

  const mapItem = (r: any): RxWaitItem => ({
    id: Number(r.q_id ?? 0),
    queueText: String(r.q_queue_text || ''),
  });

  // 4) แยกตามสถานะ (ให้ตรงกับที่ WHERE ใช้)
  const rxWaiting    = rows.filter(r => r.q_queue_status_id === '21').map(mapItem);
  const rxMissCalled = rows.filter(r => r.q_queue_status_id === '23').map(mapItem);

  return res.json({
    success: true,
    dateTH_BE: todayBE(),
    opdCode,
    queues: {
      rxWaiting,        // 21
      rxMissCalled      // 23
    }
  });
}, 10000);


/* 
==================================================
แบบที่ 1 (1 เส้น/1 จอ → คืนข้อมูล 2 ช่องพร้อมกัน)
POST /api/queue/rx/calling/:opdCode/:displayCode
==================================================
*/
export const rxCallingPollAndPopBoth = wrapController(async (req: Request, res: Response) => {
  // validate
  const schema = Joi.object({
    opdCode:     Joi.string().trim().max(10).required()
                  .messages({ 'any.required':'ต้องระบุ OPD', 'string.empty':'OPD ห้ามว่าง' }),
    displayCode: Joi.number().integer().required()
                  .messages({ 'any.required':'ต้องระบุ displayCode', 'number.base':'displayCode ต้องเป็นตัวเลข' }),
  });
  const { error, value } = schema.validate(req.params, { abortEarly:false });
  if (error) {
    return res.status(400).json({
      success:false,
      message:'พารามิเตอร์ไม่ถูกต้อง',
      errors: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    });
  }
  const { opdCode, displayCode } = value as { opdCode: string; displayCode: number };

  const db = ManagementDB.getInstance();

  // STEP 1: มีคิวช่องใดช่องหนึ่งไหม?
  const sigSql = `
    SELECT COUNT(*) AS cnt
    FROM tbl_queue_display
    WHERE opd_code = ?
      AND display_id = ?
      AND queue_status_id = '22'
      AND channel IN (1,2)
  `;
  const [sig] = await db.executeQuery(sigSql, [opdCode, displayCode]) as any[];
  if (!Number(sig?.cnt ?? 0)) return res.status(204).end();

  // STEP 2: POP+DELETE (atomic) แยกสองช่องในทรานแซคชันเดียว
  type RxRow = { id:number; queue_text:string; datetime_stamp:string|Date; channel:number|null; status_name?:string|null; };
  const selectOneSql = (ch: number) => `
    SELECT d.id, d.queue_text, d.datetime_stamp, d.channel,
           s.s_queue_status_name_display AS status_name
    FROM tbl_queue_display d
    LEFT JOIN tbl_queue_status s ON d.queue_status_id = s.s_queue_status_id
    WHERE d.opd_code = ? AND d.display_id = ? AND d.queue_status_id = '22' AND d.channel = ${ch}
    ORDER BY
      d.datetime_stamp,
      CAST(SUBSTRING(d.queue_text, 4, 1) AS UNSIGNED),
      CAST(SUBSTRING(d.queue_text, 5, 2) AS UNSIGNED)
    LIMIT 1
    FOR UPDATE
  `;

  const popped = await db.executeTransaction(async (conn: any) => {
    const [r1]: [RxRow[]] = await conn.execute(selectOneSql(1), [opdCode, displayCode]);
    const row1 = r1?.[0] || null;
    if (row1) await conn.execute(`DELETE FROM tbl_queue_display WHERE id = ? LIMIT 1`, [row1.id]);

    const [r2]: [RxRow[]] = await conn.execute(selectOneSql(2), [opdCode, displayCode]);
    const row2 = r2?.[0] || null;
    if (row2) await conn.execute(`DELETE FROM tbl_queue_display WHERE id = ? LIMIT 1`, [row2.id]);

    return { row1, row2 };
  });

  // ถ้าถูกชิงลบระหว่างทางและไม่เหลือทั้งสองช่อง → 204
  if (!popped.row1 && !popped.row2) return res.status(204).end();

  const mapItem = (r: RxRow | null) => r ? ({
    id: Number(r.id),
    queueText: String(r.queue_text || ''),
    statusName: String(r.status_name || ''),
    rxChannel: r.channel != null ? Number(r.channel) : null,
    dateTimeStamp: r.datetime_stamp ? moment(r.datetime_stamp).format('YYYY-MM-DD HH:mm:ss') : ''
  }) : null;

  return res.status(200).json({
    success: true,
    opdCode,
    displayCode,
    data: {
      ch1: mapItem(popped.row1),   // อาจเป็น null
      ch2: mapItem(popped.row2),   // อาจเป็น null
    }
  });
}, 15000);

/* 
==================================================
แบบที่ 2 (ระบุช่อง → ทำงานอิสระ)
POST /api/queue/rx/calling/:opdCode/:displayCode/:channelCode
==================================================
*/
export const rxCallingPollAndPopSingle = wrapController(async (req: Request, res: Response) => {
  const schema = Joi.object({
    opdCode:     Joi.string().trim().max(10).required()
                  .messages({ 'any.required':'ต้องระบุ OPD', 'string.empty':'OPD ห้ามว่าง' }),
    displayCode: Joi.number().integer().required()
                  .messages({ 'any.required':'ต้องระบุ displayCode', 'number.base':'displayCode ต้องเป็นตัวเลข' }),
    channelCode: Joi.number().integer().required()
                  .messages({ 'any.required':'ต้องระบุ channelCode', 'number.base':'channelCode ต้องเป็นตัวเลข' }),
  });
  const { error, value } = schema.validate(req.params, { abortEarly:false });
  if (error) {
    return res.status(400).json({
      success:false,
      message:'พารามิเตอร์ไม่ถูกต้อง',
      errors: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    });
  }
  const { opdCode, displayCode, channelCode } = value as { opdCode: string; displayCode: number; channelCode: number; };

  const db = ManagementDB.getInstance();

  // STEP 1: มีคิวช่องนี้ไหม?
  const sigSql = `
    SELECT COUNT(*) AS cnt
    FROM tbl_queue_display
    WHERE opd_code = ?
      AND display_id = ?
      AND queue_status_id = '22'
      AND channel = ?
  `;
  const [sig] = await db.executeQuery(sigSql, [opdCode, displayCode, channelCode]) as any[];
  if (!Number(sig?.cnt ?? 0)) return res.status(204).end();

  // STEP 2: POP+DELETE (atomic) เฉพาะช่อง
  type RxRow = { id:number; queue_text:string; datetime_stamp:string|Date; channel:number|null; status_name?:string|null; };
  const popped: RxRow | null = await db.executeTransaction(async (conn: any) => {
    const [rows]: [RxRow[]] = await conn.execute(
      `
      SELECT d.id, d.queue_text, d.datetime_stamp, d.channel,
             s.s_queue_status_name_display AS status_name
      FROM tbl_queue_display d
      LEFT JOIN tbl_queue_status s ON d.queue_status_id = s.s_queue_status_id
      WHERE d.opd_code = ?
        AND d.display_id = ?
        AND d.queue_status_id = '22'
        AND d.channel = ?
      ORDER BY
        d.datetime_stamp,
        CAST(SUBSTRING(d.queue_text, 4, 1) AS UNSIGNED),
        CAST(SUBSTRING(d.queue_text, 5, 2) AS UNSIGNED)
      LIMIT 1
      FOR UPDATE
      `,
      [opdCode, displayCode, channelCode]
    );
    const row = rows?.[0] || null;
    if (!row) return null;
    await conn.execute(`DELETE FROM tbl_queue_display WHERE id = ? LIMIT 1`, [row.id]);
    return row;
  });

  if (!popped) return res.status(204).end();

  const data = {
    id: Number(popped.id),
    queueText: String(popped.queue_text || ''),
    statusName: String(popped.status_name || ''),
    rxChannel: popped.channel != null ? Number(popped.channel) : null,
    dateTimeStamp: popped.datetime_stamp ? moment(popped.datetime_stamp).format('YYYY-MM-DD HH:mm:ss') : ''
  };

  return res.status(200).json({
    success: true,
    opdCode,
    displayCode,
    channelCode,
    data
  });
}, 10000);
