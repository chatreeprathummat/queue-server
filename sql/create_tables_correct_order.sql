-- =====================================================
-- สร้างตารางใหม่ทั้งหมดตามลำดับที่ถูกต้อง
-- =====================================================

-- 1. ลบตารางเก่าทั้งหมด (ถ้ามี)
DROP TABLE IF EXISTS tbl_inv_requisitions;
DROP TABLE IF EXISTS tbl_inv_departments;
DROP TABLE IF EXISTS tbl_inv_users;

-- 2. สร้างตาราง users ก่อน (เพราะ departments จะอ้างอิง)
CREATE TABLE `tbl_inv_users` (
  `user_id` varchar(15) NOT NULL COMMENT 'รหัสผู้ใช้',
  `username` varchar(50) NOT NULL COMMENT 'ชื่อผู้ใช้',
  `full_name` varchar(100) NOT NULL COMMENT 'ชื่อ-นามสกุล',
  `email` varchar(100) DEFAULT NULL COMMENT 'อีเมล',
  `department_code` varchar(20) DEFAULT NULL COMMENT 'รหัสหน่วยงาน',
  `role_code` varchar(20) NOT NULL DEFAULT 'USER' COMMENT 'รหัสบทบาท',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  
  -- ฟิลด์ Audit
  `created_by_user_id` varchar(15) NOT NULL COMMENT 'ผู้สร้าง',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  `updated_by_user_id` varchar(15) DEFAULT NULL COMMENT 'ผู้แก้ไข',
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไข',
  
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_department_code` (`department_code`),
  KEY `idx_role_code` (`role_code`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางผู้ใช้';

-- 3. สร้างตาราง departments
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

-- 4. เพิ่ม Foreign Key ในตาราง users
ALTER TABLE `tbl_inv_users` 
ADD CONSTRAINT `fk_users_department_code` 
FOREIGN KEY (`department_code`) REFERENCES `tbl_inv_departments`(`department_code`);

-- 5. สร้างตาราง requisitions
CREATE TABLE `tbl_inv_requisitions` (
  `requisition_id` varchar(20) NOT NULL COMMENT 'รหัสคำขอเบิก',
  `requisition_number` varchar(50) NOT NULL COMMENT 'เลขที่คำขอเบิก',
  `department_code` varchar(20) NOT NULL COMMENT 'รหัสหน่วยงาน',
  `requested_by_user_id` varchar(15) NOT NULL COMMENT 'รหัสผู้ขอ',
  `request_date` date NOT NULL COMMENT 'วันที่ขอ',
  `priority_level` varchar(20) NOT NULL DEFAULT 'NORMAL' COMMENT 'ระดับความสำคัญ',
  `status_code` varchar(50) NOT NULL DEFAULT 'REQ_PENDING_DEPT_APPROVAL' COMMENT 'รหัสสถานะ',
  `total_amount` decimal(15,2) DEFAULT 0.00 COMMENT 'จำนวนเงินรวม',
  `remarks` text COMMENT 'หมายเหตุ',
  
  -- ฟิลด์ Audit
  `created_by_user_id` varchar(15) NOT NULL COMMENT 'ผู้สร้าง',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  `updated_by_user_id` varchar(15) DEFAULT NULL COMMENT 'ผู้แก้ไข',
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไข',
  
  PRIMARY KEY (`requisition_id`),
  UNIQUE KEY `uk_requisition_number` (`requisition_number`),
  KEY `idx_department_code` (`department_code`),
  KEY `idx_requested_by` (`requested_by_user_id`),
  KEY `idx_status_code` (`status_code`),
  KEY `idx_request_date` (`request_date`),
  
  -- Foreign Keys
  CONSTRAINT `fk_requisitions_department_code` 
    FOREIGN KEY (`department_code`) REFERENCES `tbl_inv_departments`(`department_code`),
  CONSTRAINT `fk_requisitions_requested_by` 
    FOREIGN KEY (`requested_by_user_id`) REFERENCES `tbl_inv_users`(`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางคำขอเบิก';

-- 6. เพิ่มข้อมูลหน่วยงาน
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

-- 7. เพิ่มข้อมูลผู้ใช้ทดสอบ
INSERT INTO `tbl_inv_users` (
  `user_id`,
  `username`,
  `full_name`,
  `email`,
  `department_code`,
  `role_code`,
  `created_by_user_id`
) VALUES
('U001', 'admin', 'ผู้ดูแลระบบ', 'admin@hospital.com', 'IT', 'ADMIN', 'SYSTEM'),
('U002', 'user1', 'ผู้ใช้ทดสอบ 1', 'user1@hospital.com', 'COMP', 'USER', 'SYSTEM'),
('U003', 'user2', 'ผู้ใช้ทดสอบ 2', 'user2@hospital.com', 'NUR', 'USER', 'SYSTEM');

-- 8. แสดงผลลัพธ์
SELECT '=== ข้อมูลหน่วยงาน ===' as info;
SELECT 
  `department_code`,
  `department_name`,
  `is_active`,
  `display_order`
FROM `tbl_inv_departments` 
ORDER BY `display_order`, `department_code`;

SELECT '=== ข้อมูลผู้ใช้ ===' as info;
SELECT 
  `user_id`,
  `username`,
  `full_name`,
  `department_code`,
  `role_code`
FROM `tbl_inv_users` 
ORDER BY `user_id`;

SELECT '=== Foreign Keys ===' as info;
SELECT 
    TABLE_NAME,
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'sgh4' 
    AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME; 