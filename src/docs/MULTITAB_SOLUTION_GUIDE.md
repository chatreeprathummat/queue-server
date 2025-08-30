# คู่มือแก้ไขปัญหา Multi-Tab และ Request Hanging

## ปัญหาที่พบ

### 1. การเปิด Browser หลาย Tab
- ผู้ใช้เปิดหน้าเดียวกันใน 2 tabs แล้วใช้งานพร้อมกัน
- Tab หนึ่งไม่ response ทำให้ Frontend โหลดค้าง
- Backend ไม่ตอบกลับ request บางตัว

### 2. Error Message ไม่ชัดเจน
- ระบบแสดง "ข้อมูลไม่ถูกต้อง" แต่ใน errors มีรายละเอียดที่ชัดเจนกว่า
- ผู้ใช้ไม่เข้าใจปัญหาที่แท้จริง

## สาเหตุและการแก้ไข

### Backend Improvements

#### 1. Multi-Tab Handler Middleware
```javascript
// ระบบตรวจจับและจัดการ request ที่ค้าง
// timeout แต่ละประเภท API ตามความเหมาะสม
// tracking active requests เพื่อป้องกัน hanging
```

#### 2. Database Connection Pool Optimization
```javascript
// เพิ่ม connection limit จาก 20 → 25
// ปรับ timeout และ queue management
// auto cleanup stale connections
```

#### 3. Better Error Messages
```javascript
// ใช้ error message แรกเป็น main message
// แทนที่จะใช้ generic "ข้อมูลไม่ถูกต้อง"
```

### Frontend Recommendations

#### 1. Request Timeout Handling
```javascript
// ตัวอย่าง Axios configuration
const api = axios.create({
  timeout: 30000, // 30 วินาที
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor เพื่อเพิ่ม request ID
api.interceptors.request.use(config => {
  config.headers['X-Request-Time'] = Date.now().toString();
  return config;
});

// Response interceptor เพื่อจัดการ timeout
api.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
      return Promise.reject({
        message: 'การประมวลผลใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง',
        errorCode: 'REQUEST_TIMEOUT',
        timeout: true
      });
    }
    return Promise.reject(error);
  }
);
```

#### 2. Multi-Tab Coordination
```javascript
// ใช้ localStorage เพื่อ sync ระหว่าง tabs
const TabCoordinator = {
  // ตรวจสอบว่า tab อื่นกำลังทำงานอยู่หรือไม่
  isAnotherTabActive: () => {
    const lastActivity = localStorage.getItem('lastTabActivity');
    const now = Date.now();
    return lastActivity && (now - parseInt(lastActivity)) < 5000; // 5 วินาที
  },
  
  // อัพเดทสถานะ activity
  updateActivity: () => {
    localStorage.setItem('lastTabActivity', Date.now().toString());
  },
  
  // แจ้งเตือนเมื่อมี tab อื่นทำงาน
  showTabWarning: () => {
    alert('พบการใช้งานจากหน้าต่างอื่น กรุณาใช้งานทีละหน้าต่างเพื่อป้องกันข้อผิดพลาด');
  }
};

// ใช้งานก่อนส่ง request สำคัญ
if (TabCoordinator.isAnotherTabActive()) {
  TabCoordinator.showTabWarning();
  return;
}

TabCoordinator.updateActivity();
```

#### 3. Loading State Management
```javascript
// Component สำหรับจัดการ loading state
const useApiRequest = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const request = async (apiCall) => {
    if (loading) {
      console.warn('Request already in progress, ignoring duplicate');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiCall();
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return { request, loading, error };
};

// ใช้งาน
const { request, loading, error } = useApiRequest();

const handleSubmit = async () => {
  try {
    await request(() => api.post('/saveNCRecord', data));
    // success handling
  } catch (err) {
    // error handling
  }
};
```

#### 4. Request Deduplication
```javascript
// ป้องกันการส่ง request ซ้ำ
const RequestManager = {
  pendingRequests: new Map(),
  
  async dedupedRequest(key, apiCall) {
    // ถ้ามี request เดียวกันกำลังทำงานอยู่
    if (this.pendingRequests.has(key)) {
      console.log(`Request ${key} already pending, returning existing promise`);
      return this.pendingRequests.get(key);
    }
    
    // สร้าง promise ใหม่
    const promise = apiCall().finally(() => {
      this.pendingRequests.delete(key);
    });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
};

// ใช้งาน
const saveRecord = (data) => {
  const key = `saveRecord_${data.an}_${JSON.stringify(data.records)}`;
  return RequestManager.dedupedRequest(key, () => 
    api.post('/saveNCRecord', data)
  );
};
```

## API Monitoring

### ตรวจสอบสถานะ Multi-Tab
```javascript
// GET /api/multitab-status
{
  "success": true,
  "message": "สถานะระบบ Multi-Tab",
  "data": {
    "multiTab": {
      "totalRequests": 1250,
      "errorRequests": 15,
      "timeoutRequests": 3,
      "activeRequestsCount": 2,
      "activeRequests": [...],
      "errorRate": 1,
      "timeoutRate": 0
    },
    "database": {
      "activeConnections": 5,
      "connectionLimit": 25,
      "usage": "20%",
      "poolStatus": "healthy"
    }
  }
}
```

### ตรวจสอบ Connection Health
```javascript
// GET /api/connection-health
```

### รีเซ็ตสถิติ
```javascript
// POST /api/reset-multitab-stats
```

## Best Practices สำหรับ Frontend

### 1. User Experience
- แสดง loading indicator ที่ชัดเจน
- ปิดใช้งานปุ่มขณะประมวลผล
- แสดง progress bar สำหรับการบันทึกที่ใช้เวลานาน
- ให้ option ยกเลิกการดำเนินการ

### 2. Error Handling
- แสดง error message ที่เข้าใจง่าย
- ให้ตัวเลือก retry สำหรับ network errors
- log errors สำหรับ debugging

### 3. Performance
- ใช้ debouncing สำหรับการค้นหา
- implement pagination สำหรับข้อมูลจำนวนมาก
- cache ข้อมูลที่ไม่เปลี่ยนบ่อย

### 4. Multi-Tab Management
- แจ้งเตือนเมื่อมีการใช้งานจากหลาย tabs
- sync ข้อมูลระหว่าง tabs ด้วย localStorage/BroadcastChannel
- ป้องกันการทำงานซ้ำซ้อน

## การ Debug ปัญหา

### 1. ตรวจสอบ Network Tab
- ดู request timing
- ตรวจสอบ status codes
- ดู response headers (X-Request-ID, X-Request-Duration)

### 2. ตรวจสอบ Console Logs
- หา error messages
- ตรวจสอบ warning messages
- ดู performance metrics

### 3. ตรวจสอบผ่าน API
```javascript
// ตรวจสอบสถานะระบบ
fetch('/api/multitab-status')
  .then(r => r.json())
  .then(data => console.log('System Status:', data));

// ตรวจสอบ health
fetch('/api/health')
  .then(r => r.json())
  .then(data => console.log('Health:', data));
```

## สรุป

การแก้ไขปัญหา Multi-Tab ต้องทำทั้ง Backend และ Frontend:

**Backend:**
- ✅ เพิ่ม Multi-Tab Handler Middleware
- ✅ ปรับปรุง Database Connection Pool
- ✅ แก้ไข Error Messages ให้ชัดเจน
- ✅ เพิ่ม Monitoring APIs

**Frontend ควรทำ:**
- ⚠️ เพิ่ม Request Timeout Handling
- ⚠️ ใช้ Tab Coordination
- ⚠️ ปรับปรุง Loading State Management
- ⚠️ เพิ่ม Request Deduplication

ระบบจะเสถียรขึ้นและผู้ใช้จะได้รับประสบการณ์ที่ดีขึ้นเมื่อใช้งานหลาย tabs พร้อมกัน 