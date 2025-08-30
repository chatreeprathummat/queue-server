# 🚀 ตัวอย่างข้อมูลทดสอบ API พัสดุ (แบบสั้น)

## 📌 **ข้อมูลพื้นฐาน**
- **Base URL**: `http://localhost:3000/api/stock`
- **User ID**: `STOCK001` 
- **Auth Token**: ใส่ JWT token ของคุณ

---

## 1️⃣ **ดูรายการที่รอดำเนินการ**
```
GET /api/stock/pending-items?page=1&itemsPerPage=10
Headers: Authorization: Bearer your_token
```

---

## 2️⃣ **สร้างร่าง PR**
```
POST /api/stock/create-draft-pr
Headers: 
  Content-Type: application/json
  Authorization: Bearer your_token

Body:
{
  "source_requisition_id": "REQ25010001",
  "source_item_sequence": 1,
  "source_item_id": 12345,
  "detailed_specification": "แท็บเล็ต Paracetamol 500mg ยี่ห้อ GPO",
  "estimated_unit_price": 25.50,
  "estimated_total_price": 1275.00,
  "suggested_supplier_id": 15,
  "pr_title": "ขอซื้อยา Paracetamol สำหรับแผนกอายุรกรรม",
  "purpose": "ใช้สำหรับรักษาผู้ป่วย",
  "budget_source": "งบประมาณยา",
  "budget_year": "2568",
  "requested_delivery_date": "2025-02-15",
  "created_by_user_id": "STOCK001"
}
```

---

## 3️⃣ **เพิ่มผู้จำหน่าย**
```
POST /api/stock/draft-pr/DPR25010001/suppliers
Headers: 
  Content-Type: application/json
  Authorization: Bearer your_token

Body:
{
  "supplier_id": 20,
  "quoted_unit_price": 28.00,
  "quoted_total_price": 1400.00,
  "quotation_ref": "QT-2025-001",
  "delivery_lead_time": 7,
  "payment_terms": "เครดิต 30 วัน",
  "evaluation_score": 8.5,
  "is_recommended": true,
  "quote_status": "RECEIVED",
  "contact_person": "คุณสมชาย ใจดี",
  "contact_phone": "02-123-4567",
  "added_by_user_id": "STOCK001"
}
```

---

## 4️⃣ **เพิ่มผู้จำหน่ายตัวที่ 2**
```
POST /api/stock/draft-pr/DPR25010001/suppliers
Body: (เปลี่ยนเฉพาะ)
{
  "supplier_id": 25,
  "quoted_unit_price": 29.00,
  "quoted_total_price": 1450.00,
  "quotation_ref": "QT-2025-002",
  "delivery_lead_time": 10,
  "evaluation_score": 7.5,
  "is_recommended": false,
  "contact_person": "คุณสมหญิง ดีใจ",
  "contact_phone": "02-987-6543",
  "added_by_user_id": "STOCK001"
}
```

---

## 5️⃣ **ดูรายการผู้จำหน่าย**
```
GET /api/stock/draft-pr/DPR25010001/suppliers
Headers: Authorization: Bearer your_token
```

---

## 6️⃣ **เปรียบเทียบราคา**
```
GET /api/stock/draft-pr/DPR25010001/compare-prices
Headers: Authorization: Bearer your_token
```

---

## 7️⃣ **แนะนำผู้จำหน่าย**
```
POST /api/stock/draft-pr/DPR25010001/recommend-supplier
Headers: 
  Content-Type: application/json
  Authorization: Bearer your_token

Body:
{
  "criteria": "BALANCED",
  "recommended_by_user_id": "STOCK001"
}

ตัวเลือก criteria:
- "PRICE" = ราคาถูกที่สุด
- "QUALITY" = คุณภาพดีที่สุด  
- "SPEED" = ส่งเร็วที่สุด
- "BALANCED" = คะแนนรวมสูงสุด (แนะนำ)
```

---

## 8️⃣ **แก้ไขข้อมูลผู้จำหน่าย**
```
PUT /api/stock/draft-pr/DPR25010001/suppliers/101
Headers: 
  Content-Type: application/json
  Authorization: Bearer your_token

Body:
{
  "quoted_unit_price": 26.50,
  "quoted_total_price": 1325.00,
  "delivery_lead_time": 5,
  "evaluation_score": 9.0,
  "updated_by_user_id": "STOCK001"
}
```

---

## 9️⃣ **หัวหน้าดูรายการร่าง PR ที่รออนุมัติ**
```
GET /api/stock/manager/pending-draft-prs?page=1&itemsPerPage=10
Headers: Authorization: Bearer your_token
```

---

## 🔟 **หัวหน้าอนุมัติร่าง PR**
```
POST /api/stock/manager/approve-draft-pr/DPR25010001
Headers: 
  Content-Type: application/json
  Authorization: Bearer your_token

Body:
{
  "comment": "อนุมัติร่าง PR ราคาเหมาะสม",
  "approved_by_user_id": "STOCK_MGR01"
}
```

---

## 1️⃣1️⃣ **ปฏิเสธรายการ**
```
POST /api/stock/reject-item
Headers: 
  Content-Type: application/json
  Authorization: Bearer your_token

Body:
{
  "source_requisition_id": "REQ25010002",
  "source_item_sequence": 2,
  "source_item_id": 12346,
  "reason": "ข้อมูลไม่ครบถ้วน ขาดรายละเอียด",
  "rejected_by_user_id": "STOCK001"
}
```

---

## 1️⃣2️⃣ **อัพเดทข้อมูลสรุป**
```
POST /api/stock/draft-pr/DPR25010001/update-summary
Headers: 
  Content-Type: application/json
  Authorization: Bearer your_token

Body: {} (ส่งข้อมูลว่าง)
```

---

## 🧪 **ลำดับการทดสอบที่แนะนำ:**

1. **ดูรายการที่รอดำเนินการ** (#1)
2. **สร้างร่าง PR** (#2) 
3. **เพิ่มผู้จำหน่าย 2 ตัว** (#3, #4)
4. **ดูรายการผู้จำหน่าย** (#5)
5. **เปรียบเทียบราคา** (#6)
6. **แนะนำผู้จำหน่าย** (#7)
7. **แก้ไขข้อมูล** (#8)
8. **หัวหน้าอนุมัติ** (#9, #10)

---

## 💡 **Tips:**

- **เปลี่ยน DPR25010001** เป็น ID ที่ได้จาก response ข้อ 2
- **เปลี่ยน 101** เป็น supplier_entry_id ที่ได้จาก response ข้อ 3
- **ใช้ Postman Variables** เพื่อความสะดวก:
  ```
  {{base_url}} = http://localhost:3000/api/stock
  {{auth_token}} = your_jwt_token
  {{user_id}} = STOCK001
  {{draft_pr_id}} = DPR25010001
  ```

🎯 **พร้อมทดสอบแล้วครับ!** 