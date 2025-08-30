-- =====================================================
-- ตรวจสอบโครงสร้างตารางปัจจุบัน
-- =====================================================

-- ตรวจสอบว่าตารางมีอยู่หรือไม่
SHOW TABLES LIKE 'tbl_inv_requisitions';
SHOW TABLES LIKE 'tbl_inv_departments';

-- ตรวจสอบโครงสร้างตาราง tbl_inv_requisitions
DESCRIBE tbl_inv_requisitions;

-- ตรวจสอบ Foreign Keys ของตาราง tbl_inv_requisitions
SELECT 
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'sgh4' 
    AND TABLE_NAME = 'tbl_inv_requisitions' 
    AND REFERENCED_TABLE_NAME IS NOT NULL;

-- ตรวจสอบโครงสร้างตาราง tbl_inv_departments
DESCRIBE tbl_inv_departments;

-- ตรวจสอบข้อมูลในตาราง tbl_inv_departments
SELECT * FROM tbl_inv_departments LIMIT 5; 