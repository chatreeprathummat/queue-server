# 🛡️ Safe Logger Guide - คู่มือระบบ Logging ที่ปลอดภัย

## 📋 สารบัญ
- [ภาพรวมระบบ](#ภาพรวมระบบ)
- [วิธีการทำงาน](#วิธีการทำงาน)
- [การใช้งาน](#การใช้งาน)
- [Circuit Breaker Pattern](#circuit-breaker-pattern)
- [การตรวจสอบสุขภาพ](#การตรวจสอบสุขภาพ)
- [API สำหรับ Admin](#api-สำหรับ-admin)
- [การแก้ไขปัญหา](#การแก้ไขปัญหา)

---

## 🎯 ภาพรวมระบบ

**Safe Logger** เป็นระบบที่ป้องกันไม่ให้การเขียน log มีปัญหาจนทำให้ระบบหลักหยุดทำงาน

### ⭐ ฟีเจอร์หลัก
- **Graceful Error Handling** - ไม่ให้ logging error ทำลายระบบหลัก
- **Circuit Breaker Pattern** - หยุด logging ชั่วคราวเมื่อมีปัญหา
- **Fallback Logging** - ใช้ console.log เมื่อไฟล์ logging ไม่สามารถใช้ได้  
- **Async Logging** - ไม่ block main thread
- **Health Monitoring** - ตรวจสอบสถานะ logging system
- **Auto Recovery** - พยายาม recover เมื่อปัญหาหายไป

---

## ⚙️ วิธีการทำงาน

### 1. **Normal Operation (CLOSED State)**
```
Application → Safe Logger → Winston Logger → Log File
                    ↓
              Success/Failure Tracking
```

### 2. **Circuit Open (OPEN State)**
```
Application → Safe Logger → Console Fallback
                    ↓
              Buffer Storage (Memory)
```

### 3. **Recovery Attempt (HALF_OPEN State)**
```
Application → Safe Logger → Test Winston Logger
                    ↓
          Success: CLOSED | Failure: OPEN
```

---

## 🚀 การใช้งาน

### 1. **การใช้งานพื้นฐาน**

```javascript
// Import logger
const { logger } = require('./services/logging');

// การใช้งาน - Safe by default
logger.system.info('ระบบทำงานปกติ', { userId: 123 });
logger.system.error('เกิดข้อผิดพลาด', { error: 'Database connection failed' });

// หรือใช้ safeLog wrapper
const { safeLog } = require('./services/logging');
safeLog('system', 'info', 'ข้อความ log', { data: 'some data' });
```

### 2. **ใน Controller**

```javascript
const { logger } = require('../services/logging');

exports.someController = async (req, res) => {
  try {
    // การทำงานของระบบหลัก
    const result = await businessLogic();
    
    // Logging ไม่กระทบระบบหลัก แม้จะล้มเหลว
    logger.request.info('Request สำเร็จ', {
      userId: req.user?.user_id,
      endpoint: req.originalUrl,
      duration: Date.now() - req.startTime
    });
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    // แม้ logging ล้มเหลว ระบบยังส่ง response ได้
    logger.system.error('Controller error', { 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
};
```

### 3. **การใช้ใน Service**

```javascript
const { logger } = require('../services/logging');

class UserService {
  async createUser(userData) {
    try {
      // Business logic
      const user = await this.saveUser(userData);
      
      // Safe logging - ไม่กระทบการสร้าง user
      logger.system.info('สร้างผู้ใช้ใหม่สำเร็จ', {
        userId: user.id,
        username: user.username
      });
      
      return user;
      
    } catch (error) {
      logger.system.error('สร้างผู้ใช้ล้มเหลว', {
        error: error.message,
        userData: { ...userData, password: '[HIDDEN]' }
      });
      
      throw error; // ระบบหลักยัง throw error ได้ตามปกติ
    }
  }
}
```

---

## 🔄 Circuit Breaker Pattern

### States
- **CLOSED** 🟢 - ปกติ ทำงานได้
- **OPEN** 🔴 - มีปัญหา ใช้ fallback
- **HALF_OPEN** 🟡 - ทดสอบการกลับมาใช้

### Configuration
```javascript
{
  failureThreshold: 5,        // ล้มเหลว 5 ครั้งแล้วเปิด circuit
  recoveryTimeout: 30000,     // รอ 30 วินาที ก่อนลองใหม่
  halfOpenMaxAttempts: 3      // ทดสอบ 3 ครั้งใน half-open
}
```

### การทำงาน

1. **Normal → Open**: ล้มเหลว 5 ครั้งติดต่อกัน
2. **Open → Half-Open**: หลังจากผ่านไป 30 วินาที
3. **Half-Open → Closed**: ทดสอบสำเร็จ
4. **Half-Open → Open**: ทดสอบล้มเหลว

---

## 📊 การตรวจสอบสุขภาพ

### 1. **ดูสถานะผ่าน API**

```bash
# สถานะสุขภาพทั้งหมด
GET /api/admin/logging/health

# สถิติสั้นๆ
GET /api/admin/logging/stats

# สถานะ Circuit Breaker
GET /api/admin/logging/circuit-status
```

### 2. **ดูสถานะใน Code**

```javascript
const { getLoggingHealth } = require('./services/logging');

const health = getLoggingHealth();
console.log('Logger Health:', health);

// ตัวอย่าง Response:
{
  "system": {
    "totalLogs": 1250,
    "successfulLogs": 1248,
    "failedLogs": 2,
    "circuitBreaker": {
      "state": "CLOSED",
      "failureCount": 0
    },
    "healthStatus": {
      "isHealthy": true,
      "consecutiveFailures": 0
    },
    "bufferSize": 0
  }
}
```

---

## 🔧 API สำหรับ Admin

### 1. **Health Check**
```bash
GET /api/admin/logging/health
```
**Response:**
```json
{
  "success": true,
  "data": {
    "overall": {
      "status": "healthy",
      "totalLoggers": 5,
      "healthyLoggers": 5,
      "openCircuits": 0,
      "errorRate": "0.16%"
    },
    "loggers": {
      "system": {
        "status": "healthy",
        "circuitState": "CLOSED",
        "successRate": "99.84%"
      }
    }
  }
}
```

### 2. **Flush Buffers**
```bash
POST /api/admin/logging/flush
```
ใช้เมื่อต้องการ dump ข้อมูลใน memory buffer ออกมาดู

### 3. **Reset Statistics**
```bash
POST /api/admin/logging/reset-stats
```
รีเซ็ตสถิติทั้งหมดเป็น 0

### 4. **Test Logging**
```bash
POST /api/admin/logging/test
Content-Type: application/json

{
  "loggerName": "system",
  "level": "info", 
  "message": "Test message"
}
```

---

## 🚨 การแก้ไขปัญหา

### ปัญหาที่พบบ่อย

#### 1. **Circuit Breaker เปิดอยู่**
**อาการ:** Logs ไม่เข้าไฟล์ แต่เห็นใน console

**สาเหตุ:** 
- Disk เต็ม
- Permission denied
- File system error

**วิธีแก้:**
```bash
# ตรวจสอบ disk space
df -h

# ตรวจสอบ permission
ls -la logs/

# ดูข้อผิดพลาด
GET /api/admin/logging/health
```

#### 2. **Logs หาย**
**อาการ:** ไม่มี logs ใน file เลย

**วิธีตรวจสอบ:**
1. ดูใน console logs
2. ตรวจสอบ buffer size ผ่าน API
3. ตรวจสอบ circuit breaker state

```bash
# ดู buffer ที่ยังไม่ได้เขียน
POST /api/admin/logging/flush
```

#### 3. **Performance ช้า**
**อาการ:** Application ช้าหลังจากใช้ logging

**วิธีแก้:**
- Safe Logger ใช้ `setImmediate()` แล้ว ไม่น่าจะ block
- ตรวจสอบ `averageLogTime` ใน stats
- ลดระดับ log (เช่น เปลี่ยนจาก info เป็น warn)

### Emergency Commands

```bash
# Force flush ทุก logger
POST /api/admin/logging/flush

# Reset ทุกอย่าง
POST /api/admin/logging/reset-stats

# ตรวจสอบทั้งหมด
GET /api/admin/logging/health
```

---

## 💡 Best Practices

### 1. **การใช้งานใน Production**
- ใช้ระดับ `warn` และ `error` เป็นหลัก
- ตรวจสอบ health ทุกวัน
- ตั้ง monitoring alert สำหรับ circuit breaker

### 2. **การจัดการ Log Levels**
```javascript
// Production
logger.system.error('Critical error', data);  // ✅ สำคัญ
logger.system.warn('Warning condition', data); // ✅ ควรรู้

// Development
logger.system.info('Process started', data);   // ⚠️ ใช้แค่ dev
logger.system.debug('Variable value', data);   // ⚠️ ใช้แค่ debug
```

### 3. **การใส่ข้อมูล Meta**
```javascript
// Good - มีข้อมูลเพียงพอ
logger.request.info('API called', {
  userId: req.user?.user_id,
  endpoint: req.originalUrl,
  method: req.method,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  duration: Date.now() - req.startTime
});

// Bad - ข้อมูลไม่เพียงพอ  
logger.request.info('API called'); // ❌ ไม่รู้ API ไหน
```

---

## 🔗 ไฟล์ที่เกี่ยวข้อง

- `services/logging/safeLogger.js` - Core Safe Logger implementation
- `services/logging/config/loggerConfig.js` - Logger configuration
- `controllers/LoggingHealthController.js` - Health check API
- `routes/loggingHealth.js` - Health API routes
- `logs/README_LOGS_STRUCTURE.md` - โครงสร้างโฟลเดอร์ logs

---

*เอกสารนี้อัปเดตล่าสุด: 6 มิถุนายน 2568* 