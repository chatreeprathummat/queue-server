# คู่มือการใช้งาน API ผู้ป่วย (Patient API)

## ภาพรวม
API สำหรับดึงข้อมูลผู้ป่วยจากฐานข้อมูล Oracle หลัก ประกอบด้วยการดึงข้อมูลและการค้นหาผู้ป่วย

## Endpoints

### 1. ดึงข้อมูลผู้ป่วยโดยระบุ HN
**GET** `/api/inv/patient-by-hn`

#### Query Parameter
- `hn` - หมายเลข HN ของผู้ป่วย (รูปแบบ xxx-xx เช่น 1-68, 001-25)

**หมายเหตุ:** ระบบจะแปลง `xxx-xx` เป็น `xxx/xx` อัตโนมัติเพื่อค้นหาในฐานข้อมูล

#### ตัวอย่าง URL
```
GET /api/inv/patient-by-hn?hn=1-68
GET /api/inv/patient-by-hn?hn=001-25
```

#### Response (สำเร็จ)
```json
{
  "success": true,
  "message": "ดึงข้อมูลผู้ป่วยเรียบร้อยแล้ว",
  "data": {
    "hn": "1/68",
    "prename": "นาย",
    "name": "สมชาย",
    "lastName": "ใจดี",
    "fullName": "นาย สมชาย ใจดี",
    "birthday": "1980-05-15",
    "sex": "M",
    "idcard": "1234567890123",
    "passportno": null,
    "lastAdmitAt": "2024-01-15",
    "usercreated": "SYSTEM",
    "datecreated": "2024-01-15T10:30:00.000Z",
    "userupdated": null,
    "dateupdated": null,
    "deleted": null,
    "userdeleted": null,
    "datedeleted": null
  }
}
```

#### Response (ไม่พบข้อมูล)
```json
{
  "success": false,
  "message": "ไม่พบข้อมูลผู้ป่วยที่ระบุ",
  "data": null
}
```

### 2. ดึงรายการผู้ป่วยทั้งหมด (สำหรับค้นหา)
**POST** `/api/inv/patient-list`

#### Request Body
```json
{
  "search": "สมชาย",
  "limit": 10,
  "offset": 0
}
```

#### Response
```json
{
  "success": true,
  "message": "ดึงรายการผู้ป่วยเรียบร้อยแล้ว",
  "data": [
    {
      "hn": "1/68",
      "fullName": "นาย สมชาย ใจดี",
      "prename": "นาย",
      "name": "สมชาย",
      "lastName": "ใจดี",
      "birthday": "1980-05-15",
      "sex": "M",
      "idcard": "1234567890123",
      "passportno": null,
      "lastAdmitAt": "2024-01-15"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

## โครงสร้างข้อมูล

### ฟิลด์ข้อมูลผู้ป่วย
| ฟิลด์ | ประเภท | ความยาว | ข้อบังคับ | คำอธิบาย |
|-------|--------|---------|----------|----------|
| hn | varchar | 15 | ✅ | หมายเลข HN (Primary Key) |
| prename | varchar | 30 | ❌ | คำนำหน้าชื่อ (เช่น นาย, นาง, นางสาว) |
| name | varchar | 300 | ❌ | ชื่อจริงของผู้ป่วย |
| lastName | varchar | 300 | ❌ | นามสกุลของผู้ป่วย |
| birthday | date | - | ❌ | วันเกิด |
| sex | varchar | 1 | ❌ | เพศ (M=ชาย, F=หญิง) |
| idcard | varchar | 13 | ❌ | เลขบัตรประชาชน |
| passportno | varchar | 15 | ❌ | เลขพาสปอร์ต |
| lastAdmitAt | date | - | ❌ | วันที่ Admit ครั้งสุดท้าย |

### ฟิลด์ Audit
| ฟิลด์ | ประเภท | ความยาว | ข้อบังคับ | คำอธิบาย |
|-------|--------|---------|----------|----------|
| usercreated | varchar | 15 | ❌ | ผู้สร้าง |
| datecreated | datetime | - | ❌ | วันที่สร้าง |
| userupdated | varchar | 15 | ❌ | ผู้แก้ไข |
| dateupdated | datetime | - | ❌ | วันที่แก้ไข |
| deleted | varchar | 1 | ❌ | สถานะการลบ (Y=ลบ, N=ปกติ) |
| userdeleted | varchar | 15 | ❌ | ผู้ลบ |
| datedeleted | datetime | - | ❌ | วันที่ลบ |

## ข้อผิดพลาดที่อาจเกิดขึ้น

### 400 Bad Request
- ข้อมูล HN ไม่ถูกต้อง
- ข้อมูลการค้นหาไม่ถูกต้อง

### 404 Not Found
- ไม่พบข้อมูลผู้ป่วยที่ระบุ

### 500 Internal Server Error
- เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย
- เกิดข้อผิดพลาดในการดึงรายการผู้ป่วย

## ตัวอย่างการใช้งาน

### JavaScript/TypeScript
```javascript
// ดึงข้อมูลผู้ป่วยโดย HN
const getPatient = async (hn) => {
  const response = await fetch(`/api/inv/patient-by-hn/${hn}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  
  const result = await response.json();
  return result;
};

// ค้นหาผู้ป่วย
const searchPatients = async (searchTerm) => {
  const response = await fetch('/api/inv/patient-list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      search: searchTerm,
      limit: 20,
      offset: 0
    })
  });
  
  const result = await response.json();
  return result;
};
```

### cURL
```bash
# ดึงข้อมูลผู้ป่วย
curl -X GET "http://localhost:5009/api/inv/patient-by-hn?hn=1-68"

# ค้นหาผู้ป่วย
curl -X POST http://localhost:5009/api/inv/patient-list \
  -H "Content-Type: application/json" \
  -d '{"search": "สมชาย", "limit": 10, "offset": 0}'
```

## ตัวอย่างการใช้งานใน Postman

### 1. ดึงข้อมูลผู้ป่วยโดย HN

**Method:** GET  

**URL:**
```
http://localhost:5009/api/inv/patient-by-hn?hn=1-68
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN
```

### 2. ค้นหาผู้ป่วย

**Method:** POST  
**URL:** `http://localhost:5009/api/inv/patient-list`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN
```

**Body (raw JSON):**
```json
{
  "search": "สมชาย",
  "limit": 10,
  "offset": 0
}
```

## หมายเหตุ
- API นี้ดึงข้อมูลจากฐานข้อมูล Oracle หลัก
- ไม่มีการเพิ่มหรืออัปเดตข้อมูลในตารางผู้ป่วย
- การค้นหาสามารถค้นหาจาก HN, ชื่อ, นามสกุล, หรือเลขบัตรประชาชน
- ข้อมูลวันที่จะถูกส่งกลับในรูปแบบ YYYY-MM-DD
- ฟิลด์ `fullName` จะถูกสร้างอัตโนมัติจากการรวม prename, name, และ lastName
- **HN ใช้รูปแบบ xxx-xx (เช่น 1-68, 001-25) และส่งผ่าน query parameter ระบบจะแปลงเป็น xxx/xx อัตโนมัติ** 