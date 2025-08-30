โครงสร้างตารางเก็บ ประเภทรอบของแผน RepeatType
CREATE TABLE IF NOT EXISTS `tbl_ur_ncRepeatType` (
  `repeatTypeId` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'รหัสประเภทการทำซ้ำ',
  `repeatTypeCode` VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสภาษาอังกฤษ เช่น daily, continue, off',
  `repeatTypeName` VARCHAR(100) NOT NULL COMMENT 'ชื่อภาษาไทย เช่น ทำทุกวัน, ต่อเนื่อง, หยุด',
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'สถานะการใช้งาน',
  `seq` INT NOT NULL DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  `allowManualTime` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'อนุญาตให้กำหนดเวลาเอง',
  `requiresTimeCode` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'ต้องระบุ TimeCode',
  `businessLogic` VARCHAR(50) NULL COMMENT 'Logic พิเศษ เช่น AUTO_GENERATE, MANUAL_ONLY',
  
  -- ข้อมูลผู้สร้าง/แก้ไข
  `userCreated` VARCHAR(50) NOT NULL COMMENT 'ผู้สร้าง',
  `dateCreated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  `userUpdated` VARCHAR(50) NULL COMMENT 'ผู้แก้ไข',
  `dateUpdated` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไข',
  `deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'สถานะลบ',
  `userDeleted` VARCHAR(50) NULL COMMENT 'ผู้ลบ',
  `dateDeleted` DATETIME NULL COMMENT 'วันที่ลบ',
  
  INDEX `idx_repeatTypeCode` (`repeatTypeCode`),
  INDEX `idx_isActive_seq` (`isActive`, `seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='ตาราง Master สำหรับประเภทการทำซ้ำของแผนการพยาบาล';