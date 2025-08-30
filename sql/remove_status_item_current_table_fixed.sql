-- =====================================================
-- ลบตาราง tbl_inv_status_item_current และเพิ่มฟิลด์ current_status
-- ใน tbl_inv_requisition_items เพื่อลดความซ้ำซ้อน
-- =====================================================

-- 1. สำรองข้อมูลจาก tbl_inv_status_item_current (ถ้ามี)
-- CREATE TABLE tbl_inv_status_item_current_backup AS 
-- SELECT * FROM tbl_inv_status_item_current;

-- 2. เพิ่มฟิลด์ current_status ใน tbl_inv_requisition_items
ALTER TABLE tbl_inv_requisition_items 
ADD COLUMN current_status VARCHAR(50) DEFAULT 'REQ_DRAFT' COMMENT 'สถานะปัจจุบันของรายการ (REQ_DRAFT, REQ_PENDING_HEAD_APPROVAL, REQ_HEAD_APPROVED, etc.)';

-- 3. เพิ่มฟิลด์ status_updated_at เพื่อติดตามเวลาที่อัปเดตสถานะล่าสุด
ALTER TABLE tbl_inv_requisition_items 
ADD COLUMN status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'เวลาที่อัปเดตสถานะล่าสุด';

-- 4. เพิ่มฟิลด์ status_comment เพื่อเก็บ comment ล่าสุดของสถานะ
ALTER TABLE tbl_inv_requisition_items 
ADD COLUMN status_comment TEXT NULL COMMENT 'comment ล่าสุดของสถานะ';

-- 5. เพิ่มฟิลด์ status_updated_by เพื่อติดตามผู้ที่อัปเดตสถานะล่าสุด
ALTER TABLE tbl_inv_requisition_items 
ADD COLUMN status_updated_by VARCHAR(15) NULL COMMENT 'ผู้ที่อัปเดตสถานะล่าสุด';

-- 6. อัปเดตข้อมูลจาก tbl_inv_status_item_current (ถ้ามี)
-- UPDATE tbl_inv_requisition_items ri
-- INNER JOIN tbl_inv_status_item_current sic ON ri.item_id = sic.item_id
-- SET ri.current_status = sic.current_status_code,
--     ri.status_updated_at = sic.current_status_since,
--     ri.status_comment = sic.last_comment,
--     ri.status_updated_by = sic.updated_by_user_id;

-- 7. ลบตาราง tbl_inv_status_item_current
DROP TABLE IF EXISTS tbl_inv_status_item_current;

-- 8. สร้าง Index สำหรับการค้นหาตามสถานะ
CREATE INDEX idx_requisition_items_current_status ON tbl_inv_requisition_items(current_status);
CREATE INDEX idx_requisition_items_status_updated_at ON tbl_inv_requisition_items(status_updated_at);

-- 9. อัปเดตข้อมูลเริ่มต้น (ถ้าต้องการ)
-- UPDATE tbl_inv_requisition_items 
-- SET current_status = 'REQ_DRAFT', 
--     status_updated_at = CURRENT_TIMESTAMP,
--     status_comment = 'สร้างรายการใหม่'
-- WHERE current_status IS NULL;

-- =====================================================
-- คำอธิบายการเปลี่ยนแปลง:
-- =====================================================
-- 1. ลบความซ้ำซ้อน: ไม่ต้องเก็บสถานะใน 2 ตาราง
-- 2. เพิ่มฟิลด์ที่จำเป็น:
--    - current_status: สถานะปัจจุบัน
--    - status_updated_at: เวลาอัปเดตล่าสุด
--    - status_comment: comment ล่าสุด
--    - status_updated_by: ผู้อัปเดตล่าสุด
-- 3. สร้าง Index เพื่อประสิทธิภาพการค้นหา
-- 4. ใช้ tbl_inv_status_logs และ tbl_inv_item_event_logs สำหรับประวัติ
-- ===================================================== 