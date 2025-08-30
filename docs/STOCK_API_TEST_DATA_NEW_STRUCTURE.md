# ตัวอย่างข้อมูลทดสอบ Stock API (โครงสร้างใหม่)

## โครงสร้างผู้จำหน่ายใหม่

เราได้แยกตารางผู้จำหน่ายออกเป็น 2 ตาราง:
1. **`tbl_inv_draft_pr_official_suppliers`** - ผู้จำหน่ายที่มีรหัสแล้ว
2. **`tbl_inv_draft_pr_suggested_suppliers`** - ผู้จำหน่ายที่ยังไม่มีรหัส (เสนอใหม่)

## API: POST /api/inv/stock-create-draft-pr

### ตัวอย่างที่ 1: ผู้จำหน่ายผสม (มีรหัส + ไม่มีรหัส)

```json
{
  "source_requisition_id": "REQ2025010001",
  "source_item_sequence": 1,
  "source_item_id": 12345,
  
  "detailed_specification": "เครื่องวัดความดันโลหิตแบบดิจิตอล สำหรับผู้ป่วยเบาหวาน รองรับการเชื่อมต่อ Bluetooth",
  "estimated_unit_price": 2500.00,
  "estimated_total_price": 2500.00,
  
  "pr_title": "จัดซื้อเครื่องวัดความดันโลหิตแบบดิจิตอล",
  "purpose": "สำหรับใช้ในแผนกผู้ป่วยนอกเบาหวาน",
  "justification": "เครื่องเดิมชำรุดไม่สามารถใช้งานได้",
  "budget_source": "งบประมาณแผนกฯ ประจำปี 2568",
  "budget_year": "2568",
  "requested_delivery_date": "2025-02-15",
  "delivery_location": "แผนกผู้ป่วยนอก ชั้น 3",
  "special_requirements": "ต้องมีใบรับรองมาตรฐาน FDA",
  
  "suppliers": [
    {
      "type": "official",
      "supplier_id": 101,
      "quoted_unit_price": 2400.00,
      "quoted_total_price": 2400.00,
      "quotation_ref": "QT-2025-001",
      "quotation_date": "2025-01-20",
      "delivery_lead_time": 10,
      "payment_terms": "30 วัน",
      "warranty_period": "2 ปี",
      "supplier_notes": "ราคารวม VAT แล้ว มีบริการติดตั้งฟรี",
      "internal_notes": "ผู้จำหน่ายเดิมที่เคยซื้อ มีประสบการณ์ดี",
      "is_recommended": true,
      "recommendation_reason": "ราคาดี มีประสบการณ์จากการซื้อครั้งก่อน",
      "supplier_rank": 1,
      "quote_status": "RECEIVED",
      "quote_valid_until": "2025-02-20",
      "contact_person": "คุณสมชาย จันทร์เจริญ",
      "contact_phone": "089-123-4567",
      "contact_email": "somchai@medicalsupply.co.th"
    },
    {
      "type": "suggested",
      "suggested_supplier_name": "บริษัท เทคโนโลยีการแพทย์ใหม่ จำกัด",
      "contact_person": "คุณนันทนา เทคโนโลยี",
      "contact_phone": "092-987-6543",
      "contact_email": "nantana@newmedtech.com",
      "address": "123/45 ซ.ลาดพร้าว 101 แขวงคลองจั่น เขตบางกะปิ กรุงเทพฯ 10240",
      "tax_id": "0123456789012",
      "quoted_unit_price": 2200.00,
      "quoted_total_price": 2200.00,
      "quotation_ref": "NMT-Q-2025-012",
      "quotation_date": "2025-01-22",
      "delivery_lead_time": 7,
      "payment_terms": "เงินสด",
      "warranty_period": "3 ปี",
      "supplier_notes": "ผลิตภัณฑ์ใหม่ล่าสุด รับประกันนาน",
      "internal_notes": "ผู้จำหน่ายใหม่ ราคาดีกว่า แต่ยังไม่มีประสบการณ์",
      "is_recommended": false,
      "recommendation_reason": "",
      "supplier_rank": 2,
      "quote_status": "RECEIVED",
      "quote_valid_until": "2025-03-01"
    }
  ],
  
  "documents": [
    {
      "document_type_id": 1,
      "document_name": "ใบเสนอราคาจากผู้จำหน่าย A",
      "description": "ใบเสนอราคาจาก บริษัท อุปกรณ์การแพทย์",
      "file_name": "quotation_supplier_a.pdf"
    },
    {
      "document_type_id": 1,
      "document_name": "ใบเสนอราคาจากผู้จำหน่าย B",
      "description": "ใบเสนอราคาจาก บริษัท เทคโนโลยีการแพทย์ใหม่",
      "file_name": "quotation_supplier_b.pdf"
    },
    {
      "document_type_id": 2,
      "document_name": "ใบรับรองมาตรฐาน FDA",
      "description": "เอกสารรับรองมาตรฐานของผลิตภัณฑ์",
      "file_name": "fda_certificate.pdf"
    }
  ],
  
  "created_by_user_id": "STOCK001"
}
```

### ตัวอย่างที่ 2: ผู้จำหน่ายที่มีรหัสแล้วเท่านั้น

```json
{
  "source_requisition_id": "REQ2025010002",
  "source_item_sequence": 1,
  "source_item_id": 12346,
  
  "pr_title": "จัดซื้อยาพาราเซตามอล 500mg",
  "purpose": "สำหรับใช้ในคลังยา",
  "justification": "ยาใกล้หมด",
  
  "suppliers": [
    {
      "type": "official",
      "supplier_id": 205,
      "quoted_unit_price": 0.50,
      "quoted_total_price": 5000.00,
      "quotation_ref": "PHARMA-Q-001",
      "quotation_date": "2025-01-25",
      "delivery_lead_time": 3,
      "payment_terms": "15 วัน",
      "warranty_period": "ตามอายุของยา",
      "supplier_notes": "ยาคุณภาพ GPP",
      "is_recommended": true,
      "quote_status": "RECEIVED"
    },
    {
      "type": "official", 
      "supplier_id": 206,
      "quoted_unit_price": 0.48,
      "quoted_total_price": 4800.00,
      "quotation_ref": "MED-Q-789",
      "quotation_date": "2025-01-25",
      "delivery_lead_time": 5,
      "payment_terms": "30 วัน",
      "warranty_period": "ตามอายุของยา",
      "supplier_notes": "ยาคุณภาพ สต็อกพร้อม",
      "is_recommended": false,
      "quote_status": "RECEIVED"
    }
  ],
  
  "created_by_user_id": "STOCK001"
}
```

### ตัวอย่างที่ 3: ผู้จำหน่ายใหม่เท่านั้น

```json
{
  "source_requisition_id": "REQ2025010003", 
  "source_item_sequence": 1,
  "source_item_id": 12347,
  
  "pr_title": "จัดซื้ออุปกรณ์ทำความสะอาดพิเศษ",
  "purpose": "สำหรับห้องผ่าตัด",
  
  "suppliers": [
    {
      "type": "suggested",
      "suggested_supplier_name": "บริษัท คลีนโซลูชั่น โปร จำกัด",
      "contact_person": "คุณสุดา ทำความสะอาด",
      "contact_phone": "081-555-1234",
      "contact_email": "suda@cleansolution.com",
      "address": "555 ถ.รามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ",
      "tax_id": "9876543210987",
      "quoted_unit_price": 1500.00,
      "quoted_total_price": 1500.00,
      "quotation_ref": "CLEAN-2025-005",
      "quotation_date": "2025-01-26",
      "delivery_lead_time": 14,
      "payment_terms": "เงินสดก่อนส่งมอบ",
      "warranty_period": "6 เดือน",
      "supplier_notes": "ผลิตภัณฑ์นำเข้าจากญี่ปุ่น",
      "internal_notes": "ผู้จำหน่ายใหม่ มีสินค้าพิเศษที่หาที่อื่นไม่ได้",
      "is_recommended": true,
      "recommendation_reason": "มีสินค้าที่หาได้ยากและมีคุณภาพสูง",
      "quote_status": "RECEIVED"
    }
  ],
  
  "created_by_user_id": "STOCK001"
}
```

## Response ที่คาดหวัง

```json
{
  "success": true,
  "message": "สร้างร่าง PR เรียบร้อยแล้ว รอหัวหน้าพัสดุอนุมัติ",
  "data": {
    "draftPRId": "DPR2025010001",
    "source_requisition_id": "REQ2025010001",
    "source_item_sequence": 1,
    "pr_title": "จัดซื้อเครื่องวัดความดันโลหิตแบบดิจิตอล",
    "status": "STOCK_DRAFT_PR_PENDING",
    "estimated_total_price": 2500.00,
    "suppliers_added": 2,
    "total_suppliers_sent": 2,
    "documents_added": 3,
    "total_documents_sent": 3
  }
}
```

## ความแตกต่างจากโครงสร้างเดิม

### เปลี่ยนแปลงหลัก:
1. **type**: `'existing'` → `'official'`, `'new'` → `'suggested'`
2. **supplier_name** → **suggested_supplier_name** (สำหรับผู้จำหน่ายใหม่)
3. เพิ่มฟิลด์ **tax_id** สำหรับผู้จำหน่ายใหม่
4. เพิ่มฟิลด์ **internal_notes** สำหรับหมายเหตุภายใน

### ข้อดีของโครงสร้างใหม่:
- **แยกข้อมูลชัดเจน**: ผู้จำหน่ายที่มีรหัสกับไม่มีรหัสไม่ปนกัน
- **Foreign Key ถูกต้อง**: ไม่มีปัญหา ID ที่ยังไม่มีจริง  
- **การจัดการง่าย**: สามารถ query แยกประเภทได้โดยตรง
- **ความยืดหยุ่น**: ขยายโครงสร้างได้ง่ายในอนาคต
- **การติดตามสถานะ**: ผู้จำหน่ายใหม่มีสถานะการอนุมัติแยก

## การใช้ View สำหรับดูข้อมูลรวม

สามารถใช้ `view_draft_pr_all_suppliers` เพื่อดูผู้จำหน่ายทั้งสองประเภทรวมกัน:

```sql
SELECT * FROM view_draft_pr_all_suppliers 
WHERE draft_pr_id = 'DPR2025010001' 
  AND is_removed = 0
ORDER BY supplier_rank ASC, is_recommended DESC;
``` 