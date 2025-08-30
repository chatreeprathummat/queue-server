-- ========================================
-- ตารางระบบขออนุญาตพิมพ์เอกสาร
-- ========================================

-- ตารางเก็บคำขออนุญาตพิมพ์
CREATE TABLE IF NOT EXISTS tbl_in_test_print_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attachment_id INT NOT NULL,
    requested_by_user_id VARCHAR(15) NOT NULL,
    reason TEXT NOT NULL,
    document_name VARCHAR(255),
    file_name VARCHAR(255),
    status ENUM('PENDING', 'APPROVED', 'REJECTED', 'USED', 'EXPIRED') DEFAULT 'PENDING',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    approved_by_user_id VARCHAR(15) NULL,
    used_at TIMESTAMP NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_by_user_id VARCHAR(15) NOT NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id VARCHAR(15) NULL,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_attachment_id (attachment_id),
    INDEX idx_requested_by (requested_by_user_id),
    INDEX idx_status (status),
    INDEX idx_requested_at (requested_at),
    
    FOREIGN KEY (attachment_id) REFERENCES tbl_in_test_attachments(id) ON DELETE CASCADE
);

-- ตารางเก็บ log การเข้าถึงไฟล์ (อัปเดตจากเดิม)
-- เพิ่มฟิลด์ additional_data สำหรับเก็บข้อมูลเพิ่มเติม
ALTER TABLE tbl_in_test_file_access_logs 
ADD COLUMN IF NOT EXISTS additional_data JSON NULL AFTER user_agent;

-- อัปเดตตารางไฟล์แนบให้มีฟิลด์สำหรับการพิมพ์
ALTER TABLE tbl_in_test_attachments 
ADD COLUMN IF NOT EXISTS print_count INT DEFAULT 0 AFTER file_extension,
ADD COLUMN IF NOT EXISTS last_printed_at TIMESTAMP NULL AFTER print_count,
ADD COLUMN IF NOT EXISTS last_printed_by VARCHAR(15) NULL AFTER last_printed_at;

-- สร้าง View สำหรับดูสถิติการพิมพ์
CREATE OR REPLACE VIEW view_print_statistics AS
SELECT 
    a.id as attachment_id,
    a.file_name,
    a.original_file_name,
    a.print_count,
    a.last_printed_at,
    a.last_printed_by,
    COUNT(p.id) as total_permissions,
    COUNT(CASE WHEN p.status = 'APPROVED' THEN 1 END) as approved_permissions,
    COUNT(CASE WHEN p.status = 'USED' THEN 1 END) as used_permissions,
    MAX(p.requested_at) as last_request_date
FROM tbl_in_test_attachments a
LEFT JOIN tbl_in_test_print_permissions p ON a.id = p.attachment_id
GROUP BY a.id, a.file_name, a.original_file_name, a.print_count, a.last_printed_at, a.last_printed_by;

-- สร้าง Stored Procedure สำหรับขออนุญาตพิมพ์
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_request_print_permission(
    IN p_attachment_id INT,
    IN p_requested_by_user_id VARCHAR(15),
    IN p_reason TEXT,
    IN p_document_name VARCHAR(255),
    IN p_file_name VARCHAR(255),
    IN p_ip_address VARCHAR(45),
    IN p_user_agent TEXT
)
BEGIN
    DECLARE v_permission_id INT;
    DECLARE v_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'USED', 'EXPIRED') DEFAULT 'APPROVED';
    
    -- ตรวจสอบว่าไฟล์มีอยู่จริง
    IF NOT EXISTS (SELECT 1 FROM tbl_in_test_attachments WHERE id = p_attachment_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'File not found';
    END IF;
    
    -- บันทึกคำขออนุญาต
    INSERT INTO tbl_in_test_print_permissions (
        attachment_id, requested_by_user_id, reason, 
        document_name, file_name, status, 
        ip_address, user_agent, created_by_user_id
    ) VALUES (
        p_attachment_id, p_requested_by_user_id, p_reason,
        p_document_name, p_file_name, v_status,
        p_ip_address, p_user_agent, p_requested_by_user_id
    );
    
    SET v_permission_id = LAST_INSERT_ID();
    
    -- บันทึก log
    INSERT INTO tbl_in_test_file_access_logs (
        attachment_id, action, accessed_by_user_id,
        ip_address, user_agent, additional_data
    ) VALUES (
        p_attachment_id, 'PRINT_REQUEST', p_requested_by_user_id,
        p_ip_address, p_user_agent, 
        JSON_OBJECT(
            'reason', p_reason,
            'permission_id', v_permission_id,
            'document_name', p_document_name,
            'file_name', p_file_name
        )
    );
    
    -- ส่งคืน permission ID
    SELECT v_permission_id as permission_id, v_status as status;
END //
DELIMITER ;

-- สร้าง Stored Procedure สำหรับใช้ permission
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_use_print_permission(
    IN p_permission_id INT,
    IN p_attachment_id INT,
    IN p_user_id VARCHAR(15)
)
BEGIN
    DECLARE v_status VARCHAR(20);
    
    -- ตรวจสอบ permission
    SELECT status INTO v_status 
    FROM tbl_in_test_print_permissions 
    WHERE id = p_permission_id AND attachment_id = p_attachment_id;
    
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Permission not found';
    ELSEIF v_status != 'APPROVED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Permission not approved or already used';
    END IF;
    
    -- อัปเดต permission เป็น USED
    UPDATE tbl_in_test_print_permissions 
    SET status = 'USED', used_at = CURRENT_TIMESTAMP
    WHERE id = p_permission_id;
    
    -- อัปเดตจำนวนการพิมพ์ในไฟล์
    UPDATE tbl_in_test_attachments 
    SET print_count = print_count + 1,
        last_printed_at = CURRENT_TIMESTAMP,
        last_printed_by = p_user_id
    WHERE id = p_attachment_id;
    
    SELECT 'SUCCESS' as result;
END //
DELIMITER ;

-- เพิ่มข้อมูลตัวอย่าง (ถ้าต้องการ)
-- INSERT INTO tbl_in_test_print_permissions (attachment_id, requested_by_user_id, reason, document_name, file_name, status) 
-- VALUES (1, 'user001', 'ต้องการพิมพ์เพื่อเก็บเป็นเอกสารอ้างอิง', 'ใบเสนอราคา', 'quotation_001.pdf', 'APPROVED'); 