-- =====================================================
-- แก้ไขโครงสร้างตาราง departments ให้ใช้ department_code เป็น varchar
-- =====================================================

-- 1. ลบตารางเก่า (ถ้ามี)
DROP TABLE IF EXISTS tbl_inv_departments;

-- 2. สร้างตารางใหม่ด้วย department_code เป็น varchar
CREATE TABLE `tbl_inv_departments` (
  `department_code` varchar(20) NOT NULL COMMENT 'รหัสหน่วยงาน (เช่น COMP, IT, NUR)',
  `department_name` varchar(100) NOT NULL COMMENT 'ชื่อหน่วยงาน',
  `description` text COMMENT 'คำอธิบายหน่วยงาน (ถ้ามี)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'สถานะการใช้งาน (1=ใช้งาน, 0=ไม่ใช้งาน)',
  `display_order` int NOT NULL DEFAULT 0 COMMENT 'ลำดับการแสดงผล (น้อยไปมาก)',
  
  -- ฟิลด์ Audit
  `created_by_user_id` varchar(15) NOT NULL COMMENT 'ผู้สร้าง',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  `updated_by_user_id` varchar(15) DEFAULT NULL COMMENT 'ผู้แก้ไข',
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไข',
  
  PRIMARY KEY (`department_code`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_display_order` (`display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางหน่วยงาน';

-- 3. เพิ่มข้อมูลหน่วยงาน
INSERT INTO `tbl_inv_departments` (
  `department_code`, 
  `department_name`, 
  `description`, 
  `display_order`, 
  `created_by_user_id`
) VALUES
-- หน่วยงานหลัก
('COMP', 'คอมพิวเตอร์', 'แผนกเทคโนโลยีสารสนเทศและคอมพิวเตอร์', 1, 'SYSTEM'),
('IT', 'ไอที', 'แผนกเทคโนโลยีสารสนเทศ', 2, 'SYSTEM'),
('NUR', 'พยาบาล', 'แผนกการพยาบาล', 3, 'SYSTEM'),
('PHA', 'เภสัชกรรม', 'แผนกเภสัชกรรม', 4, 'SYSTEM'),
('LAB', 'ห้องปฏิบัติการ', 'แผนกห้องปฏิบัติการ', 5, 'SYSTEM'),
('RAD', 'รังสีวิทยา', 'แผนกรังสีวิทยา', 6, 'SYSTEM'),
('SUR', 'ศัลยกรรม', 'แผนกศัลยกรรม', 7, 'SYSTEM'),
('ER', 'ฉุกเฉิน', 'แผนกฉุกเฉิน', 8, 'SYSTEM'),
('OPD', 'ผู้ป่วยนอก', 'แผนกผู้ป่วยนอก', 9, 'SYSTEM'),
('IPD', 'ผู้ป่วยใน', 'แผนกผู้ป่วยใน', 10, 'SYSTEM'),
('ICU', 'ไอซียู', 'แผนกไอซียู', 11, 'SYSTEM'),
('NICU', 'ทารกแรกเกิด', 'แผนกทารกแรกเกิด', 12, 'SYSTEM'),
('PT', 'กายภาพบำบัด', 'แผนกกายภาพบำบัด', 13, 'SYSTEM'),
('NUT', 'โภชนาการ', 'แผนกโภชนาการ', 14, 'SYSTEM'),
('LAU', 'ซักรีด', 'แผนกซักรีด', 15, 'SYSTEM'),
('MAI', 'ซ่อมบำรุง', 'แผนกซ่อมบำรุง', 16, 'SYSTEM'),
('ACC', 'บัญชี', 'แผนกบัญชี', 17, 'SYSTEM'),
('HR', 'บุคคล', 'แผนกบุคคล', 18, 'SYSTEM'),
('PUR', 'จัดซื้อ', 'แผนกจัดซื้อ', 19, 'SYSTEM'),
('STO', 'พัสดุ', 'แผนกพัสดุ', 20, 'SYSTEM');

-- 4. แสดงผลลัพธ์
SELECT 
  `department_code`,
  `department_name`,
  `is_active`,
  `display_order`
FROM `tbl_inv_departments` 
ORDER BY `display_order`, `department_code`; 