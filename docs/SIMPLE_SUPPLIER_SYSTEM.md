# 🎯 ระบบผู้จำหน่ายแบบเรียบง่าย (Simple Supplier System)

## 📋 **ความต้องการที่แก้ไข**

1. ✅ **พัสดุดึงผู้ขายที่มีรหัสแล้วมาแสดง** - สำหรับเลือกใส่ draft-pr
2. ✅ **พัสดุเพิ่มผู้จำหน่ายใหม่ได้เอง** - ถ้าไม่มีในระบบ
3. ✅ **ไม่ต้องการระบบคะแนน** - ยุ่งยากเกินไป
4. ✅ **จัดซื้ออาจไม่เลือกจากที่พัสดุเสนอ** - ยืดหยุ่นในการเลือก
5. ✅ **ลดความซับซ้อน** - ใช้ตารางเดียว แทนหลายตาราง

---

## 🏗️ **โครงสร้างใหม่ (แบบเรียบง่าย)**

### **ตาราง 1: `tbl_inv_suppliers` (ตารางเดียวรวมทั้งหมด)**

```sql
-- ผู้จำหน่าย/ผู้ขายรวมในตารางเดียว
CREATE TABLE tbl_inv_suppliers (
    id INT PRIMARY KEY,
    supplier_name VARCHAR(200) NOT NULL,        -- ชื่อผู้จำหน่าย
    supplier_type ENUM('SUGGESTED', 'OFFICIAL'), -- ประเภท
    vendor_code VARCHAR(20),                     -- รหัสผู้ขาย (เฉพาะ OFFICIAL)
    contact_person VARCHAR(100),                 -- ผู้ติดต่อ
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1,             -- สถานะใช้งาน
    -- ... ฟิลด์อื่นๆ
);
```

**หลักการ:**
- **SUGGESTED**: ผู้จำหน่ายที่พัสดุเสนอ (ยังไม่มีรหัส)
- **OFFICIAL**: ผู้ขายที่มีรหัสแล้ว (จัดซื้อ/Admin อนุมัติแล้ว)

### **ตาราง 2: `tbl_inv_draft_pr_suppliers` (เรียบง่าย)**

```sql
-- ผู้จำหน่ายใน draft-pr (เชื่อมกับตารางเดียว)
CREATE TABLE tbl_inv_draft_pr_suppliers (
    id INT PRIMARY KEY,
    draft_pr_id VARCHAR(20),                    -- รหัสร่าง PR
    supplier_id INT,                            -- อ้างอิงผู้จำหน่าย (ตารางเดียว)
    quoted_unit_price DECIMAL(15,2),            -- ราคาเสนอ
    is_recommended TINYINT(1) DEFAULT 0,        -- แนะนำหรือไม่
    quote_status ENUM('PENDING', 'RECEIVED'),   -- สถานะใบเสนอราคา
    -- ... ฟิลด์อื่นๆ
);
```

---

## 🔄 **Workflow การใช้งาน**

### **ขั้นตอนที่ 1: พัสดุสร้าง Draft-PR**

```javascript
// 1. ดึงผู้จำหน่ายทั้งหมดมาแสดง (ทั้ง SUGGESTED และ OFFICIAL)
GET /api/suppliers/for-selection
Response: [
    {id: 1, display_name: "[VEN001] บริษัท เฮลท์แคร์", supplier_type: "OFFICIAL"},
    {id: 2, display_name: "[เสนอแนะ] บริษัท นิวเมดิคอล", supplier_type: "SUGGESTED"},
    ...
]

// 2. หากไม่มีผู้จำหน่ายที่ต้องการ → เพิ่มใหม่
POST /api/suppliers/add-new
Body: {
    supplier_name: "บริษัท ABC จำกัด",
    contact_person: "คุณสมชาย",
    phone: "02-123-4567",
    suggestion_note: "ค้นหาจากอินเทอร์เน็ต ราคาน่าสนใจ"
}
Response: {new_supplier_id: 5, message: "เพิ่มผู้จำหน่ายใหม่เรียบร้อย"}

// 3. เลือกผู้จำหน่ายใส่ draft-pr
POST /api/draft-pr/suppliers/add
Body: {
    draft_pr_id: "DPR25010001",
    supplier_id: 5,
    quoted_unit_price: 150.00,
    is_recommended: true
}
```

### **ขั้นตอนที่ 2: จัดซื้อดู Draft-PR**

```javascript
// จัดซื้อดูผู้จำหน่ายใน draft-pr
GET /api/draft-pr/DPR25010001/suppliers
Response: [
    {
        supplier_id: 1,
        supplier_display_name: "[VEN001] บริษัท เฮลท์แคร์",
        supplier_type: "OFFICIAL",
        quoted_total_price: 5000.00,
        is_recommended: true
    },
    {
        supplier_id: 5,
        supplier_display_name: "[เสนอแนะ] บริษัท ABC จำกัด",
        supplier_type: "SUGGESTED",
        quoted_total_price: 4500.00,
        is_recommended: false
    }
]
```

### **ขั้นตอนที่ 3: การเลื่อนสถานะ (ถ้าต้องการ)**

```javascript
// ถ้าจัดซื้อเลือกผู้จำหน่าย SUGGESTED และต้องการให้เป็น OFFICIAL
CALL PromoteSupplierToOfficial(5, 'VEN003', 'PURCHASE_MANAGER', 'ได้รับคัดเลือกจากการเปรียบเทียบราคา');
```

---

## 📊 **Views สำหรับการใช้งาน**

### **1. `vw_suppliers_for_selection` - รายการเลือกผู้จำหน่าย**

```sql
SELECT * FROM vw_suppliers_for_selection;
-- แสดงผู้จำหน่ายทั้งหมดพร้อม display_name ที่สวยงาม
```

### **2. `vw_draft_pr_suppliers_detail` - รายละเอียด Draft-PR**

```sql
SELECT * FROM vw_draft_pr_suppliers_detail 
WHERE draft_pr_id = 'DPR25010001';
-- แสดงผู้จำหน่ายใน draft-pr พร้อมรายละเอียดครบถ้วน
```

---

## 🎨 **UI/UX ที่เสนอแนะ**

### **หน้าสร้าง Draft-PR**

```
┌─────────────────────────────────────────────┐
│ เลือกผู้จำหน่าย                               │
├─────────────────────────────────────────────┤
│ ☐ [VEN001] บริษัท เฮลท์แคร์ ซัพพลาย จำกัด     │
│ ☐ [VEN002] บริษัท เมดิคอล เซ็นเตอร์ จำกัด     │
│ ☐ [เสนอแนะ] บริษัท นิว เมดิคอล จำกัด          │
│ ☐ [เสนอแนะ] ร้าน ยาดี เภสัช                 │
├─────────────────────────────────────────────┤
│ [+ เพิ่มผู้จำหน่ายใหม่]                       │
└─────────────────────────────────────────────┘
```

### **Modal เพิ่มผู้จำหน่ายใหม่**

```
┌─────────────────────────────────────────────┐
│ เพิ่มผู้จำหน่ายใหม่                           │
├─────────────────────────────────────────────┤
│ ชื่อผู้จำหน่าย: [___________________]        │
│ ผู้ติดต่อ:     [___________________]        │
│ โทรศัพท์:      [___________________]        │
│ อีเมล:        [___________________]        │
│ หมายเหตุ:      [___________________]        │
│                                             │
│ [ยกเลิก] [เพิ่มผู้จำหน่าย]                   │
└─────────────────────────────────────────────┘
```

---

## ⚡ **ข้อดีของระบบใหม่**

### **✅ ความเรียบง่าย**
- ใช้ตารางเดียว แทนหลายตาราง
- ไม่มีระบบคะแนนที่ซับซ้อน
- Logic ชัดเจน เข้าใจง่าย

### **✅ ความยืดหยุ่น**
- พัสดุเพิ่มผู้จำหน่ายได้ทันที
- จัดซื้อไม่จำเป็นต้องเลือกจากที่พัสดุเสนอ
- สามารถเลื่อนสถานะได้เมื่อต้องการ

### **✅ ประสิทธิภาพ**
- Query เร็ว (ตารางเดียว)
- UI โหลดเร็ว
- การจัดการง่าย

### **✅ การบำรุงรักษา**
- โค้ดน้อย บัคน้อย
- อัพเดทง่าย
- เพิ่มฟีเจอร์ได้ในอนาคต

---

## 🔧 **การ Implement**

### **1. Database Migration**

```sql
-- รัน script สร้างตารางใหม่
SOURCE simple_supplier_system.sql;
```

### **2. API Endpoints ใหม่**

```javascript
// ดึงผู้จำหน่ายสำหรับเลือก
GET /api/suppliers/for-selection

// เพิ่มผู้จำหน่ายใหม่
POST /api/suppliers/add-new

// เลื่อนสถานะ
POST /api/suppliers/:id/promote-to-official
```

### **3. Frontend Components**

```jsx
// SupplierSelector.jsx - Component เลือกผู้จำหน่าย
// AddSupplierModal.jsx - Modal เพิ่มผู้จำหน่ายใหม่
// SupplierBadge.jsx - แสดงป้ายประเภทผู้จำหน่าย
```

---

## 🚀 **การ Deploy**

1. **Backup Database** - สำรองข้อมูลเดิม
2. **Run Migration** - รัน SQL script
3. **Update API** - อัพเดท Controller
4. **Update Frontend** - แก้ไข UI components
5. **Test** - ทดสอบการทำงาน
6. **Go Live** - เปิดใช้งานจริง

---

## 📝 **ตัวอย่างการใช้งาน**

### **Scenario 1: พัสดุสร้าง Draft-PR ปกติ**
1. เลือกจาก vendor ที่มีรหัสแล้ว
2. เพิ่มในราคาที่ต้องการ
3. ส่งให้หัวหน้าพัสดุอนุมัติ

### **Scenario 2: พัสดุหาผู้จำหน่ายใหม่**
1. ไม่เจอใน list → กด "เพิ่มผู้จำหน่ายใหม่"
2. กรอกข้อมูล supplier ใหม่
3. เลือกผู้จำหน่ายที่เพิ่งเพิ่ม
4. ส่งให้หัวหน้าพัสดุอนุมัติ

### **Scenario 3: จัดซื้อเลือกผู้จำหน่ายที่เสนอแนะ**
1. ดู draft-pr จากพัสดุ
2. เลือกผู้จำหน่ายที่เสนอแนะ
3. Admin สร้างรหัส vendor ให้
4. ดำเนินการสั่งซื้อต่อไป

---

## 💡 **การขยายในอนาคต**

- **🏷️ Categories**: เพิ่มหมวดหมู่สินค้า
- **⭐ Simple Rating**: ระบบให้คะแนนแบบง่าย (1-5 ดาว)
- **📈 History**: ประวัติการทำงานร่วมกัน
- **🔔 Notifications**: แจ้งเตือนเมื่อมี supplier ใหม่

---

*✨ ระบบนี้เรียบง่าย ใช้งานง่าย และตอบโจทย์ความต้องการจริง!* 