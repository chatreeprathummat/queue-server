-- =====================================================
-- ตารางหน่วยนับ (Units Table) - แก้ไขแล้ว
-- =====================================================

-- สร้างตารางหลักสำหรับเก็บหน่วยนับ
CREATE TABLE IF NOT EXISTS tbl_inv_units (
    unit_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'รหัสหน่วยนับ (Primary Key)',
    unit_name VARCHAR(50) NOT NULL COMMENT 'ชื่อหน่วยนับ (เช่น ชิ้น, กล่อง, เมตร)',
    unit_code VARCHAR(20) COMMENT 'รหัสหน่วยนับ (เช่น PCS, BOX, M) - ไม่บังคับ',
    unit_description TEXT COMMENT 'คำอธิบายเพิ่มเติมของหน่วยนับ',
    unit_category VARCHAR(50) DEFAULT 'GENERAL' COMMENT 'หมวดหมู่หน่วยนับ (GENERAL, WEIGHT, LENGTH, VOLUME, etc.)',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน (1=ใช้งาน, 0=ไม่ใช้งาน)',
    is_system_unit TINYINT(1) DEFAULT 0 COMMENT 'เป็นหน่วยนับของระบบหรือไม่ (1=ระบบ, 0=ผู้ใช้เพิ่ม)',
    display_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล (น้อยไปมาก)',
    
    -- ฟิลด์ Audit
    created_by_user_id VARCHAR(15) NOT NULL COMMENT 'รหัสผู้สร้าง',
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_by_user_id VARCHAR(15) NULL COMMENT 'รหัสผู้แก้ไขล่าสุด',
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    
    -- Indexes
    INDEX idx_unit_name (unit_name),
    INDEX idx_unit_category (unit_category),
    INDEX idx_is_active (is_active),
    INDEX idx_is_system_unit (is_system_unit),
    INDEX idx_display_order (display_order),
    
    -- Unique constraint สำหรับชื่อหน่วยนับ (ไม่ให้ซ้ำ)
    UNIQUE KEY uk_unit_name (unit_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางเก็บข้อมูลหน่วยนับ';

-- =====================================================
-- ข้อมูลเริ่มต้นสำหรับหน่วยนับระบบ
-- =====================================================

-- เพิ่มหน่วยนับพื้นฐานของระบบ
INSERT INTO tbl_inv_units (unit_name, unit_code, unit_description, unit_category, is_system_unit, display_order, created_by_user_id) VALUES
-- หน่วยนับทั่วไป
('ชิ้น', 'PCS', 'หน่วยนับแบบชิ้น', 'GENERAL', 1, 1, 'SYSTEM'),
('กล่อง', 'BOX', 'หน่วยนับแบบกล่อง', 'GENERAL', 1, 2, 'SYSTEM'),
('ชุด', 'SET', 'หน่วยนับแบบชุด', 'GENERAL', 1, 3, 'SYSTEM'),
('คู่', 'PAIR', 'หน่วยนับแบบคู่', 'GENERAL', 1, 4, 'SYSTEM'),
('อัน', 'PCS_AN', 'หน่วยนับแบบอัน', 'GENERAL', 1, 5, 'SYSTEM'),
('ตัว', 'PCS_TA', 'หน่วยนับแบบตัว', 'GENERAL', 1, 6, 'SYSTEM'),
('เล่ม', 'BOOK', 'หน่วยนับแบบเล่ม', 'GENERAL', 1, 7, 'SYSTEM'),
('แผ่น', 'SHEET', 'หน่วยนับแบบแผ่น', 'GENERAL', 1, 8, 'SYSTEM'),

-- หน่วยนับน้ำหนัก
('กิโลกรัม', 'KG', 'หน่วยนับน้ำหนัก กิโลกรัม', 'WEIGHT', 1, 10, 'SYSTEM'),
('กรัม', 'G', 'หน่วยนับน้ำหนัก กรัม', 'WEIGHT', 1, 11, 'SYSTEM'),
('ปอนด์', 'LB', 'หน่วยนับน้ำหนัก ปอนด์', 'WEIGHT', 1, 12, 'SYSTEM'),

-- หน่วยนับความยาว
('เมตร', 'M', 'หน่วยนับความยาว เมตร', 'LENGTH', 1, 20, 'SYSTEM'),
('เซนติเมตร', 'CM', 'หน่วยนับความยาว เซนติเมตร', 'LENGTH', 1, 21, 'SYSTEM'),
('มิลลิเมตร', 'MM', 'หน่วยนับความยาว มิลลิเมตร', 'LENGTH', 1, 22, 'SYSTEM'),
('ฟุต', 'FT', 'หน่วยนับความยาว ฟุต', 'LENGTH', 1, 23, 'SYSTEM'),
('นิ้ว', 'INCH', 'หน่วยนับความยาว นิ้ว', 'LENGTH', 1, 24, 'SYSTEM'),

-- หน่วยนับปริมาตร
('ลิตร', 'L', 'หน่วยนับปริมาตร ลิตร', 'VOLUME', 1, 30, 'SYSTEM'),
('มิลลิลิตร', 'ML', 'หน่วยนับปริมาตร มิลลิลิตร', 'VOLUME', 1, 31, 'SYSTEM'),
('แกลลอน', 'GAL', 'หน่วยนับปริมาตร แกลลอน', 'VOLUME', 1, 32, 'SYSTEM'),

-- หน่วยนับพื้นที่
('ตารางเมตร', 'M2', 'หน่วยนับพื้นที่ ตารางเมตร', 'AREA', 1, 40, 'SYSTEM'),
('ตารางฟุต', 'FT2', 'หน่วยนับพื้นที่ ตารางฟุต', 'AREA', 1, 41, 'SYSTEM'),

-- หน่วยนับเวลา
('ชั่วโมง', 'HR', 'หน่วยนับเวลา ชั่วโมง', 'TIME', 1, 50, 'SYSTEM'),
('นาที', 'MIN', 'หน่วยนับเวลา นาที', 'TIME', 1, 51, 'SYSTEM'),
('วัน', 'DAY', 'หน่วยนับเวลา วัน', 'TIME', 1, 52, 'SYSTEM'),
('สัปดาห์', 'WEEK', 'หน่วยนับเวลา สัปดาห์', 'TIME', 1, 53, 'SYSTEM'),
('เดือน', 'MONTH', 'หน่วยนับเวลา เดือน', 'TIME', 1, 54, 'SYSTEM'),
('ปี', 'YEAR', 'หน่วยนับเวลา ปี', 'TIME', 1, 55, 'SYSTEM'),

-- หน่วยนับอื่นๆ
('ถุง', 'BAG', 'หน่วยนับแบบถุง', 'GENERAL', 1, 60, 'SYSTEM'),
('ขวด', 'BOTTLE', 'หน่วยนับแบบขวด', 'GENERAL', 1, 61, 'SYSTEM'),
('กระป๋อง', 'CAN', 'หน่วยนับแบบกระป๋อง', 'GENERAL', 1, 62, 'SYSTEM'),
('หลอด', 'TUBE', 'หน่วยนับแบบหลอด', 'GENERAL', 1, 63, 'SYSTEM'),
('แท่ง', 'STICK', 'หน่วยนับแบบแท่ง', 'GENERAL', 1, 64, 'SYSTEM'),
('ม้วน', 'ROLL', 'หน่วยนับแบบม้วน', 'GENERAL', 1, 65, 'SYSTEM'),
('ก้อน', 'BLOCK', 'หน่วยนับแบบก้อน', 'GENERAL', 1, 66, 'SYSTEM'),
('ถ้วย', 'CUP', 'หน่วยนับแบบถ้วย', 'GENERAL', 1, 67, 'SYSTEM'),
('ช้อน', 'SPOON', 'หน่วยนับแบบช้อน', 'GENERAL', 1, 68, 'SYSTEM'),
('แก้ว', 'GLASS', 'หน่วยนับแบบแก้ว', 'GENERAL', 1, 69, 'SYSTEM');

-- =====================================================
-- Stored Procedure สำหรับตรวจสอบและเพิ่มหน่วยนับ
-- =====================================================

DELIMITER //

-- Stored Procedure: ตรวจสอบและเพิ่มหน่วยนับใหม่
CREATE PROCEDURE sp_check_and_add_unit(
    IN p_unit_name VARCHAR(50),
    IN p_unit_code VARCHAR(20),
    IN p_unit_description TEXT,
    IN p_unit_category VARCHAR(50),
    IN p_created_by_user_id VARCHAR(15),
    OUT p_result_code INT,
    OUT p_result_message VARCHAR(255),
    OUT p_unit_id INT
)
BEGIN
    DECLARE v_existing_unit_id INT DEFAULT NULL;
    DECLARE v_existing_unit_name VARCHAR(50) DEFAULT NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result_code = -1;
        SET p_result_message = 'เกิดข้อผิดพลาดในการประมวลผล';
        SET p_unit_id = NULL;
    END;
    
    START TRANSACTION;
    
    -- ตรวจสอบว่ามีหน่วยนับชื่อนี้อยู่แล้วหรือไม่
    SELECT unit_id, unit_name INTO v_existing_unit_id, v_existing_unit_name
    FROM tbl_inv_units 
    WHERE LOWER(TRIM(unit_name)) = LOWER(TRIM(p_unit_name))
    AND is_active = 1;
    
    -- ถ้ามีหน่วยนับอยู่แล้ว
    IF v_existing_unit_id IS NOT NULL THEN
        SET p_result_code = 0;
        SET p_result_message = CONCAT('หน่วยนับ "', v_existing_unit_name, '" มีอยู่ในระบบแล้ว');
        SET p_unit_id = v_existing_unit_id;
    ELSE
        -- เพิ่มหน่วยนับใหม่
        INSERT INTO tbl_inv_units (
            unit_name, 
            unit_code, 
            unit_description, 
            unit_category, 
            is_system_unit, 
            display_order,
            created_by_user_id
        ) VALUES (
            TRIM(p_unit_name),
            CASE WHEN p_unit_code IS NULL OR p_unit_code = '' THEN NULL ELSE TRIM(p_unit_code) END,
            p_unit_description,
            COALESCE(p_unit_category, 'GENERAL'),
            0, -- ไม่ใช่หน่วยนับของระบบ
            (SELECT COALESCE(MAX(display_order), 0) + 1 FROM tbl_inv_units),
            p_created_by_user_id
        );
        
        SET p_unit_id = LAST_INSERT_ID();
        SET p_result_code = 1;
        SET p_result_message = CONCAT('เพิ่มหน่วยนับ "', TRIM(p_unit_name), '" สำเร็จ');
    END IF;
    
    COMMIT;
END //

-- Stored Procedure: ดึงรายการหน่วยนับทั้งหมด
CREATE PROCEDURE sp_get_all_units(
    IN p_category VARCHAR(50),
    IN p_is_active TINYINT(1)
)
BEGIN
    SELECT 
        unit_id,
        unit_name,
        unit_code,
        unit_description,
        unit_category,
        is_active,
        is_system_unit,
        display_order,
        created_by_user_id,
        date_created,
        updated_by_user_id,
        date_updated
    FROM tbl_inv_units
    WHERE (p_category IS NULL OR unit_category = p_category)
    AND (p_is_active IS NULL OR is_active = p_is_active)
    ORDER BY display_order ASC, unit_name ASC;
END //

-- Stored Procedure: ค้นหาหน่วยนับ
CREATE PROCEDURE sp_search_units(
    IN p_search_term VARCHAR(100)
)
BEGIN
    SELECT 
        unit_id,
        unit_name,
        unit_code,
        unit_description,
        unit_category,
        is_active,
        is_system_unit,
        display_order
    FROM tbl_inv_units
    WHERE is_active = 1
    AND (
        LOWER(unit_name) LIKE CONCAT('%', LOWER(p_search_term), '%')
        OR LOWER(unit_code) LIKE CONCAT('%', LOWER(p_search_term), '%')
        OR LOWER(unit_description) LIKE CONCAT('%', LOWER(p_search_term), '%')
    )
    ORDER BY 
        CASE 
            WHEN LOWER(unit_name) = LOWER(p_search_term) THEN 1
            WHEN LOWER(unit_name) LIKE CONCAT(LOWER(p_search_term), '%') THEN 2
            ELSE 3
        END,
        display_order ASC,
        unit_name ASC
    LIMIT 20;
END //

DELIMITER ;

-- =====================================================
-- Views สำหรับใช้งาน
-- =====================================================

-- View: หน่วยนับที่ใช้งานได้ทั้งหมด
CREATE VIEW v_active_units AS
SELECT 
    unit_id,
    unit_name,
    unit_code,
    unit_description,
    unit_category,
    is_system_unit,
    display_order
FROM tbl_inv_units
WHERE is_active = 1
ORDER BY display_order ASC, unit_name ASC;

-- View: หน่วยนับแยกตามหมวดหมู่
CREATE VIEW v_units_by_category AS
SELECT 
    unit_category,
    COUNT(*) as unit_count,
    GROUP_CONCAT(unit_name ORDER BY display_order, unit_name SEPARATOR ', ') as unit_names
FROM tbl_inv_units
WHERE is_active = 1
GROUP BY unit_category
ORDER BY unit_category;

-- =====================================================
-- Triggers สำหรับการจัดการข้อมูล
-- =====================================================

DELIMITER //

-- Trigger: อัพเดท display_order เมื่อเพิ่มหน่วยนับใหม่
CREATE TRIGGER tr_units_before_insert
BEFORE INSERT ON tbl_inv_units
FOR EACH ROW
BEGIN
    -- ถ้าไม่ได้กำหนด display_order ให้กำหนดให้อัตโนมัติ
    IF NEW.display_order = 0 OR NEW.display_order IS NULL THEN
        SET NEW.display_order = (SELECT COALESCE(MAX(display_order), 0) + 1 FROM tbl_inv_units);
    END IF;
    
    -- กำหนดค่าเริ่มต้น
    IF NEW.unit_category IS NULL OR NEW.unit_category = '' THEN
        SET NEW.unit_category = 'GENERAL';
    END IF;
    
    IF NEW.is_active IS NULL THEN
        SET NEW.is_active = 1;
    END IF;
    
    IF NEW.is_system_unit IS NULL THEN
        SET NEW.is_system_unit = 0;
    END IF;
END //

-- Trigger: ตรวจสอบการอัพเดทชื่อหน่วยนับ
CREATE TRIGGER tr_units_before_update
BEFORE UPDATE ON tbl_inv_units
FOR EACH ROW
BEGIN
    -- ตรวจสอบว่าชื่อหน่วยนับใหม่ซ้ำกับที่มีอยู่หรือไม่ (ยกเว้นตัวเอง)
    IF NEW.unit_name != OLD.unit_name THEN
        IF EXISTS (
            SELECT 1 FROM tbl_inv_units 
            WHERE LOWER(TRIM(unit_name)) = LOWER(TRIM(NEW.unit_name))
            AND unit_id != NEW.unit_id
            AND is_active = 1
        ) THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'ชื่อหน่วยนับนี้มีอยู่ในระบบแล้ว';
        END IF;
    END IF;
END //

DELIMITER ;

-- =====================================================
-- ตัวอย่างการใช้งาน
-- =====================================================

/*
-- ตัวอย่างการเรียกใช้ Stored Procedure

-- 1. ตรวจสอบและเพิ่มหน่วยนับใหม่
CALL sp_check_and_add_unit(
    'ถ้วยพลาสติก',           -- ชื่อหน่วยนับ
    'CUP_PLASTIC',          -- รหัสหน่วยนับ (ไม่บังคับ)
    'ถ้วยพลาสติกใช้แล้วทิ้ง', -- คำอธิบาย
    'GENERAL',              -- หมวดหมู่
    'user123',              -- รหัสผู้สร้าง
    @result_code,           -- ผลลัพธ์ (1=สำเร็จ, 0=มีอยู่แล้ว, -1=ผิดพลาด)
    @result_message,        -- ข้อความผลลัพธ์
    @unit_id                -- รหัสหน่วยนับที่ได้
);

SELECT @result_code, @result_message, @unit_id;

-- 2. ดึงรายการหน่วยนับทั้งหมด
CALL sp_get_all_units(NULL, 1);

-- 3. ดึงรายการหน่วยนับเฉพาะหมวดหมู่
CALL sp_get_all_units('GENERAL', 1);

-- 4. ค้นหาหน่วยนับ
CALL sp_search_units('ชิ้น');

-- 5. ดูข้อมูลจาก View
SELECT * FROM v_active_units;
SELECT * FROM v_units_by_category;
*/ 