# 🔗 Frontend Integration Guide
**คู่มือการเชื่อมต่อระหว่าง Frontend และ Backend Health Check System**

---

## 📋 **Table of Contents**
1. [Overview](#overview)
2. [Health Check Headers](#health-check-headers)
3. [Error Response Standards](#error-response-standards)
4. [Frontend Implementation](#frontend-implementation)
5. [Error Handling Examples](#error-handling-examples)
6. [Best Practices](#best-practices)

---

## 🎯 **Overview**

### **Health Check Middleware คืออะไร?**
เป็น middleware ที่ตรวจสอบสถานะของ server ก่อนที่จะประมวลผล API request ทุกครั้ง

### **ทำไมต้องมี Health Check?**
- 🛡️ **ป้องกันระบบล่ม** เมื่อ memory เกินขีดจำกัด
- 📊 **ให้ข้อมูล server status** แก่ frontend
- ⚡ **จัดการ rate limiting** ป้องกัน spam requests
- 🔄 **แนะนำ retry timing** เมื่อระบบติดขัด

---

## 📡 **Health Check Headers**

ทุก API response จะมี headers เหล่านี้:

```javascript
// Response Headers ที่ Frontend จะได้รับ
{
  "X-Server-Status": "healthy",           // สถานะ server
  "X-Server-Uptime": "3600",             // วินาทีที่ server ทำงาน
  "X-Server-Memory-MB": "512",           // Memory ที่ใช้ (MB)
  "X-Server-Memory-GB": "0.50",          // Memory ที่ใช้ (GB) 
  "X-Server-Timestamp": "2024-06-09 14:30:00",  // เวลา server
  "X-API-Version": "1.0.0"               // เวอร์ชัน API
}
```

### **Frontend การใช้งาน Headers:**
```javascript
// JavaScript/TypeScript
const response = await fetch('/api/your-endpoint');

// อ่าน server status จาก headers
const serverStatus = response.headers.get('X-Server-Status');
const serverMemory = response.headers.get('X-Server-Memory-MB');
const serverUptime = response.headers.get('X-Server-Uptime');

console.log('Server Status:', serverStatus);
console.log('Memory Usage:', serverMemory + ' MB');
console.log('Uptime:', Math.floor(serverUptime / 3600) + ' hours');
```

---

## 🚨 **Error Response Standards**

### **Response Format มาตรฐาน:**
```json
{
  "success": false,
  "message": "ข้อความอธิบายสำหรับผู้ใช้",
  "timestamp": "2024-06-09 14:30:00",
  "serverStatus": {
    "memory": "2.1GB",
    "uptime": "48.5 ชั่วโมง", 
    "status": "unhealthy"
  },
  "errorCode": "HIGH_MEMORY_USAGE",
  "retryAfter": 60
}
```

### **Error Codes และความหมาย:**

| Error Code | HTTP Status | ความหมาย | การจัดการ |
|-----------|-------------|----------|-----------|
| `HIGH_MEMORY_USAGE` | 503 | Memory เกิน 2.5GB | Retry หลัง 60 วินาที |
| `CRITICAL_HIGH_MEMORY` | 503 | Memory เกิน 1.5GB (Critical API) | Retry หลัง 30 วินาที |
| `RATE_LIMIT_EXCEEDED` | 429 | Request มากเกินไป | Retry หลังเวลาที่กำหนด |
| `HEALTH_CHECK_ERROR` | 503 | ระบบขัดข้อง | Retry หลัง 30 วินาที |

---

## 💻 **Frontend Implementation**

### **1. Axios Interceptor (แนะนำ):**
```javascript
import axios from 'axios';

// สร้าง axios instance
const apiClient = axios.create({
  baseURL: 'http://localhost:5009/api',
  timeout: 30000
});

// Response Interceptor สำหรับจัดการ Health Check
apiClient.interceptors.response.use(
  (response) => {
    // Success response
    return response;
  },
  (error) => {
    const { response } = error;
    
    if (response && response.data) {
      const { errorCode, retryAfter, message } = response.data;
      
      // จัดการตาม Error Code
      switch (errorCode) {
        case 'HIGH_MEMORY_USAGE':
        case 'CRITICAL_HIGH_MEMORY':
          console.warn('Server memory สูง:', message);
          // แสดง notification ให้ user
          showNotification('warning', message);
          // Auto retry หลังเวลาที่กำหนด
          if (retryAfter) {
            setTimeout(() => {
              console.log('Retrying request...');
              // Retry logic here
            }, retryAfter * 1000);
          }
          break;
          
        case 'RATE_LIMIT_EXCEEDED':
          console.warn('Rate limit exceeded:', message);
          showNotification('error', message);
          break;
          
        case 'HEALTH_CHECK_ERROR':
          console.error('Server health check failed:', message);
          showNotification('error', 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง');
          break;
          
        default:
          // Handle other errors
          console.error('API Error:', message);
          showNotification('error', message);
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper function สำหรับแสดง notification
function showNotification(type, message) {
  // ใช้ notification library ของคุณ
  // เช่น react-toastify, antd notification, etc.
  console.log(`[${type.toUpperCase()}] ${message}`);
}
```

### **2. Fetch API Implementation:**
```javascript
// Wrapper function สำหรับ API calls
async function apiCall(url, options = {}) {
  try {
    const response = await fetch(`/api${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    // ตรวจสอบ health headers
    const serverStatus = response.headers.get('X-Server-Status');
    const serverMemory = response.headers.get('X-Server-Memory-GB');
    
    // แสดงข้อมูล server status (optional)
    if (serverMemory && parseFloat(serverMemory) > 2.0) {
      console.warn(`Server memory usage: ${serverMemory}GB`);
    }
    
    const data = await response.json();
    
    // จัดการ error responses
    if (!response.ok) {
      handleErrorResponse(data, response.status);
      throw new Error(data.message || 'API Error');
    }
    
    return data;
    
  } catch (error) {
    console.error('API Call Failed:', error);
    throw error;
  }
}

function handleErrorResponse(data, status) {
  const { errorCode, retryAfter, message } = data;
  
  switch (status) {
    case 503: // Service Unavailable
      if (errorCode === 'HIGH_MEMORY_USAGE') {
        showUserMessage('warning', message);
        // Auto retry logic
        if (retryAfter) {
          scheduleRetry(retryAfter);
        }
      }
      break;
      
    case 429: // Too Many Requests
      showUserMessage('error', message);
      break;
      
    default:
      showUserMessage('error', message);
  }
}

function scheduleRetry(seconds) {
  console.log(`Scheduling retry in ${seconds} seconds...`);
  // Implement retry logic based on your app structure
}
```

### **3. React Hook Example:**
```javascript
import { useState, useCallback } from 'react';

// Custom hook สำหรับ API calls พร้อม health check
export function useApiCall() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverHealth, setServerHealth] = useState(null);
  
  const callApi = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api${url}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      // อัพเดท server health จาก headers
      setServerHealth({
        status: response.headers.get('X-Server-Status'),
        memory: response.headers.get('X-Server-Memory-MB'),
        uptime: response.headers.get('X-Server-Uptime'),
        timestamp: response.headers.get('X-Server-Timestamp')
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // จัดการ health check errors
        if (data.errorCode) {
          handleHealthError(data);
        }
        throw new Error(data.message || 'API Error');
      }
      
      return data;
      
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const handleHealthError = (errorData) => {
    const { errorCode, message, retryAfter } = errorData;
    
    // แสดง appropriate message ตาม error type
    switch (errorCode) {
      case 'HIGH_MEMORY_USAGE':
      case 'CRITICAL_HIGH_MEMORY':
        // Show warning message
        console.warn('Server overloaded:', message);
        break;
      case 'RATE_LIMIT_EXCEEDED':
        console.warn('Rate limited:', message);
        break;
      default:
        console.error('Health check error:', message);
    }
  };
  
  return { callApi, loading, error, serverHealth };
}

// การใช้งานใน component
function MyComponent() {
  const { callApi, loading, error, serverHealth } = useApiCall();
  
  const handleSaveData = async () => {
    try {
      const result = await callApi('/save-data', {
        method: 'POST',
        body: JSON.stringify({ data: 'example' })
      });
      console.log('Success:', result);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };
  
  return (
    <div>
      {/* แสดง server health status */}
      {serverHealth && (
        <div className="server-status">
          Status: {serverHealth.status} | 
          Memory: {serverHealth.memory}MB |
          Uptime: {Math.floor(serverHealth.uptime / 3600)}h
        </div>
      )}
      
      <button onClick={handleSaveData} disabled={loading}>
        {loading ? 'Saving...' : 'Save Data'}
      </button>
      
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

---

## 🎯 **Error Handling Examples**

### **Business Logic Errors (ตัวอย่างที่คุณให้มา):**
```json
{
  "success": false,
  "message": "ข้อมูลไม่ถูกต้อง",
  "errors": [
    "รายการนี้เคยบันทึกไปแล้ว: NCP-6802705-20250609000120655-1913, N0210, 2025-06-09 11:00:00"
  ]
}
```

### **Health Check Errors:**
```json
{
  "success": false,
  "message": "ระบบใช้หน่วยความจำมากเกินไป กรุณาลองใหม่ในอีกสักครู่",
  "timestamp": "2024-06-09 14:30:00",
  "serverStatus": {
    "memory": "2.8GB",
    "uptime": "48.5 ชั่วโมง",
    "status": "unhealthy"
  },
  "errorCode": "HIGH_MEMORY_USAGE",
  "retryAfter": 60
}
```

### **Frontend Error Handling:**
```javascript
function handleApiResponse(response) {
  const { success, message, errors, errorCode, retryAfter } = response;
  
  if (!success) {
    // ตรวจสอบว่าเป็น health check error หรือ business logic error
    if (errorCode) {
      // Health Check Error
      switch (errorCode) {
        case 'HIGH_MEMORY_USAGE':
          showNotification('warning', message);
          // Schedule retry
          if (retryAfter) {
            setTimeout(() => retryRequest(), retryAfter * 1000);
          }
          break;
          
        case 'RATE_LIMIT_EXCEEDED':
          showNotification('error', message);
          break;
          
        default:
          showNotification('error', message);
      }
    } else if (errors && errors.length > 0) {
      // Business Logic Error
      showValidationErrors(errors);
    } else {
      // Generic Error
      showNotification('error', message);
    }
  }
}

function showValidationErrors(errors) {
  // แสดง validation errors
  errors.forEach(error => {
    showNotification('error', error);
  });
}
```

---

## ✅ **Best Practices**

### **1. การจัดการ Retry:**
```javascript
class ApiClient {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }
  
  async callWithRetry(url, options = {}, attempt = 1) {
    try {
      return await this.call(url, options);
    } catch (error) {
      if (attempt < this.retryAttempts && this.shouldRetry(error)) {
        console.log(`Retry attempt ${attempt + 1}/${this.retryAttempts}`);
        await this.delay(this.retryDelay * attempt);
        return this.callWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }
  
  shouldRetry(error) {
    // Retry สำหรับ 503 (Service Unavailable) เท่านั้น
    return error.status === 503;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### **2. User Experience:**
```javascript
// แสดง loading state พร้อม progress
function showLoadingWithProgress(message) {
  // แสดง spinner หรือ progress bar
  showSpinner(message);
}

// แสดง friendly error messages
function showFriendlyError(errorCode, message) {
  const friendlyMessages = {
    'HIGH_MEMORY_USAGE': 'ระบบกำลังใช้งานหนัก กรุณารอสักครู่',
    'RATE_LIMIT_EXCEEDED': 'คำขอมากเกินไป กรุณารอสักครู่',
    'HEALTH_CHECK_ERROR': 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง'
  };
  
  const friendlyMessage = friendlyMessages[errorCode] || message;
  showNotification('warning', friendlyMessage);
}
```

### **3. Monitoring & Analytics:**
```javascript
// Track health check events
function trackHealthEvent(eventType, data) {
  // ส่งข้อมูลไป analytics service
  analytics.track('health_check_event', {
    type: eventType,
    serverMemory: data.serverStatus?.memory,
    errorCode: data.errorCode,
    timestamp: new Date().toISOString()
  });
}
```

---

## 📞 **สรุปสำหรับการคุยกับ Frontend Team**

### **🎯 สิ่งที่ Frontend ต้องทำ:**

1. **ตรวจสอบ Response Headers** - อ่าน server status จาก `X-Server-*` headers
2. **จัดการ Error Codes** - แยกระหว่าง health errors กับ business errors
3. **Implement Retry Logic** - ใช้ `retryAfter` field สำหรับ scheduling
4. **แสดง User-Friendly Messages** - ใช้ `message` field จาก response
5. **Monitor Server Health** - แสดงสถานะ server ใน UI (optional)

### **🔧 Tools ที่แนะนำ:**
- **Axios Interceptors** สำหรับ centralized error handling
- **React Hooks** สำหรับ state management
- **Notification Library** สำหรับแสดง error messages
- **Retry Logic** สำหรับ automatic retry

### **📊 Benefits:**
- ✅ **Better User Experience** - ไม่มี silent failures
- ✅ **Automatic Error Recovery** - retry เมื่อระบบกลับมาปกติ
- ✅ **Real-time Server Monitoring** - รู้สถานะ server แบบ real-time
- ✅ **Consistent Error Handling** - error messages เป็นมาตรฐานเดียวกัน

### **🎯 ข้อสำคัญที่สุด:**
**Frontend ต้องแยกระหว่าง Health Check Errors กับ Business Logic Errors**

**Health Check Errors:**
```json
{
  "success": false,
  "message": "ระบบกำลังใช้งานหนัก กรุณารอสักครู่",
  "errorCode": "HIGH_MEMORY_USAGE",
  "retryAfter": 60
}
```

**Business Logic Errors:**
```json
{
  "success": false,
  "message": "ข้อมูลไม่ถูกต้อง",
  "errors": [
    "รายการนี้เคยบันทึกไปแล้ว: NCP-6802705-20250609000120655-1913"
  ]
}
```

**ตอนนี้ Frontend จะสามารถ integrate กับ Backend Health Check System ได้อย่างมีประสิทธิภาพ! 🚀** 