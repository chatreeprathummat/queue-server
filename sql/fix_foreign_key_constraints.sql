-- =====================================================
-- แก้ไข Foreign Key Constraints
-- =====================================================

-- 1. ลบ Foreign Key constraints เก่า (ถ้ามี)
ALTER TABLE tbl_inv_requisitions 
DROP FOREIGN KEY IF EXISTS tbl_inv_requisitions_ibfk_3;

-- 2. ตรวจสอบว่าตาราง tbl_inv_departments มีข้อมูลหรือไม่
SELECT COUNT(*) as department_count FROM tbl_inv_departments;

-- 3. เพิ่ม Foreign Key constraint ใหม่
-- ใช้ department_code แทน id
ALTER TABLE tbl_inv_requisitions 
ADD CONSTRAINT fk_requisitions_department_code 
FOREIGN KEY (department_code) REFERENCES tbl_inv_departments(department_code);

-- 4. ตรวจสอบ Foreign Keys หลังแก้ไข
SELECT 
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'sgh4' 
    AND TABLE_NAME = 'tbl_inv_requisitions' 
    AND REFERENCED_TABLE_NAME IS NOT NULL; 