# ตารางหน่วยนับ (Units Table) - การออกแบบและ API

## 📋 สรุปการทำงาน

ระบบหน่วยนับถูกออกแบบให้รองรับการใช้งานแบบยืดหยุ่น:

1. **หน่วยนับระบบ**: มีหน่วยนับพื้นฐานที่ระบบเตรียมไว้ให้
2. **หน่วยนับผู้ใช้**: ผู้ใช้สามารถเพิ่มหน่วยนับใหม่ได้
3. **การตรวจสอบซ้ำ**: ระบบจะตรวจสอบชื่อหน่วยนับที่ซ้ำกันและไม่สร้างใหม่
4. **การค้นหา**: รองรับการค้นหาหน่วยนับจากชื่อหรือรหัส

## 🗄️ โครงสร้างฐานข้อมูล

### ตารางหลัก: `tbl_inv_units`

```sql
CREATE TABLE tbl_inv_units (
    unit_id INT AUTO_INCREMENT PRIMARY KEY,           -- รหัสหน่วยนับ
    unit_name VARCHAR(50) NOT NULL,                   -- ชื่อหน่วยนับ
    unit_code VARCHAR(20) UNIQUE,                     -- รหัสหน่วยนับ (ไม่บังคับ)
    unit_description TEXT,                            -- คำอธิบาย
    unit_category VARCHAR(50) DEFAULT 'GENERAL',      -- หมวดหมู่
    is_active TINYINT(1) DEFAULT 1,                   -- สถานะการใช้งาน
    is_system_unit TINYINT(1) DEFAULT 0,              -- เป็นหน่วยนับของระบบหรือไม่
    display_order INT DEFAULT 0,                      -- ลำดับการแสดงผล
    
    -- ฟิลด์ Audit
    created_by_user_id VARCHAR(15) NOT NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id VARCHAR(15) NULL,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_unit_name (unit_name)
);
```

### หมวดหมู่หน่วยนับ

- `GENERAL` - ทั่วไป (ชิ้น, กล่อง, ชุด, คู่, อัน, ตัว, เล่ม, แผ่น, ถุง, ขวด, กระป๋อง, หลอด, แท่ง, ม้วน, ก้อน, ถ้วย, ช้อน, แก้ว)
- `WEIGHT` - น้ำหนัก (กิโลกรัม, กรัม, ปอนด์)
- `LENGTH` - ความยาว (เมตร, เซนติเมตร, มิลลิเมตร, ฟุต, นิ้ว)
- `VOLUME` - ปริมาตร (ลิตร, มิลลิลิตร, แกลลอน)
- `AREA` - พื้นที่ (ตารางเมตร, ตารางฟุต)
- `TIME` - เวลา (ชั่วโมง, นาที, วัน, สัปดาห์, เดือน, ปี)
- `COUNT` - การนับ
- `CUSTOM` - กำหนดเอง

## 🔧 Stored Procedures

### 1. `sp_check_and_add_unit`

**วัตถุประสงค์**: ตรวจสอบและเพิ่มหน่วยนับใหม่

**พารามิเตอร์**:
- `p_unit_name` - ชื่อหน่วยนับ
- `p_unit_code` - รหัสหน่วยนับ (ไม่บังคับ)
- `p_unit_description` - คำอธิบาย
- `p_unit_category` - หมวดหมู่
- `p_created_by_user_id` - รหัสผู้สร้าง

**ผลลัพธ์**:
- `p_result_code` - รหัสผลลัพธ์ (1=สำเร็จ, 0=มีอยู่แล้ว, -1=ผิดพลาด)
- `p_result_message` - ข้อความผลลัพธ์
- `p_unit_id` - รหัสหน่วยนับ

**การทำงาน**:
1. ตรวจสอบว่ามีหน่วยนับชื่อนี้อยู่แล้วหรือไม่
2. ตรวจสอบรหัสหน่วยนับ (ถ้ามี)
3. ถ้ามีอยู่แล้ว: ส่งคืนรหัสหน่วยนับที่มีอยู่
4. ถ้าไม่มี: สร้างหน่วยนับใหม่

### 2. `sp_get_all_units`

**วัตถุประสงค์**: ดึงรายการหน่วยนับทั้งหมด

**พารามิเตอร์**:
- `p_category` - หมวดหมู่ (ไม่บังคับ)
- `p_is_active` - สถานะการใช้งาน (ไม่บังคับ)

### 3. `sp_search_units`

**วัตถุประสงค์**: ค้นหาหน่วยนับ

**พารามิเตอร์**:
- `p_search_term` - คำค้นหา

## 🌐 API Endpoints ที่ต้องการ

### 1. ดึงรายการหน่วยนับ

```
GET /api/units
```

**Query Parameters**:
- `category` - หมวดหมู่ (ไม่บังคับ)
- `is_active` - สถานะการใช้งาน (ไม่บังคับ)
- `include_inactive` - รวมหน่วยนับที่ไม่ใช้งาน (default: false)
- `order_by` - เรียงลำดับตาม (name, code, category, display_order)
- `order_direction` - ทิศทางการเรียง (asc, desc)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "unit_id": 1,
      "unit_name": "ชิ้น",
      "unit_code": "PCS",
      "unit_description": "หน่วยนับแบบชิ้น",
      "unit_category": "GENERAL",
      "is_active": true,
      "is_system_unit": true,
      "display_order": 1,
      "created_by_user_id": "SYSTEM",
      "date_created": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 50,
    "total_pages": 3
  }
}
```

### 2. ดึงหน่วยนับตามรหัส

```
GET /api/units/:id
```

### 3. ค้นหาหน่วยนับ

```
POST /api/units/search
```

**Request Body**:
```json
{
  "search_term": "ชิ้น",
  "category": "GENERAL",
  "is_active": true,
  "limit": 20
}
```

### 4. ตรวจสอบและเพิ่มหน่วยนับใหม่

```
POST /api/units/check-and-add
```

**Request Body**:
```json
{
  "unit_name": "ถ้วยพลาสติก",
  "unit_code": "CUP_PLASTIC",
  "unit_description": "ถ้วยพลาสติกใช้แล้วทิ้ง",
  "unit_category": "GENERAL",
  "created_by_user_id": "user123"
}
```

**Response**:
```json
{
  "success": true,
  "result_code": 1,
  "result_message": "เพิ่มหน่วยนับ \"ถ้วยพลาสติก\" สำเร็จ",
  "unit_id": 100,
  "unit": {
    "unit_id": 100,
    "unit_name": "ถ้วยพลาสติก",
    "unit_code": "CUP_PLASTIC",
    "unit_description": "ถ้วยพลาสติกใช้แล้วทิ้ง",
    "unit_category": "GENERAL",
    "is_active": true,
    "is_system_unit": false,
    "display_order": 70,
    "created_by_user_id": "user123",
    "date_created": "2025-01-01T00:00:00Z"
  }
}
```

### 5. สร้างหน่วยนับใหม่

```
POST /api/units
```

### 6. อัพเดทหน่วยนับ

```
PUT /api/units/:id
```

### 7. ลบหน่วยนับ

```
DELETE /api/units/:id
```

### 8. ดึงหน่วยนับตามหมวดหมู่

```
GET /api/units/category/:category
```

### 9. ดึงรายการหมวดหมู่

```
GET /api/units/categories
```

### 10. ดึงหน่วยนับที่ใช้งานได้

```
GET /api/units/active
```

### 11. ดึงหน่วยนับของระบบ

```
GET /api/units/system
```

### 12. ดึงหน่วยนับที่ผู้ใช้สร้างเอง

```
GET /api/units/custom
```

## 🔍 การทำงานของระบบ

### 1. การเลือกหน่วยนับในฟอร์ม

1. **โหลดรายการหน่วยนับ**: ดึงหน่วยนับที่ใช้งานได้ทั้งหมด
2. **แสดงใน dropdown**: แสดงรายการหน่วยนับให้เลือก
3. **การค้นหา**: ผู้ใช้สามารถพิมพ์ค้นหาได้
4. **การเพิ่มใหม่**: ถ้าไม่มีหน่วยนับที่ต้องการ ผู้ใช้สามารถเพิ่มใหม่ได้

### 2. การตรวจสอบซ้ำ

1. **ตรวจสอบชื่อ**: ระบบจะตรวจสอบชื่อหน่วยนับที่ซ้ำกัน
2. **ตรวจสอบรหัส**: ตรวจสอบรหัสหน่วยนับที่ซ้ำกัน (ถ้ามี)
3. **ไม่สร้างซ้ำ**: ถ้ามีอยู่แล้ว จะส่งคืนรหัสหน่วยนับที่มีอยู่
4. **สร้างใหม่**: ถ้าไม่มี จะสร้างหน่วยนับใหม่

### 3. การจัดการข้อมูล

1. **Audit Trail**: บันทึกผู้สร้างและผู้แก้ไข
2. **Soft Delete**: ใช้ `is_active` แทนการลบจริง
3. **Display Order**: จัดลำดับการแสดงผล
4. **Categories**: จัดกลุ่มตามหมวดหมู่

## 📝 ตัวอย่างการใช้งาน

### ตัวอย่างที่ 1: ผู้ใช้เลือกหน่วยนับที่มีอยู่

```javascript
// 1. ดึงรายการหน่วยนับ
const units = await unitService.getActiveUnits();

// 2. แสดงใน dropdown
const options = unitService.convertToDropdownOptions(units.data);

// 3. ผู้ใช้เลือก "ชิ้น"
const selectedUnit = units.data.find(u => u.unit_name === "ชิ้น");
```

### ตัวอย่างที่ 2: ผู้ใช้เพิ่มหน่วยนับใหม่

```javascript
// 1. ผู้ใช้พิมพ์ "ถ้วยพลาสติก"
const newUnitName = "ถ้วยพลาสติก";

// 2. ตรวจสอบและเพิ่ม
const result = await unitService.checkAndAddUnit({
  unit_name: newUnitName,
  unit_category: "GENERAL",
  created_by_user_id: "user123"
});

// 3. ผลลัพธ์
if (result.result_code === 1) {
  console.log("เพิ่มสำเร็จ:", result.unit_id);
} else if (result.result_code === 0) {
  console.log("มีอยู่แล้ว:", result.unit_id);
} else {
  console.log("เกิดข้อผิดพลาด:", result.result_message);
}
```

### ตัวอย่างที่ 3: การค้นหาหน่วยนับ

```javascript
// ค้นหาหน่วยนับที่มีคำว่า "ชิ้น"
const searchResult = await unitService.searchUnits({
  search_term: "ชิ้น"
});

// ผลลัพธ์จะได้: ชิ้น, ชิ้นส่วน, ชิ้นงาน, etc.
```

## 🎯 ประโยชน์ของระบบ

1. **ยืดหยุ่น**: ผู้ใช้สามารถเพิ่มหน่วยนับใหม่ได้
2. **ป้องกันซ้ำ**: ไม่สร้างหน่วยนับที่ซ้ำกัน
3. **จัดระเบียบ**: จัดกลุ่มตามหมวดหมู่
4. **ติดตามได้**: บันทึกประวัติการสร้างและแก้ไข
5. **ใช้งานง่าย**: รองรับการค้นหาและเลือก
6. **ขยายได้**: เพิ่มหมวดหมู่ใหม่ได้ในอนาคต

## 🔧 การติดตั้ง

1. รันไฟล์ SQL: `create_units_table.sql`
2. สร้าง API endpoints ตามที่กำหนด
3. ทดสอบการทำงานของระบบ
4. เชื่อมต่อกับ frontend

## 📊 ข้อมูลเริ่มต้น

ระบบจะสร้างหน่วยนับพื้นฐาน 50+ รายการ รวมถึง:
- หน่วยนับทั่วไป: ชิ้น, กล่อง, ชุด, คู่, อัน, ตัว, เล่ม, แผ่น
- หน่วยนับน้ำหนัก: กิโลกรัม, กรัม, ปอนด์
- หน่วยนับความยาว: เมตร, เซนติเมตร, มิลลิเมตร, ฟุต, นิ้ว
- หน่วยนับปริมาตร: ลิตร, มิลลิลิตร, แกลลอน
- หน่วยนับพื้นที่: ตารางเมตร, ตารางฟุต
- หน่วยนับเวลา: ชั่วโมง, นาที, วัน, สัปดาห์, เดือน, ปี
- และอื่นๆ 