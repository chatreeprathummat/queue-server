# 🚨 แก้ไขปัญหาหน้าเว็บค้างด่วน - Frontend

## ปัญหา: หน้าเว็บโหลดค้างเพราะ Backend ไม่ Response

### ✅ แก้ไขใน 5 นาที - ใส่โค้ดนี้ทันที

#### 1. แก้ไข API Configuration (จำเป็น!)

```javascript
// ถ้าใช้ Axios - เพิ่มใน API config
axios.defaults.timeout = 30000; // 30 วินาที

// หรือสร้าง instance ใหม่
const api = axios.create({
  timeout: 30000,
  baseURL: 'http://localhost:5009/api'
});
```

```javascript
// ถ้าใช้ fetch - wrap ด้วย timeout
const fetchWithTimeout = (url, options = {}, timeout = 30000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
};

// ใช้งาน
const response = await fetchWithTimeout('/api/saveNCRecord', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

#### 2. เพิ่ม Loading State พร้อม Cancel (แนะนำ)

```javascript
// เพิ่มใน Component
const [loading, setLoading] = useState(false);
const [abortController, setAbortController] = useState(null);

const handleSubmit = async (data) => {
  // ป้องกันการกดซ้ำ
  if (loading) return;
  
  setLoading(true);
  const controller = new AbortController();
  setAbortController(controller);
  
  try {
    const response = await fetch('/api/saveNCRecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal // สำคัญ!
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('บันทึกสำเร็จ');
    } else {
      alert(result.message || 'เกิดข้อผิดพลาด');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('ยกเลิกการบันทึกแล้ว');
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  } finally {
    setLoading(false);
    setAbortController(null);
  }
};

const handleCancel = () => {
  if (abortController) {
    abortController.abort();
  }
};
```

#### 3. ปุ่มที่ไม่ให้กดซ้ำ

```jsx
<button 
  onClick={handleSubmit}
  disabled={loading}
  className={`btn btn-primary ${loading ? 'loading' : ''}`}
>
  {loading ? (
    <>
      <span className="spinner-border spinner-border-sm me-2"></span>
      กำลังบันทึก...
    </>
  ) : (
    'บันทึก'
  )}
</button>

{loading && (
  <button 
    onClick={handleCancel}
    className="btn btn-outline-danger ms-2"
  >
    ยกเลิก
  </button>
)}
```

---

## 📊 ตรวจสอบปัญหา Backend (สำหรับ Debug)

### เช็คว่า Backend ทำงานปกติ
```javascript
// เพิ่มใน useEffect หรือ componentDidMount
useEffect(() => {
  const checkBackend = async () => {
    try {
      const response = await fetch('/api/health', { timeout: 5000 });
      const data = await response.json();
      
      if (!data.success) {
        console.warn('⚠️ Backend ไม่ปกติ:', data);
      }
    } catch (error) {
      console.error('❌ Backend ไม่ตอบสนอง:', error.message);
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาติดต่อผู้ดูแลระบบ');
    }
  };
  
  checkBackend();
}, []);
```

### เช็คสถานะ Multi-Tab (ถ้าสงสัยว่ามี Tab อื่นรบกวน)
```javascript
const checkMultiTabStatus = async () => {
  try {
    const response = await fetch('/api/multitab-status');
    const data = await response.json();
    
    const activeRequests = data.data.multiTab.activeRequestsCount;
    if (activeRequests > 5) {
      console.warn(`⚠️ มี request ค้าง ${activeRequests} รายการ`);
      
      // แสดงแจ้งเตือน
      if (confirm('พบการใช้งานหนักในระบบ ต้องการรอหรือลองใหม่?')) {
        // รอ 5 วินาทีแล้วลองใหม่
        setTimeout(() => location.reload(), 5000);
      }
    }
  } catch (error) {
    console.log('ไม่สามารถตรวจสอบสถานะได้:', error.message);
  }
};
```

---

## 🎯 สรุป Priority สำหรับ Frontend

### 🚨 ต้องทำทันที (ไม่ทำจะค้างเรื่อยๆ)
1. **เพิ่ม timeout ใน API calls** ← สำคัญที่สุด
2. **เพิ่ม loading state + disable button**
3. **เพิ่ม cancel functionality**

### ⚠️ ควรทำ (ป้องกันปัญหาเพิ่มเติม)
1. **Backend health check**
2. **Error message display**
3. **ป้องกันการกดซ้ำเร็วเกินไป**

### 💡 ทำเพิ่มได้ (เมื่อมีเวลา)
1. **Progress bar แสดงเวลา**
2. **Multi-tab detection**
3. **Request retry mechanism**

---

## 📝 Code Template สำเร็จรูป

### React Hook for API Requests (Copy & Paste)
```javascript
import { useState } from 'react';

export const useApiWithTimeout = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const apiCall = async (url, options = {}, timeout = 30000) => {
    if (loading) {
      throw new Error('มี request กำลังดำเนินการอยู่');
    }
    
    setLoading(true);
    setError(null);
    
    const controller = new AbortController();
    
    try {
      const response = await Promise.race([
        fetch(url, {
          ...options,
          signal: controller.signal
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
      ]);
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'HTTP Error');
      }
      
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return { apiCall, loading, error };
};
```

### ใช้งาน
```javascript
const { apiCall, loading, error } = useApiWithTimeout();

const saveData = async () => {
  try {
    const result = await apiCall('/api/saveNCRecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    alert('บันทึกสำเร็จ');
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
};
```

**หมายเหตุ:** Backend ได้ปรับปรุงแล้ว แต่ **Frontend ยังต้องเพิ่ม timeout เอง** เพื่อให้ผู้ใช้สามารถยกเลิกและรู้สถานะได้! 