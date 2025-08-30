# Transaction Management Pattern

## 📖 คืออะไร?
Pattern สำหรับจัดการ Database Transaction ใน Controller ให้รองรับการใช้งาน 2 แบบ:

## 🔧 วิธีการทำงาน

### 1) การใช้งานแยกเดี่ยว (Standalone)
```javascript
// เรียกใช้ Controller โดยตรง
const result = await assignPlanVitalSigns({
    an: "12345/67",
    objVSPlan: [...],
    user_created: "admin"
    // ไม่ส่ง connection
});
```

**ผลลัพธ์:**
- `shouldManageOwnTransaction = true`
- Controller สร้าง connection + transaction เอง
- Controller ต้อง `commit()` และ `rollback()` เอง

### 2) การใช้งานแบบรวม (Nested)
```javascript
// เรียกจาก Service ที่มี transaction ใหญ่
const connection = await db.getConnection();
await connection.beginTransaction();

try {
    await assignPlanMedicine({ connection, ... });
    await assignPlanVitalSigns({ connection, ... });  // ส่ง connection มา
    await assignPlanNursingCare({ connection, ... });
    
    await connection.commit(); // commit ที่เดียว
} catch (err) {
    await connection.rollback();
}
```

**ผลลัพธ์:**
- `shouldManageOwnTransaction = false`
- Controller ใช้ connection ที่ส่งมา
- Controller **ไม่** `commit()` หรือ `rollback()`
- Service จัดการ transaction

## ✅ ข้อดี

1. **ยืดหยุ่น** - ใช้ได้ทั้งแบบแยกและแบบรวม
2. **Transaction Integrity** - ไม่มี commit ซ้อน
3. **Reusability** - Controller ใช้ซ้ำได้หลายที่
4. **Error Handling** - rollback ถูกต้อง

## 📁 ไฟล์ที่ใช้ Pattern นี้

- `AssignsPlanVSController.js` - Vital Signs
- `AssignsPlanNCController.js` - Nursing Care  
- `AssignsPlanRiskController.js` - Risk Assessment

## 🎯 หลักการสำคัญ

```javascript
// ตรวจสอบว่าต้องจัดการ transaction เองหรือไม่
if (params.connection) {
    connection = params.connection;
    shouldManageOwnTransaction = false; // ไม่ต้อง commit
} else {
    connection = await db.getConnection();
    shouldManageOwnTransaction = true;  // ต้อง commit เอง
    await connection.beginTransaction();
}

// ท้าย function
if (shouldManageOwnTransaction) {
    await connection.commit(); // commit เฉพาะที่สร้างเอง
}
```

---
*อัปเดต: เพิ่มคอมเมนต์อธิบายใน Controller ทุกตัวแล้ว* 

## ✅ Status การปรับปรุง Controllers

### Controllers ที่ปรับปรุงแล้ว (Updated ✅)

1. **AssignsPlanVSController.js** ✅
   - ✅ ใช้ getInstance() แทน new ManagementDB()
   - ✅ มี Transaction Management ที่ถูกต้อง
   - ✅ เพิ่มคอมเมนต์อธิบาย Pattern

2. **AuthController.js** ✅
   - ✅ ใช้ getInstance() แทน new ManagementDB()
   - ✅ แก้ไข beginTransaction() ใน login function
   - ✅ เพิ่ม safeRollback() ใน catch
   - ✅ เพิ่มคอมเมนต์อธิบาย Pattern

3. **GetDashboardsController.js** ✅
   - ✅ ใช้ getInstance() (ตรวจสอบแล้ว)
   - ✅ Read-only operations ไม่ใช้ transaction
   - ✅ เพิ่มคอมเมนต์อธิบาย Pattern

4. **GetGraphicController.js** ✅
   - ✅ ใช้ getInstance() (ตรวจสอบแล้ว)
   - ✅ มี Transaction Management ที่ถูกต้องใน saveNote
   - ✅ เพิ่มคอมเมนต์อธิบาย Pattern

5. **GetPlanCodesController.js** ✅
   - ✅ ใช้ getInstance() (ตรวจสอบแล้ว)
   - ✅ Read-only operations ไม่ใช้ transaction
   - ✅ เพิ่มคอมเมนต์อธิบาย Pattern

6. **OracleController.js** ✅
   - ✅ ใช้ getInstance() แทน new ManagementDB()
   - ✅ มี Transaction Management ที่ถูกต้อง
   - ✅ แก้ไข autoTransferFromOracleToMySQL ให้แต่ละ AN จัดการ transaction เอง
   - ✅ เพิ่มคอมเมนต์อธิบาย Pattern

7. **RecordVSController.js** ✅
   - ✅ ใช้ getInstance() (ตรวจสอบแล้ว)
   - ✅ มี Transaction Management ที่ถูกต้อง
   - ✅ เพิ่มคอมเมนต์อธิบาย Pattern

8. **RecordNCController.js** ✅
   - ✅ ใช้ getInstance() (ตรวจสอบแล้ว)
   - ✅ มี Transaction Management ที่ถูกต้อง
   - ✅ เพิ่มคอมเมนต์อธิบาย Pattern

9. **ServerTimeController.js** ✅
   - ✅ ไม่ใช้ฐานข้อมูล - ไม่ต้องใช้ Transaction Management
   - ✅ เพิ่มคอมเมนต์อธิบาย Pattern

### สรุปผลการปรับปรุง

- ✅ **ทุก Controller ได้รับการปรับปรุงแล้ว**
- ✅ **เปลี่ยนจาก new ManagementDB() เป็น getInstance() ทั้งหมด**
- ✅ **เพิ่ม Transaction Management ที่ถูกต้องตาม Pattern**
- ✅ **เพิ่มคอมเมนต์อธิบาย Pattern ในทุกไฟล์**
- ✅ **แก้ไขปัญหา Business Logic ใน autoTransferFromOracleToMySQL**

## 🎯 การใช้งานต่อไป

ทีมพัฒนาสามารถนำ Pattern นี้ไปใช้กับ Controller ใหม่ๆ ที่จะสร้างในอนาคต โดยอ้างอิงจากเอกสารนี้และตัวอย่างใน Controllers ที่มีอยู่

**หลักการสำคัญ:** 
- ใช้ getInstance() เสมอ
- กำหนด transaction management ให้ชัดเจน
- เพิ่มคอมเมนต์อธิบาย pattern ในทุกไฟล์