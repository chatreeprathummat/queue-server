# Server Time API - คู่มือการใช้งาน

## 📅 API สำหรับดึงวันที่และเวลาจาก Server

API เหล่านี้ช่วยให้ Frontend ดึงวันที่และเวลาจาก Server เพื่อให้เครื่องลูกข่ายมีเวลาตรงกัน

---

## 🔗 API Endpoints

### 1. **GET /api/server-time/display** (แนะนำสำหรับ Frontend)
ดึงวันที่และเวลาสำหรับแสดงผล (ข้อมูลแบบง่าย)

#### Request:
```javascript
// ต้อง Authentication (ส่ง token ใน header)
fetch('/api/server-time/display', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

#### Response:
```json
{
  "success": true,
  "data": {
    "dateISO": "2025-01-20",
    "dateThai": "จันทร์, 20 มกราคม 2568",
    "time": "14:30",
    "dateTimeDisplay": "จันทร์, 20 มกราคม 2568 เวลา 14:30 น."
  }
}
```

---

### 2. **GET /api/server-time/current** (ข้อมูลครบถ้วน)
ดึงวันที่และเวลาพร้อมข้อมูลเพิ่มเติม

#### Response:
```json
{
  "success": true,
  "message": "ดึงวันที่และเวลาจาก Server สำเร็จ",
  "data": {
    "dateISO": "2025-01-20",
    "dateThai": "จันทร์, 20 มกราคม 2568",
    "time24": "14:30",
    "timestamp": 1674567890,
    "iso8601": "2025-01-20T07:30:00.000Z",
    "timezone": {
      "name": "Asia/Bangkok",
      "offset": "+07:00",
      "abbr": "ICT"
    },
    "components": {
      "year": 2025,
      "yearBuddhist": 2568,
      "month": 1,
      "day": 20,
      "hour": 14,
      "minute": 30,
      "weekday": "จันทร์",
      "weekdayShort": "จ."
    }
  },
  "serverInfo": {
    "generateAt": "2025-01-20T07:30:00.000Z",
    "timezone": "Asia/Bangkok (GMT+7)"
  }
}
```

---

### 3. **POST /api/server-time/sync-check** (ตรวจสอบ Time Sync)
ตรวจสอบความแตกต่างของเวลาระหว่าง Client และ Server

#### Request:
```javascript
fetch('/api/server-time/sync-check', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    clientTimestamp: Date.now() // Unix timestamp ในหน่วยมิลลิวินาที
  })
})
```

#### Response:
```json
{
  "success": true,
  "message": "ตรวจสอบความตรงกันของเวลาเสร็จสิ้น",
  "data": {
    "serverTime": {
      "timestamp": 1674567890123,
      "iso": "2025-01-20T07:30:00.123Z",
      "display": "2025-01-20 14:30:00"
    },
    "clientTime": {
      "timestamp": 1674567890000,
      "iso": "2025-01-20T07:30:00.000Z",
      "display": "2025-01-20 14:30:00"
    },
    "difference": {
      "milliseconds": 123,
      "seconds": 0.12,
      "description": "Client ช้ากว่า Server"
    },
    "sync": {
      "isSync": true,
      "status": "เวลาตรงกัน",
      "recommendation": "ไม่จำเป็นต้องปรับเวลา"
    }
  }
}
```

---

## 🌐 Public API (ไม่ต้อง Authentication)

### **GET /api/server-time/public/display** 
สำหรับหน้า Login หรือ Public Pages

#### Response:
```json
{
  "success": true,
  "data": {
    "dateISO": "2025-01-20",
    "dateThai": "จันทร์, 20 มกราคม 2568",
    "time": "14:30",
    "dateTimeDisplay": "จันทร์, 20 มกราคม 2568 เวลา 14:30 น."
  }
}
```

---

## 💻 ตัวอย่างการใช้งานใน Frontend

### 1. **React Hook สำหรับแสดงเวลา Real-time**

```javascript
import { useState, useEffect } from 'react';

const useServerTime = (updateInterval = 60000) => { // อัพเดททุก 1 นาที
  const [serverTime, setServerTime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchServerTime = async () => {
    try {
      const response = await fetch('/api/server-time/display', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch server time');
      
      const data = await response.json();
      setServerTime(data.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServerTime();
    const interval = setInterval(fetchServerTime, updateInterval);
    return () => clearInterval(interval);
  }, [updateInterval]);

  return { serverTime, loading, error, refetch: fetchServerTime };
};

// Component การใช้งาน
const ServerTimeDisplay = () => {
  const { serverTime, loading, error } = useServerTime();

  if (loading) return <div>กำลังโหลดเวลา...</div>;
  if (error) return <div>ข้อผิดพลาด: {error}</div>;

  return (
    <div className="server-time">
      <div className="date-thai">{serverTime?.dateThai}</div>
      <div className="time">{serverTime?.time}</div>
    </div>
  );
};
```

### 2. **JavaScript Vanilla สำหรับแสดงเวลา**

```javascript
class ServerTimeManager {
  constructor(elementId, options = {}) {
    this.element = document.getElementById(elementId);
    this.updateInterval = options.updateInterval || 60000; // 1 นาที
    this.autoStart = options.autoStart !== false;
    this.intervalId = null;
    
    if (this.autoStart) {
      this.start();
    }
  }

  async fetchTime() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/server-time/display', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      this.updateDisplay(data.data);
      
    } catch (error) {
      console.error('Error fetching server time:', error);
      this.element.innerHTML = '<span class="error">ไม่สามารถดึงเวลาได้</span>';
    }
  }

  updateDisplay(timeData) {
    this.element.innerHTML = `
      <div class="server-time-widget">
        <div class="date-thai">${timeData.dateThai}</div>
        <div class="time-24">${timeData.time}</div>
      </div>
    `;
  }

  start() {
    this.fetchTime(); // ดึงครั้งแรกทันที
    this.intervalId = setInterval(() => this.fetchTime(), this.updateInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// การใช้งาน
const timeWidget = new ServerTimeManager('server-time-display', {
  updateInterval: 30000 // อัพเดททุก 30 วินาที
});
```

### 3. **Vue.js Component**

```vue
<template>
  <div class="server-time-display">
    <div v-if="loading" class="loading">กำลังโหลดเวลา...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="time-widget">
      <div class="date-thai">{{ serverTime?.dateThai }}</div>
      <div class="time">{{ serverTime?.time }}</div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';

export default {
  name: 'ServerTimeDisplay',
  props: {
    updateInterval: {
      type: Number,
      default: 60000 // 1 นาที
    }
  },
  setup(props) {
    const serverTime = ref(null);
    const loading = ref(true);
    const error = ref(null);
    let intervalId = null;

    const fetchServerTime = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/server-time/display', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to fetch server time');

        const data = await response.json();
        serverTime.value = data.data;
        error.value = null;
      } catch (err) {
        error.value = err.message;
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      fetchServerTime();
      intervalId = setInterval(fetchServerTime, props.updateInterval);
    });

    onUnmounted(() => {
      if (intervalId) clearInterval(intervalId);
    });

    return {
      serverTime,
      loading,
      error
    };
  }
};
</script>
```

---

## 🎨 CSS Styling ตัวอย่าง

```css
.server-time-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  font-family: 'Kanit', sans-serif;
}

.date-thai {
  font-size: 14px;
  font-weight: 400;
  margin-bottom: 4px;
  opacity: 0.9;
}

.time-24 {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 1px;
}

.error {
  color: #e74c3c;
  font-size: 12px;
  text-align: center;
}

.loading {
  color: #95a5a6;
  font-size: 12px;
  text-align: center;
}
```

---

## ⚠️ ข้อควรระวัง

1. **Rate Limiting**: ไม่ควรเรียก API บ่อยเกินไป แนะนำให้อัพเดททุก 30-60 วินาที
2. **Error Handling**: ควรมี fallback เมื่อไม่สามารถดึงเวลาจาก server ได้
3. **Token Management**: ตรวจสอบให้แน่ใจว่า token ยังไม่ expire
4. **Network Issues**: ควรมีการจัดการกรณี network timeout หรือ connection error

---

## 🔧 Troubleshooting

### ปัญหาที่อาจพบ:

1. **401 Unauthorized**: Token หมดอายุหรือไม่ถูกต้อง
2. **500 Server Error**: ปัญหาด้าน server หรือ database
3. **Network Timeout**: การเชื่อมต่อช้าหรือขาดหาย

### วิธีแก้ไข:

```javascript
const fetchWithRetry = async (url, options, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
};
``` 