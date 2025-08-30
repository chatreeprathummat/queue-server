-- =================================================================
-- Database Design for Nursing Template System
-- =================================================================
-- ออกแบบโดย: Nursing System Development Team
-- วันที่: 2025-01-20
-- Version: 1.0
-- 
-- ระบบนี้รองรับ:
-- 1. Templates หลากหลายประเภท (Universal, Category, Specific)
-- 2. Recent Templates แบบ Hybrid (User-based + Patient-based)
-- 3. Auto-suggestion และ Ranking
-- 4. Template Analytics และ Optimization
-- =================================================================

-- 1. ตาราง Template หลัก - เก็บ Templates ทั้งหมด
CREATE TABLE `tbl_nurse_templates` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `template_text` TEXT NOT NULL COMMENT 'ข้อความ template',
  `template_type` ENUM('universal', 'category', 'specific', 'user_custom') NOT NULL DEFAULT 'universal' 
    COMMENT 'ประเภท: universal=ทั่วไป, category=ตามหมวด, specific=เฉพาะแผน, user_custom=ของ user',
  
  -- การจัดหมวดหมู่
  `category_id` VARCHAR(50) NULL COMMENT 'หมวดการพยาบาล เช่น assessment, hygiene',
  `plan_id` INT NULL COMMENT 'ID แผนการพยาบาล (สำหรับ specific templates)',
  `ward_code` VARCHAR(10) NULL COMMENT 'รหัสวอร์ด (ถ้าเฉพาะวอร์ด)',
  
  -- สถิติการใช้งาน
  `usage_count` INT DEFAULT 0 COMMENT 'จำนวนครั้งที่ใช้ทั้งหมด',
  `usage_frequency` DECIMAL(5,2) DEFAULT 0.00 COMMENT 'เปอร์เซ็นต์การใช้งาน (0-100)',
  `avg_rating` DECIMAL(3,2) DEFAULT 0.00 COMMENT 'คะแนนเฉลี่ย (1-5)',
  
  -- การจัดการ
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '1=ใช้งาน, 0=ปิดใช้งาน',
  `is_system` TINYINT(1) DEFAULT 1 COMMENT '1=template ระบบ, 0=template ของ user',
  `created_by` VARCHAR(50) NULL COMMENT 'ผู้สร้าง (username)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_by` VARCHAR(50) NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `del_flag` CHAR(1) NULL DEFAULT NULL,
  
  -- Indexes สำหรับ performance
  INDEX `idx_template_type` (`template_type`),
  INDEX `idx_category_id` (`category_id`),
  INDEX `idx_plan_id` (`plan_id`),
  INDEX `idx_usage_frequency` (`usage_frequency` DESC),
  INDEX `idx_active_templates` (`is_active`, `del_flag`),
  
  -- Full-text search สำหรับ auto-suggestion
  FULLTEXT KEY `ft_template_text` (`template_text`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='ตาราง Templates หลักสำหรับระบบการพยาบาล';

-- =================================================================
-- 2. ตาราง Template Usage History - ประวัติการใช้งาน Template
-- =================================================================
CREATE TABLE `tbl_nurse_template_usage` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `template_id` INT NOT NULL COMMENT 'ID ของ template ที่ใช้',
  `username` VARCHAR(50) NOT NULL COMMENT 'ผู้ใช้งาน',
  `patient_an` VARCHAR(20) NULL COMMENT 'AN ผู้ป่วย (ถ้ามี)',
  `plan_id` INT NULL COMMENT 'แผนการพยาบาลที่ใช้ template นี้',
  `category_id` VARCHAR(50) NULL COMMENT 'หมวดการพยาบาล',
  
  -- Context ของการใช้งาน
  `usage_context` ENUM('plan_narrative', 'standalone_note', 'suggestion', 'manual_select') 
    DEFAULT 'plan_narrative' COMMENT 'บริบทการใช้งาน',
  `ward_code` VARCHAR(10) NULL COMMENT 'วอร์ดที่ใช้งาน',
  `shift_time` ENUM('morning', 'afternoon', 'night') NULL COMMENT 'เวรที่ใช้งาน',
  
  -- การให้คะแนน (optional)
  `user_rating` TINYINT NULL COMMENT 'คะแนนที่ user ให้ (1-5)',
  `is_modified` TINYINT(1) DEFAULT 0 COMMENT '1=มีการแก้ไขหลังเลือก template',
  
  -- Metadata
  `used_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่ใช้งาน',
  `session_id` VARCHAR(100) NULL COMMENT 'Session ID สำหรับ track การใช้งาน',
  
  -- Foreign Keys
  FOREIGN KEY (`template_id`) REFERENCES `tbl_nurse_templates`(`id`) ON DELETE CASCADE,
  
  -- Indexes สำหรับ Recent Templates
  INDEX `idx_user_recent` (`username`, `used_at` DESC),
  INDEX `idx_patient_recent` (`patient_an`, `used_at` DESC),
  INDEX `idx_user_category` (`username`, `category_id`, `used_at` DESC),
  INDEX `idx_patient_category` (`patient_an`, `category_id`, `used_at` DESC),
  INDEX `idx_plan_templates` (`plan_id`, `used_at` DESC),
  INDEX `idx_usage_analytics` (`template_id`, `used_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='ประวัติการใช้งาน Templates - สำหรับ Recent Templates และ Analytics';

-- =================================================================
-- 3. ตาราง User Custom Templates - Templates ที่ user สร้างเอง
-- =================================================================
CREATE TABLE `tbl_nurse_user_templates` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL COMMENT 'เจ้าของ template',
  `template_text` TEXT NOT NULL COMMENT 'ข้อความ template',
  `template_name` VARCHAR(200) NULL COMMENT 'ชื่อ template (ถ้า user ตั้ง)',
  `category_id` VARCHAR(50) NULL COMMENT 'หมวดที่ user กำหนด',
  `plan_id` INT NULL COMMENT 'แผนที่เกี่ยวข้อง (ถ้ามี)',
  
  -- การแชร์
  `is_shared` TINYINT(1) DEFAULT 0 COMMENT '1=แชร์ให้คนอื่นใช้, 0=ใช้เอง',
  `shared_with_ward` VARCHAR(10) NULL COMMENT 'แชร์กับวอร์ด (ถ้ามี)',
  
  -- สถิติ
  `usage_count` INT DEFAULT 0 COMMENT 'จำนวนครั้งที่ใช้',
  `last_used_at` TIMESTAMP NULL COMMENT 'ครั้งล่าสุดที่ใช้',
  
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `del_flag` CHAR(1) NULL DEFAULT NULL,
  
  INDEX `idx_username` (`username`),
  INDEX `idx_shared_templates` (`is_shared`, `shared_with_ward`),
  INDEX `idx_category_templates` (`category_id`),
  INDEX `idx_usage_count` (`usage_count` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Templates ที่ User สร้างเอง - Personal และ Shared Templates';

-- =================================================================
-- 4. ตาราง Template Categories - หมวดหมู่ Template
-- =================================================================
CREATE TABLE `tbl_nurse_template_categories` (
  `category_id` VARCHAR(50) PRIMARY KEY COMMENT 'รหัสหมวด เช่น assessment, hygiene',
  `category_name` VARCHAR(200) NOT NULL COMMENT 'ชื่อหมวด',
  `category_icon` VARCHAR(10) NULL COMMENT 'ไอคอนหมวด',
  `sort_order` INT DEFAULT 0 COMMENT 'ลำดับการแสดง',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `del_flag` CHAR(1) NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='หมวดหมู่ของ Templates';

-- =================================================================
-- 5. ตาราง Template Plan Mapping - ผูก Templates กับแผนการพยาบาล
-- =================================================================
CREATE TABLE `tbl_nurse_template_plan_mapping` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `plan_id` INT NOT NULL COMMENT 'ID แผนการพยาบาล',
  `template_id` INT NOT NULL COMMENT 'ID template',
  `priority` TINYINT DEFAULT 1 COMMENT 'ลำดับความสำคัญ (1=สูงสุด)',
  `auto_suggest` TINYINT(1) DEFAULT 1 COMMENT '1=แสดงใน auto-suggestion',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`template_id`) REFERENCES `tbl_nurse_templates`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_plan_template` (`plan_id`, `template_id`),
  INDEX `idx_plan_priority` (`plan_id`, `priority`),
  INDEX `idx_auto_suggest` (`auto_suggest`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='การผูก Templates กับแผนการพยาบาล';

-- =================================================================
-- 6. Views สำหรับ Recent Templates (Hybrid Approach)
-- =================================================================

-- View: Recent Templates by User (นิสัยการทำงานส่วนตัว)
CREATE VIEW `v_user_recent_templates` AS
SELECT 
    u.username,
    t.id as template_id,
    t.template_text,
    t.template_type,
    t.category_id,
    COUNT(*) as usage_count,
    MAX(u.used_at) as last_used,
    AVG(u.user_rating) as avg_rating
FROM `tbl_nurse_template_usage` u
JOIN `tbl_nurse_templates` t ON u.template_id = t.id
WHERE t.is_active = 1 AND t.del_flag IS NULL
    AND u.used_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) -- ล่าสุด 30 วัน
GROUP BY u.username, t.id
ORDER BY u.username, last_used DESC, usage_count DESC;

-- View: Recent Templates by Patient (เฉพาะผู้ป่วยรายนี้)
CREATE VIEW `v_patient_recent_templates` AS
SELECT 
    u.patient_an,
    t.id as template_id,
    t.template_text,
    t.template_type,
    t.category_id,
    COUNT(*) as usage_count,
    MAX(u.used_at) as last_used,
    COUNT(DISTINCT u.username) as used_by_users
FROM `tbl_nurse_template_usage` u
JOIN `tbl_nurse_templates` t ON u.template_id = t.id
WHERE t.is_active = 1 AND t.del_flag IS NULL
    AND u.patient_an IS NOT NULL
    AND u.used_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) -- ล่าสุด 7 วัน
GROUP BY u.patient_an, t.id
ORDER BY u.patient_an, last_used DESC, usage_count DESC;

-- =================================================================
-- 7. Sample Data - ข้อมูลตัวอย่าง
-- =================================================================

-- Categories
INSERT INTO `tbl_nurse_template_categories` VALUES
('assessment', 'การประเมิน Assessment', '📋', 1, 1, NOW(), NULL),
('hygiene', 'Hygiene Care', '🛀', 2, 1, NOW(), NULL),
('iv_care', 'IV Care', '💉', 3, 1, NOW(), NULL),
('medication', 'การให้ยา', '💊', 4, 1, NOW(), NULL),
('monitoring', 'การติดตาม', '📊', 5, 1, NOW(), NULL);

-- Universal Templates
INSERT INTO `tbl_nurse_templates` 
(`template_text`, `template_type`, `usage_frequency`, `is_system`, `created_by`) VALUES
('ผู้ป่วยให้ความร่วมมือดี', 'universal', 95.0, 1, 'system'),
('ไม่มีอาการผิดปกติ', 'universal', 87.0, 1, 'system'),
('ตอบสนองต่อการรักษาดี', 'universal', 78.0, 1, 'system'),
('สัญญาณชีพเสถียร', 'universal', 85.0, 1, 'system'),
('ญาติให้การสนับสนุน', 'universal', 65.0, 1, 'system'),
('ต้องติดตามอาการต่อเนื่อง', 'universal', 45.0, 1, 'system'),
('สถานภาพคงที่', 'universal', 67.0, 1, 'system'),
('แนะนำการดูแลตนเอง', 'universal', 58.0, 1, 'system'),
('ให้การสนับสนุนทางจิตใจ', 'universal', 52.0, 1, 'system');

-- Category-specific Templates
INSERT INTO `tbl_nurse_templates` 
(`template_text`, `template_type`, `category_id`, `usage_frequency`, `is_system`, `created_by`) VALUES
('รู้สึกตัวดี ตอบสนองปกติ', 'category', 'assessment', 89.0, 1, 'system'),
('ประเมินได้ครบถ้วน', 'category', 'assessment', 76.0, 1, 'system'),
('ช่วยดูแลสุขอนามัย', 'category', 'hygiene', 91.0, 1, 'system'),
('ผิวหนังสะอาด', 'category', 'hygiene', 84.0, 1, 'system'),
('ไม่มีผื่นแดง', 'category', 'hygiene', 73.0, 1, 'system'),
('ตรวจสอบสายน้ำเกิด', 'category', 'iv_care', 95.0, 1, 'system'),
('จุดแทงไม่บวม', 'category', 'iv_care', 88.0, 1, 'system'),
('สายน้ำเกิดไหลดี', 'category', 'iv_care', 79.0, 1, 'system');

-- =================================================================
-- 8. Stored Procedures สำหรับ Recent Templates
-- =================================================================

DELIMITER //

-- Procedure: ดึง Recent Templates แบบ Hybrid (User + Patient)
CREATE PROCEDURE `sp_get_recent_templates`(
    IN p_username VARCHAR(50),
    IN p_patient_an VARCHAR(20),
    IN p_category_id VARCHAR(50),
    IN p_limit INT DEFAULT 5
)
BEGIN
    -- Hybrid approach: รวม User-based + Patient-based
    SELECT DISTINCT
        t.id,
        t.template_text,
        t.template_type,
        t.category_id,
        COALESCE(ur.usage_count, 0) + COALESCE(pr.usage_count, 0) as total_usage,
        GREATEST(COALESCE(ur.last_used, '1970-01-01'), COALESCE(pr.last_used, '1970-01-01')) as last_used,
        CASE 
            WHEN ur.last_used IS NOT NULL AND pr.last_used IS NOT NULL THEN 'both'
            WHEN ur.last_used IS NOT NULL THEN 'user'
            WHEN pr.last_used IS NOT NULL THEN 'patient'
            ELSE 'none'
        END as source_type
    FROM `tbl_nurse_templates` t
    LEFT JOIN `v_user_recent_templates` ur ON t.id = ur.template_id AND ur.username = p_username
    LEFT JOIN `v_patient_recent_templates` pr ON t.id = pr.template_id AND pr.patient_an = p_patient_an
    WHERE t.is_active = 1 AND t.del_flag IS NULL
        AND (ur.template_id IS NOT NULL OR pr.template_id IS NOT NULL)
        AND (p_category_id IS NULL OR t.category_id = p_category_id OR t.template_type = 'universal')
    ORDER BY 
        total_usage DESC,
        last_used DESC
    LIMIT p_limit;
END //

-- Procedure: บันทึกการใช้งาน Template
CREATE PROCEDURE `sp_log_template_usage`(
    IN p_template_id INT,
    IN p_username VARCHAR(50),
    IN p_patient_an VARCHAR(20),
    IN p_plan_id INT,
    IN p_category_id VARCHAR(50),
    IN p_usage_context VARCHAR(20),
    IN p_ward_code VARCHAR(10),
    IN p_user_rating TINYINT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- บันทึกการใช้งาน
    INSERT INTO `tbl_nurse_template_usage` 
    (template_id, username, patient_an, plan_id, category_id, usage_context, ward_code, user_rating)
    VALUES 
    (p_template_id, p_username, p_patient_an, p_plan_id, p_category_id, p_usage_context, p_ward_code, p_user_rating);
    
    -- อัปเดตสถิติใน template หลัก
    UPDATE `tbl_nurse_templates` 
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = p_template_id;
    
    COMMIT;
END //

DELIMITER ;

-- =================================================================
-- 9. คำแนะนำการใช้งาน Recent Templates
-- =================================================================

/*
💡 **คำแนะนำ: การผูก Recent Templates**

### **Hybrid Approach (แนะนำ):**
ใช้ทั้ง User-based และ Patient-based พร้อมกัน เพราะ:

✅ **User-based Recent Templates:**
- เหมาะสำหรับนิสัยการทำงานส่วนตัว
- Template ที่ nurse คนนั้นใช้บ่อย
- คงอยู่ข้าม patients
- ใช้ระยะยาว (30 วัน)

✅ **Patient-based Recent Templates:**
- เหมาะสำหรับ context เฉพาะผู้ป่วย
- Template ที่เกี่ยวข้องกับสภาพผู้ป่วยรายนั้น
- ใช้ร่วมกันระหว่าง nurses ที่ดูแลผู้ป่วยคนเดียวกัน
- ใช้ระยะสั้น (7 วัน)

### **การ Query Recent Templates:**
```sql
-- ดึง Recent Templates แบบ Hybrid
CALL sp_get_recent_templates('nurse_sommai', '1234/67', 'assessment', 5);
```

### **Priority การแสดงผล:**
1. Templates ที่ใช้บ่อยทั้ง User + Patient
2. Templates ที่ User ใช้บ่อย
3. Templates ที่ใช้กับ Patient รายนี้
4. Templates ทั่วไปที่มี usage_frequency สูง

### **Performance Optimization:**
- ใช้ INDEX ที่เหมาะสม
- จำกัดข้อมูลด้วยวันที่
- ใช้ Views สำหรับ query ซ้ำๆ
- Cache ผลลัพธ์ที่ Application Level
*/