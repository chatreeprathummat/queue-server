# 📋 ตัวอย่างข้อมูลทดสอบ API ฟังก์ชันพัสดุ (Postman)

## 🔧 **การตั้งค่า Environment ใน Postman**

```json
{
  "name": "Inventory System - Stock",
  "values": [
    {
      "key": "base_url",
      "value": "http://localhost:3000/api/stock",
      "enabled": true
    },
    {
      "key": "auth_token",
      "value": "your_jwt_token_here",
      "enabled": true
    },
    {
      "key": "user_id",
      "value": "STOCK001",
      "enabled": true
    }
  ]
}
```

---

## 1. 📝 **สร้างร่าง PR** 
### `POST {{base_url}}/create-draft-pr`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "source_requisition_id": "REQ25010001",
  "source_item_sequence": 1,
  "source_item_id": 12345,
  
  "detailed_specification": "แท็บเล็ต Paracetamol 500mg ยี่ห้อ GPO แพ็ค 10 เม็ด มีใบรับรองจาก อย. ไม่หมดอายุก่อน 2 ปี",
  "estimated_unit_price": 25.50,
  "estimated_total_price": 1275.00,
  "suggested_supplier_id": 15,
  "supplier_notes": "ผู้จำหน่ายหลัก ราคาดี มีใบรับรอง GMP",
  
  "pr_title": "ขอซื้อยา Paracetamol สำหรับแผนกอายุรกรรม",
  "purpose": "ใช้สำหรับรักษาผู้ป่วยในแผนกอายุรกรรม",
  "justification": "ยาเก่าใกล้หมดอายุ จำเป็นต้องเติมสต็อกเพื่อความต่อเนื่องในการรักษา",
  "budget_source": "งบประมาณยา",
  "budget_year": "2568",
  "requested_delivery_date": "2025-02-15",
  "delivery_location": "โรงพยาบาล ห้องเก็บยา ชั้น 2",
  "special_requirements": "ต้องการใบรับรองคุณภาพ และเก็บในอุณหภูมิห้อง",
  
  "created_by_user_id": "{{user_id}}"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "สร้างร่าง PR เรียบร้อยแล้ว รอหัวหน้าพัสดุอนุมัติ",
  "data": {
    "draftPRId": "DPR25010001",
    "source_requisition_id": "REQ25010001",
    "source_item_sequence": 1,
    "pr_title": "ขอซื้อยา Paracetamol สำหรับแผนกอายุรกรรม",
    "status": "STOCK_DRAFT_PR_PENDING",
    "estimated_total_price": 1275.00
  }
}
```

---

## 2. ❌ **ปฏิเสธรายการ**
### `POST {{base_url}}/reject-item`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "source_requisition_id": "REQ25010002",
  "source_item_sequence": 2,
  "source_item_id": 12346,
  "reason": "ข้อมูลไม่ครบถ้วน ขาดรายละเอียดขนาดบรรจุและยี่ห้อที่ต้องการ กรุณาระบุข้อมูลเพิ่มเติม",
  "rejected_by_user_id": "{{user_id}}"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "ปฏิเสธรายการเรียบร้อยแล้ว จะส่งกลับไปยังหน่วยงานขอเบิก",
  "data": {
    "source_requisition_id": "REQ25010002",
    "source_item_sequence": 2,
    "source_item_id": 12346,
    "item_description": "เครื่องวัดความดัน",
    "status": "STOCK_REJECTED_BY_STOCK",
    "reason": "ข้อมูลไม่ครบถ้วน ขาดรายละเอียดขนาดบรรจุและยี่ห้อที่ต้องการ"
  }
}
```

---

## 3. 📋 **ดูรายการที่รอดำเนินการ**
### `GET {{base_url}}/pending-items?page=1&itemsPerPage=10`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "item_id": 12345,
        "requisition_id": "REQ25010001",
        "item_sequence": 1,
        "description": "แท็บเล็ต Paracetamol 500mg",
        "unit": "กล่อง",
        "quantity": 50,
        "request_date": "2025-01-15",
        "department_code": "MED001",
        "DepartmentName": "แผนกอายุรกรรม",
        "request_username": "DOC001",
        "urgency": "HIGH",
        "material_category": "MEDICINE",
        "current_status_code": "STOCK_PENDING_RECEIVE",
        "current_status_since": "2025-01-15T10:30:00.000Z",
        "last_comment": "รอพัสดุดำเนินการ",
        "status_name_th": "รอแผนกพัสดุรับเรื่อง",
        "status_color": "#FFA500",
        "has_draft_pr": false,
        "draft_pr": null
      }
    ],
    "pagination": {
      "page": 1,
      "itemsPerPage": 10,
      "total": 5
    }
  }
}
```

---

## 4. ✅ **หัวหน้าพัสดุอนุมัติร่าง PR**
### `POST {{base_url}}/manager/approve-draft-pr/DPR25010001`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "comment": "อนุมัติร่าง PR ราคาเหมาะสม ส่งไปแผนกจัดซื้อดำเนินการต่อ",
  "approved_by_user_id": "STOCK_MGR01"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "อนุมัติร่าง PR และส่งไปแผนกจัดซื้อเรียบร้อยแล้ว",
  "data": {
    "draftPRId": "DPR25010001",
    "pr_title": "ขอซื้อยา Paracetamol สำหรับแผนกอายุรกรรม",
    "source_requisition_id": "REQ25010001",
    "source_item_sequence": 1,
    "status": "STOCK_DRAFT_PR_APPROVED",
    "forwarded_to": "PURCHASE_DEPARTMENT",
    "approved_by": "STOCK_MGR01",
    "approved_date": "2025-01-15T14:30:00.000Z",
    "estimated_total_price": 1275.00
  }
}
```

---

## 5. 📋 **หัวหน้าพัสดุดูรายการร่าง PR ที่รออนุมัติ**
### `GET {{base_url}}/manager/pending-draft-prs?page=1&itemsPerPage=10`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "draft_prs": [
      {
        "id": "DPR25010002",
        "source_requisition_id": "REQ25010003",
        "source_item_sequence": 1,
        "pr_title": "ขอซื้อเครื่องมือแพทย์",
        "estimated_total_price": 45000.00,
        "current_status": "STOCK_DRAFT_PR_PENDING",
        "date_created": "2025-01-15T08:00:00.000Z",
        "department_code": "SUR001",
        "DepartmentName": "แผนกศัลยกรรม",
        "request_username": "NURSE002",
        "urgency": "MEDIUM",
        "status_name_th": "ร่าง PR รอหัวหน้าพัสดุอนุมัติ",
        "status_color": "#FF8C00",
        "supplier_name": "บริษัท เมดิคอล ซัพพลาย จำกัด"
      }
    ],
    "pagination": {
      "page": 1,
      "itemsPerPage": 10,
      "total": 3
    }
  }
}
```

---

## 6. ➕ **เพิ่มผู้จำหน่ายในร่าง PR**
### `POST {{base_url}}/draft-pr/DPR25010001/suppliers`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "supplier_id": 20,
  "quoted_unit_price": 28.00,
  "quoted_total_price": 1400.00,
  "quotation_ref": "QT-2025-001",
  "quotation_date": "2025-01-10",
  "delivery_lead_time": 7,
  "payment_terms": "เครดิต 30 วัน",
  "warranty_period": "12 เดือน",
  "supplier_notes": "มีใบรับรอง ISO สินค้าคุณภาพสูง",
  "evaluation_score": 8.5,
  "evaluation_criteria": {
    "quality": 9,
    "price": 7,
    "service": 9,
    "delivery": 8
  },
  "is_recommended": true,
  "recommendation_reason": "ราคาแข่งขันได้ คุณภาพดี",
  "supplier_rank": 1,
  "quote_status": "RECEIVED",
  "quote_valid_until": "2025-02-28",
  "contact_person": "คุณสมชาย ใจดี",
  "contact_phone": "02-123-4567",
  "contact_email": "somchai@supplier.com",
  "added_by_user_id": "{{user_id}}"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "เพิ่มผู้จำหน่ายในร่าง PR เรียบร้อยแล้ว",
  "data": {
    "supplier_entry_id": 101,
    "draft_pr_id": "DPR25010001",
    "supplier_name": "บริษัท เฮลท์แคร์ ซัพพลาย จำกัด",
    "is_recommended": true,
    "quoted_total_price": 1400.00
  }
}
```

---

## 7. ✏️ **แก้ไขข้อมูลผู้จำหน่าย**
### `PUT {{base_url}}/draft-pr/DPR25010001/suppliers/101`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "quoted_unit_price": 26.50,
  "quoted_total_price": 1325.00,
  "quotation_ref": "QT-2025-001-REV1",
  "delivery_lead_time": 5,
  "evaluation_score": 9.0,
  "is_recommended": true,
  "recommendation_reason": "ปรับราคาลงได้ และส่งเร็วขึ้น",
  "supplier_rank": 1,
  "quote_status": "RECEIVED",
  "contact_phone": "02-123-4568",
  "updated_by_user_id": "{{user_id}}"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "อัพเดทข้อมูลผู้จำหน่ายเรียบร้อยแล้ว",
  "data": {
    "supplier_entry_id": 101,
    "draft_pr_id": "DPR25010001",
    "supplier_name": "บริษัท เฮลท์แคร์ ซัพพลาย จำกัด",
    "changes": [
      "quoted_unit_price: 28.00 → 26.50",
      "quoted_total_price: 1400.00 → 1325.00",
      "delivery_lead_time: 7 → 5"
    ],
    "updated_fields": 6
  }
}
```

---

## 8. 🗑️ **ลบผู้จำหน่าย**
### `DELETE {{base_url}}/draft-pr/DPR25010001/suppliers/102`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "remove_reason": "ผู้จำหน่ายไม่สามารถส่งของได้ตามกำหนด",
  "removed_by_user_id": "{{user_id}}"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "ลบผู้จำหน่ายออกจากร่าง PR เรียบร้อยแล้ว",
  "data": {
    "supplier_entry_id": 102,
    "draft_pr_id": "DPR25010001",
    "supplier_name": "บริษัท สโลว์ ดีลิเวอรี่ จำกัด",
    "remove_reason": "ผู้จำหน่ายไม่สามารถส่งของได้ตามกำหนด"
  }
}
```

---

## 9. 👀 **ดูรายการผู้จำหน่ายทั้งหมด**
### `GET {{base_url}}/draft-pr/DPR25010001/suppliers`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "ดึงข้อมูลผู้จำหน่ายเรียบร้อยแล้ว",
  "data": {
    "draft_pr": {
      "id": "DPR25010001",
      "description": "แท็บเล็ต Paracetamol 500mg",
      "estimated_unit_price": 25.50,
      "estimated_total_price": 1275.00,
      "total_suppliers_count": 2,
      "supplier_summary": "มีผู้จำหน่าย 2 ราย",
      "recommended_supplier_name": "บริษัท เฮลท์แคร์ ซัพพลาย จำกัด"
    },
    "suppliers": [
      {
        "id": 101,
        "supplier_id": 20,
        "supplier_name": "บริษัท เฮลท์แคร์ ซัพพลาย จำกัด",
        "quoted_unit_price": 26.50,
        "quoted_total_price": 1325.00,
        "delivery_lead_time": 5,
        "is_recommended": true,
        "supplier_rank": 1,
        "quote_status": "RECEIVED",
        "rank_display": "แนะนำ",
        "quote_status_display": "ได้รับใบเสนอราคาแล้ว"
      }
    ],
    "total_suppliers": 2,
    "recommended_suppliers": 1,
    "quotes_received": 2
  }
}
```

---

## 10. 📊 **เปรียบเทียบราคาผู้จำหน่าย**
### `GET {{base_url}}/draft-pr/DPR25010001/compare-prices`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "เปรียบเทียบราคาเรียบร้อยแล้ว",
  "data": {
    "draft_pr": {
      "id": "DPR25010001",
      "pr_title": "ขอซื้อยา Paracetamol สำหรับแผนกอายุรกรรม"
    },
    "price_comparison": [
      {
        "supplier_id": 20,
        "supplier_name": "บริษัท เฮลท์แคร์ ซัพพลาย จำกัด",
        "quoted_unit_price": 26.50,
        "quoted_total_price": 1325.00,
        "delivery_lead_time": 5,
        "evaluation_score": 9.0,
        "is_recommended": true,
        "supplier_rank": 1,
        "price_diff_from_lowest": 0.00,
        "percent_higher_than_lowest": 0.00,
        "total_score": 92.5
      },
      {
        "supplier_id": 25,
        "supplier_name": "บริษัท เมดิซีน เซ็นเตอร์ จำกัด",
        "quoted_unit_price": 29.00,
        "quoted_total_price": 1450.00,
        "delivery_lead_time": 10,
        "evaluation_score": 7.5,
        "is_recommended": false,
        "supplier_rank": 2,
        "price_diff_from_lowest": 125.00,
        "percent_higher_than_lowest": 9.43,
        "total_score": 78.2
      }
    ],
    "summary": {
      "total_suppliers": 2,
      "has_prices": 2,
      "has_scores": 2
    }
  }
}
```

---

## 11. 🎯 **แนะนำผู้จำหน่ายที่ดีที่สุด**
### `POST {{base_url}}/draft-pr/DPR25010001/recommend-supplier`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "criteria": "BALANCED",
  "recommended_by_user_id": "{{user_id}}"
}
```

**ตัวเลือก criteria:**
- `"PRICE"` - เลือกราคาถูกที่สุด
- `"QUALITY"` - เลือกคุณภาพดีที่สุด  
- `"SPEED"` - เลือกส่งเร็วที่สุด
- `"BALANCED"` - เลือกคะแนนรวมสูงสุด (แนะนำ)

**Expected Response:**
```json
{
  "success": true,
  "message": "ระบบแนะนำผู้จำหน่ายเรียบร้อยแล้ว",
  "data": {
    "draft_pr": {
      "id": "DPR25010001",
      "pr_title": "ขอซื้อยา Paracetamol สำหรับแผนกอายุรกรรม"
    },
    "recommendation": {
      "recommended_supplier_id": 20,
      "supplier_name": "บริษัท เฮลท์แคร์ ซัพพลาย จำกัด",
      "criteria_used": "BALANCED",
      "status": "อัพเดทเรียบร้อยแล้ว"
    },
    "criteria_used": "BALANCED",
    "recommended_by": "STOCK001"
  }
}
```

---

## 12. 🔄 **อัพเดทข้อมูลสรุปผู้จำหน่าย**
### `POST {{base_url}}/draft-pr/DPR25010001/update-summary`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body:** (ไม่ต้องส่งข้อมูล)
```json
{}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "อัพเดทข้อมูลสรุปผู้จำหน่ายเรียบร้อยแล้ว",
  "data": {
    "draft_pr": {
      "id": "DPR25010001",
      "pr_title": "ขอซื้อยา Paracetamol สำหรับแผนกอายุรกรรม"
    },
    "summary": {
      "total_suppliers_count": 2,
      "recommended_supplier_id": 20,
      "lowest_quoted_price": 1325.00,
      "highest_quoted_price": 1450.00,
      "recommended_supplier_name": "บริษัท เฮลท์แคร์ ซัพพลาย จำกัด"
    },
    "message": "อัพเดทข้อมูลสรุปเรียบร้อยแล้ว"
  }
}
```

---

## 🧪 **ลำดับการทดสอบที่แนะนำ:**

1. **ดูรายการที่รอดำเนินการ** (#3)
2. **สร้างร่าง PR** (#1) 
3. **เพิ่มผู้จำหน่าย** (#6)
4. **เพิ่มผู้จำหน่ายตัวที่ 2** (#6 ใช้ supplier_id อื่น)
5. **ดูรายการผู้จำหน่าย** (#9)
6. **เปรียบเทียบราคา** (#10)
7. **แนะนำผู้จำหน่าย** (#11)
8. **แก้ไขข้อมูลผู้จำหน่าย** (#7)
9. **หัวหน้าพัสดุอนุมัติ** (#4)

---

## ⚡ **Tips การทดสอบ:**

1. **เปลี่ยน Environment Variables** ตาม server ของคุณ
2. **ใช้ {{variable}}** สำหรับค่าที่ใช้บ่อย
3. **ทดสอบ Error Cases** ด้วย เช่น id ที่ไม่มี, ข้อมูลผิด
4. **เก็บ Response** ไว้ใช้ต่อใน Test อื่น
5. **ใช้ Pre-request Scripts** สำหรับสร้างข้อมูลทดสอบ

🎯 **ตอนนี้พร้อมทดสอบระบบพัสดุครบทุกฟังก์ชันแล้วครับ!** 