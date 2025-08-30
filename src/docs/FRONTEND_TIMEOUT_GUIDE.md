# คู่มือจัดการ Timeout และ Request สำหรับ Frontend

## ปัญหาหลัก: หน้าเว็บโหลดค้างเพราะ Backend ไม่ Response

### สาเหตุที่พบบ่อย
1. **ไม่มี Client-side Timeout** - Frontend รอ backend ไม่จำกัดเวลา
2. **ไม่มี Loading State Management** - ผู้ใช้ไม่รู้ว่าระบบกำลังทำงาน
3. **ไม่มี Error Recovery** - เมื่อ timeout แล้วไม่รู้จะทำอะไร

---

## 🚨 แก้ไขปัญหาเร่งด่วน

### ขั้นตอนที่ 1: เพิ่ม Axios Timeout Configuration

```javascript
// config/api.js - สร้างไฟล์นี้ใหม่
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5009/api',
  timeout: 30000, // 30 วินาที - ต้องตั้งค่านี้!
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - เพิ่ม timestamp
api.interceptors.request.use(config => {
  config.metadata = { startTime: Date.now() };
  console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor - จัดการ timeout และ error
api.interceptors.response.use(
  response => {
    const duration = Date.now() - response.config.metadata.startTime;
    console.log(`✅ API Success: ${response.config.url} (${duration}ms)`);
    return response;
  },
  error => {
    const duration = Date.now() - (error.config?.metadata?.startTime || Date.now());
    
    // จัดการ timeout
    if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
      console.error(`⏰ API Timeout: ${error.config?.url} (${duration}ms)`);
      return Promise.reject({
        isTimeout: true,
        message: 'การประมวลผลใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง',
        duration: duration,
        url: error.config?.url
      });
    }
    
    // จัดการ network error
    if (error.message === 'Network Error') {
      console.error(`🌐 Network Error: ${error.config?.url}`);
      return Promise.reject({
        isNetworkError: true,
        message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อ',
        url: error.config?.url
      });
    }
    
    console.error(`❌ API Error: ${error.config?.url} (${duration}ms)`, error.response?.data);
    return Promise.reject(error);
  }
);

export default api;
```

### ขั้นตอนที่ 2: สร้าง Hook สำหรับจัดการ Loading และ Error

```javascript
// hooks/useApiRequest.js - สร้างไฟล์นี้ใหม่
import { useState, useRef } from 'react';

export const useApiRequest = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  
  const request = async (apiCall, options = {}) => {
    // ป้องกันการส่ง request ซ้ำ
    if (loading && !options.allowDuplicate) {
      console.warn('⚠️ Request already in progress, ignoring duplicate');
      return;
    }
    
    // ยกเลิก request เก่าถ้ามี
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setLoading(true);
    setError(null);
    
    // สร้าง AbortController สำหรับยกเลิก request
    abortControllerRef.current = new AbortController();
    
    try {
      const result = await apiCall(abortControllerRef.current.signal);
      return result;
    } catch (err) {
      // ไม่ต้อง set error ถ้าเป็นการยกเลิก
      if (err.name !== 'AbortError') {
        setError(err);
      }
      throw err;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };
  
  const cancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      console.log('🚫 Request cancelled by user');
    }
  };
  
  return { request, loading, error, cancel };
};
```

### ขั้นตอนที่ 3: สร้าง Error Handler Component

```javascript
// components/ErrorHandler.jsx - สร้างไฟล์นี้ใหม่
import React from 'react';

const ErrorHandler = ({ error, onRetry, onDismiss }) => {
  if (!error) return null;
  
  const getErrorMessage = (error) => {
    // Backend timeout (handled by our middleware)
    if (error.response?.status === 408) {
      return {
        title: 'การประมวลผลใช้เวลานานเกินไป',
        message: 'ระบบประมวลผลนานเกินกำหนด กรุณาลองใหม่อีกครั้ง',
        type: 'timeout',
        canRetry: true
      };
    }
    
    // Frontend timeout
    if (error.isTimeout) {
      return {
        title: 'การประมวลผลใช้เวลานานเกินไป',
        message: error.message || 'กรุณาลองใหม่อีกครั้ง',
        type: 'timeout',
        canRetry: true
      };
    }
    
    // Network error
    if (error.isNetworkError) {
      return {
        title: 'ปัญหาการเชื่อมต่อ',
        message: error.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
        type: 'network',
        canRetry: true
      };
    }
    
    // Business logic error
    if (error.response?.data?.success === false) {
      return {
        title: 'ข้อผิดพลาด',
        message: error.response.data.message || 'เกิดข้อผิดพลาดในการประมวลผล',
        type: 'business',
        canRetry: false
      };
    }
    
    // Unknown error
    return {
      title: 'เกิดข้อผิดพลาด',
      message: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
      type: 'unknown',
      canRetry: true
    };
  };
  
  const errorInfo = getErrorMessage(error);
  
  return (
    <div className={`alert alert-${errorInfo.type === 'timeout' ? 'warning' : 'danger'}`}>
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <h5 className="alert-heading">{errorInfo.title}</h5>
          <p className="mb-2">{errorInfo.message}</p>
          {error.duration && (
            <small className="text-muted">เวลาที่ใช้: {Math.round(error.duration / 1000)} วินาที</small>
          )}
        </div>
        <div className="btn-group-vertical">
          {errorInfo.canRetry && onRetry && (
            <button className="btn btn-outline-primary btn-sm mb-1" onClick={onRetry}>
              ลองใหม่
            </button>
          )}
          {onDismiss && (
            <button className="btn btn-outline-secondary btn-sm" onClick={onDismiss}>
              ปิด
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorHandler;
```

### ขั้นตอนที่ 4: ใช้งานในหน้าบันทึกการพยาบาล

```javascript
// pages/SaveNCRecord.jsx - ตัวอย่างการใช้งาน
import React, { useState } from 'react';
import api from '../config/api';
import { useApiRequest } from '../hooks/useApiRequest';
import ErrorHandler from '../components/ErrorHandler';

const SaveNCRecord = () => {
  const [formData, setFormData] = useState({ an: '', records: [] });
  const [lastRequestTime, setLastRequestTime] = useState(null);
  const { request, loading, error, cancel } = useApiRequest();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // ป้องกันการกดซ้ำเร็วเกินไป
    const now = Date.now();
    if (lastRequestTime && (now - lastRequestTime) < 2000) {
      alert('กรุณารอสักครู่ก่อนบันทึกอีกครั้ง');
      return;
    }
    
    try {
      setLastRequestTime(now);
      
      const result = await request((signal) => 
        api.post('/saveNCRecord', formData, { signal })
      );
      
      if (result.data.success) {
        alert('บันทึกสำเร็จ');
        // reset form หรือ redirect
      }
    } catch (err) {
      console.error('Save error:', err);
      // ErrorHandler จะแสดง error ให้อัตโนมัติ
    }
  };
  
  const handleRetry = () => {
    handleSubmit({ preventDefault: () => {} });
  };
  
  const handleDismissError = () => {
    setError(null); // ถ้า useApiRequest support setter
  };
  
  return (
    <div className="container">
      <h2>บันทึกการปฏิบัติการพยาบาล</h2>
      
      {/* แสดง Error */}
      <ErrorHandler 
        error={error} 
        onRetry={handleRetry}
        onDismiss={handleDismissError}
      />
      
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
        
        <div className="d-flex justify-content-between">
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                กำลังบันทึก...
              </>
            ) : (
              'บันทึก'
            )}
          </button>
          
          {loading && (
            <button 
              type="button" 
              className="btn btn-outline-danger"
              onClick={cancel}
            >
              ยกเลิก
            </button>
          )}
        </div>
      </form>
      
      {/* แสดงเวลาในการประมวลผล */}
      {loading && (
        <div className="mt-3">
          <div className="progress">
            <div className="progress-bar progress-bar-striped progress-bar-animated" 
                 style={{width: '100%'}}>
              กำลังประมวลผล...
            </div>
          </div>
          <small className="text-muted">
            หากใช้เวลานานกว่า 30 วินาที ระบบจะยกเลิกอัตโนมัติ
          </small>
        </div>
      )}
    </div>
  );
};

export default SaveNCRecord;
```

---

## 📊 APIs ที่เพิ่มมา - ใช้ตอนไหน?

### 1. **`/api/multitab-status`** - สำหรับ Admin/Debug
```javascript
// ใช้ในหน้า Admin Dashboard หรือ Debug Console
const checkSystemStatus = async () => {
  const response = await fetch('/api/multitab-status');
  const data = await response.json();
  
  if (data.data.multiTab.activeRequestsCount > 10) {
    console.warn('⚠️ มี request จำนวนมาก:', data.data.multiTab.activeRequests);
  }
};
```

### 2. **`/api/connection-health`** - Health Check
```javascript
// ใช้ในการตรวจสอบก่อนส่ง request สำคัญ
const ensureSystemHealthy = async () => {
  try {
    const response = await fetch('/api/connection-health', { timeout: 5000 });
    const data = await response.json();
    return data.success && data.data.healthy;
  } catch {
    return false;
  }
};

// ใช้งาน
if (!(await ensureSystemHealthy())) {
  alert('ระบบไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง');
  return;
}
```

### 3. **`/api/reset-multitab-stats`** - สำหรับ Admin เท่านั้น
```javascript
// ใช้เมื่อต้องการ reset สถิติ (ในหน้า admin)
const resetStats = async () => {
  await fetch('/api/reset-multitab-stats', { method: 'POST' });
  console.log('Reset stats สำเร็จ');
};
```

---

## 🎯 สรุปสิ่งที่ Frontend ต้องทำ (Priority)

### ✅ ต้องทำทันที (Critical)
1. **เพิ่ม Axios timeout 30 วินาที**
2. **สร้าง Loading states ที่ชัดเจน**
3. **เพิ่ม Cancel button เมื่อ loading**
4. **จัดการ Error display**

### ✅ ควรทำ (Important)  
1. **ป้องกันการกดปุ่มซ้ำ**
2. **แสดงเวลาในการประมวลผล**
3. **Health check ก่อน request สำคัญ**

### ✅ ทำเพิ่มได้ (Nice to have)
1. **Tab coordination (localStorage)**
2. **Request deduplication**
3. **Progress indicators**

## 🚨 สำคัญ: ถ้าไม่แก้ Frontend จะยังมีปัญหา!

Backend ป้องกันได้แค่ server-side timeout แต่ **Frontend ยังต้องจัดการ client-side timeout เอง** เพื่อ:
- ป้องกันหน้าเว็บค้าง
- ให้ผู้ใช้ยกเลิกได้
- แสดงสถานะที่ชัดเจน
- จัดการ error อย่างเหมาะสม 