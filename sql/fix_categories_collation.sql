-- =====================================================
-- แก้ไข Collation ของตาราง categories ให้ใช้ utf8mb3_unicode_ci
-- =====================================================

-- 1. ตรวจสอบ Foreign Keys ที่อ้างอิง categories
SELECT 
    TABLE_NAME,
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'sgh4' 
    AND REFERENCED_TABLE_NAME = 'tbl_inv_categories';

-- 2. ลบ Foreign Key constraints ที่อ้างอิง categories (ถ้ามี)
-- หมายเหตุ: ต้องใช้ชื่อ constraint ที่ถูกต้องจากผลลัพธ์ข้างต้น
-- ALTER TABLE [table_name] DROP FOREIGN KEY [constraint_name];

-- 3. ลบตาราง categories เก่า
DROP TABLE IF EXISTS tbl_inv_categories;

-- 4. สร้างตาราง categories ใหม่ด้วย utf8mb3_unicode_ci
CREATE TABLE `tbl_inv_categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'รหัสหมวดหมู่',
  `category_code` varchar(20) NOT NULL COMMENT 'รหัสหมวดหมู่ (เช่น MED, SUP, EQU)',
  `category_name` varchar(100) NOT NULL COMMENT 'ชื่อหมวดหมู่',
  `description` text COMMENT 'คำอธิบายหมวดหมู่ (ถ้ามี)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'สถานะการใช้งาน (1=ใช้งาน, 0=ไม่ใช้งาน)',
  `display_order` int NOT NULL DEFAULT 0 COMMENT 'ลำดับการแสดงผล (น้อยไปมาก)',
  
  -- ฟิลด์ Audit
  `created_by_user_id` varchar(15) NOT NULL COMMENT 'ผู้สร้าง',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  `updated_by_user_id` varchar(15) DEFAULT NULL COMMENT 'ผู้แก้ไข',
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไข',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_code` (`category_code`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_display_order` (`display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci COMMENT='ตารางหมวดหมู่';

-- 5. เพิ่มข้อมูลหมวดหมู่
INSERT INTO `tbl_inv_categories` (
  `category_code`,
  `category_name`,
  `description`,
  `display_order`,
  `created_by_user_id`
) VALUES
-- หมวดหมู่หลัก
('MED', 'ยา', 'ยาต่างๆ', 1, 'SYSTEM'),
('SUP', 'อุปกรณ์', 'อุปกรณ์การแพทย์', 2, 'SYSTEM'),
('EQU', 'เครื่องมือ', 'เครื่องมือแพทย์', 3, 'SYSTEM'),
('LAB', 'ห้องปฏิบัติการ', 'อุปกรณ์ห้องปฏิบัติการ', 4, 'SYSTEM'),
('RAD', 'รังสีวิทยา', 'อุปกรณ์รังสีวิทยา', 5, 'SYSTEM'),
('SUR', 'ศัลยกรรม', 'อุปกรณ์ศัลยกรรม', 6, 'SYSTEM'),
('IT', 'เทคโนโลยีสารสนเทศ', 'อุปกรณ์คอมพิวเตอร์และไอที', 7, 'SYSTEM'),
('OFF', 'สำนักงาน', 'อุปกรณ์สำนักงาน', 8, 'SYSTEM'),
('MAI', 'ซ่อมบำรุง', 'อุปกรณ์ซ่อมบำรุง', 9, 'SYSTEM'),
('GEN', 'ทั่วไป', 'หมวดหมู่อื่นๆ', 10, 'SYSTEM');

-- 6. แสดงผลลัพธ์
SELECT '=== ข้อมูลหมวดหมู่ ===' as info;
SELECT 
  `id`,
  `category_code`,
  `category_name`,
  `is_active`,
  `display_order`
FROM `tbl_inv_categories` 
ORDER BY `display_order`, `category_code`;

SELECT '=== Collation ของตาราง categories ===' as info;
SELECT 
  TABLE_NAME,
  TABLE_COLLATION
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'sgh4' 
    AND TABLE_NAME = 'tbl_inv_categories'; 