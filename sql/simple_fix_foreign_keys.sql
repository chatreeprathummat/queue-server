-- =====================================================
-- แก้ไข Foreign Key Constraints แบบง่าย
-- =====================================================

-- ตรวจสอบข้อมูลในตาราง departments
SELECT COUNT(*) as department_count FROM tbl_inv_departments;

-- แสดงข้อมูล departments ที่มี
SELECT department_code, department_name FROM tbl_inv_departments ORDER BY display_order;

-- ลบ Foreign Key constraint เก่า (ถ้ามี)
-- หมายเหตุ: อาจต้องใช้ชื่อ constraint ที่ถูกต้อง
-- ALTER TABLE tbl_inv_requisitions DROP FOREIGN KEY tbl_inv_requisitions_ibfk_3;

-- เพิ่ม Foreign Key constraint ใหม่
-- ใช้ department_code แทน id
ALTER TABLE tbl_inv_requisitions 
ADD CONSTRAINT fk_requisitions_department_code 
FOREIGN KEY (department_code) REFERENCES tbl_inv_departments(department_code); 