-- =====================================================
-- ตรวจสอบ Foreign Key Constraints ที่มีอยู่
-- =====================================================

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

-- ตรวจสอบโครงสร้างตาราง tbl_inv_requisitions
SHOW CREATE TABLE tbl_inv_requisitions;

-- ตรวจสอบข้อมูลในตาราง departments
SELECT * FROM tbl_inv_departments; 