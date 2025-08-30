# 📁 Auto Generate Logs Directory

## 📋 **ภาพรวม**
โฟลเดอร์นี้เก็บไฟล์ log ทั้งหมดที่เกี่ยวข้องกับระบบ Auto Generate Plan

## 📂 **โครงสร้างไฟล์**

### 🔄 **ไฟล์ Log ปัจจุบัน (Active)**
- `auto-generate-vs-YYYY-MM-DD.log` - Log การ generate VS Plan รายวัน
- `auto-generate-nc-YYYY-MM-DD.log` - Log การ generate NC Plan รายวัน
- `auto-generate-both-YYYY-MM-DD.log` - Log การ generate ทั้ง VS และ NC Plan รายวัน
- `generate-plan.log` - Log ทั่วไปของระบบ generate plan
- `generate-plan-error.log` - Log error ของระบบ generate plan

### 📦 **โฟลเดอร์ Legacy**
- `legacy/` - เก็บไฟล์ log เก่าที่ไม่ได้ใช้งานแล้ว
  - `auto-generate-vs.log` - ไฟล์ VS log แบบเก่า (ไม่แยกวันที่)
  - `auto-generate-nc.log` - ไฟล์ NC log แบบเก่า (ไม่แยกวันที่)
  - `auto-generate-service.log` - ไฟล์ service log แบบเก่า
  - `auto-generate-*-error.log` - ไฟล์ error log แบบเก่า

## 🔧 **ระบบ Logging ปัจจุบัน**

### **AutoGenerateLogger.js**
- สร้างไฟล์ log แยกตามวันที่
- รูปแบบ: `auto-generate-{planType}-{YYYY-MM-DD}.log`
- บันทึกลงฐานข้อมูลด้วย

### **loggerConfig.js**
- จัดการ winston logger
- ไฟล์ log: `generate-plan.log` และ `generate-plan-error.log`

## 📅 **การจัดการไฟล์ Log**

### **ไฟล์ที่สร้างอัตโนมัติ**
- ระบบจะสร้างไฟล์ log ใหม่ทุกวัน
- ไฟล์เก่าจะถูกเก็บไว้สำหรับการตรวจสอบ

### **การทำความสะอาด**
- ไฟล์ log เก่าที่เกิน 30 วันจะถูกลบอัตโนมัติ
- ไฟล์ในโฟลเดอร์ `legacy/` สามารถลบได้หากไม่ต้องการ

## 🚀 **การใช้งาน**

### **ดู Log ล่าสุด**
```bash
# VS Plan log วันนี้
tail -f auto-generate-vs-$(date +%Y-%m-%d).log

# NC Plan log วันนี้
tail -f auto-generate-nc-$(date +%Y-%m-%d).log

# Error log
tail -f generate-plan-error.log
```

### **ค้นหา Log**
```bash
# ค้นหา error ใน log วันนี้
grep "ERROR" auto-generate-*-$(date +%Y-%m-%d).log

# ค้นหา AN เฉพาะ
grep "AN:1234/67" auto-generate-*-$(date +%Y-%m-%d).log
```

## 📊 **การตรวจสอบสถิติ**
- ใช้ API `/auto-generate/logs` เพื่อดูสถิติจากฐานข้อมูล
- ใช้ API `/auto-generate/status` เพื่อดูสถานะระบบ

---
**อัปเดตล่าสุด:** 2025-05-27
**ผู้จัดการ:** Nursing System Development Team 