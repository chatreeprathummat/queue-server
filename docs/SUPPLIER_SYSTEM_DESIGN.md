# 📋 ระบบผู้จำหน่าย 2 ประเภท (Dual Supplier System)

## 🎯 **ภาพรวมระบบ**

ระบบนี้แยกผู้จำหน่ายออกเป็น 2 ประเภทหลัก:

### **1. ผู้จำหน่ายแนะนำ (Suggested Suppliers)**
- 🔍 **ที่มา**: พัสดุค้นหาและเสนอแนะ
- 📝 **สถานะ**: ยังไม่มีรหัสผู้ขาย (Unofficial)
- 🎯 **วัตถุประสงค์**: ให้แผนกจัดซื้อพิจารณาเลือก
- 🔄 **การพัฒนา**: สามารถเลื่อนสถานะเป็น vendor ได้

### **2. ผู้ขายที่มีรหัส (Official Vendors)**
- ✅ **ที่มา**: ได้รับการอนุมัติจากแผนกจัดซื้อแล้ว
- 🏷️ **สถานะ**: มีรหัสผู้ขายแล้ว (Official)
- 💼 **การใช้งาน**: ใช้ในการสั่งซื้อจริง
- 📊 **การจัดการ**: มีข้อมูลครบถ้วน รวมถึงเครดิต ประวัติ

---

## 🏗️ **โครงสร้างฐานข้อมูล**

### **ตาราง 1: `tbl_inv_suggested_suppliers`**
```sql
-- ผู้จำหน่ายที่พัสดุเสนอแนะ (ยังไม่มีรหัส)
```

**ฟิลด์สำคัญ:**
- `supplier_name`: ชื่อผู้จำหน่าย
- `source_type`: ที่มาของการเสนอ (STOCK_RESEARCH, RECOMMENDATION, etc.)
- `evaluation_status`: สถานะการพิจารณา (PENDING, APPROVED_FOR_QUOTE, etc.)
- `promoted_to_vendor_id`: เชื่อมโยงถ้าเลื่อนเป็น vendor แล้ว

### **ตาราง 2: `tbl_inv_vendors`**
```sql
-- ผู้ขายที่มีรหัสแล้ว (Official)
```

**ฟิลด์สำคัญ:**
- `vendor_code`: รหัสผู้ขาย (VEN001, VEN002, ...)
- `vendor_name`: ชื่อผู้ขาย
- `vendor_status`: สถานะ (ACTIVE, INACTIVE, SUSPENDED, BLACKLISTED)
- `credit_limit`: วงเงินเครดิต
- `evaluation_score`: คะแนนประเมินโดยรวม

### **ตาราง 3: `tbl_inv_draft_pr_suppliers` (ปรับปรุง)**
```sql
-- รองรับทั้ง 2 ประเภทผู้จำหน่าย
```

**ฟิลด์สำคัญ:**
- `supplier_type`: ประเภท ('VENDOR' หรือ 'SUGGESTED_SUPPLIER')
- `vendor_id`: อ้างอิง vendor (ถ้าเป็น VENDOR)
- `suggested_supplier_id`: อ้างอิง suggested supplier (ถ้าเป็น SUGGESTED_SUPPLIER)

### **ตาราง 4: `tbl_inv_supplier_promotion_logs`**
```sql
-- ประวัติการเลื่อนสถานะจาก suggested → vendor
```

---

## 🔄 **Workflow การใช้งาน**

### **ขั้นตอนที่ 1: พัสดุเสนอผู้จำหน่าย**
```
1. พัสดุค้นหาผู้จำหน่าย
2. เพิ่มข้อมูลลง tbl_inv_suggested_suppliers
3. สถานะ = PENDING
```

### **ขั้นตอนที่ 2: เพิ่มใน Draft-PR**
```
1. เลือก suggested supplier ใส่ใน draft-pr
2. supplier_type = 'SUGGESTED_SUPPLIER'
3. เปรียบเทียบราคา/เงื่อนไข
```

### **ขั้นตอนที่ 3: จัดซื้อเลือกผู้จำหน่าย**
```
ถ้าจัดซื้อเลือก suggested supplier:
1. Admin สร้างรหัสผู้ขาย (VEN001, VEN002, ...)
2. เพิ่มข้อมูลลง tbl_inv_vendors
3. อัพเดท tbl_inv_suggested_suppliers:
   - evaluation_status = 'PROMOTED_TO_VENDOR'
   - promoted_to_vendor_id = vendor_id ใหม่
4. บันทึกประวัติใน tbl_inv_supplier_promotion_logs
```

### **ขั้นตอนที่ 4: ใช้งานต่อไป**
```
draft-pr ใหม่ๆ สามารถใช้:
- suggested suppliers (ยังไม่มีรหัส)
- vendors (มีรหัสแล้ว)
```

---

## 📊 **Views สำหรับการใช้งาน**

### **1. `vw_all_suppliers`**
รวมผู้จำหน่ายทั้ง 2 ประเภท:
```sql
SELECT * FROM vw_all_suppliers 
WHERE supplier_type = 'VENDOR'  -- เฉพาะ vendors
ORDER BY supplier_name;
```

### **2. `vw_draft_pr_suppliers_detail`**
ข้อมูล draft-pr suppliers พร้อมรายละเอียด:
```sql
SELECT * FROM vw_draft_pr_suppliers_detail 
WHERE draft_pr_id = 'DPR25010001';
```

---

## 🎨 **ข้อดีของการออกแบบนี้**

### **✅ ความยืดหยุ่น**
- รองรับผู้จำหน่ายใหม่ที่ยังไม่มีรหัส
- สามารถเลื่อนสถานะได้เมื่อได้รับการอนุมัติ

### **✅ ความปลอดภัย**
- แยก vendor จริงออกจาก suggested supplier
- ป้องกันการใช้ผู้จำหน่ายที่ไม่ได้รับอนุมัติ

### **✅ การติดตาม**
- มีประวัติการเลื่อนสถานะ
- ติดตามประสิทธิภาพได้

### **✅ ไม่ซ้ำซ้อน**
- ข้อมูลแยกชัดเจน
- ไม่มีข้อมูลซ้ำระหว่าง 2 ประเภท

---

## 🔧 **การใช้งานในโค้ด**

### **เพิ่ม Suggested Supplier**
```javascript
const newSuggestedSupplier = {
    supplier_name: 'บริษัท ABC จำกัด',
    contact_person: 'คุณสมชาย',
    phone: '02-123-4567',
    source_type: 'STOCK_RESEARCH',
    source_description: 'ค้นหาจากการวิจัยราคา',
    suggested_by_user_id: 'STOCK001'
};
```

### **เพิ่มใน Draft-PR**
```javascript
const draftPRSupplier = {
    draft_pr_id: 'DPR25010001',
    supplier_type: 'SUGGESTED_SUPPLIER',
    suggested_supplier_id: 123,
    quoted_unit_price: 50.00,
    // ... ข้อมูลอื่นๆ
};
```

### **การเลื่อนสถานะ**
```javascript
// เมื่อ Admin สร้าง vendor code
const promotedVendor = {
    vendor_code: 'VEN003',
    vendor_name: 'บริษัท ABC จำกัด',
    // ... copy ข้อมูลจาก suggested supplier
};

// อัพเดท suggested supplier
UPDATE tbl_inv_suggested_suppliers 
SET evaluation_status = 'PROMOTED_TO_VENDOR',
    promoted_to_vendor_id = new_vendor_id
WHERE id = suggested_supplier_id;
```

---

## 🚀 **ขั้นตอนการ Deploy**

1. **รัน SQL Script:**
   ```bash
   mysql -u username -p database_name < redesign_supplier_system.sql
   ```

2. **อัพเดท Controller:**
   - แก้ไข StockController ให้รองรับ 2 ประเภท
   - เพิ่มฟังก์ชันการเลื่อนสถานะ

3. **อัพเดท Frontend:**
   - UI สำหรับเลือกประเภทผู้จำหน่าย
   - แสดงสถานะ vendor/suggested

4. **Test:**
   - ทดสอบการเพิ่ม suggested supplier
   - ทดสอบการเลื่อนสถานะ
   - ทดสอบ constraint ต่างๆ

---

## 🔍 **ตัวอย่างการ Query**

### **หาผู้จำหน่ายทั้งหมดสำหรับ Draft-PR**
```sql
SELECT supplier_type, supplier_id, supplier_name, supplier_code
FROM vw_all_suppliers 
WHERE status IN ('ACTIVE', 'APPROVED_FOR_QUOTE')
ORDER BY classification DESC, supplier_name;
```

### **ติดตามการเลื่อนสถานะ**
```sql
SELECT ss.supplier_name, v.vendor_code, spl.promotion_reason, spl.date_promoted
FROM tbl_inv_supplier_promotion_logs spl
JOIN tbl_inv_suggested_suppliers ss ON spl.suggested_supplier_id = ss.id
JOIN tbl_inv_vendors v ON spl.vendor_id = v.id
ORDER BY spl.date_promoted DESC;
```

### **สถิติการใช้งาน**
```sql
SELECT 
    supplier_type,
    COUNT(*) as usage_count,
    AVG(quoted_total_price) as avg_price
FROM vw_draft_pr_suppliers_detail 
WHERE is_removed = 0
GROUP BY supplier_type;
```

---

## 💡 **ข้อเสนอแนะเพิ่มเติม**

1. **Auto-Promotion**: สร้างกฎอัตโนมัติสำหรับการเลื่อนสถานะ
2. **Performance Tracking**: ติดตามประสิทธิภาพผู้จำหน่าย
3. **Integration**: เชื่อมต่อกับระบบ ERP ภายนอก
4. **Approval Workflow**: สร้าง workflow การอนุมัติผู้จำหน่าย

---

*📝 หมายเหตุ: ระบบนี้ออกแบบให้ยืดหยุ่นและสามารถขยายได้ในอนาคต* 