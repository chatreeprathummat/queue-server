โค้ดสร้างตารางระบบจัดซื้อ-พัสดุพร้อมคำอธิบาย
ส่วนที่ 1: ตารางข้อมูลพื้นฐาน (Master Data)
sql-- ========================================================================
-- ตารางแผนก (Departments)
-- เก็บข้อมูลแผนกต่างๆ ในองค์กร เพื่อใช้อ้างอิงในการขอเบิกและกำหนดสิทธิ์
-- ========================================================================
CREATE TABLE departments (
  DepartmentID INT PRIMARY KEY AUTO_INCREMENT, -- รหัสแผนก (PK)
  DepartmentCode VARCHAR(20) UNIQUE NOT NULL, -- รหัสย่อแผนก ไม่ซ้ำกัน
  DepartmentName VARCHAR(100) NOT NULL, -- ชื่อแผนก
  IsActive BOOLEAN DEFAULT TRUE, -- สถานะการใช้งาน (true=ใช้งาน, false=ยกเลิก)
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่สร้าง
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP -- วันที่แก้ไขล่าสุด
);

-- ========================================================================
-- ตารางบทบาท (Roles)
-- เก็บข้อมูลบทบาทของผู้ใช้งาน เช่น พนักงานทั่วไป, หัวหน้าแผนก, พนักงานพัสดุ
-- ========================================================================
CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสบทบาท (PK)
  role_code VARCHAR(50) UNIQUE NOT NULL, -- รหัสบทบาท ไม่ซ้ำกัน เช่น dept_staff, dept_head
  role_name_th VARCHAR(100) NOT NULL, -- ชื่อบทบาทภาษาไทย
  role_name_en VARCHAR(100) NOT NULL, -- ชื่อบทบาทภาษาอังกฤษ
  description TEXT -- รายละเอียดเพิ่มเติม
);

-- ========================================================================
-- ตารางสิทธิ์การใช้งาน (Permissions)
-- เก็บข้อมูลสิทธิ์ต่างๆ ในระบบ เช่น ดูรายการ, สร้างรายการใหม่, อนุมัติ
-- ========================================================================
CREATE TABLE permissions (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสสิทธิ์ (PK)
  permission_code VARCHAR(50) UNIQUE NOT NULL, -- รหัสสิทธิ์ ไม่ซ้ำกัน เช่น view_requisition, create_requisition
  permission_name VARCHAR(100) NOT NULL, -- ชื่อสิทธิ์
  description TEXT -- รายละเอียดเพิ่มเติม
);

-- ========================================================================
-- ตารางกำหนดสถานะที่มีในระบบ (Status Definitions)
-- เก็บข้อมูลสถานะต่างๆ ที่เป็นไปได้ในระบบ เพื่อให้สามารถเพิ่ม/แก้ไขสถานะได้โดยไม่ต้องแก้โค้ด
-- ========================================================================
CREATE TABLE status_definitions (
  status_code VARCHAR(50) PRIMARY KEY, -- รหัสสถานะ (PK) เช่น pending_approval, approved
  status_name_th VARCHAR(100) NOT NULL, -- ชื่อสถานะภาษาไทย
  status_name_en VARCHAR(100) NOT NULL, -- ชื่อสถานะภาษาอังกฤษ
  description TEXT, -- รายละเอียดเพิ่มเติม
  display_order INT NOT NULL, -- ลำดับการแสดงผล
  is_active BOOLEAN DEFAULT TRUE -- สถานะการใช้งาน (true=ใช้งาน, false=ยกเลิก)
);

-- ========================================================================
-- ตารางข้อมูลผู้จำหน่าย (Suppliers)
-- เก็บข้อมูลบริษัทผู้จำหน่ายสินค้า/บริการ
-- ========================================================================
CREATE TABLE suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสผู้จำหน่าย (PK)
  supplier_code VARCHAR(20) UNIQUE NOT NULL, -- รหัสย่อผู้จำหน่าย ไม่ซ้ำกัน
  supplier_name VARCHAR(200) NOT NULL, -- ชื่อผู้จำหน่าย
  tax_id VARCHAR(20), -- เลขที่ผู้เสียภาษี
  address TEXT, -- ที่อยู่
  contact_person VARCHAR(100), -- ชื่อผู้ติดต่อ
  phone VARCHAR(20), -- เบอร์โทรศัพท์
  email VARCHAR(100), -- อีเมล
  bank_account VARCHAR(100), -- เลขที่บัญชีธนาคาร
  bank_name VARCHAR(100), -- ชื่อธนาคาร
  payment_term INT DEFAULT 30 COMMENT 'จำนวนวันเครดิต', -- จำนวนวันเครดิต (เช่น 30 วัน, 45 วัน)
  is_active BOOLEAN DEFAULT TRUE, -- สถานะการใช้งาน (true=ใช้งาน, false=ยกเลิก)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่สร้าง
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP -- วันที่แก้ไขล่าสุด
);

-- ========================================================================
-- ตารางเก็บการรันเลขที่เอกสาร (Document Running Numbers)
-- เก็บข้อมูลการออกเลขที่เอกสารต่างๆ โดยแยกตามประเภทเอกสารและเดือน-ปี
-- ========================================================================
CREATE TABLE document_running_numbers (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสอ้างอิง (PK)
  document_type VARCHAR(10) NOT NULL COMMENT 'RQ=คำขอเบิก, PR=ใบขอซื้อ, PO=ใบสั่งซื้อ, GR=ใบรับของ, PRQ=ใบขอจ่ายเงิน', -- ประเภทเอกสาร
  yearmonth_code VARCHAR(4) NOT NULL COMMENT 'YYMM เช่น 2405 = พ.ค. 2024', -- รหัสปี-เดือน (ปี 2 หลัก + เดือน 2 หลัก)
  last_running_number INT NOT NULL DEFAULT 0, -- เลขที่ล่าสุดที่ออกไปแล้ว
  prefix VARCHAR(10) NOT NULL DEFAULT 'SGH-', -- คำนำหน้าเลขที่เอกสาร
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่สร้าง
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- วันที่แก้ไขล่าสุด
  UNIQUE KEY unique_document_yearmonth (document_type, yearmonth_code) -- กำหนด Unique key ให้ประเภทเอกสาร+ปีเดือน ไม่ซ้ำกัน
);


-------------------------------------------------------------------------------------------------------
ส่วนที่ 2: ตารางเกี่ยวกับผู้ใช้งานและสิทธิ์
-- ========================================================================
-- ตารางผู้ใช้งาน (Users)
-- เก็บข้อมูลผู้ใช้งานในระบบพร้อมสิทธิ์
-- ========================================================================
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสผู้ใช้งาน (PK)
  username VARCHAR(50) UNIQUE NOT NULL, -- ชื่อผู้ใช้ ไม่ซ้ำกัน
  password VARCHAR(255) NOT NULL, -- รหัสผ่าน (ควรเก็บในรูปแบบที่เข้ารหัสแล้ว)
  full_name VARCHAR(100) NOT NULL, -- ชื่อ-นามสกุล
  department_id INT NOT NULL, -- รหัสแผนก (FK)
  role_id INT NOT NULL, -- รหัสบทบาท (FK)
  is_active BOOLEAN DEFAULT TRUE, -- สถานะการใช้งาน (true=ใช้งาน, false=ยกเลิก)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่สร้าง
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- วันที่แก้ไขล่าสุด
  FOREIGN KEY (department_id) REFERENCES departments(DepartmentID), -- ความสัมพันธ์กับตาราง departments
  FOREIGN KEY (role_id) REFERENCES roles(id) -- ความสัมพันธ์กับตาราง roles
);

-- ========================================================================
-- ตารางความสัมพันธ์ระหว่างบทบาทและสิทธิ์ (Role Permissions)
-- กำหนดว่าบทบาทใดมีสิทธิ์อะไรบ้าง (many-to-many)
-- ========================================================================
CREATE TABLE role_permissions (
  role_id INT NOT NULL, -- รหัสบทบาท (FK)
  permission_id INT NOT NULL, -- รหัสสิทธิ์ (FK)
  PRIMARY KEY (role_id, permission_id), -- กำหนด Primary Key แบบ Composite
  FOREIGN KEY (role_id) REFERENCES roles(id), -- ความสัมพันธ์กับตาราง roles
  FOREIGN KEY (permission_id) REFERENCES permissions(id) -- ความสัมพันธ์กับตาราง permissions
);

-- ========================================================================
-- ตารางกำหนดสิทธิ์ในการเปลี่ยนสถานะ (Status Permissions)
-- กำหนดว่าบทบาทใดสามารถเปลี่ยนสถานะจากอะไรไปเป็นอะไรได้บ้าง
-- ========================================================================
CREATE TABLE status_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสอ้างอิง (PK)
  from_status VARCHAR(50) NOT NULL, -- สถานะเริ่มต้น (FK)
  to_status VARCHAR(50) NOT NULL, -- สถานะปลายทาง (FK)
  role_id INT NOT NULL, -- รหัสบทบาทที่มีสิทธิ์เปลี่ยน (FK)
  auto_transition BOOLEAN DEFAULT FALSE COMMENT 'ถ้า TRUE ระบบจะเปลี่ยนสถานะโดยอัตโนมัติ', -- กำหนดให้เปลี่ยนสถานะอัตโนมัติหรือไม่
  FOREIGN KEY (from_status) REFERENCES status_definitions(status_code), -- ความสัมพันธ์กับตาราง status_definitions
  FOREIGN KEY (to_status) REFERENCES status_definitions(status_code), -- ความสัมพันธ์กับตาราง status_definitions
  FOREIGN KEY (role_id) REFERENCES roles(id) -- ความสัมพันธ์กับตาราง roles
);

-----------------------------------------------------------------------------------------------------
ส่วนที่ 3: ตารางหลักเกี่ยวกับการขอเบิกและจัดซื้อ
-- ========================================================================
-- ตารางคำขอเบิก (Requisitions)
-- เก็บข้อมูลหลักของคำขอเบิกวัสดุ/อุปกรณ์ต่างๆ จากหน่วยงาน
-- ========================================================================
CREATE TABLE requisitions (
  id VARCHAR(20) PRIMARY KEY COMMENT 'รหัสคำขอเบิก เช่น SGH-RQ-2405-001', -- รหัสคำขอเบิก (PK)
  department_id INT NOT NULL, -- รหัสแผนกที่ขอเบิก (FK)
  requester_id INT NOT NULL, -- รหัสผู้ขอเบิก (FK)
  request_date DATETIME NOT NULL, -- วันที่ขอเบิก
  material_category VARCHAR(50) NOT NULL, -- หมวดหมู่วัสดุ เช่น วัสดุการแพทย์, วัสดุสำนักงาน
  urgency VARCHAR(20) DEFAULT 'normal' COMMENT 'ความเร่งด่วน: normal, urgent, critical', -- ระดับความเร่งด่วน
  reason TEXT, -- เหตุผลในการขอเบิก
  current_status VARCHAR(50) NOT NULL DEFAULT 'pending_approval', -- สถานะปัจจุบัน
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่สร้าง
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- วันที่แก้ไขล่าสุด
  FOREIGN KEY (department_id) REFERENCES departments(DepartmentID), -- ความสัมพันธ์กับตาราง departments
  FOREIGN KEY (requester_id) REFERENCES users(id) -- ความสัมพันธ์กับตาราง users
  เพิ่ม 22/6/68
  ALTER TABLE tbl_inv_requisitions 
ADD COLUMN created_by_user_id INT NOT NULL DEFAULT 1 COMMENT 'ผู้สร้างระเบียน' AFTER requester_user_id,
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง' AFTER created_by_user_id,
ADD COLUMN updated_by_user_id INT NULL COMMENT 'ผู้แก้ไขล่าสุด' AFTER created_at,
ADD COLUMN updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด' AFTER updated_by_user_id;
);

-- ========================================================================
-- ตารางใบขอซื้อ (Purchase Requisitions)
-- เก็บข้อมูลหลักของใบขอซื้อ (PR) ที่สร้างโดยแผนกพัสดุ
-- ========================================================================
CREATE TABLE purchase_requisitions (
  id VARCHAR(20) PRIMARY KEY COMMENT 'รหัสใบขอซื้อ เช่น SGH-PR-2405-001', -- รหัสใบขอซื้อ (PK)
  requisition_id VARCHAR(20) NOT NULL, -- รหัสคำขอเบิกที่อ้างอิง (FK)
  created_by INT NOT NULL, -- รหัสผู้สร้าง (FK)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่สร้าง
  status VARCHAR(50) NOT NULL DEFAULT 'pending_stock_head_approval', -- สถานะใบขอซื้อ
  FOREIGN KEY (requisition_id) REFERENCES requisitions(id), -- ความสัมพันธ์กับตาราง requisitions
  FOREIGN KEY (created_by) REFERENCES users(id) -- ความสัมพันธ์กับตาราง users
);

-- ========================================================================
-- ตารางใบสั่งซื้อ (Purchase Orders)
-- เก็บข้อมูลหลักของใบสั่งซื้อ (PO) ที่สร้างโดยแผนกจัดซื้อ
-- ========================================================================
CREATE TABLE purchase_orders (
  id VARCHAR(20) PRIMARY KEY COMMENT 'รหัสใบสั่งซื้อ เช่น SGH-PO-2405-001', -- รหัสใบสั่งซื้อ (PK)
  pr_id VARCHAR(20) NOT NULL, -- รหัสใบขอซื้อที่อ้างอิง (FK)
  supplier_id INT NOT NULL, -- รหัสผู้จำหน่ายที่สั่งซื้อ (FK)
  created_by INT NOT NULL, -- รหัสผู้สร้าง (FK)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่สร้าง
  status VARCHAR(50) NOT NULL DEFAULT 'pending_executive_approval', -- สถานะใบสั่งซื้อ
  delivery_date DATE, -- กำหนดวันส่งของ
  FOREIGN KEY (pr_id) REFERENCES purchase_requisitions(id), -- ความสัมพันธ์กับตาราง purchase_requisitions
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id), -- ความสัมพันธ์กับตาราง suppliers
  FOREIGN KEY (created_by) REFERENCES users(id) -- ความสัมพันธ์กับตาราง users
);

-- ========================================================================
-- ตารางใบรับของ (Goods Receipts)
-- เก็บข้อมูลการรับสินค้าจากผู้จำหน่าย
-- ========================================================================
CREATE TABLE goods_receipts (
  id VARCHAR(20) PRIMARY KEY COMMENT 'รหัสใบรับของ เช่น SGH-GR-2405-001', -- รหัสใบรับของ (PK)
  po_id VARCHAR(20) NOT NULL, -- รหัสใบสั่งซื้อที่อ้างอิง (FK)
  receipt_date DATETIME NOT NULL, -- วันที่รับของ
  delivery_note_no VARCHAR(50) COMMENT 'เลขที่ใบส่งของจากผู้จำหน่าย', -- เลขที่ใบส่งของ
  delivery_note_date DATE COMMENT 'วันที่ใบส่งของ', -- วันที่ใบส่งของ
  invoice_no VARCHAR(50) COMMENT 'เลขที่ใบแจ้งหนี้', -- เลขที่ใบแจ้งหนี้
  invoice_date DATE COMMENT 'วันที่ใบแจ้งหนี้', -- วันที่ใบแจ้งหนี้
  received_by INT NOT NULL COMMENT 'ผู้รับของ', -- รหัสผู้รับของ (FK)
  verified_by INT COMMENT 'ผู้ตรวจสอบ', -- รหัสผู้ตรวจสอบ (FK)
  status VARCHAR(20) NOT NULL DEFAULT 'pending_verification' COMMENT 'สถานะ: pending_verification, verified, rejected', -- สถานะการรับของ
  remark TEXT, -- หมายเหตุ
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่สร้าง
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- วันที่แก้ไขล่าสุด
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id), -- ความสัมพันธ์กับตาราง purchase_orders
  FOREIGN KEY (received_by) REFERENCES users(id), -- ความสัมพันธ์กับตาราง users
  FOREIGN KEY (verified_by) REFERENCES users(id) -- ความสัมพันธ์กับตาราง users
);

-- ========================================================================
-- ตารางใบขอจ่ายเงิน (Payment Requisitions)
-- เก็บข้อมูลการขอจ่ายเงินให้ผู้จำหน่าย
-- ========================================================================
CREATE TABLE payment_requisitions (
  id VARCHAR(20) PRIMARY KEY COMMENT 'รหัสใบขอจ่ายเงิน เช่น SGH-PRQ-2405-001', -- รหัสใบขอจ่ายเงิน (PK)
  supplier_id INT NOT NULL, -- รหัสผู้จำหน่ายที่จะจ่ายเงิน (FK)
  payment_due_date DATE NOT NULL COMMENT 'วันครบกำหนดชำระเงิน', -- วันที่ครบกำหนดชำระ
  payment_amount DECIMAL(15,2) NOT NULL, -- จำนวนเงินที่ต้องจ่าย
  payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer', -- วิธีการจ่ายเงิน เช่น โอนเงิน, เช็ค
  bank_account VARCHAR(100), -- เลขที่บัญชีธนาคารที่โอนเงิน
  status VARCHAR(20) NOT NULL DEFAULT 'pending_approval' COMMENT 'สถานะ: pending_approval, approved, paid, cancelled', -- สถานะการจ่ายเงิน
  requested_by INT NOT NULL, -- รหัสผู้ขอจ่ายเงิน (FK)
  approved_by INT, -- รหัสผู้อนุมัติการจ่ายเงิน (FK)
  approved_date DATETIME, -- วันที่อนุมัติ
  payment_date DATE COMMENT 'วันที่จ่ายเงิน', -- วันที่จ่ายเงิน
  payment_ref VARCHAR(50) COMMENT 'เลขที่อ้างอิงการจ่ายเงิน', -- เลขที่อ้างอิงการจ่ายเงิน เช่น เลขที่ใบเสร็จ
  remark TEXT, -- หมายเหตุ
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่สร้าง
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- วันที่แก้ไขล่าสุด
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id), -- ความสัมพันธ์กับตาราง suppliers
  FOREIGN KEY (requested_by) REFERENCES users(id), -- ความสัมพันธ์กับตาราง users
  FOREIGN KEY (approved_by) REFERENCES users(id) -- ความสัมพันธ์กับตาราง users
);


---------------------------------------------------------------------------------------------------
ส่วนที่ 4: ตารางรายละเอียดและความสัมพันธ์
-- ========================================================================
-- ตารางรายการสินค้าที่ขอเบิก (Requisition Items)
-- เก็บรายละเอียดสินค้า/บริการที่ขอเบิกในแต่ละคำขอเบิก
-- ========================================================================
CREATE TABLE requisition_items (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสรายการ (PK)
  requisition_id VARCHAR(20) NOT NULL, -- รหัสคำขอเบิกที่อ้างอิง (FK)
  description VARCHAR(255) NOT NULL, -- รายละเอียดสินค้า/บริการ
  item_type VARCHAR(50) NOT NULL COMMENT 'ประเภท: เพื่อใช้, เพื่อจำหน่าย', -- ประเภทการใช้งาน
  hn VARCHAR(50) COMMENT 'HN ของผู้ป่วย (กรณีเพื่อจำหน่าย)', -- เลข HN ผู้ป่วย (กรณีเบิกเพื่อจำหน่าย)
  patient_name VARCHAR(100) COMMENT 'ชื่อผู้ป่วย (กรณีเพื่อจำหน่าย)', -- ชื่อผู้ป่วย (กรณีเบิกเพื่อจำหน่าย)
  unit VARCHAR(30) NOT NULL, -- หน่วยนับ เช่น ชิ้น, กล่อง, ตัว
  quantity INT NOT NULL, -- จำนวนที่ขอ
  price DECIMAL(12,2) NOT NULL, -- ราคาต่อหน่วย
  note TEXT, -- หมายเหตุเพิ่มเติม
  request_date DATE COMMENT 'วันที่ต้องการใช้', -- วันที่ต้องการใช้งาน
  FOREIGN KEY (requisition_id) REFERENCES requisitions(id) -- ความสัมพันธ์กับตาราง requisitions
  เพิ่มใหม่ 22/6/68
  ALTER TABLE tbl_inv_requisition_items 
ADD COLUMN is_cancelled TINYINT(1) DEFAULT 0 COMMENT 'รายการถูกยกเลิก: 0=ปกติ, 1=ยกเลิก';

-- Index เพื่อ performance
CREATE INDEX idx_requisition_items_cancelled 
ON tbl_inv_requisition_items(requisition_id, is_cancelled);
);

-- ========================================================================
-- ตารางเอกสารแนบคำขอเบิก (Requisition Documents)
-- เก็บรายการเอกสารแนบที่เกี่ยวข้องกับคำขอเบิก
-- ========================================================================
CREATE TABLE requisition_documents (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสเอกสาร (PK)
  requisition_id VARCHAR(20) NOT NULL, -- รหัสคำขอเบิกที่อ้างอิง (FK)
  document_type_id VARCHAR(50) NOT NULL, -- ประเภทเอกสาร เช่น ใบเสนอราคา, แคตตาล็อก
  document_name VARCHAR(255) NOT NULL, -- ชื่อเอกสาร
  file_path VARCHAR(255), -- ที่อยู่ไฟล์เอกสาร
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่อัพโหลด
  FOREIGN KEY (requisition_id) REFERENCES requisitions(id) -- ความสัมพันธ์กับตาราง requisitions
);

-- ========================================================================
-- ตารางประวัติการเปลี่ยนสถานะ (Status Logs)
-- เก็บประวัติการเปลี่ยนสถานะทั้งหมดของคำขอเบิก
-- ========================================================================
CREATE TABLE status_logs (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสประวัติ (PK)
  requisition_id VARCHAR(20) NOT NULL, -- รหัสคำขอเบิกที่อ้างอิง (FK)
  previous_status VARCHAR(50), -- สถานะก่อนหน้า (NULL ถ้าเป็นสถานะเริ่มต้น)
  new_status VARCHAR(50) NOT NULL, -- สถานะใหม่
  changed_by INT NOT NULL, -- รหัสผู้เปลี่ยนสถานะ (FK)
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันเวลาที่เปลี่ยน
  comment TEXT, -- หมายเหตุการเปลี่ยนสถานะ
  document_reference VARCHAR(50), -- เอกสารอ้างอิง เช่น เลขที่ PR, PO
  FOREIGN KEY (requisition_id) REFERENCES requisitions(id), -- ความสัมพันธ์กับตาราง requisitions
  FOREIGN KEY (changed_by) REFERENCES users(id) -- ความสัมพันธ์กับตาราง users
);

-- ========================================================================
-- ตารางรายการสินค้าในใบขอซื้อ (PR Items)
-- เก็บรายละเอียดสินค้า/บริการในแต่ละใบขอซื้อ (PR)
-- ========================================================================
CREATE TABLE pr_items (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสรายการ (PK)
  pr_id VARCHAR(20) NOT NULL, -- รหัสใบขอซื้อที่อ้างอิง (FK)
  description VARCHAR(255) NOT NULL, -- รายละเอียดสินค้า/บริการ
  unit VARCHAR(30) NOT NULL, -- หน่วยนับ
  quantity INT NOT NULL, -- จำนวนที่ขอซื้อ
  price DECIMAL(12,2) NOT NULL, -- ราคาต่อหน่วย
  total_price DECIMAL(12,2) GENERATED ALWAYS AS (quantity * price) STORED, -- ราคารวม (คำนวณอัตโนมัติ)
  FOREIGN KEY (pr_id) REFERENCES purchase_requisitions(id) -- ความสัมพันธ์กับตาราง purchase_requisitions
);

-- ========================================================================
-- ตารางความสัมพันธ์ระหว่าง PR และผู้จำหน่าย (PR Suppliers)
-- เก็บข้อมูลผู้จำหน่ายที่เกี่ยวข้องกับใบขอซื้อ (PR) แต่ละใบ
-- ========================================================================
CREATE TABLE pr_suppliers (
  pr_id VARCHAR(20) NOT NULL, -- รหัสใบขอซื้อ (FK)
  supplier_id INT NOT NULL, -- รหัสผู้จำหน่าย (FK)
  is_primary BOOLEAN DEFAULT FALSE COMMENT 'เป็นผู้จำหน่ายหลักหรือไม่', -- เป็นผู้จำหน่ายหลักหรือไม่
  quote_ref VARCHAR(50) COMMENT 'เลขที่ใบเสนอราคา', -- เลขที่ใบเสนอราคา
  quote_date DATE COMMENT 'วันที่ใบเสนอราคา', -- วันที่ใบเสนอราคา
  PRIMARY KEY (pr_id, supplier_id), -- กำหนด Primary Key แบบ Composite
  FOREIGN KEY (pr_id) REFERENCES purchase_requisitions(id), -- ความสัมพันธ์กับตาราง purchase_requisitions
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) -- ความสัมพันธ์กับตาราง suppliers
);

-- ========================================================================
-- ตารางเอกสารแนบ PR (PR Documents)
-- เก็บรายการเอกสารแนบที่เกี่ยวข้องกับใบขอซื้อ (PR)
-- ========================================================================
CREATE TABLE pr_documents (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสเอกสาร (PK)
  pr_id VARCHAR(20) NOT NULL, -- รหัสใบขอซื้อที่อ้างอิง (FK)
  document_type_id VARCHAR(50) NOT NULL, -- ประเภทเอกสาร
  document_name VARCHAR(255) NOT NULL, -- ชื่อเอกสาร
  file_path VARCHAR(255), -- ที่อยู่ไฟล์เอกสาร
  FOREIGN KEY (pr_id) REFERENCES purchase_requisitions(id) -- ความสัมพันธ์กับตาราง purchase_requisitions
);

-- ========================================================================
-- ตารางรายการสินค้าในใบสั่งซื้อ (PO Items)
-- เก็บรายละเอียดสินค้า/บริการในแต่ละใบสั่งซื้อ (PO)
-- ========================================================================
CREATE TABLE po_items (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสรายการ (PK)
  po_id VARCHAR(20) NOT NULL, -- รหัสใบสั่งซื้อที่อ้างอิง (FK)
  description VARCHAR(255) NOT NULL, -- รายละเอียดสินค้า/บริการ
  unit VARCHAR(30) NOT NULL, -- หน่วยนับ
  quantity INT NOT NULL, -- จำนวนที่สั่งซื้อ
  price DECIMAL(12,2) NOT NULL, -- ราคาต่อหน่วย
  total_price DECIMAL(12,2) GENERATED ALWAYS AS (quantity * price) STORED, -- ราคารวม (คำนวณอัตโนมัติ)
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) -- ความสัมพันธ์กับตาราง purchase_orders
);

-- ========================================================================
-- ตารางรายการรับของ (Goods Receipt Items)
-- เก็บรายละเอียดสินค้าที่ได้รับในแต่ละใบรับของ
-- ========================================================================
CREATE TABLE goods_receipt_items (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสรายการ (PK)
  gr_id VARCHAR(20) NOT NULL, -- รหัสใบรับของที่อ้างอิง (FK)
  po_item_id INT NOT NULL, -- รหัสรายการในใบสั่งซื้อที่อ้างอิง (FK)
  quantity_received INT NOT NULL, -- จำนวนที่ได้รับ
  quantity_accepted INT NOT NULL COMMENT 'จำนวนที่ผ่านการตรวจสอบ', -- จำนวนที่ผ่านการตรวจสอบ
  quantity_rejected INT DEFAULT 0 COMMENT 'จำนวนที่ไม่ผ่านการตรวจสอบ', -- จำนวนที่ไม่ผ่านการตรวจสอบ
  unit VARCHAR(30) NOT NULL, -- หน่วยนับ
  remark TEXT, -- หมายเหตุ
  FOREIGN KEY (gr_id) REFERENCES goods_receipts(id), -- ความสัมพันธ์กับตาราง goods_receipts
  FOREIGN KEY (po_item_id) REFERENCES po_items(id) -- ความสัมพันธ์กับตาราง po_items
);

-- ========================================================================
-- ตารางรายการใบรับของที่เกี่ยวข้องกับใบขอจ่ายเงิน (Payment Requisition Items)
-- เก็บความสัมพันธ์ว่าใบขอจ่ายเงินแต่ละใบเกี่ยวข้องกับใบรับของใดบ้าง
-- ========================================================================
CREATE TABLE payment_requisition_items (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสรายการ (PK)
  prq_id VARCHAR(20) NOT NULL, -- รหัสใบขอจ่ายเงินที่อ้างอิง (FK)
  gr_id VARCHAR(20) NOT NULL, -- รหัสใบรับของที่อ้างอิง (FK)
  invoice_amount DECIMAL(15,2) NOT NULL, -- จำนวนเงินตามใบแจ้งหนี้
  tax_amount DECIMAL(15,2) DEFAULT 0, -- จำนวนภาษี
  FOREIGN KEY (prq_id) REFERENCES payment_requisitions(id), -- ความสัมพันธ์กับตาราง payment_requisitions
  FOREIGN KEY (gr_id) REFERENCES goods_receipts(id) -- ความสัมพันธ์กับตาราง goods_receipts
);

-- ========================================================================
-- ตารางประวัติการจ่ายเงิน (Payment History)
-- เก็บประวัติการจ่ายเงินทั้งหมด
-- ========================================================================
CREATE TABLE payment_history (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสประวัติ (PK)
  prq_id VARCHAR(20) NOT NULL, -- รหัสใบขอจ่ายเงินที่อ้างอิง (FK)
  payment_date DATE NOT NULL, -- วันที่จ่ายเงิน
  payment_amount DECIMAL(15,2) NOT NULL, -- จำนวนเงินที่จ่าย
  payment_method VARCHAR(50) NOT NULL, -- วิธีการจ่ายเงิน
  payment_ref VARCHAR(50), -- เลขที่อ้างอิงการจ่ายเงิน
  paid_by INT NOT NULL, -- รหัสผู้จ่ายเงิน (FK)
  remark TEXT, -- หมายเหตุ
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่บันทึก
  FOREIGN KEY (prq_id) REFERENCES payment_requisitions(id), -- ความสัมพันธ์กับตาราง payment_requisitions
  FOREIGN KEY (paid_by) REFERENCES users(id) -- ความสัมพันธ์กับตาราง users
);

-- ========================================================================
-- ตารางการวางบิล (Invoice Submissions)
-- เก็บข้อมูลการวางบิลของผู้จำหน่าย
-- ========================================================================
CREATE TABLE invoice_submissions (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสการวางบิล (PK)
  supplier_id INT NOT NULL, -- รหัสผู้จำหน่าย (FK)
  submission_date DATE NOT NULL, -- วันที่วางบิล
  submission_ref VARCHAR(50) COMMENT 'เลขที่ใบวางบิล', -- เลขที่ใบวางบิล
  total_amount DECIMAL(15,2) NOT NULL, -- จำนวนเงินรวม
  status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'สถานะ: pending, processed, cancelled', -- สถานะการวางบิล
  received_by INT NOT NULL, -- รหัสผู้รับใบวางบิล (FK)
  remark TEXT, -- หมายเหตุ
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- วันที่บันทึก
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- วันที่แก้ไขล่าสุด
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id), -- ความสัมพันธ์กับตาราง suppliers
  FOREIGN KEY (received_by) REFERENCES users(id) -- ความสัมพันธ์กับตาราง users
);

-- ========================================================================
-- ตารางรายการใบแจ้งหนี้ในใบวางบิล (Invoice Submission Details)
-- เก็บรายละเอียดใบแจ้งหนี้แต่ละรายการในแต่ละใบวางบิล
-- ========================================================================
CREATE TABLE invoice_submission_details (
  id INT PRIMARY KEY AUTO_INCREMENT, -- รหัสรายการ (PK)
  submission_id INT NOT NULL, -- รหัสใบวางบิลที่อ้างอิง (FK)
  invoice_no VARCHAR(50) NOT NULL, -- เลขที่ใบแจ้งหนี้
  invoice_date DATE NOT NULL, -- วันที่ใบแจ้งหนี้
  invoice_amount DECIMAL(15,2) NOT NULL, -- จำนวนเงินในใบแจ้งหนี้
  po_id VARCHAR(20), -- รหัสใบสั่งซื้อที่เกี่ยวข้อง (FK)
  gr_id VARCHAR(20), -- รหัสใบรับของที่เกี่ยวข้อง (FK)
  status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'สถานะ: pending, processed, rejected', -- สถานะรายการ
  prq_id VARCHAR(20) COMMENT 'เลขที่ PRQ ที่ใช้ชำระ', -- รหัสใบขอจ่ายเงินที่ใช้ชำระ (FK)
  FOREIGN KEY (submission_id) REFERENCES invoice_submissions(id), -- ความสัมพันธ์กับตาราง invoice_submissions
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id), -- ความสัมพันธ์กับตาราง purchase_orders
  FOREIGN KEY (gr_id) REFERENCES goods_receipts(id), -- ความสัมพันธ์กับตาราง goods_receipts
  FOREIGN KEY (prq_id) REFERENCES payment_requisitions(id) -- ความสัมพันธ์กับตาราง payment_requisitions
);

-- ========================================================================
-- 1. ตาราง tbl_inv_status_master (Master สถานะ)
-- ========================================================================
CREATE TABLE tbl_inv_status_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- รหัสสถานะ (ใช้เป็น Key หลัก เช่น 'REQ_DRAFT', 'DEPT_APPROVED')
    status_code VARCHAR(50) UNIQUE NOT NULL COMMENT 'รหัสสถานะหลัก ใช้อ้างอิงใน Workflow',
    
    -- ชื่อสถานะภาษาไทย (แสดงใน UI ภาษาไทย)
    status_name_th VARCHAR(100) NOT NULL COMMENT 'ชื่อสถานะภาษาไทย สำหรับแสดงใน UI',
    
    -- ชื่อสถานะภาษาอังกฤษ (แสดงใน UI ภาษาอังกฤษ)
    status_name_en VARCHAR(100) NOT NULL COMMENT 'ชื่อสถานะภาษาอังกฤษ สำหรับแสดงใน UI',
    
    -- กลุ่มสถานะ (จัดกลุ่มเพื่อแยกประเภทหน้าจอ/แผนก)
    status_group ENUM('REQUEST','STOCK','PURCHASE','EXECUTIVE','DELIVERY','RECEIPT','PAYMENT') NOT NULL COMMENT 'กลุ่มสถานะ สำหรับจัดกลุ่มแยกแผนกงาน',
    
    -- ลำดับการแสดงผล (เรียงสถานะใน Timeline)
    display_order INT NOT NULL COMMENT 'ลำดับการแสดงผลใน Timeline และ Progress Bar',
    
    -- สีแสดงสถานะใน UI (Hex Color เช่น #3B82F6)
    status_color VARCHAR(7) DEFAULT '#6B7280' COMMENT 'สีแสดงสถานะใน UI (Hex Color เช่น #3B82F6)',
    
    -- CSS Class สำหรับไอคอน (เช่น 'fa-clock', 'fa-check')
    icon_class VARCHAR(50) COMMENT 'CSS Class สำหรับไอคอน (เช่น fa-clock, fa-check)',
    
    -- สถานะใช้งานได้หรือไม่ (1=ใช้ได้, 0=ปิดการใช้งาน)
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะใช้งาน: 1=ใช้ได้, 0=ปิดการใช้งาน',
    
    -- เป็นสถานะสิ้นสุด Workflow หรือไม่ (1=จบ, 0=ยังไม่จบ)
    is_final_status TINYINT(1) DEFAULT 0 COMMENT 'สถานะสิ้นสุด Workflow: 1=สิ้นสุด, 0=ยังไม่สิ้นสุด',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้างสถานะ',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่อัพเดทสถานะล่าสุด'
) COMMENT = 'ตาราง Master ข้อมูลสถานะทั้งหมดในระบบ สำหรับกำหนดค่าแบบ Dynamic';

-- ========================================================================
-- 2. ตาราง tbl_inv_status_workflow (กฎการเปลี่ยนสถานะ)
-- ========================================================================
CREATE TABLE tbl_inv_status_workflow (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- สถานะต้นทาง (NULL = เริ่มต้น Workflow)
    from_status_code VARCHAR(50) COMMENT 'สถานะต้นทาง (NULL = เริ่มต้น Workflow)',
    
    -- สถานะปลายทาง (ไปสถานะไหน)
    to_status_code VARCHAR(50) NOT NULL COMMENT 'สถานะปลายทาง (จะเปลี่ยนไปสถานะไหน)',
    
    -- Role ที่มีสิทธิ์เปลี่ยนสถานะนี้ (อ้างอิง tbl_ur_auth_roles.role_code)
    required_role_code VARCHAR(50) COMMENT 'Role ที่มีสิทธิ์เปลี่ยนสถานะ (อ้างอิง role_code)',
    
    -- เปลี่ยนสถานะอัตโนมัติหรือไม่ (1=อัตโนมัติ, 0=ต้องคลิกเปลี่ยน)
    auto_transition TINYINT(1) DEFAULT 0 COMMENT 'เปลี่ยนอัตโนมัติ: 1=อัตโนมัติ, 0=ต้องคลิกเปลี่ยน',
    
    -- ต้องอนุมัติก่อนเปลี่ยนสถานะหรือไม่ (1=ต้องอนุมัติ, 0=ไม่ต้อง)
    require_approval TINYINT(1) DEFAULT 0 COMMENT 'ต้องอนุมัติ: 1=ต้องอนุมัติ, 0=ไม่ต้องอนุมัติ',
    
    -- บังคับใส่ comment เมื่อเปลี่ยนสถานะหรือไม่ (1=บังคับ, 0=ไม่บังคับ)
    require_comment TINYINT(1) DEFAULT 0 COMMENT 'บังคับ Comment: 1=บังคับ, 0=ไม่บังคับ',
    
    -- เงื่อนไขพิเศษ (SQL Query เช่น "total_value > 100000")
    condition_sql TEXT COMMENT 'เงื่อนไขพิเศษ (SQL Query เช่น total_value > 100000)',
    
    -- กฎนี้ใช้งานได้หรือไม่ (1=ใช้ได้, 0=ปิดการใช้งาน)
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งานกฎ: 1=ใช้ได้, 0=ปิดการใช้งาน',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้างกฎ',
    
    FOREIGN KEY (from_status_code) REFERENCES tbl_inv_status_master(status_code),
    FOREIGN KEY (to_status_code) REFERENCES tbl_inv_status_master(status_code),
    INDEX idx_workflow_from(from_status_code),
    INDEX idx_workflow_to(to_status_code)
) COMMENT = 'ตารางกฎการเปลี่ยนสถานะ กำหนด Flow การทำงานแบบ Dynamic';

-- ========================================================================
-- 3. ตาราง tbl_inv_status_item_current (สถานะปัจจุบันของแต่ละ Item)
-- ========================================================================
CREATE TABLE tbl_inv_status_item_current (
    -- ID ของ Item (อ้างอิง tbl_inv_requisition_items.item_id)
    item_id INT PRIMARY KEY COMMENT 'ID ของ Item (อ้างอิง tbl_inv_requisition_items.item_id)',
    
    -- สถานะปัจจุบัน (อ้างอิง tbl_inv_status_master.status_code)
    current_status_code VARCHAR(50) NOT NULL COMMENT 'สถานะปัจจุบันของ Item (อ้างอิง status_master)',
    
    -- เวลาที่เข้าสถานะนี้ (สำหรับคำนวณระยะเวลา)
    current_status_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่เข้าสถานะนี้ สำหรับคำนวณระยะเวลา',
    
    -- คนสุดท้ายที่อัพเดท (อ้างอิง tbl_ur_auth_users.id)
    last_updated_by INT COMMENT 'คนสุดท้ายที่อัพเดทสถานะ (อ้างอิง users.id)',
    
    -- Comment สุดท้าย
    last_comment TEXT COMMENT 'Comment สุดท้ายที่บันทึกไว้',
    
    -- ระงับการทำงานชั่วคราวหรือไม่ (1=ระงับ, 0=ปกติ)
    is_on_hold TINYINT(1) DEFAULT 0 COMMENT 'ระงับงานชั่วคราว: 1=ระงับ, 0=ดำเนินการปกติ',
    
    -- เหตุผลการระงับงาน
    hold_reason TEXT COMMENT 'เหตุผลการระงับงาน (ถ้ามี)',
    
    -- วันที่คาดว่าจะเสร็จ (สำหรับ Planning)
    estimated_completion DATE COMMENT 'วันที่คาดว่าจะเสร็จ สำหรับ Planning และติดตาม',
    
    -- ระดับความสำคัญ
    priority_level ENUM('LOW','NORMAL','HIGH','URGENT') DEFAULT 'NORMAL' COMMENT 'ระดับความสำคัญของงาน',
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่อัพเดทล่าสุด',
    
    FOREIGN KEY (item_id) REFERENCES tbl_inv_requisition_items(item_id),
    FOREIGN KEY (current_status_code) REFERENCES tbl_inv_status_master(status_code),
    FOREIGN KEY (last_updated_by) REFERENCES tbl_ur_auth_users(id)
) COMMENT = 'ตารางเก็บสถานะปัจจุบันของแต่ละ Item สำหรับการติดตาม';

-- ========================================================================
-- 4. ตาราง tbl_inv_item_event_logs (ตาราง tbl_inv_item_event_logs (Log ทุก Event))
-- ========================================================================
CREATE TABLE tbl_inv_item_event_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- ID ของ Item ที่เกิด Event
    item_id INT NOT NULL COMMENT 'ID ของ Item ที่เกิด Event (อ้างอิง requisition_items)',
    
    -- ประเภท Event ที่เกิดขึ้น
    event_type ENUM('STATUS_CHANGE','CREATE','UPDATE','DELETE','APPROVE','REJECT','COMMENT','HOLD','RESUME','PRINT','SEND','RECEIVE') NOT NULL COMMENT 'ประเภท Event ที่เกิดขึ้น',
    
    -- สถานะก่อนหน้า (สำหรับ STATUS_CHANGE event)
    previous_status_code VARCHAR(50) COMMENT 'สถานะก่อนหน้า (สำหรับ Event การเปลี่ยนสถานะ)',
    
    -- สถานะใหม่ (สำหรับ STATUS_CHANGE event)
    new_status_code VARCHAR(50) COMMENT 'สถานะใหม่ (สำหรับ Event การเปลี่ยนสถานะ)',
    
    -- คำอธิบาย Event
    event_description TEXT COMMENT 'คำอธิบาย Event ที่เกิดขึ้นอย่างละเอียด',
    
    -- คนที่ทำ Event นี้
    changed_by INT NOT NULL COMMENT 'คนที่ทำ Event นี้ (อ้างอิง users.id)',
    
    -- เวลาที่เกิด Event
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่เกิด Event ขึ้น',
    
    -- IP Address ของผู้ใช้ (สำหรับ Security Audit)
    ip_address VARCHAR(45) COMMENT 'IP Address ของผู้ใช้ สำหรับ Security Audit',
    
    -- User Agent ของ Browser (สำหรับ Security Audit)
    user_agent TEXT COMMENT 'User Agent ของ Browser สำหรับ Security Audit',
    
    -- ข้อมูลเพิ่มเติมแบบ JSON (ยืดหยุ่น เช่น {"old_price": 100, "new_price": 150})
    additional_data JSON COMMENT 'ข้อมูลเพิ่มเติมแบบ JSON สำหรับเก็บข้อมูลที่ยืดหยุ่น',
    
    -- อ้างอิงเอกสาร (เช่น PR001, PO001, GR001)
    document_ref VARCHAR(100) COMMENT 'อ้างอิงเอกสาร (เช่น PR001, PO001, GR001)',
    
    FOREIGN KEY (item_id) REFERENCES tbl_inv_requisition_items(item_id),
    FOREIGN KEY (changed_by) REFERENCES tbl_ur_auth_users(id),
    INDEX idx_event_item(item_id),
    INDEX idx_event_type(event_type),
    INDEX idx_event_date(changed_at),
    INDEX idx_event_status(new_status_code)
) COMMENT = 'ตารางเก็บ Log ทุก Event ที่เกิดขึ้นกับแต่ละ Item สำหรับ Audit Trail';

-- ========================================================================
-- 5. tbl_inv_requisition_document_types (ตารางเก็บประเภทเอกสารที่เลือกสำหรับแต่ละคำขอเบิก)
-- ========================================================================
CREATE TABLE tbl_inv_requisition_document_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requisition_id VARCHAR(20) NOT NULL COMMENT 'รหัสคำขอเบิก',
    document_type_id INT NOT NULL COMMENT 'รหัสประเภทเอกสาร (อ้างอิง tbl_inv_document_types)',
    other_document_name VARCHAR(255) COMMENT 'ชื่อเอกสารกรณีเลือก "อื่นๆ"',
    is_required TINYINT(1) DEFAULT 0 COMMENT 'เป็นเอกสารจำเป็นหรือไม่',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่เลือกเอกสาร',
    FOREIGN KEY (requisition_id) REFERENCES tbl_inv_requisitions(id),
    FOREIGN KEY (document_type_id) REFERENCES tbl_inv_document_types(id),
    UNIQUE KEY unique_requisition_document_type (requisition_id, document_type_id)
) COMMENT = 'ตารางเก็บประเภทเอกสารที่เลือกสำหรับคำขอเบิก (Checkbox)';

-- ========================================================================
-- ฟังก์ชันสำหรับการสร้างเลขที่เอกสาร
-- ฟังก์ชันนี้จะสร้างเลขที่เอกสารอัตโนมัติตามรูปแบบ SGH-{TYPE}-YYMM-000
-- ========================================================================
DELIMITER $$

CREATE FUNCTION generate_document_number(doc_type VARCHAR(10)) 
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE current_yearmonth VARCHAR(4);
    DECLARE next_number INT;
    DECLARE document_prefix VARCHAR(10);
    DECLARE new_document_number VARCHAR(20);
    
    -- ดึงปี(2หลัก)และเดือน(2หลัก)ปัจจุบัน
    SET current_yearmonth = DATE_FORMAT(NOW(), '%y%m');
    
    -- ตรวจสอบว่ามีเลขที่ของเดือนนี้แล้วหรือยัง
    IF NOT EXISTS (SELECT 1 FROM document_running_numbers WHERE document_type = doc_type AND yearmonth_code = current_yearmonth) THEN
        -- ถ้ายังไม่มี ให้สร้างใหม่
        INSERT INTO document_running_numbers (document_type, yearmonth_code, last_running_number, prefix)
        VALUES (doc_type, current_yearmonth, 0, CONCAT('SGH-', doc_type, '-'));
    END IF;
    
    -- อัพเดทและดึงเลขที่ถัดไป
    UPDATE document_running_numbers 
    SET last_running_number = last_running_number + 1,
        updated_at = NOW()
    WHERE document_type = doc_type AND yearmonth_code = current_yearmonth;
    
    -- ดึงข้อมูลล่าสุด
    SELECT last_running_number, prefix INTO next_number, document_prefix
    FROM document_running_numbers
    WHERE document_type = doc_type AND yearmonth_code = current_yearmonth;
    
    -- สร้างเลขที่เอกสารใหม่
    SET new_document_number = CONCAT(document_prefix, current_yearmonth, '-', LPAD(next_number, 3, '0'));
    
    RETURN new_document_number;
END$$

DELIMITER ;


-------------------------------------------------------------------------------------------------------
Flow Diagram: ขั้นตอนการทำงานของระบบจัดซื้อ-พัสดุ
1. ภาพรวมกระบวนการทำงาน (Overview)
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│   การขอเบิกวัสดุ   │──────▶│   การสร้าง PR    │──────▶│   การสร้าง PO    │──────▶│    การรับของ     │──────▶│   การจ่ายเงิน    │
└───────────────────┘      └───────────────────┘      └───────────────────┘      └───────────────────┘      └───────────────────┘
      │                           │                           │                           │                           │
      ▼                           ▼                           ▼                           ▼                           ▼
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│   หน่วยงานทั่วไป   │      │     แผนกพัสดุ     │      │    แผนกจัดซื้อ    │      │  แผนกพัสดุ/จัดซื้อ │      │  แผนกจัดซื้อ/บัญชี │
└───────────────────┘      └───────────────────┘      └───────────────────┘      └───────────────────┘      └───────────────────┘
2. รายละเอียดขั้นตอนการขอเบิกและอนุมัติ
┌─────────────────────────────────────────────────────────────────────┐
│                        การขอเบิกและอนุมัติ                           │
└────────────────────────────────────┬────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 1. พนักงานหน่วยงานสร้างคำขอเบิก (Requisition)                       │
│    - บันทึกข้อมูลใน requisitions                                    │
│    - บันทึกรายการสินค้าใน requisition_items                         │
│    - แนบเอกสาร (ถ้ามี) ใน requisition_documents                     │
│    - บันทึกประวัติสถานะเริ่มต้น 'pending_approval' ใน status_logs   │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 2. หัวหน้าแผนกพิจารณาคำขอเบิก                                       │
│    - อนุมัติ: เปลี่ยนสถานะเป็น 'approved_by_dept_head'              │
│    - ไม่อนุมัติ: เปลี่ยนสถานะเป็น 'rejected_by_dept_head'           │
│    - บันทึกประวัติการเปลี่ยนสถานะใน status_logs                     │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
            ┌───────────────────────────────────────────┐
            │           หัวหน้าแผนกอนุมัติ?             │
            └───────────────┬───────────────┬──────────┘
                            │               │
                            ▼               ▼
┌────────────────────────────────┐  ┌────────────────────────────────┐
│ คำขอเบิกถูกปฏิเสธ              │  │ 3. ระบบเปลี่ยนสถานะเป็น         │
│ - สถานะ: rejected_by_dept_head │  │    'pending_stock_review'      │
│ - แจ้งผู้ขอเบิก                │  │    โดยอัตโนมัติ                 │
└────────────────────────────────┘  └────────────────┬───────────────┘
                                                      │
                                                      ▼
                                   ┌────────────────────────────────┐
                                   │ 4. ส่งให้แผนกพัสดุตรวจสอบ      │
                                   └────────────────────────────────┘
3. รายละเอียดขั้นตอนการสร้างใบขอซื้อ (PR)
┌─────────────────────────────────────────────────────────────────────┐
│                      การสร้างใบขอซื้อ (PR)                           │
└────────────────────────────────────┬────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 1. พนักงานพัสดุตรวจสอบรายการขอเบิก                                  │
│    - ตรวจสอบรายละเอียดคำขอเบิกที่มีสถานะ 'pending_stock_review'     │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
              ┌───────────────────────────────────────┐
              │        ข้อมูลครบถ้วนถูกต้อง?         │
              └─────────────┬─────────────┬──────────┘
                            │             │
                            ▼             ▼
┌────────────────────────────────┐  ┌────────────────────────────────┐
│ ส่งกลับให้แก้ไข                │  │ 2. สร้างใบขอซื้อ (PR)           │
│ - เปลี่ยนสถานะเป็น             │  │    - สร้างเลขที่ใบขอซื้อด้วย     │
│   'rejected_by_stock'         │  │      generate_document_number   │
│ - ระบุเหตุผลที่ปฏิเสธ          │  │    - บันทึกข้อมูลหลักใน          │
└────────────────────────────────┘  │      purchase_requisitions     │
                                     │    - บันทึกรายการสินค้าใน       │
                                     │      pr_items                  │
                                     │    - บันทึกผู้จำหน่ายใน          │
                                     │      pr_suppliers              │
                                     │    - แนบเอกสาร (ถ้ามี) ใน        │
                                     │      pr_documents              │
                                     │    - เปลี่ยนสถานะเป็น           │
                                     │      'pending_stock_head_approval'│
                                     └────────────────┬───────────────┘
                                                      │
                                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 3. หัวหน้าพัสดุพิจารณาใบขอซื้อ (PR)                                 │
│    - อนุมัติ: เปลี่ยนสถานะเป็น 'approved_by_stock_head'             │
│    - ไม่อนุมัติ: เปลี่ยนสถานะเป็น 'rejected_by_stock_head'          │
│    - บันทึกประวัติการเปลี่ยนสถานะใน status_logs                     │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
            ┌───────────────────────────────────────────┐
            │          หัวหน้าพัสดุอนุมัติ?             │
            └───────────────┬───────────────┬──────────┘
                            │               │
                            ▼               ▼
┌────────────────────────────────┐  ┌────────────────────────────────┐
│ ปฏิเสธใบขอซื้อ                 │  │ 4. ระบบเปลี่ยนสถานะเป็น         │
│ - สถานะ: rejected_by_stock_head│  │    'pending_purchase_review'   │
│ - ส่งกลับให้แก้ไข               │  │    โดยอัตโนมัติ                 │
└────────────────────────────────┘  └────────────────┬───────────────┘
                                                      │
                                                      ▼
                                   ┌────────────────────────────────┐
                                   │ 5. ส่งให้แผนกจัดซื้อดำเนินการ   │
                                   └────────────────────────────────┘
4. รายละเอียดขั้นตอนการสร้างใบสั่งซื้อ (PO)
┌─────────────────────────────────────────────────────────────────────┐
│                      การสร้างใบสั่งซื้อ (PO)                         │
└────────────────────────────────────┬────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 1. พนักงานจัดซื้อตรวจสอบใบขอซื้อ (PR)                                │
│    - ตรวจสอบใบขอซื้อที่มีสถานะ 'pending_purchase_review'             │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 2. หัวหน้าจัดซื้อสร้างใบสั่งซื้อ (PO)                                 │
│    - สร้างเลขที่ใบสั่งซื้อด้วย generate_document_number              │
│    - บันทึกข้อมูลหลักใน purchase_orders                             │
│    - บันทึกรายการสินค้าใน po_items                                  │
│    - เลือกผู้จำหน่ายที่จะสั่งซื้อ                                     │
│    - เปลี่ยนสถานะเป็น 'po_created'                                  │
│    - บันทึกประวัติการเปลี่ยนสถานะใน status_logs                      │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 3. ระบบเปลี่ยนสถานะเป็น 'pending_executive_approval' โดยอัตโนมัติ    │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 4. ผู้บริหารพิจารณาอนุมัติใบสั่งซื้อ                                  │
│    - อนุมัติ: เปลี่ยนสถานะเป็น 'approved_by_executive'               │
│    - ไม่อนุมัติ: เปลี่ยนสถานะเป็น 'rejected_by_executive'            │
│    - บันทึกประวัติการเปลี่ยนสถานะใน status_logs                      │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
            ┌───────────────────────────────────────────┐
            │           ผู้บริหารอนุมัติ?               │
            └───────────────┬───────────────┬──────────┘
                            │               │
                            ▼               ▼
┌────────────────────────────────┐  ┌────────────────────────────────┐
│ ปฏิเสธใบสั่งซื้อ                │  │ 5. จัดซื้อส่ง PO ให้ผู้จำหน่าย   │
│ - สถานะ: rejected_by_executive │  │    - เปลี่ยนสถานะเป็น           │
│ - ส่งกลับให้แก้ไข               │  │      'po_sent_to_supplier'     │
└────────────────────────────────┘  │    - บันทึกประวัติการเปลี่ยนสถานะ│
                                     └────────────────┬───────────────┘
                                                      │
                                                      ▼
                                   ┌────────────────────────────────┐
                                   │ 6. รอผู้จำหน่ายส่งสินค้า        │
                                   └────────────────────────────────┘
5. รายละเอียดขั้นตอนการรับสินค้าและออกใบ PRQ
┌─────────────────────────────────────────────────────────────────────┐
│                การรับสินค้าและการออกใบขอจ่ายเงิน (PRQ)               │
└────────────────────────────────────┬────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 1. ผู้จำหน่ายมาส่งสินค้าตาม PO                                       │
│    - พร้อมใบส่งของ (Delivery Note)                                  │
│    - อาจมีใบแจ้งหนี้ (Invoice) หรือใบวางบิลมาด้วย                     │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 2. พนักงานพัสดุรับสินค้า                                             │
│    - สร้างเลขที่ใบรับสินค้าด้วย generate_document_number             │
│    - บันทึกข้อมูลหลักใน goods_receipts                              │
│    - บันทึกรายการสินค้าที่รับใน goods_receipt_items                  │
│    - บันทึกเลขที่ใบส่งของและใบแจ้งหนี้                                │
│    - เปลี่ยนสถานะเป็น 'partially_received' หรือ 'fully_received'     │
│    - บันทึกประวัติการเปลี่ยนสถานะใน status_logs                      │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 3. พนักงานพัสดุและผู้ขอเบิกตรวจสอบสินค้า                             │
│    - ตรวจสอบคุณภาพและจำนวนสินค้า                                    │
│    - เปลี่ยนสถานะใบรับสินค้าเป็น 'verified'                          │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 4. พนักงานจัดซื้อตรวจสอบใบส่งของและใบแจ้งหนี้                         │
│    - เปลี่ยนสถานะคำขอเบิกเป็น 'sent_to_accounting'                   │
│    - ส่งเอกสารให้แผนกบัญชีตรวจสอบ                                    │
│    - บันทึกประวัติการเปลี่ยนสถานะใน status_logs                      │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 5. แผนกบัญชีตรวจสอบเอกสาร                                          │
│    - ตรวจสอบความถูกต้องของใบแจ้งหนี้กับใบสั่งซื้อและใบรับสินค้า        │
│    - ส่งกลับให้แผนกจัดซื้อ                                          │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 6. พนักงานจัดซื้อออกใบขอจ่ายเงิน (PRQ)                               │
│    - สร้างเลขที่ใบขอจ่ายเงินด้วย generate_document_number            │
│    - บันทึกข้อมูลหลักใน payment_requisitions                        │
│    - บันทึกรายการใบรับสินค้าใน payment_requisition_items             │
│    - เปลี่ยนสถานะคำขอเบิกเป็น 'payment_completed'                    │
│    - บันทึกประวัติการเปลี่ยนสถานะใน status_logs                      │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 7. แผนกการเงินจ่ายเงินให้ผู้จำหน่าย                                  │
│    - จ่ายเงินตามรอบ (เช่น ทุกวันที่ 5 และ 20 ของเดือน)                │
│    - บันทึกการจ่ายเงินใน payment_history                            │
│    - เปลี่ยนสถานะใบขอจ่ายเงินเป็น 'paid'                             │
└────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│ 8. ปิดรายการ                                                        │
│    - เปลี่ยนสถานะคำขอเบิกเป็น 'closed'                               │
│    - บันทึกประวัติการเปลี่ยนสถานะใน status_logs                      │
└────────────────────────────────────────────────────────────────────┘