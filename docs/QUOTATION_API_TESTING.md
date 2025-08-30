# การทดสอบ API ระบบจัดการใบเสนอราคา

## ข้อมูลทดสอบ

### 1. ตารางฐานข้อมูล
รันไฟล์ SQL เพื่อสร้างตารางและข้อมูลทดสอบ:
```sql
-- รันไฟล์นี้ใน MySQL
source inventory-server2/sql/create_supplier_quotation_tables.sql
```

### 2. ข้อมูลทดสอบที่สร้างขึ้น

#### ผู้จำหน่าย (tbl_inv_suppliers)
- SUP001: บริษัท เทคโนโลยีการแพทย์ จำกัด (OFFICIAL)
- SUP002: บริษัท อุปกรณ์การแพทย์ ไทย จำกัด (OFFICIAL)  
- SUP003: ร้านค้าอุปกรณ์การแพทย์ ABC (SUGGESTED)

#### ใบเสนอราคา (tbl_inv_supplier_quotations)
- QT-2024-001: 150,000 บาท (SUP001)
- QT-2024-002: 250,000 บาท (SUP002)
- QT-2024-003: 75,000 บาท (SUP003)

#### รายการสินค้า (tbl_inv_quotation_items)
- เครื่องวัดความดันโลหิตดิจิตอล, เครื่องวัดอุณหภูมิ, เครื่องวัดออกซิเจน
- เตียงผู้ป่วยไฟฟ้า, รถเข็นผู้ป่วย
- ถุงมือแพทย์ Latex

#### ไฟล์แนบ (tbl_inv_quotation_attachments)
- ไฟล์ PDF และรูปภาพตัวอย่าง

## API Endpoints

### 1. ดึงรายการผู้จำหน่าย
```http
GET /api/inv/suppliers
```

**Query Parameters:**
- `supplier_type`: OFFICIAL, SUGGESTED
- `is_active`: 1, 0

**ตัวอย่าง:**
```bash
curl -X GET "http://localhost:5009/api/inv/suppliers"
```

### 2. ดึงรายการใบเสนอราคา
```http
GET /api/inv/quotations
```

**Query Parameters:**
- `supplier_id`: รหัสผู้จำหน่าย
- `status`: ACTIVE, EXPIRED, CANCELLED
- `page`: หน้า (default: 1)
- `limit`: จำนวนต่อหน้า (default: 10)

**ตัวอย่าง:**
```bash
curl -X GET "http://localhost:5009/api/inv/quotations?page=1&limit=5"
```

### 3. ดึงข้อมูลใบเสนอราคาเดียว
```http
GET /api/inv/quotation/:quotationId
```

**ตัวอย่าง:**
```bash
curl -X GET "http://localhost:5009/api/inv/quotation/1"
```

### 4. สร้างใบเสนอราคาใหม่
```http
POST /api/inv/create-quotation
```

**Request Body:**
```json
{
  "supplier_id": 1,
  "quotation_number": "QT-2024-004",
  "quotation_date": "2024-01-20",
  "valid_until": "2024-02-20",
  "total_amount": 100000.00,
  "currency": "THB",
  "terms_conditions": "ชำระเงินภายใน 30 วัน",
  "notes": "ใบเสนอราคาสำหรับอุปกรณ์การแพทย์",
  "created_by_user_id": "admin",
  "items": [
    {
      "item_sequence": 1,
      "description": "เครื่องวัดความดันโลหิตดิจิตอล",
      "specification": "รุ่นใหม่ล่าสุด",
      "unit": "เครื่อง",
      "quantity": 5,
      "unit_price": 8000.00,
      "delivery_time": "7 วัน",
      "warranty": "1 ปี",
      "notes": "สีขาว"
    },
    {
      "item_sequence": 2,
      "description": "เครื่องวัดอุณหภูมิร่างกาย",
      "unit": "เครื่อง",
      "quantity": 10,
      "unit_price": 3000.00,
      "delivery_time": "7 วัน",
      "warranty": "1 ปี"
    }
  ]
}
```

**ตัวอย่าง:**
```bash
curl -X POST "http://localhost:5009/api/inv/create-quotation" \
  -H "Content-Type: application/json" \
  -d @quotation_data.json
```

### 5. อัปโหลดไฟล์แนบ
```http
POST /api/inv/quotation/:quotationId/upload
```

**Form Data:**
- `file`: ไฟล์ที่ต้องการอัปโหลด
- `uploaded_by_user_id`: รหัสผู้ใช้

**ตัวอย่าง:**
```bash
curl -X POST "http://localhost:5009/api/inv/quotation/1/upload" \
  -F "file=@document.pdf" \
  -F "uploaded_by_user_id=admin"
```

### 6. ลบไฟล์แนบ
```http
DELETE /api/inv/attachment/:attachmentId
```

**Request Body:**
```json
{
  "deleted_by_user_id": "admin",
  "delete_reason": "ไฟล์ไม่ถูกต้อง"
}
```

**ตัวอย่าง:**
```bash
curl -X DELETE "http://localhost:5009/api/inv/attachment/1" \
  -H "Content-Type: application/json" \
  -d '{"deleted_by_user_id": "admin", "delete_reason": "ไฟล์ไม่ถูกต้อง"}'
```

### 7. ดาวน์โหลดไฟล์
```http
GET /api/inv/attachment/:attachmentId/download
```

**ตัวอย่าง:**
```bash
curl -X GET "http://localhost:5009/api/inv/attachment/1/download" \
  -o downloaded_file.pdf
```

## การทดสอบด้วย Postman

### 1. Collection สำหรับทดสอบ
สร้าง Postman Collection ใหม่และเพิ่ม requests ตาม endpoints ข้างต้น

### 2. Environment Variables
ตั้งค่า environment variables:
- `base_url`: http://localhost:5009
- `api_base`: {{base_url}}/api/inv

### 3. ตัวอย่าง Request ใน Postman

#### สร้างใบเสนอราคาใหม่
```
Method: POST
URL: {{api_base}}/create-quotation
Headers: Content-Type: application/json
Body (raw JSON):
{
  "supplier_id": 1,
  "quotation_number": "QT-2024-004",
  "quotation_date": "2024-01-20",
  "total_amount": 100000.00,
  "created_by_user_id": "admin",
  "items": [
    {
      "item_sequence": 1,
      "description": "เครื่องวัดความดันโลหิต",
      "unit": "เครื่อง",
      "quantity": 5,
      "unit_price": 8000.00
    }
  ]
}
```

#### อัปโหลดไฟล์
```
Method: POST
URL: {{api_base}}/quotation/1/upload
Body (form-data):
- file: [เลือกไฟล์]
- uploaded_by_user_id: admin
```

## การทดสอบ Frontend

### 1. เชื่อมต่อกับ React App
ใช้ axios หรือ fetch เพื่อเรียก API จาก React frontend

### 2. ตัวอย่างการใช้งานใน React
```typescript
// ดึงรายการใบเสนอราคา
const getQuotations = async () => {
  try {
    const response = await axios.get('/api/inv/quotations');
    console.log('Quotations:', response.data);
  } catch (error) {
    console.error('Error:', error);
  }
};

// สร้างใบเสนอราคาใหม่
const createQuotation = async (quotationData: any) => {
  try {
    const response = await axios.post('/api/inv/create-quotation', quotationData);
    console.log('Created:', response.data);
  } catch (error) {
    console.error('Error:', error);
  }
};

// อัปโหลดไฟล์
const uploadFile = async (quotationId: number, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('uploaded_by_user_id', 'admin');
  
  try {
    const response = await axios.post(`/api/inv/quotation/${quotationId}/upload`, formData);
    console.log('Uploaded:', response.data);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## การตรวจสอบผลลัพธ์

### 1. ตรวจสอบฐานข้อมูล
```sql
-- ตรวจสอบใบเสนอราคา
SELECT * FROM tbl_inv_supplier_quotations;

-- ตรวจสอบรายการสินค้า
SELECT * FROM tbl_inv_quotation_items;

-- ตรวจสอบไฟล์แนบ
SELECT * FROM tbl_inv_quotation_attachments WHERE is_deleted = 0;
```

### 2. ตรวจสอบ Logs
ดู logs ในโฟลเดอร์ `logs/` เพื่อตรวจสอบการทำงานของ API

### 3. ตรวจสอบ Response
ทุก API จะส่ง response ในรูปแบบ:
```json
{
  "success": true/false,
  "message": "ข้อความ",
  "data": {...},
  "error": "ข้อผิดพลาด (ถ้ามี)"
}
```

## ข้อควรระวัง

1. **สิทธิ์การเขียนไฟล์**: ตรวจสอบว่าโฟลเดอร์ uploads มีสิทธิ์เขียน
2. **ขนาดไฟล์**: ระบบจำกัดขนาดไฟล์ที่อัปโหลด
3. **ประเภทไฟล์**: อนุญาตเฉพาะ PDF, JPEG, PNG, GIF
4. **Database Connection**: ตรวจสอบการเชื่อมต่อฐานข้อมูล
5. **CORS**: ตรวจสอบการตั้งค่า CORS หากเรียกจาก frontend

## การแก้ไขปัญหา

### 1. Error: Connection refused
- ตรวจสอบว่า server กำลังรันอยู่
- ตรวจสอบ port ที่ใช้

### 2. Error: Database connection failed
- ตรวจสอบการตั้งค่าฐานข้อมูลใน config
- ตรวจสอบว่า MySQL กำลังรันอยู่

### 3. Error: File upload failed
- ตรวจสอบสิทธิ์การเขียนไฟล์
- ตรวจสอบขนาดและประเภทไฟล์

### 4. Error: Validation failed
- ตรวจสอบข้อมูลที่ส่งไปให้ตรงกับ schema
- ตรวจสอบ required fields 