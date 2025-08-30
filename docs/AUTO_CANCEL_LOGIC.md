# Logic การยกเลิกคำขอเบิกอัตโนมัติ (Auto-Cancel Requisition)

## ภาพรวม
เมื่อผู้ใช้ยกเลิกรายการแบบ Selective และไม่มีรายการที่ใช้งานได้เหลืออยู่ ระบบจะยกเลิกคำขอเบิกอัตโนมัติ

## เงื่อนไขการทำงาน

### ✅ เมื่อใดที่จะยกเลิกอัตโนมัติ
1. **การยกเลิกแบบ Selective**: `cancel_type = "selective"`
2. **ไม่มีรายการที่ใช้งานได้เหลือ**: `COUNT(items WHERE is_cancelled = 0) = 0`
3. **มีการยกเลิกรายการสำเร็จ**: มีอย่างน้อย 1 รายการที่ถูกยกเลิกในครั้งนี้

### ❌ เมื่อใดที่ไม่ยกเลิกอัตโนมัติ
1. **การยกเลิกแบบ Full**: `cancel_type = "full"` (ยกเลิกทั้งหมดอยู่แล้ว)
2. **ยังมีรายการที่ใช้งานได้**: `COUNT(items WHERE is_cancelled = 0) > 0`
3. **ไม่มีรายการที่ถูกยกเลิกในครั้งนี้**: การยกเลิกไม่สำเร็จ

## ตัวอย่างสถานการณ์

### สถานการณ์ที่ 1: ยกเลิกบางรายการ (ไม่ยกเลิกอัตโนมัติ)
```
คำขอเบิก SGH-RQ-001 มี 3 รายการ:
- รายการ A (ใช้งานได้)
- รายการ B (ใช้งานได้) 
- รายการ C (ใช้งานได้)

ผู้ใช้ยกเลิกรายการ A
→ เหลือรายการ B, C ที่ใช้งานได้
→ ไม่ยกเลิกคำขอเบิก (ยังมีรายการเหลือ)
```

### สถานการณ์ที่ 2: ยกเลิกรายการสุดท้าย (ยกเลิกอัตโนมัติ)
```
คำขอเบิก SGH-RQ-002 มี 2 รายการ:
- รายการ X (ยกเลิกแล้ว)
- รายการ Y (ใช้งานได้)

ผู้ใช้ยกเลิกรายการ Y (รายการสุดท้าย)
→ ไม่มีรายการที่ใช้งานได้เหลือ
→ ยกเลิกคำขอเบิกอัตโนมัติ
```

### สถานการณ์ที่ 3: ยกเลิกหลายรายการในครั้งเดียว (ยกเลิกอัตโนมัติ)
```
คำขอเบิก SGH-RQ-003 มี 3 รายการ:
- รายการ P (ใช้งานได้)
- รายการ Q (ใช้งานได้)
- รายการ R (ใช้งานได้)

ผู้ใช้ยกเลิกรายการ P, Q, R ในครั้งเดียว
→ ไม่มีรายการที่ใช้งานได้เหลือ
→ ยกเลิกคำขอเบิกอัตโนมัติ
```

## การทำงานของระบบ

### 1. ขั้นตอนการยกเลิกรายการ
```sql
-- ยกเลิกรายการที่เลือก
UPDATE tbl_inv_requisition_items 
SET is_cancelled = 1, cancelled_by_user_id = ?, date_cancelled = NOW() 
WHERE item_id = ?;

-- อัพเดทสถานะรายการ
UPDATE tbl_inv_status_item_current 
SET current_status_code = 'REQ_ITEM_CANCELLED', 
    current_status_since = NOW(), 
    last_comment = ? 
WHERE item_id = ?;

-- บันทึก Event Log
INSERT INTO tbl_inv_item_event_logs (...);
```

### 2. ตรวจสอบรายการที่เหลือ
```sql
SELECT COUNT(*) as active_count 
FROM tbl_inv_requisition_items 
WHERE requisition_id = ? AND is_cancelled = 0;
```

### 3. ยกเลิกคำขอเบิกอัตโนมัติ (ถ้า active_count = 0)
```sql
-- อัพเดทสถานะคำขอเบิก
UPDATE tbl_inv_requisitions 
SET current_status = 'REQ_CANCELLED_BY_DEPT', 
    is_cancelled = 1, 
    cancelled_by_user_id = ?, 
    date_cancelled = NOW(), 
    cancel_reason = ?, 
    date_updated = NOW() 
WHERE id = ?;

-- บันทึกประวัติการยกเลิกอัตโนมัติ
INSERT INTO tbl_inv_status_logs 
(requisition_id, previous_status, new_status, changed_by, comment, created_by_user_id, date_created) 
VALUES (?, ?, ?, ?, ?, ?, NOW());
```

## ข้อมูลที่บันทึก

### ข้อมูลการยกเลิกอัตโนมัติ
- **สถานะใหม่**: `REQ_CANCELLED_BY_DEPT`
- **ผู้ยกเลิก**: ผู้ที่ยกเลิกรายการสุดท้าย
- **วันที่ยกเลิก**: วันที่ที่ยกเลิกรายการสุดท้าย
- **เหตุผล**: `"ยกเลิกอัตโนมัติ: รายการทั้งหมดถูกยกเลิกแล้ว ({เหตุผลเดิม})"`

### ข้อมูลใน Status Log
```
comment: "ยกเลิกคำขอเบิกอัตโนมัติ: รายการทั้งหมดถูกยกเลิกแล้ว (เหตุผลรายการสุดท้าย: {เหตุผล})"
```

## API Response

### Response เมื่อไม่ยกเลิกอัตโนมัติ
```json
{
  "success": true,
  "message": "ยกเลิกคำขอเบิกเรียบร้อยแล้ว",
  "data": {
    "requisitionId": "SGH-RQ-001",
    "status": "REQ_DRAFT",
    "itemsCancelled": 1,
    "autoClosedRequisition": false
  }
}
```

### Response เมื่อยกเลิกอัตโนมัติ
```json
{
  "success": true,
  "message": "ยกเลิกคำขอเบิกเรียบร้อยแล้ว",
  "data": {
    "requisitionId": "SGH-RQ-002", 
    "status": "REQ_CANCELLED_BY_DEPT",
    "itemsCancelled": 1,
    "autoClosedRequisition": true
  }
}
```

## การทดสอบ

### Test Case 1: ยกเลิกบางรายการ
```bash
# สร้างคำขอเบิกที่มี 2 รายการ
POST /api/place/create-request
{
  "items": [
    {"item_sequence": 1, "description": "รายการ A", ...},
    {"item_sequence": 2, "description": "รายการ B", ...}
  ]
}

# ยกเลิกรายการแรก (ควรไม่ยกเลิกคำขอเบิก)
DELETE /api/place/cancel-request/{reqId}
{
  "cancel_type": "selective",
  "reason": "ทดสอบยกเลิกบางรายการ",
  "cancelled_by_user_id": "USR001",
  "items": [{"item_id": 1001, "reason": "ทดสอบ"}]
}

# Expected: autoClosedRequisition = false
```

### Test Case 2: ยกเลิกรายการสุดท้าย
```bash
# ยกเลิกรายการที่สอง (ควรยกเลิกคำขอเบิกอัตโนมัติ)
DELETE /api/place/cancel-request/{reqId}
{
  "cancel_type": "selective", 
  "reason": "ทดสอบยกเลิกรายการสุดท้าย",
  "cancelled_by_user_id": "USR001",
  "items": [{"item_id": 1002, "reason": "รายการสุดท้าย"}]
}

# Expected: autoClosedRequisition = true, status = "REQ_CANCELLED_BY_DEPT"
```

## ข้อควรระวัง

1. **Performance**: การนับรายการที่เหลือใช้ `COUNT(*)` ซึ่งอาจช้าถ้ามีรายการเยอะ
2. **Concurrency**: หากมีการยกเลิกพร้อมกันจากหลาย user อาจเกิด race condition  
3. **Transaction**: การยกเลิกต้องอยู่ใน transaction เดียวกันเพื่อความถูกต้อง
4. **Logging**: ต้องบันทึก event log ครบถ้วนเพื่อ audit trail

## การปรับปรุงในอนาคต

1. **Soft Delete**: พิจารณาใช้ soft delete แทน hard flag
2. **Notification**: แจ้งเตือนเมื่อคำขอเบิกถูกยกเลิกอัตโนมัติ
3. **Rollback**: ฟีเจอร์กู้คืนคำขอเบิกที่ยกเลิกอัตโนมัติ
4. **Batch Processing**: ปรับปรุงประสิทธิภาพสำหรับการยกเลิกจำนวนมาก 