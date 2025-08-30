-- =====================================================
-- ตารางหมวดหมู่สินค้าแบบเรียบง่าย
-- สำหรับเก็บหมวดหมู่ของสินค้าที่ขอเบิก
-- =====================================================

CREATE TABLE `tbl_inv_categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'รหัสหมวดหมู่ (Auto Increment)',
  `category_code` varchar(20) NOT NULL COMMENT 'รหัสหมวดหมู่ (เช่น OFFICE, MEDICAL, MAINTENANCE)',
  `category_name` varchar(100) NOT NULL COMMENT 'ชื่อหมวดหมู่ (เช่น วัสดุสำนักงาน, วัสดุการแพทย์)',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางหมวดหมู่สินค้า';

-- =====================================================
-- ข้อมูลเริ่มต้น
-- =====================================================

INSERT INTO `tbl_inv_categories` (
  `category_code`, 
  `category_name`, 
  `description`, 
  `display_order`, 
  `created_by_user_id`
) VALUES
('OFFICE', 'วัสดุสำนักงาน', 'วัสดุสิ้นเปลืองสำหรับงานสำนักงาน เช่น กระดาษ ปากกา แฟ้ม', 1, 'SYSTEM'),
('MEDICAL', 'วัสดุการแพทย์', 'วัสดุสิ้นเปลืองทางการแพทย์ เช่น ถุงมือ หน้ากาก ยา', 2, 'SYSTEM'),
('MAINTENANCE', 'วัสดุงานช่าง', 'วัสดุสำหรับงานซ่อมบำรุง เช่น สี ไขควง น๊อต', 3, 'SYSTEM'),
('KITCHEN', 'วัสดุงานครัว', 'วัสดุสำหรับงานครัว เช่น จาน ช้อน ส้อม', 4, 'SYSTEM'),
('CLEANING', 'วัสดุทำความสะอาด', 'วัสดุสำหรับทำความสะอาด เช่น น้ำยาล้างพื้น ผงซักฟอก', 5, 'SYSTEM'),
('IT', 'วัสดุไอที', 'วัสดุสำหรับงานไอที เช่น สายไฟ แป้นพิมพ์ เมาส์', 6, 'SYSTEM'),
('SECURITY', 'วัสดุรักษาความปลอดภัย', 'วัสดุสำหรับรักษาความปลอดภัย เช่น ไฟฉุกเฉิน กล้อง', 7, 'SYSTEM'),
('OTHER', 'อื่นๆ', 'หมวดหมู่อื่นๆ ที่ไม่ได้จัดอยู่ในหมวดหมู่ข้างต้น', 99, 'SYSTEM'); 