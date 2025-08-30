# การออกแบบตารางหมวดหมู่สินค้า (Item Categories)

## 📋 ภาพรวม

ระบบหมวดหมู่สินค้าถูกออกแบบให้ยืดหยุ่นและรองรับการเพิ่ม/ลดหมวดหมู่ในอนาคต พร้อมฟีเจอร์พิเศษสำหรับการจัดการข้อมูลผู้ป่วยและการจัดซื้อ

## 🏗️ โครงสร้างตาราง

### 1. ตารางหลัก: `tbl_inv_item_categories`

#### ฟิลด์พื้นฐาน
- `id` - รหัสหมวดหมู่ (Auto Increment)
- `category_code` - รหัสหมวดหมู่ (Unique)
- `category_name_th` - ชื่อหมวดหมู่ภาษาไทย
- `category_name_en` - ชื่อหมวดหมู่ภาษาอังกฤษ
- `parent_category_id` - หมวดหมู่หลัก (สำหรับหมวดหมู่ย่อย)
- `category_level` - ระดับหมวดหมู่ (1=หลัก, 2=ย่อย, 3=ย่อยของย่อย)
- `category_path` - เส้นทางหมวดหมู่ (เช่น /1/5/12)

#### ฟิลด์สำหรับข้อมูลผู้ป่วย
- `requires_patient_info` - ต้องระบุข้อมูลผู้ป่วย
- `requires_hn` - ต้องระบุ HN
- `requires_patient_name` - ต้องระบุชื่อผู้ป่วย
- `requires_medical_justification` - ต้องระบุเหตุผลทางการแพทย์
- `requires_doctor_approval` - ต้องอนุมัติจากแพทย์
- `requires_special_handling` - ต้องจัดการพิเศษ

#### ฟิลด์สำหรับการจัดซื้อ
- `purchase_approval_level` - ระดับการอนุมัติ (NORMAL/MANAGER/EXECUTIVE/BOARD)
- `budget_category` - หมวดงบประมาณ
- `cost_center` - ศูนย์ต้นทุน
- `asset_type` - ประเภทสินทรัพย์ (CONSUMABLE/FIXED_ASSET/LOW_VALUE/MEDICAL_DEVICE/DRUG/SUPPLY)

### 2. ตารางคุณสมบัติ: `tbl_inv_category_attributes`

สำหรับกำหนดคุณสมบัติเพิ่มเติมของแต่ละหมวดหมู่:

- `attribute_code` - รหัสคุณสมบัติ
- `attribute_name_th` - ชื่อคุณสมบัติภาษาไทย
- `attribute_type` - ประเภทข้อมูล (TEXT/NUMBER/DECIMAL/DATE/BOOLEAN/SELECT/MULTISELECT/FILE)
- `is_required` - จำเป็นต้องกรอก
- `validation_rules` - กฎการตรวจสอบ (JSON)
- `options` - ตัวเลือก (สำหรับ SELECT/MULTISELECT)

### 3. ตารางค่าคุณสมบัติ: `tbl_inv_item_attribute_values`

เก็บค่าคุณสมบัติของแต่ละรายการสินค้า:

- `item_id` - รหัสรายการสินค้า (เชื่อมกับ tbl_inv_requisition_items)
- `category_id` - รหัสหมวดหมู่
- `attribute_id` - รหัสคุณสมบัติ
- `attribute_value` - ค่าคุณสมบัติ
- `attribute_value_json` - ค่าคุณสมบัติแบบ JSON (สำหรับ MULTISELECT)

### 4. ตารางติดตาม: `tbl_inv_category_usage_logs`

ติดตามการใช้งานหมวดหมู่:

- `category_id` - รหัสหมวดหมู่
- `item_id` - รหัสรายการสินค้า
- `action_type` - ประเภทการกระทำ (CREATE/UPDATE/DELETE/APPROVE/REJECT)
- `old_values` / `new_values` - ค่าเดิม/ใหม่ (JSON)

## 📊 ข้อมูลเริ่มต้น

### หมวดหมู่หลัก
1. **อุปกรณ์ทางการแพทย์** (MEDICAL_DEVICES) - ต้องระบุข้อมูลผู้ป่วย
2. **ยาและเวชภัณฑ์** (DRUGS) - ต้องระบุข้อมูลผู้ป่วย
3. **วัสดุสิ้นเปลือง** (SUPPLIES) - ไม่ต้องระบุข้อมูลผู้ป่วย
4. **วัสดุสำนักงาน** (OFFICE_SUPPLIES) - ไม่ต้องระบุข้อมูลผู้ป่วย
5. **อุปกรณ์คอมพิวเตอร์** (IT_EQUIPMENT) - ไม่ต้องระบุข้อมูลผู้ป่วย
6. **เฟอร์นิเจอร์** (FURNITURE) - ไม่ต้องระบุข้อมูลผู้ป่วย
7. **อุปกรณ์ห้องปฏิบัติการ** (LABORATORY) - ต้องระบุข้อมูลผู้ป่วย
8. **วัสดุซ่อมบำรุง** (MAINTENANCE) - ไม่ต้องระบุข้อมูลผู้ป่วย

### หมวดหมู่ย่อย - อุปกรณ์ทางการแพทย์
- อุปกรณ์ติดตามผู้ป่วย (MONITORING_DEVICES)
- อุปกรณ์วินิจฉัย (DIAGNOSTIC_DEVICES)
- อุปกรณ์ผ่าตัด (SURGICAL_DEVICES)
- อุปกรณ์บำบัด (THERAPEUTIC_DEVICES)

### หมวดหมู่ย่อย - ยาและเวชภัณฑ์
- ยาตามใบสั่งแพทย์ (PRESCRIPTION_DRUGS)
- ยาที่ไม่ต้องมีใบสั่งแพทย์ (OTC_DRUGS)
- วัคซีน (VACCINES)
- ก๊าซทางการแพทย์ (MEDICAL_GASES)

## 🔧 ฟีเจอร์พิเศษ

### 1. การจัดการข้อมูลผู้ป่วย
```sql
-- ดูหมวดหมู่ที่ต้องระบุข้อมูลผู้ป่วย
SELECT * FROM vw_patient_required_categories;

-- ดูหมวดหมู่ที่ต้องระบุ HN
SELECT * FROM tbl_inv_item_categories 
WHERE requires_hn = 1 AND is_active = 1;
```

### 2. การจัดการคุณสมบัติเพิ่มเติม
```sql
-- เพิ่มคุณสมบัติใหม่ให้หมวดหมู่
INSERT INTO tbl_inv_category_attributes (
  category_id, attribute_code, attribute_name_th, 
  attribute_type, is_required, options, created_by_user_id
) VALUES (
  1, 'BRAND', 'ยี่ห้อ', 'TEXT', 0, NULL, 'USER001'
);

-- ดูคุณสมบัติของหมวดหมู่
SELECT * FROM tbl_inv_category_attributes 
WHERE category_id = 1 AND is_active = 1;
```

### 3. การติดตามการใช้งาน
```sql
-- ดูสถิติการใช้งานหมวดหมู่
SELECT * FROM vw_category_usage_stats;

-- ดูประวัติการใช้งานหมวดหมู่
SELECT * FROM tbl_inv_category_usage_logs 
WHERE category_id = 1 
ORDER BY date_created DESC;
```

## 📈 Views ที่มีประโยชน์

### 1. `vw_category_hierarchy`
แสดงหมวดหมู่แบบ hierarchical พร้อมเส้นทาง

### 2. `vw_patient_required_categories`
แสดงเฉพาะหมวดหมู่ที่ต้องระบุข้อมูลผู้ป่วย

### 3. `vw_category_usage_stats`
แสดงสถิติการใช้งานหมวดหมู่

## 🚀 Stored Procedures

### 1. `update_all_category_paths()`
อัปเดต category_path ทั้งหมด

### 2. `get_category_hierarchy(parent_id)`
ดึงหมวดหมู่แบบ hierarchical

### 3. `get_patient_required_categories()`
ดึงหมวดหมู่ที่ต้องระบุข้อมูลผู้ป่วย

## 💡 ตัวอย่างการใช้งาน

### 1. เพิ่มหมวดหมู่ใหม่
```sql
INSERT INTO tbl_inv_item_categories (
  category_code, category_name_th, category_name_en,
  parent_category_id, category_level,
  requires_patient_info, requires_hn, requires_patient_name,
  purchase_approval_level, asset_type,
  created_by_user_id
) VALUES (
  'NEW_CATEGORY', 'หมวดหมู่ใหม่', 'New Category',
  1, 2, 1, 1, 1, 'MANAGER', 'MEDICAL_DEVICE', 'USER001'
);
```

### 2. เพิ่มคุณสมบัติให้หมวดหมู่
```sql
INSERT INTO tbl_inv_category_attributes (
  category_id, attribute_code, attribute_name_th,
  attribute_type, is_required, options, created_by_user_id
) VALUES (
  1, 'SPECIFICATION', 'รายละเอียดทางเทคนิค', 'TEXT', 1, NULL, 'USER001'
);
```

### 3. บันทึกค่าคุณสมบัติของรายการสินค้า
```sql
INSERT INTO tbl_inv_item_attribute_values (
  item_id, category_id, attribute_id, attribute_value, created_by_user_id
) VALUES (
  123, 1, 5, 'รายละเอียดทางเทคนิคของสินค้า', 'USER001'
);
```

## 🔒 การรักษาความปลอดภัย

### 1. Foreign Key Constraints
- ตรวจสอบความถูกต้องของข้อมูล
- ป้องกันการลบข้อมูลที่ถูกใช้งาน

### 2. Audit Fields
- ติดตามผู้สร้าง/แก้ไข
- บันทึกเวลาในการสร้าง/แก้ไข

### 3. Soft Delete
- ใช้ `is_active` แทนการลบข้อมูลจริง
- รักษาประวัติการใช้งาน

## 📋 การบำรุงรักษา

### 1. การอัปเดต category_path
```sql
CALL update_all_category_paths();
```

### 2. การตรวจสอบข้อมูล
```sql
-- ตรวจสอบหมวดหมู่ที่ไม่มี parent
SELECT * FROM tbl_inv_item_categories 
WHERE parent_category_id IS NOT NULL 
AND parent_category_id NOT IN (SELECT id FROM tbl_inv_item_categories);

-- ตรวจสอบคุณสมบัติที่ไม่มีหมวดหมู่
SELECT * FROM tbl_inv_category_attributes 
WHERE category_id NOT IN (SELECT id FROM tbl_inv_item_categories);
```

### 3. การทำความสะอาดข้อมูล
```sql
-- ลบ log เก่า (มากกว่า 1 ปี)
DELETE FROM tbl_inv_category_usage_logs 
WHERE date_created < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

## 🎯 ประโยชน์ของระบบ

1. **ยืดหยุ่น**: เพิ่ม/ลดหมวดหมู่ได้ง่าย
2. **รองรับข้อมูลผู้ป่วย**: กำหนดความต้องการข้อมูลผู้ป่วยได้
3. **คุณสมบัติเพิ่มเติม**: เพิ่มคุณสมบัติเฉพาะของแต่ละหมวดหมู่
4. **ติดตามการใช้งาน**: ดูสถิติและประวัติการใช้งาน
5. **การจัดซื้อ**: กำหนดระดับการอนุมัติและประเภทสินทรัพย์
6. **Hierarchical**: รองรับหมวดหมู่ย่อยหลายระดับ
7. **Audit Trail**: ติดตามการเปลี่ยนแปลงทั้งหมด 