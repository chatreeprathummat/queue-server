-- =====================================================
-- ตารางข้อมูลผู้ป่วย (Patients Table)
-- =====================================================

CREATE TABLE IF NOT EXISTS `tbl_inv_patients` (
  `hn` varchar(15) NOT NULL COMMENT 'หมายเลข HN (Primary Key)',
  `prename` varchar(30) DEFAULT NULL COMMENT 'คำนำหน้าชื่อ (เช่น นาย, นาง, นางสาว)',
  `name` varchar(300) DEFAULT NULL COMMENT 'ชื่อจริงของผู้ป่วย',
  `lastName` varchar(300) DEFAULT NULL COMMENT 'นามสกุลของผู้ป่วย',
  `birthday` date DEFAULT NULL COMMENT 'วันเกิด',
  `sex` varchar(1) DEFAULT NULL COMMENT 'เพศ (M=ชาย, F=หญิง)',
  `idcard` varchar(13) DEFAULT NULL COMMENT 'เลขบัตรประชาชน',
  `passportno` varchar(15) DEFAULT NULL COMMENT 'เลขพาสปอร์ต (ถ้ามี)',
  `lastAdmitAt` date DEFAULT NULL COMMENT 'วันที่ Admit ครั้งสุดท้าย (ถ้ามี)',
  
  -- ฟิลด์ Audit
  `usercreated` varchar(15) DEFAULT NULL COMMENT 'ผู้สร้าง',
  `datecreated` datetime DEFAULT NULL COMMENT 'วันที่สร้าง',
  `userupdated` varchar(15) DEFAULT NULL COMMENT 'ผู้แก้ไข',
  `dateupdated` datetime DEFAULT NULL COMMENT 'วันที่แก้ไข',
  `deleted` varchar(1) DEFAULT NULL COMMENT 'สถานะการลบ (Y=ลบ, N=ปกติ)',
  `userdeleted` varchar(15) DEFAULT NULL COMMENT 'ผู้ลบ',
  `datedeleted` datetime DEFAULT NULL COMMENT 'วันที่ลบ',
  
  PRIMARY KEY (`hn`),
  KEY `idx_idcard` (`idcard`),
  KEY `idx_name` (`name`, `lastName`),
  KEY `idx_deleted` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางข้อมูลผู้ป่วย';

-- เพิ่มข้อมูลผู้ป่วยตัวอย่าง
INSERT INTO `tbl_inv_patients` (
  `hn`, 
  `prename`, 
  `name`, 
  `lastName`, 
  `birthday`, 
  `sex`, 
  `idcard`, 
  `passportno`, 
  `lastAdmitAt`,
  `usercreated`,
  `datecreated`
) VALUES
('1/68', 'นาย', 'สมชาย', 'ใจดี', '1980-05-15', 'M', '1234567890123', NULL, '2024-01-15', 'SYSTEM', NOW()),
('2/30', 'นาง', 'สมหญิง', 'รักดี', '1985-08-20', 'F', '9876543210987', NULL, '2024-02-10', 'SYSTEM', NOW()),
('3/15', 'เด็กชาย', 'สมศักดิ์', 'เรียนดี', '2010-12-03', 'M', '1112223334445', NULL, '2024-03-05', 'SYSTEM', NOW()),
('4/42', 'นางสาว', 'สมปอง', 'ทำงานดี', '1992-03-25', 'F', '5556667778889', 'A12345678', '2024-01-20', 'SYSTEM', NOW()),
('5/18', 'นาย', 'สมพร', 'สุขดี', '1975-11-08', 'M', '9998887776665', NULL, '2024-02-28', 'SYSTEM', NOW()),
('10/25', 'นาย', 'ทดสอบ', 'รูปแบบ HN', '1990-06-10', 'M', '1234567890124', NULL, '2024-01-10', 'SYSTEM', NOW()),
('100/55', 'นาย', 'หนึ่ง', 'สองสาม', '1989-03-12', 'F', '1234567890125', NULL, '2024-02-15', 'SYSTEM', NOW()),
('1000/12', 'นาง', 'พัน', 'สิบสอง', '1982-09-18', 'F', '1234567890126', NULL, '2024-03-20', 'SYSTEM', NOW()),
('10000/8', 'นาย', 'หมื่น', 'แปด', '1978-12-05', 'M', '1234567890127', NULL, '2024-01-25', 'SYSTEM', NOW()),
('123456/99', 'นางสาว', 'แสน', 'เก้าสิบเก้า', '1995-07-22', 'F', '1234567890128', NULL, '2024-02-08', 'SYSTEM', NOW()); 