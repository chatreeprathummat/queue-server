# Database Constraints Setup

## ไฟล์ SQL สำหรับตั้งค่า Unique Constraints

### ไฟล์ที่ต้องรัน:
- `add_unique_constraints.sql` - เพิ่ม Unique Constraints และ Check Constraints

### Constraints ที่เพิ่ม:

#### 1. Unique Constraints
- **`uk_requisition_item_sequence`** - ป้องกัน `item_sequence` ซ้ำในคำขอเบิกเดียวกัน
  - ตาราง: `tbl_inv_requisition_items`
  - ฟิลด์: `(requisition_id, item_sequence)`

- **`uk_requisition_document_type`** - ป้องกันเลือกเอกสารประเภทเดียวกันซ้ำ
  - ตาราง: `tbl_inv_requisition_document_types`
  - ฟิลด์: `(requisition_id, document_type_id)`

#### 2. Check Constraints
- **`chk_item_sequence_positive`** - `item_sequence` ต้องมากกว่า 0
- **`chk_quantity_positive`** - `quantity` ต้องมากกว่า 0
- **`chk_price_non_negative`** - `price` ต้องมากกว่าหรือเท่ากับ 0

#### 3. Index เพิ่มประสิทธิภาพ
- **`idx_requisition_items_lookup`** - สำหรับการค้นหา `(requisition_id, item_sequence)`

### วิธีการรัน:

1. เชื่อมต่อฐานข้อมูล MySQL
2. รันไฟล์ `add_unique_constraints.sql`
3. ตรวจสอบ constraints ที่สร้างแล้ว:

```sql
SHOW CREATE TABLE tbl_inv_requisition_items;
SHOW CREATE TABLE tbl_inv_requisition_document_types;
```

### ผลกระทบต่อ Application:

#### ✅ ข้อดี:
- ป้องกันข้อมูลซ้ำซ้อนที่ระดับฐานข้อมูล
- Error ชัดเจนเมื่อมีการบันทึกข้อมูลซ้ำ
- ประสิทธิภาพการค้นหาดีขึ้น

#### ⚠️ ข้อควรระวัง:
- Controller ต้องจัดการ `ER_DUP_ENTRY` error
- Frontend ต้องส่ง `item_sequence` ที่ไม่ซ้ำ
- ต้องตรวจสอบข้อมูลเก่าที่อาจขัดแย้งก่อนรัน script

### Error Handling ใน Controller:

Controller ได้รับการปรับปรุงให้จัดการ Unique Constraint Errors:

```typescript
catch (dbError: any) {
    if (dbError.code === 'ER_DUP_ENTRY' && dbError.sqlMessage?.includes('uk_requisition_item_sequence')) {
        throw new Error(`ลำดับรายการ ${item.item_sequence} ซ้ำกัน กรุณาใช้ลำดับที่ไม่ซ้ำกัน`);
    }
    throw dbError;
}
```

### Frontend Guidelines:

#### สำหรับ Create Request:
```json
{
  "items": [
    {"item_sequence": 1, "description": "ถุงมือ", ...},
    {"item_sequence": 2, "description": "เข็มฉีดยา", ...}
  ]
}
```

#### สำหรับ Update Request:
```json
{
  "items": [
    {"action": "add", "item_sequence": 3, "description": "ผ้าพันแผล", ...},
    {"action": "update", "item_sequence": 1, "description": "ถุงมือยางปลอดเชื้อ", ...},
    {"action": "delete", "item_sequence": 2, "delete_reason": "ไม่ต้องการแล้ว"}
  ]
}
```

### การทดสอบ:

1. ทดสอบสร้างรายการซ้ำ item_sequence
2. ทดสอบเลือกเอกสารประเภทเดียวกันซ้ำ
3. ทดสอบค่าติดลบใน quantity/price
4. ตรวจสอบ Error Messages ที่เหมาะสม 