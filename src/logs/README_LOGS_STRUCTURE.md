# 📊 Logs Folder Structure - โครงสร้างการจัดเก็บ Log Files

## 🗂️ โครงสร้างโฟลเดอร์

```
logs/
├── connection/          # Database connection logs
│   ├── connection-YYYY-MM-DD.log
│   └── connection-error-YYYY-MM-DD.log
│
├── request/            # API request logs  
│   ├── request-YYYY-MM-DD.log
│   └── request-error-YYYY-MM-DD.log
│
├── system/             # System & application logs
│   ├── system-YYYY-MM-DD.log
│   ├── system-error-YYYY-MM-DD.log
│   ├── auth-YYYY-MM-DD.log
│   └── auth-error-YYYY-MM-DD.log
│
├── auto-generate/      # Auto generation process logs
│   ├── generate-plan-YYYY-MM-DD.log
│   ├── generate-plan-error-YYYY-MM-DD.log
│   ├── auto-generate-nc-YYYY-MM-DD.log
│   ├── auto-generate-vs-YYYY-MM-DD.log
│   └── legacy/         # เก่าที่ยังไม่ได้ migrate
│
└── archive/            # Archived logs (old logs)
    └── [archived log files]
```

## 📋 รายละเอียดแต่ละประเภท Log

### 🔗 **connection/** - Database Connection Logs
- **connection-[date].log**: บันทึกการเชื่อมต่อฐานข้อมูล, connection pool status
- **connection-error-[date].log**: ข้อผิดพลาดด้าน connection (timeout, hang, pool exhausted)

**ตัวอย่างการใช้งาน:**
```javascript
const { logger } = require('./services/logging');
logger.connection.info('Connection pool status', { available: 5, used: 3 });
logger.connection.error('Connection timeout', { query: 'SELECT * FROM users' });
```

### 🌐 **request/** - API Request Logs  
- **request-[date].log**: บันทึก API requests ทั้งหมด (สำเร็จ/ไม่สำเร็จ)
- **request-error-[date].log**: ข้อผิดพลาดจาก API calls เฉพาะ

**ตัวอย่างการใช้งาน:**
```javascript
logger.request.info('API Request', { 
  method: 'POST', 
  url: '/api/users', 
  status: 200,
  responseTime: '45ms'
});
logger.request.error('API Error', { 
  method: 'GET', 
  url: '/api/data',
  error: 'Database timeout' 
});
```

### ⚙️ **system/** - System & Application Logs
- **system-[date].log**: บันทึกระบบทั่วไป (startup, shutdown, config changes)
- **system-error-[date].log**: ข้อผิดพลาดระดับระบบ
- **auth-[date].log**: บันทึกการ authentication/authorization
- **auth-error-[date].log**: ข้อผิดพลาดด้าน authentication

**ตัวอย่างการใช้งาน:**
```javascript
logger.system.info('Server started', { port: 5009, env: 'production' });
logger.system.error('Configuration error', { config: 'database.host' });
logger.auth.info('User login', { username: 'john_doe', ip: '192.168.1.100' });
logger.auth.error('Failed login attempt', { username: 'hacker', reason: 'invalid_password' });
```

### 🤖 **auto-generate/** - Auto Generation Process Logs
- **generate-plan-[date].log**: บันทึกกระบวนการ generate plans ทั่วไป
- **generate-plan-error-[date].log**: ข้อผิดพลาดใน generate plans
- **auto-generate-nc-[date].log**: บันทึกการ generate NC plans
- **auto-generate-vs-[date].log**: บันทึกการ generate VS plans

**ตัวอย่างการใช้งาน:**
```javascript
logger.generatePlan.info('Plan generation started', { 
  type: 'NC', 
  totalPatients: 150 
});
logger.generatePlan.error('Plan generation failed', { 
  patient: 'AN123/2025',
  error: 'Missing required data' 
});
```

## 🔧 การกำหนดค่า Logger

### Logger Configuration (services/logging/config/loggerConfig.js):

```javascript
const logger = {
  request: winston.createLogger({
    level: 'info',  // เก็บทั้ง info และ error
    transports: [
      new winston.transports.File({ 
        filename: 'logs/request/request-YYYY-MM-DD.log',
        level: 'info'
      }),
      new winston.transports.File({ 
        filename: 'logs/request/request-error-YYYY-MM-DD.log',
        level: 'error'
      })
    ]
  }),
  
  connection: winston.createLogger({
    level: 'warn',  // เก็บ warn และ error
    transports: [...]
  }),
  
  system: winston.createLogger({
    level: 'info',  // เก็บ info, warn และ error
    transports: [...]
  }),
  
  generatePlan: winston.createLogger({
    level: 'error', // เก็บเฉพาะ error
    transports: [...]
  })
};
```

## 📅 การจัดการไฟล์ Log

### การสร้างชื่อไฟล์ตามวันที่:
```javascript
function getLogFileName(baseName) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${baseName}-${dateStr}.log`;
}
```

### การ Archive ไฟล์เก่า:
- ไฟล์ log จะถูก rotate ทุกวัน
- ไฟล์เก่าที่เกิน 30 วันควรย้ายไปโฟลเดอร์ `archive/`
- ใช้ cron job หรือ script สำหรับ cleanup อัตโนมัติ

## 🎯 ข้อดีของโครงสร้างใหม่

### ✅ **ข้อดี:**
1. **จัดระเบียบดี**: แยกประเภท log ชัดเจน ง่ายต่อการค้นหา
2. **ขยายได้**: เพิ่มประเภท log ใหม่ได้ง่าย
3. **จัดการง่าย**: สามารถ archive หรือ backup แต่ละประเภทแยกกัน
4. **Performance**: ไฟล์ log ไม่ใหญ่เกินไป แยกตามการใช้งาน
5. **Monitoring**: สามารถตั้ง alert แยกตามประเภท log

### 📊 **การใช้งานแนะนำ:**
- **Development**: เปิด log level 'debug' หรือ 'info'
- **Production**: ใช้ log level 'warn' หรือ 'error' เพื่อลด disk usage
- **Monitoring**: ใช้ tools เช่น ELK Stack หรือ Grafana ดู log real-time

## 🚀 การ Migration จากโครงสร้างเก่า

### ขั้นตอนที่ทำแล้ว:
1. ✅ สร้างโฟลเดอร์ `connection/`, `request/`, `system/`
2. ✅ ย้ายไฟล์ log ที่มีอยู่ไปโฟลเดอร์ที่เหมาะสม
3. ✅ อัปเดต `loggerConfig.js` ให้ใช้ path ใหม่
4. ✅ เพิ่ม logger สำหรับ authentication

### ขั้นตอนถัดไป:
- [ ] ทดสอบการสร้างไฟล์ log ใหม่
- [ ] ตั้งค่า log rotation และ cleanup
- [ ] อัปเดตเอกสารการใช้งาน
- [ ] ตั้งค่า monitoring สำหรับ log files

## 📞 การใช้งานใน Code

### ตัวอย่างการเรียกใช้ Logger:

```javascript
// Import logger
const { logger } = require('./services/logging');

// Request logging
logger.request.info('User accessed dashboard', { 
  username: 'john_doe', 
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0...'
});

// Connection logging  
logger.connection.warn('Connection pool nearly full', {
  available: 2,
  total: 10,
  used: 8
});

// System logging
logger.system.info('Application started', {
  version: '1.0.0',
  environment: 'production',
  port: 5009
});

// Authentication logging
logger.auth.error('Login failed', {
  username: 'user123',
  reason: 'Invalid password',
  attempts: 3,
  ip: '192.168.1.200'
});
```

---

*อัปเดตล่าสุด: 2025-06-06*
*ผู้จัดทำ: Nursing System Development Team* 