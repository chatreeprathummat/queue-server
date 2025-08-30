-- =====================================================
-- แก้ไข Foreign Key ในตาราง requisitions ให้อ้างอิง department_code
-- =====================================================

-- 1. ตรวจสอบ Foreign Keys ปัจจุบัน
SELECT 
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'sgh4' 
    AND TABLE_NAME = 'tbl_inv_requisitions' 
    AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 2. ลบ Foreign Key constraints เก่าทั้งหมด (ถ้ามี)
-- หมายเหตุ: ต้องใช้ชื่อ constraint ที่ถูกต้องจากผลลัพธ์ข้างต้น
-- ALTER TABLE tbl_inv_requisitions DROP FOREIGN KEY [ชื่อ_constraint];

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