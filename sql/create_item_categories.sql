-- =====================================================
-- ตารางหมวดหมู่สินค้า (Item Categories)
-- ออกแบบให้ยืดหยุ่นรองรับการเพิ่ม/ลดหมวดหมู่ในอนาคต
-- =====================================================

-- ตารางหลักหมวดหมู่สินค้า
CREATE TABLE `tbl_inv_item_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_code` varchar(20) NOT NULL COMMENT 'รหัสหมวดหมู่',
  `category_name_th` varchar(100) NOT NULL COMMENT 'ชื่อหมวดหมู่ภาษาไทย',
  `category_name_en` varchar(100) DEFAULT NULL COMMENT 'ชื่อหมวดหมู่ภาษาอังกฤษ',
  `parent_category_id` int DEFAULT NULL COMMENT 'หมวดหมู่หลัก (สำหรับหมวดหมู่ย่อย)',
  `category_level` int NOT NULL DEFAULT 1 COMMENT 'ระดับหมวดหมู่ (1=หลัก, 2=ย่อย, 3=ย่อยของย่อย)',
  `category_path` varchar(255) DEFAULT NULL COMMENT 'เส้นทางหมวดหมู่ (เช่น /1/5/12)',
  `category_description` text COMMENT 'คำอธิบายหมวดหมู่',
  
  -- ฟิลด์สำหรับกำหนดความต้องการพิเศษ
  `requires_patient_info` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'ต้องระบุข้อมูลผู้ป่วย',
  `requires_hn` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'ต้องระบุ HN',
  `requires_patient_name` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'ต้องระบุชื่อผู้ป่วย',
  `requires_medical_justification` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'ต้องระบุเหตุผลทางการแพทย์',
  `requires_doctor_approval` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'ต้องอนุมัติจากแพทย์',
  `requires_special_handling` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'ต้องจัดการพิเศษ',
  
  -- ฟิลด์สำหรับการจัดซื้อ
  `purchase_approval_level` enum('NORMAL','MANAGER','EXECUTIVE','BOARD') NOT NULL DEFAULT 'NORMAL' COMMENT 'ระดับการอนุมัติการจัดซื้อ',
  `budget_category` varchar(50) DEFAULT NULL COMMENT 'หมวดงบประมาณ',
  `cost_center` varchar(50) DEFAULT NULL COMMENT 'ศูนย์ต้นทุน',
  `asset_type` enum('CONSUMABLE','FIXED_ASSET','LOW_VALUE','MEDICAL_DEVICE','DRUG','SUPPLY') DEFAULT 'CONSUMABLE' COMMENT 'ประเภทสินทรัพย์',
  
  -- ฟิลด์สำหรับการจัดการ
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  `display_order` int NOT NULL DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  `icon_class` varchar(50) DEFAULT NULL COMMENT 'ไอคอน CSS class',
  `color_code` varchar(7) DEFAULT NULL COMMENT 'รหัสสี (hex)',
  
  -- ฟิลด์สำหรับการติดตาม
  `usage_count` int NOT NULL DEFAULT 0 COMMENT 'จำนวนครั้งที่ใช้',
  `last_used_date` timestamp NULL DEFAULT NULL COMMENT 'วันที่ใช้ล่าสุด',
  
  -- ฟิลด์ Audit
  `created_by_user_id` varchar(15) NOT NULL COMMENT 'ผู้สร้าง',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  `updated_by_user_id` varchar(15) DEFAULT NULL COMMENT 'ผู้แก้ไข',
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไข',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_code` (`category_code`),
  KEY `idx_parent_category` (`parent_category_id`),
  KEY `idx_category_level` (`category_level`),
  KEY `idx_category_path` (`category_path`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_display_order` (`display_order`),
  KEY `idx_requires_patient_info` (`requires_patient_info`),
  KEY `idx_asset_type` (`asset_type`),
  KEY `idx_purchase_approval_level` (`purchase_approval_level`),
  
  CONSTRAINT `fk_item_categories_parent` FOREIGN KEY (`parent_category_id`) REFERENCES `tbl_inv_item_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางหมวดหมู่สินค้า';

-- ตารางคุณสมบัติเพิ่มเติมของหมวดหมู่
CREATE TABLE `tbl_inv_category_attributes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL COMMENT 'รหัสหมวดหมู่',
  `attribute_code` varchar(50) NOT NULL COMMENT 'รหัสคุณสมบัติ',
  `attribute_name_th` varchar(100) NOT NULL COMMENT 'ชื่อคุณสมบัติภาษาไทย',
  `attribute_name_en` varchar(100) DEFAULT NULL COMMENT 'ชื่อคุณสมบัติภาษาอังกฤษ',
  `attribute_type` enum('TEXT','NUMBER','DECIMAL','DATE','BOOLEAN','SELECT','MULTISELECT','FILE') NOT NULL COMMENT 'ประเภทข้อมูล',
  `is_required` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'จำเป็นต้องกรอก',
  `is_unique` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'ต้องไม่ซ้ำ',
  `default_value` text COMMENT 'ค่าเริ่มต้น',
  `validation_rules` text COMMENT 'กฎการตรวจสอบ (JSON)',
  `options` text COMMENT 'ตัวเลือก (สำหรับ SELECT/MULTISELECT)',
  `display_order` int NOT NULL DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  
  -- ฟิลด์ Audit
  `created_by_user_id` varchar(15) NOT NULL COMMENT 'ผู้สร้าง',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  `updated_by_user_id` varchar(15) DEFAULT NULL COMMENT 'ผู้แก้ไข',
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไข',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_attribute` (`category_id`, `attribute_code`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_attribute_type` (`attribute_type`),
  KEY `idx_is_required` (`is_required`),
  KEY `idx_is_active` (`is_active`),
  
  CONSTRAINT `fk_category_attributes_category` FOREIGN KEY (`category_id`) REFERENCES `tbl_inv_item_categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางคุณสมบัติเพิ่มเติมของหมวดหมู่';

-- ตารางค่าคุณสมบัติของรายการสินค้า
CREATE TABLE `tbl_inv_item_attribute_values` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL COMMENT 'รหัสรายการสินค้า (เชื่อมกับ tbl_inv_requisition_items)',
  `category_id` int NOT NULL COMMENT 'รหัสหมวดหมู่',
  `attribute_id` int NOT NULL COMMENT 'รหัสคุณสมบัติ',
  `attribute_value` text COMMENT 'ค่าคุณสมบัติ',
  `attribute_value_json` json DEFAULT NULL COMMENT 'ค่าคุณสมบัติแบบ JSON (สำหรับ MULTISELECT)',
  
  -- ฟิลด์ Audit
  `created_by_user_id` varchar(15) NOT NULL COMMENT 'ผู้สร้าง',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  `updated_by_user_id` varchar(15) DEFAULT NULL COMMENT 'ผู้แก้ไข',
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไข',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_item_attribute` (`item_id`, `attribute_id`),
  KEY `idx_item_id` (`item_id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_attribute_id` (`attribute_id`),
  
  CONSTRAINT `fk_item_attribute_values_item` FOREIGN KEY (`item_id`) REFERENCES `tbl_inv_requisition_items` (`item_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_item_attribute_values_category` FOREIGN KEY (`category_id`) REFERENCES `tbl_inv_item_categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_item_attribute_values_attribute` FOREIGN KEY (`attribute_id`) REFERENCES `tbl_inv_category_attributes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางค่าคุณสมบัติของรายการสินค้า';

-- ตารางการติดตามการใช้งานหมวดหมู่
CREATE TABLE `tbl_inv_category_usage_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL COMMENT 'รหัสหมวดหมู่',
  `item_id` int NOT NULL COMMENT 'รหัสรายการสินค้า',
  `requisition_id` varchar(20) NOT NULL COMMENT 'รหัสคำขอ',
  `action_type` enum('CREATE','UPDATE','DELETE','APPROVE','REJECT') NOT NULL COMMENT 'ประเภทการกระทำ',
  `action_description` text COMMENT 'คำอธิบายการกระทำ',
  `old_values` json DEFAULT NULL COMMENT 'ค่าเดิม (JSON)',
  `new_values` json DEFAULT NULL COMMENT 'ค่าใหม่ (JSON)',
  
  -- ฟิลด์ Audit
  `created_by_user_id` varchar(15) NOT NULL COMMENT 'ผู้กระทำ',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่กระทำ',
  
  PRIMARY KEY (`id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_item_id` (`item_id`),
  KEY `idx_requisition_id` (`requisition_id`),
  KEY `idx_action_type` (`action_type`),
  KEY `idx_date_created` (`date_created`),
  
  CONSTRAINT `fk_category_usage_logs_category` FOREIGN KEY (`category_id`) REFERENCES `tbl_inv_item_categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_category_usage_logs_item` FOREIGN KEY (`item_id`) REFERENCES `tbl_inv_requisition_items` (`item_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางการติดตามการใช้งานหมวดหมู่';

-- =====================================================
-- ข้อมูลเริ่มต้นสำหรับหมวดหมู่สินค้า
-- =====================================================

-- หมวดหมู่หลัก
INSERT INTO `tbl_inv_item_categories` (
  `category_code`, `category_name_th`, `category_name_en`, `category_level`, `category_path`,
  `requires_patient_info`, `requires_hn`, `requires_patient_name`, `requires_medical_justification`,
  `purchase_approval_level`, `asset_type`, `display_order`, `created_by_user_id`
) VALUES
-- หมวดหมู่หลัก
('MEDICAL_DEVICES', 'อุปกรณ์ทางการแพทย์', 'Medical Devices', 1, '/1', 1, 1, 1, 1, 'MANAGER', 'MEDICAL_DEVICE', 1, 'SYSTEM'),
('DRUGS', 'ยาและเวชภัณฑ์', 'Drugs and Pharmaceuticals', 1, '/2', 1, 1, 1, 1, 'EXECUTIVE', 'DRUG', 2, 'SYSTEM'),
('SUPPLIES', 'วัสดุสิ้นเปลือง', 'Medical Supplies', 1, '/3', 0, 0, 0, 0, 'NORMAL', 'CONSUMABLE', 3, 'SYSTEM'),
('OFFICE_SUPPLIES', 'วัสดุสำนักงาน', 'Office Supplies', 1, '/4', 0, 0, 0, 0, 'NORMAL', 'CONSUMABLE', 4, 'SYSTEM'),
('IT_EQUIPMENT', 'อุปกรณ์คอมพิวเตอร์', 'IT Equipment', 1, '/5', 0, 0, 0, 0, 'MANAGER', 'FIXED_ASSET', 5, 'SYSTEM'),
('FURNITURE', 'เฟอร์นิเจอร์', 'Furniture', 1, '/6', 0, 0, 0, 0, 'MANAGER', 'FIXED_ASSET', 6, 'SYSTEM'),
('LABORATORY', 'อุปกรณ์ห้องปฏิบัติการ', 'Laboratory Equipment', 1, '/7', 1, 1, 1, 1, 'MANAGER', 'MEDICAL_DEVICE', 7, 'SYSTEM'),
('MAINTENANCE', 'วัสดุซ่อมบำรุง', 'Maintenance Materials', 1, '/8', 0, 0, 0, 0, 'NORMAL', 'CONSUMABLE', 8, 'SYSTEM');

-- หมวดหมู่ย่อย - อุปกรณ์ทางการแพทย์
INSERT INTO `tbl_inv_item_categories` (
  `category_code`, `category_name_th`, `category_name_en`, `parent_category_id`, `category_level`, `category_path`,
  `requires_patient_info`, `requires_hn`, `requires_patient_name`, `requires_medical_justification`,
  `purchase_approval_level`, `asset_type`, `display_order`, `created_by_user_id`
) VALUES
('MONITORING_DEVICES', 'อุปกรณ์ติดตามผู้ป่วย', 'Patient Monitoring Devices', 1, 2, '/1/1', 1, 1, 1, 1, 'MANAGER', 'MEDICAL_DEVICE', 1, 'SYSTEM'),
('DIAGNOSTIC_DEVICES', 'อุปกรณ์วินิจฉัย', 'Diagnostic Devices', 1, 2, '/1/2', 1, 1, 1, 1, 'MANAGER', 'MEDICAL_DEVICE', 2, 'SYSTEM'),
('SURGICAL_DEVICES', 'อุปกรณ์ผ่าตัด', 'Surgical Devices', 1, 2, '/1/3', 1, 1, 1, 1, 'EXECUTIVE', 'MEDICAL_DEVICE', 3, 'SYSTEM'),
('THERAPEUTIC_DEVICES', 'อุปกรณ์บำบัด', 'Therapeutic Devices', 1, 2, '/1/4', 1, 1, 1, 1, 'MANAGER', 'MEDICAL_DEVICE', 4, 'SYSTEM');

-- หมวดหมู่ย่อย - ยาและเวชภัณฑ์
INSERT INTO `tbl_inv_item_categories` (
  `category_code`, `category_name_th`, `category_name_en`, `parent_category_id`, `category_level`, `category_path`,
  `requires_patient_info`, `requires_hn`, `requires_patient_name`, `requires_medical_justification`,
  `purchase_approval_level`, `asset_type`, `display_order`, `created_by_user_id`
) VALUES
('PRESCRIPTION_DRUGS', 'ยาตามใบสั่งแพทย์', 'Prescription Drugs', 2, 2, '/2/1', 1, 1, 1, 1, 'EXECUTIVE', 'DRUG', 1, 'SYSTEM'),
('OTC_DRUGS', 'ยาที่ไม่ต้องมีใบสั่งแพทย์', 'Over-the-Counter Drugs', 2, 2, '/2/2', 0, 0, 0, 0, 'MANAGER', 'DRUG', 2, 'SYSTEM'),
('VACCINES', 'วัคซีน', 'Vaccines', 2, 2, '/2/3', 1, 1, 1, 1, 'EXECUTIVE', 'DRUG', 3, 'SYSTEM'),
('MEDICAL_GASES', 'ก๊าซทางการแพทย์', 'Medical Gases', 2, 2, '/2/4', 1, 1, 1, 1, 'MANAGER', 'DRUG', 4, 'SYSTEM');

-- =====================================================
-- ตัวอย่างคุณสมบัติเพิ่มเติมสำหรับหมวดหมู่
-- =====================================================

-- คุณสมบัติสำหรับอุปกรณ์ทางการแพทย์
INSERT INTO `tbl_inv_category_attributes` (
  `category_id`, `attribute_code`, `attribute_name_th`, `attribute_name_en`, `attribute_type`, 
  `is_required`, `is_unique`, `default_value`, `validation_rules`, `options`, `display_order`, `created_by_user_id`
) VALUES
-- อุปกรณ์ติดตามผู้ป่วย
(9, 'PATIENT_TYPE', 'ประเภทผู้ป่วย', 'Patient Type', 'SELECT', 1, 0, NULL, NULL, '["ผู้ป่วยใน","ผู้ป่วยนอก","ผู้ป่วยฉุกเฉิน","ผู้ป่วยวิกฤต"]', 1, 'SYSTEM'),
(9, 'MONITORING_TYPE', 'ประเภทการติดตาม', 'Monitoring Type', 'MULTISELECT', 1, 0, NULL, NULL, '["ECG","SpO2","BP","Temperature","Respiratory Rate","Blood Glucose"]', 2, 'SYSTEM'),
(9, 'ALARM_FEATURES', 'ระบบแจ้งเตือน', 'Alarm Features', 'BOOLEAN', 0, 0, '1', NULL, NULL, 3, 'SYSTEM'),
(9, 'BATTERY_LIFE', 'อายุแบตเตอรี่ (ชั่วโมง)', 'Battery Life (hours)', 'NUMBER', 0, 0, NULL, '{"min": 0, "max": 1000}', NULL, 4, 'SYSTEM'),

-- อุปกรณ์วินิจฉัย
(10, 'DIAGNOSTIC_METHOD', 'วิธีการวินิจฉัย', 'Diagnostic Method', 'SELECT', 1, 0, NULL, NULL, '["Imaging","Laboratory","Physical Examination","Endoscopy","Biopsy"]', 1, 'SYSTEM'),
(10, 'ACCURACY_RATE', 'ความแม่นยำ (%)', 'Accuracy Rate (%)', 'NUMBER', 0, 0, NULL, '{"min": 0, "max": 100}', NULL, 2, 'SYSTEM'),
(10, 'CALIBRATION_REQUIRED', 'ต้องสอบเทียบ', 'Calibration Required', 'BOOLEAN', 0, 0, '1', NULL, NULL, 3, 'SYSTEM'),
(10, 'CALIBRATION_FREQUENCY', 'ความถี่การสอบเทียบ (เดือน)', 'Calibration Frequency (months)', 'NUMBER', 0, 0, NULL, '{"min": 1, "max": 60}', NULL, 4, 'SYSTEM'),

-- ยาตามใบสั่งแพทย์
(13, 'DRUG_CATEGORY', 'หมวดยาตาม ATC', 'Drug Category (ATC)', 'SELECT', 1, 0, NULL, NULL, '["A - Alimentary tract and metabolism","B - Blood and blood forming organs","C - Cardiovascular system","D - Dermatologicals","G - Genito urinary system and sex hormones","H - Systemic hormonal preparations","J - Antiinfectives for systemic use","L - Antineoplastic and immunomodulating agents","M - Musculo-skeletal system","N - Nervous system","P - Antiparasitic products","R - Respiratory system","S - Sensory organs","V - Various"]', 1, 'SYSTEM'),
(13, 'DOSAGE_FORM', 'รูปแบบยา', 'Dosage Form', 'SELECT', 1, 0, NULL, NULL, '["Tablet","Capsule","Injection","Syrup","Cream","Ointment","Inhaler","Suppository","Eye drops","Ear drops"]', 2, 'SYSTEM'),
(13, 'STRENGTH', 'ความแรง', 'Strength', 'TEXT', 1, 0, NULL, NULL, NULL, 3, 'SYSTEM'),
(13, 'STORAGE_CONDITION', 'เงื่อนไขการเก็บรักษา', 'Storage Condition', 'SELECT', 1, 0, 'Room Temperature', NULL, '["Room Temperature","Refrigerated (2-8°C)","Frozen (-20°C)","Light Sensitive","Moisture Sensitive"]', 4, 'SYSTEM'),
(13, 'EXPIRY_DATE', 'วันหมดอายุ', 'Expiry Date', 'DATE', 1, 0, NULL, '{"min_date": "today"}', NULL, 5, 'SYSTEM');

-- =====================================================
-- Stored Procedures และ Functions
-- =====================================================

DELIMITER //

-- ฟังก์ชันสำหรับอัปเดต category_path อัตโนมัติ
CREATE FUNCTION update_category_path(category_id INT) 
RETURNS VARCHAR(255)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE path VARCHAR(255);
    DECLARE parent_id INT;
    DECLARE parent_path VARCHAR(255);
    
    SELECT parent_category_id INTO parent_id 
    FROM tbl_inv_item_categories 
    WHERE id = category_id;
    
    IF parent_id IS NULL THEN
        SET path = CONCAT('/', category_id);
    ELSE
        SET parent_path = update_category_path(parent_id);
        SET path = CONCAT(parent_path, '/', category_id);
    END IF;
    
    RETURN path;
END //

-- Stored Procedure สำหรับอัปเดต category_path ทั้งหมด
CREATE PROCEDURE update_all_category_paths()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE cat_id INT;
    DECLARE cat_cursor CURSOR FOR SELECT id FROM tbl_inv_item_categories;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cat_cursor;
    
    read_loop: LOOP
        FETCH cat_cursor INTO cat_id;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        UPDATE tbl_inv_item_categories 
        SET category_path = update_category_path(cat_id)
        WHERE id = cat_id;
    END LOOP;
    
    CLOSE cat_cursor;
END //

-- Stored Procedure สำหรับดึงหมวดหมู่แบบ hierarchical
CREATE PROCEDURE get_category_hierarchy(parent_id INT)
BEGIN
    WITH RECURSIVE category_tree AS (
        -- Base case: หมวดหมู่หลัก
        SELECT 
            id, category_code, category_name_th, category_name_en,
            parent_category_id, category_level, category_path,
            requires_patient_info, requires_hn, requires_patient_name,
            purchase_approval_level, asset_type, display_order,
            0 as depth,
            CAST(category_name_th AS CHAR(1000)) as hierarchy_path
        FROM tbl_inv_item_categories 
        WHERE parent_category_id = parent_id OR (parent_id IS NULL AND parent_category_id IS NULL)
        
        UNION ALL
        
        -- Recursive case: หมวดหมู่ย่อย
        SELECT 
            c.id, c.category_code, c.category_name_th, c.category_name_en,
            c.parent_category_id, c.category_level, c.category_path,
            c.requires_patient_info, c.requires_hn, c.requires_patient_name,
            c.purchase_approval_level, c.asset_type, c.display_order,
            ct.depth + 1,
            CONCAT(ct.hierarchy_path, ' > ', c.category_name_th) as hierarchy_path
        FROM tbl_inv_item_categories c
        INNER JOIN category_tree ct ON c.parent_category_id = ct.id
        WHERE c.is_active = 1
    )
    SELECT * FROM category_tree
    ORDER BY hierarchy_path;
END //

-- Stored Procedure สำหรับดึงหมวดหมู่ที่ต้องระบุข้อมูลผู้ป่วย
CREATE PROCEDURE get_patient_required_categories()
BEGIN
    SELECT 
        id, category_code, category_name_th, category_name_en,
        category_level, category_path,
        requires_patient_info, requires_hn, requires_patient_name, requires_medical_justification,
        purchase_approval_level, asset_type
    FROM tbl_inv_item_categories 
    WHERE requires_patient_info = 1 AND is_active = 1
    ORDER BY category_path, display_order;
END //

DELIMITER ;

-- =====================================================
-- Triggers สำหรับการจัดการอัตโนมัติ
-- =====================================================

DELIMITER //

-- Trigger สำหรับอัปเดต category_path เมื่อมีการเปลี่ยนแปลง parent_category_id
CREATE TRIGGER tr_category_path_update
AFTER UPDATE ON tbl_inv_item_categories
FOR EACH ROW
BEGIN
    IF OLD.parent_category_id != NEW.parent_category_id THEN
        UPDATE tbl_inv_item_categories 
        SET category_path = update_category_path(NEW.id)
        WHERE id = NEW.id;
    END IF;
END //

-- Trigger สำหรับอัปเดต usage_count และ last_used_date
CREATE TRIGGER tr_category_usage_update
AFTER INSERT ON tbl_inv_category_usage_logs
FOR EACH ROW
BEGIN
    UPDATE tbl_inv_item_categories 
    SET 
        usage_count = usage_count + 1,
        last_used_date = CURRENT_TIMESTAMP
    WHERE id = NEW.category_id;
END //

DELIMITER ;

-- =====================================================
-- Views สำหรับการใช้งาน
-- =====================================================

-- View สำหรับแสดงหมวดหมู่แบบ hierarchical
CREATE VIEW vw_category_hierarchy AS
WITH RECURSIVE category_tree AS (
    SELECT 
        id, category_code, category_name_th, category_name_en,
        parent_category_id, category_level, category_path,
        requires_patient_info, requires_hn, requires_patient_name, requires_medical_justification,
        purchase_approval_level, asset_type, display_order, is_active,
        0 as depth,
        CAST(category_name_th AS CHAR(1000)) as hierarchy_path,
        CAST(category_code AS CHAR(1000)) as hierarchy_code
    FROM tbl_inv_item_categories 
    WHERE parent_category_id IS NULL AND is_active = 1
    
    UNION ALL
    
    SELECT 
        c.id, c.category_code, c.category_name_th, c.category_name_en,
        c.parent_category_id, c.category_level, c.category_path,
        c.requires_patient_info, c.requires_hn, c.requires_patient_name, c.requires_medical_justification,
        c.purchase_approval_level, c.asset_type, c.display_order, c.is_active,
        ct.depth + 1,
        CONCAT(ct.hierarchy_path, ' > ', c.category_name_th) as hierarchy_path,
        CONCAT(ct.hierarchy_code, ' > ', c.category_code) as hierarchy_code
    FROM tbl_inv_item_categories c
    INNER JOIN category_tree ct ON c.parent_category_id = ct.id
    WHERE c.is_active = 1
)
SELECT * FROM category_tree
ORDER BY hierarchy_path;

-- View สำหรับแสดงหมวดหมู่ที่ต้องระบุข้อมูลผู้ป่วย
CREATE VIEW vw_patient_required_categories AS
SELECT 
    id, category_code, category_name_th, category_name_en,
    category_level, category_path,
    requires_patient_info, requires_hn, requires_patient_name, requires_medical_justification,
    requires_doctor_approval, requires_special_handling,
    purchase_approval_level, asset_type,
    usage_count, last_used_date
FROM tbl_inv_item_categories 
WHERE requires_patient_info = 1 AND is_active = 1
ORDER BY category_path, display_order;

-- View สำหรับแสดงสถิติการใช้งานหมวดหมู่
CREATE VIEW vw_category_usage_stats AS
SELECT 
    c.id, c.category_code, c.category_name_th, c.category_name_en,
    c.category_level, c.category_path,
    c.usage_count, c.last_used_date,
    COUNT(cul.id) as total_actions,
    COUNT(CASE WHEN cul.action_type = 'CREATE' THEN 1 END) as create_count,
    COUNT(CASE WHEN cul.action_type = 'UPDATE' THEN 1 END) as update_count,
    COUNT(CASE WHEN cul.action_type = 'DELETE' THEN 1 END) as delete_count,
    COUNT(CASE WHEN cul.action_type = 'APPROVE' THEN 1 END) as approve_count,
    COUNT(CASE WHEN cul.action_type = 'REJECT' THEN 1 END) as reject_count
FROM tbl_inv_item_categories c
LEFT JOIN tbl_inv_category_usage_logs cul ON c.id = cul.category_id
WHERE c.is_active = 1
GROUP BY c.id, c.category_code, c.category_name_th, c.category_name_en, c.category_level, c.category_path, c.usage_count, c.last_used_date
ORDER BY c.usage_count DESC, c.last_used_date DESC;

-- =====================================================
-- Indexes เพิ่มเติมสำหรับประสิทธิภาพ
-- =====================================================

-- Index สำหรับการค้นหาหมวดหมู่
CREATE INDEX idx_category_search ON tbl_inv_item_categories (category_name_th, category_name_en, category_code);

-- Index สำหรับการกรองตามเงื่อนไข
CREATE INDEX idx_category_filters ON tbl_inv_item_categories (is_active, requires_patient_info, asset_type, purchase_approval_level);

-- Index สำหรับการเรียงลำดับ
CREATE INDEX idx_category_sort ON tbl_inv_item_categories (display_order, category_path, usage_count DESC);

-- Index สำหรับการติดตามการใช้งาน
CREATE INDEX idx_usage_tracking ON tbl_inv_category_usage_logs (category_id, action_type, date_created);

-- Index สำหรับการค้นหาคุณสมบัติ
CREATE INDEX idx_attribute_search ON tbl_inv_category_attributes (category_id, attribute_code, is_active);

-- Index สำหรับการค้นหาค่าคุณสมบัติ
CREATE INDEX idx_attribute_values ON tbl_inv_item_attribute_values (item_id, category_id, attribute_id); 