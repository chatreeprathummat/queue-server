# 📋 คู่มือการใช้งาน Stored Procedures สำหรับจัดการผู้จำหน่าย

## 🚀 **วิธีการติดตั้ง**

### 1. รันไฟล์ SQL เพื่อสร้าง Stored Procedures
```bash
# เข้า MySQL
mysql -u username -p database_name

# รันไฟล์
source /path/to/inventory-server2/sql/add_stored_procedures_for_suppliers.sql;
```

### 2. ตรวจสอบว่าสร้างเรียบร้อยแล้ว
```sql
-- ดู stored procedures ที่มี
SHOW PROCEDURE STATUS WHERE Db = 'your_database_name';

-- ดู triggers ที่มี
SHOW TRIGGERS;
```

---

## 📊 **Stored Procedures ที่สร้าง**

### 1. **UpdateDraftPRSupplierSummary(draft_pr_id)**
อัพเดทข้อมูลสรุปผู้จำหน่ายในตาราง `tbl_inv_draft_pr`

**การทำงาน:**
- นับจำนวนผู้จำหน่ายที่ยังใช้งาน
- หาผู้จำหน่ายที่แนะนำ (rank = 1 หรือ is_recommended = 1)
- หาราคาต่ำสุดและสูงสุด
- อัพเดทข้อมูลในตาราง draft-pr

**ตัวอย่างการใช้:**
```sql
CALL UpdateDraftPRSupplierSummary('DPR25010001');
```

### 2. **GetDraftPRSuppliersWithSummary(draft_pr_id)**
ดึงข้อมูล draft-pr พร้อมรายการผู้จำหน่ายและข้อมูลสรุป

**คืนค่า:** 2 Result Sets
- Set 1: ข้อมูล draft-pr พร้อมสรุป
- Set 2: รายการผู้จำหน่ายทั้งหมด

**ตัวอย่างการใช้:**
```sql
CALL GetDraftPRSuppliersWithSummary('DPR25010001');
```

### 3. **CompareDraftPRSupplierPrices(draft_pr_id)**
เปรียบเทียบราคาและให้คะแนนผู้จำหน่าย

**การคำนวณคะแนน:**
- **ราคา (40%)**: ยิ่งถูกยิ่งได้คะแนนสูง
- **คุณภาพ (30%)**: จากคะแนนประเมิน (0-10)
- **ความเร็วในการส่ง (20%)**: ยิ่งเร็วยิ่งดี
- **เงื่อนไขการชำระ (10%)**: 30 วัน = 70 คะแนน, 15 วัน = 50 คะแนน

**ตัวอย่างการใช้:**
```sql
CALL CompareDraftPRSupplierPrices('DPR25010001');
```

### 4. **RecommendBestSupplier(draft_pr_id, criteria)**
แนะนำผู้จำหน่ายที่ดีที่สุดตามเกณฑ์

**เกณฑ์ที่รองรับ:**
- `'PRICE'`: เลือกราคาถูกที่สุด
- `'QUALITY'`: เลือกคุณภาพดีที่สุด
- `'SPEED'`: เลือกส่งเร็วที่สุด
- `'BALANCED'`: เลือกคะแนนรวมสูงสุด (แนะนำ)

**ตัวอย่างการใช้:**
```sql
-- แนะนำแบบสมดุล
CALL RecommendBestSupplier('DPR25010001', 'BALANCED');

-- แนะนำราคาถูกที่สุด
CALL RecommendBestSupplier('DPR25010001', 'PRICE');
```

---

## 🔄 **Triggers ที่สร้าง**

### 1. **tr_draft_pr_suppliers_after_insert**
เมื่อเพิ่มผู้จำหน่ายใหม่ → อัพเดทข้อมูลสรุปอัตโนมัติ

### 2. **tr_draft_pr_suppliers_after_update**
เมื่อแก้ไขข้อมูลผู้จำหน่าย → อัพเดทข้อมูลสรุปอัตโนมัติ

### 3. **tr_draft_pr_suppliers_after_delete**
เมื่อลบผู้จำหน่าย → อัพเดทข้อมูลสรุปอัตโนมัติ

---

## 🔗 **การใช้ใน Node.js Controllers**

### 1. **เปรียบเทียบราคา**
```javascript
// GET /api/stock/draft-pr/:draftPrId/compare-prices
const result = await connection.execute(
    `CALL CompareDraftPRSupplierPrices(?)`,
    [draftPrId]
);
```

### 2. **แนะนำผู้จำหน่าย**
```javascript
// POST /api/stock/draft-pr/:draftPrId/recommend-supplier
// Body: { criteria: 'BALANCED', recommended_by_user_id: 'USER001' }
const result = await connection.execute(
    `CALL RecommendBestSupplier(?, ?)`,
    [draftPrId, criteria]
);
```

### 3. **อัพเดทข้อมูลสรุป**
```javascript
// POST /api/stock/draft-pr/:draftPrId/update-summary
await connection.execute(
    `CALL UpdateDraftPRSupplierSummary(?)`,
    [draftPrId]
);
```

---

## 📈 **ตัวอย่างผลลัพธ์**

### 1. **การเปรียบเทียบราคา**
```json
{
  "supplier_name": "บริษัท ABC จำกัด",
  "quoted_total_price": 15000.00,
  "price_diff_from_lowest": 2000.00,
  "percent_higher_than_lowest": 15.38,
  "total_score": 85.5,
  "delivery_lead_time": 7,
  "evaluation_score": 8.5
}
```

### 2. **การแนะนำผู้จำหน่าย**
```json
{
  "recommended_supplier_id": 123,
  "supplier_name": "บริษัท XYZ จำกัด",
  "criteria_used": "BALANCED",
  "status": "อัพเดทเรียบร้อยแล้ว"
}
```

---

## ⚠️ **ข้อสำคัญ**

### 1. **การทำงานของ Triggers**
- Triggers จะทำงานอัตโนมัติเมื่อมีการเปลี่ยนแปลงข้อมูลผู้จำหน่าย
- ไม่จำเป็นต้องเรียก `UpdateDraftPRSupplierSummary` ด้วยตนเอง
- หากต้องการ refresh ข้อมูล ให้เรียกใช้ stored procedure นี้

### 2. **การจัดการ Error**
```javascript
try {
    const [result] = await connection.execute(
        `CALL UpdateDraftPRSupplierSummary(?)`,
        [draftPrId]
    );
} catch (error) {
    if (error.code === 'ER_SP_DOES_NOT_EXIST') {
        console.error('Stored procedure ไม่มีอยู่');
    }
    // จัดการ error อื่นๆ
}
```

### 3. **การ Monitor Performance**
```sql
-- ดูสถิติการใช้งาน stored procedures
SELECT * FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = 'your_database_name' 
  AND ROUTINE_TYPE = 'PROCEDURE';

-- ดู execution time
SHOW PROFILES;
```

---

## 🛠️ **การบำรุงรักษา**

### 1. **การลบ Stored Procedures (หากจำเป็น)**
```sql
DROP PROCEDURE IF EXISTS UpdateDraftPRSupplierSummary;
DROP PROCEDURE IF EXISTS GetDraftPRSuppliersWithSummary;
DROP PROCEDURE IF EXISTS CompareDraftPRSupplierPrices;
DROP PROCEDURE IF EXISTS RecommendBestSupplier;
```

### 2. **การลบ Triggers (หากจำเป็น)**
```sql
DROP TRIGGER IF EXISTS tr_draft_pr_suppliers_after_insert;
DROP TRIGGER IF EXISTS tr_draft_pr_suppliers_after_update;
DROP TRIGGER IF EXISTS tr_draft_pr_suppliers_after_delete;
```

### 3. **การแก้ไข Stored Procedures**
```sql
-- ใช้ DROP แล้ว CREATE ใหม่
DROP PROCEDURE IF EXISTS UpdateDraftPRSupplierSummary;

DELIMITER //
CREATE PROCEDURE UpdateDraftPRSupplierSummary(...)
-- โค้ดใหม่
END //
DELIMITER ;
```

---

## 🎯 **Tips การใช้งาน**

1. **ใช้ BALANCED criteria**: ให้ผลลัพธ์ที่ดีที่สุดในหลายๆ ด้าน
2. **ตรวจสอบข้อมูลก่อน**: ให้แน่ใจว่าผู้จำหน่ายมีข้อมูลครบถ้วน
3. **ใช้ Manual update**: เมื่อต้องการ refresh ข้อมูลสรุป
4. **Monitor performance**: ติดตามการทำงานของ triggers
5. **Backup procedures**: สำรองไฟล์ SQL สำหรับ deploy production 