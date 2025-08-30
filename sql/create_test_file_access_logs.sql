-- สร้างตารางบันทึกการเข้าถึงไฟล์
CREATE TABLE IF NOT EXISTS `tbl_in_test_file_access_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `attachment_id` INT NOT NULL COMMENT 'รหัสไฟล์แนบ',
    `action` ENUM('view', 'print', 'download') NOT NULL COMMENT 'การกระทำ',
    `accessed_by_user_id` VARCHAR(15) NOT NULL COMMENT 'ผู้เข้าถึง',
    `ip_address` VARCHAR(45) NOT NULL COMMENT 'IP Address',
    `user_agent` TEXT COMMENT 'User Agent',
    `access_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่เข้าถึง',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_attachment_action` (`attachment_id`, `action`),
    INDEX `idx_access_date` (`access_date`),
    INDEX `idx_user_action` (`accessed_by_user_id`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- เพิ่มฟิลด์สำหรับบันทึกการพิมพ์ในตาราง attachments
ALTER TABLE `tbl_in_test_attachments` 
ADD COLUMN `print_count` INT DEFAULT 0 COMMENT 'จำนวนครั้งที่พิมพ์',
ADD COLUMN `last_printed_at` TIMESTAMP NULL COMMENT 'วันที่พิมพ์ล่าสุด',
ADD COLUMN `last_printed_by` VARCHAR(15) NULL COMMENT 'ผู้พิมพ์ล่าสุด';

-- สร้าง index สำหรับการค้นหาการพิมพ์
CREATE INDEX `idx_attachments_print` ON `tbl_in_test_attachments` (`print_count`, `last_printed_at`);

-- ตัวอย่างข้อมูลทดสอบ
INSERT INTO `tbl_in_test_file_access_logs` (`attachment_id`, `action`, `accessed_by_user_id`, `ip_address`, `user_agent`) VALUES
(88, 'view', 'test_user', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(88, 'print', 'test_user', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(89, 'view', 'test_user', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

-- อัปเดตข้อมูลการพิมพ์ในตาราง attachments
UPDATE `tbl_in_test_attachments` 
SET `print_count` = 1, 
    `last_printed_at` = CURRENT_TIMESTAMP, 
    `last_printed_by` = 'test_user' 
WHERE `id` = 88; 