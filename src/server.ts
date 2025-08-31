// ใช้ require แทน import เพื่อหลีกเลี่ยงปัญหา TypeScript config
const express = require('express');
const morgan = require('morgan');
const moment = require('moment-timezone');
const { readdirSync, readFileSync, existsSync } = require('fs');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');
const ManagementDB = require('./services/ManagementDB').default;
const { logger } = require('./services/logging');
const config = require('./config/config').default;

// Type definitions สำหรับ TypeScript
interface Request {
  method: string;
  url: string;
  originalUrl?: string;
  ip?: string;
  connection?: any;
  headers: any;
  body?: any;
  get: Function;
}

interface Response {
  status: Function;
  json: Function;
  headersSent?: boolean;
}

interface NextFunction {
  (err?: any): void;
}

const app = express();

// Type definition for custom error
interface CustomError extends Error {
  status?: number;
  statusCode?: number;
  body?: any;
  code?: string;
  fatal?: boolean;
  sql?: string;
  sqlMessage?: string;
  errno?: number;
}

// เคลียร์ connection ที่ค้างอยู่ตอนเริ่มต้น server
const db = ManagementDB.getInstance();
db.cleanStaleConnections().then(() => {
  console.log('[Server Start] เคลียร์ connection ที่ค้างอยู่เรียบร้อย');
}).catch((err: Error) => {
  console.error('[Server Start] เกิดข้อผิดพลาดในการเคลียร์ connection:', err);
});

// Environment variables ได้ถูกแสดงใน config.ts แล้ว

// ========================================
// Middleware Setup with Enhanced Logging
// ========================================

// สร้าง custom tokens สำหรับ Morgan
morgan.token('datetime-th', (): string => {
  return moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
});

morgan.token('client-ip', (req: any): string => {
  const ip: string = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  // แปลง IPv6 loopback เป็น IPv4 เพื่อให้อ่านง่าย
  if (ip === '::1') {
    return '127.0.0.1(localhost)';
  }
  
  // แปลง IPv6-mapped IPv4 เป็น IPv4
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '') + '(IPv4)';
  }
  
  return ip;
});

// Custom Morgan format แบบละเอียด (แยกตาม environment)
const isDevelopment: boolean = process.env.NODE_ENV === 'development';

console.log(`[กำหนดค่า] NODE_ENV: ${process.env.NODE_ENV || 'undefined'}, isDevelopment: ${isDevelopment}`);

let morganFormat: string;

if (isDevelopment) {
  // Development - แสดงข้อมูลเต็ม พร้อม IP และ content-length
  morganFormat = '[:datetime-th] :client-ip :method :url :status :res[content-length] - :response-time ms';
} else {
  // Production - แสดงข้อมูลพื้นฐาน
  morganFormat = '[:datetime-th] :method :url :status - :response-time ms';
}

console.log(`[กำหนดค่า] Morgan Format: ${morganFormat}`);

// Apply middleware 
app.set('trust proxy', true); // เพื่อให้ได้ IP address ที่ถูกต้อง
app.use(morgan(morganFormat));

// JSON parsing middleware with error handling
app.use(express.json({
  limit: '200mb',
  verify: (req: any, res: any, buf: Buffer, encoding: string): void => {
    try {
      JSON.parse(buf.toString());
    } catch (err: any) {
      err.status = 400;
      err.body = buf;
      throw err;
    }
  }
}));

// JSON parsing error handler
app.use((err: any, req: Request, res: Response, next: NextFunction): void => {
      if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    // แปลง err.body เป็น string ก่อนใช้ substring
    let bodyDisplay: string = 'empty';
    if (err.body !== null && err.body !== undefined) {
      const bodyStr: string = typeof err.body === 'string' ? err.body : String(err.body);
      bodyDisplay = bodyStr.length > 500 ? bodyStr.substring(0, 500) + '...' : bodyStr;
    }
    
    console.error(`[JSON Parse Error] ${req.method} ${req.url}:`, {
      error: err.message,
      receivedBody: bodyDisplay,
      bodyType: typeof err.body,
      headers: req.headers
    });
    
    (res as any).status(400).json({
      success: false,
      message: "ข้อมูล JSON ที่ส่งมาไม่ถูกต้อง กรุณาตรวจสอบรูปแบบข้อมูล",
      error: "INVALID_JSON",
      details: `JSON parsing error: ${err.message}`
    });
    return;
  }
  next(err);
});

// ตั้งค่า CORS ที่อนุญาตให้เข้าถึง custom headers
app.use(cors({
    origin: true, // อนุญาตทุก origin หรือกำหนดเป็น array ของ domain ที่อนุญาต
    credentials: true, // อนุญาตให้ส่ง credentials
    exposedHeaders: [
        'X-Token-Expired-At',
        'X-Token-Remaining-Time',
        'X-Token-Remaining-Minutes',
        'X-Token-Should-Refresh',
        'X-Token-Status'
    ]
}));

// middleware ตรวจสอบสถานะของ server 
try {
  const healthCheckModule = require('./middleware/healthCheck') as any;
  const systemHealthCheck = healthCheckModule.systemHealthCheck || healthCheckModule.default?.systemHealthCheck;
  if (typeof systemHealthCheck === 'function') {
    app.use('/api', systemHealthCheck);
    console.log('✅ โหลด healthCheck middleware สำเร็จ');
  } else {
    console.log('⚠️ ข้าม healthCheck middleware (ไม่ใช่ function)');
  }
} catch (error: any) {
  console.warn('⚠️ ไม่สามารถโหลด healthCheck middleware:', error.message);
}

// Multi-tab handler middleware เพื่อป้องกัน request ค้างและจัดการ timeout
try {
  const multiTabHandlerModule = require('./middleware/multiTabHandler') as any;
  const multiTabHandler = multiTabHandlerModule.multiTabHandler || multiTabHandlerModule.default || multiTabHandlerModule;  
  if (typeof multiTabHandler === 'function') {
    app.use('/api', multiTabHandler);
    console.log('✅ โหลด multiTabHandler middleware สำเร็จ');
  } else {
    console.log('⚠️ ข้าม multiTabHandler middleware (ไม่ใช่ function)');
  }
} catch (error: any) {
  console.warn('⚠️ ไม่สามารถโหลด multiTabHandler middleware:', error.message);
}

// Enhanced request logging middleware
app.use((req: Request, res: Response, next: NextFunction): void => {
  const timestamp: string = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
  let clientIP: string = (req as any).ip || (req as any).connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  // ปรับปรุงการแสดง IP ให้เข้าใจง่าย
  let ipDisplay: string = clientIP;
  if (clientIP === '::1') {
    ipDisplay = '127.0.0.1(localhost)';
  } else if (clientIP.startsWith('::ffff:')) {
    ipDisplay = clientIP.replace('::ffff:', '') + '(IPv4)';
  }
  
  // Safe logging - ไม่ให้ logging error กระทบระบบหลัก
  try {
    if (logger && logger.request && typeof logger.request.info === 'function') {
      logger.request.info(`${req.method} ${req.url}`, {
        method: req.method,
        url: req.url,
        endpoint: (req as any).originalUrl || req.url,
        clientIP: ipDisplay,
        originalIP: clientIP, // เก็บ IP ต้นฉบับด้วย
        userAgent: (req as any).get('User-Agent') || 'unknown',
        timestamp: timestamp,
        headers: {
          'content-type': (req as any).get('Content-Type'),
          'authorization': (req as any).get('Authorization') ? 'Bearer [HIDDEN]' : 'none'
        }
      });
    } else {
      // Fallback logging
      console.log(`[${timestamp}] ${req.method} ${req.url} - ${ipDisplay}`);
    }
  } catch (logError: any) {
    console.log(`[${timestamp}] ${req.method} ${req.url} - Logging error: ${logError.message}`);
  }
  
  next();
});

// Test endpoints
app.get('/', (req: any, res: any) => {
  res.json({
    message: '🎉 TypeScript Server is working perfectly!',
    timestamp: new Date().toISOString(),
    server: 'TypeScript + Express',
    https: req.secure,
    version: '1.0.0'
  });
});

app.get('/test', (req: any, res: any) => {
  res.json({
    status: 'success',
    message: 'TypeScript server test endpoint',
    timestamp: new Date().toISOString(),
    https: req.secure
  });
});

// Auto-load routes จากโฟลเดอร์ routes
readdirSync('./src/routes').forEach((file: string) => {
  if (file.endsWith('.ts') || file.endsWith('.js')) {
    // try {
      const routeModule = require('./routes/' + file);
      // ตรวจสอบว่าเป็น ES6 module (default export) หรือ CommonJS
      const router = routeModule.default || routeModule;
      app.use('/api/queue', router);

      // if (typeof router === 'function') {
      //   app.use('/api/inv', router);
      //   console.log(`✅ โหลด route ${file} สำเร็จ`);
      // } else {
      //   console.warn(`⚠️ ข้าม route ${file} (ไม่ใช่ function)`);
      // }
    // } catch (error: any) {
    //   console.error(`❌ Error loading route ${file}:`, error.message);
    // }
  }
});

// Main global error handler
app.use((err: CustomError, req: Request, res: Response, next: NextFunction): void => {
  const timestamp: string = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
  
  // Colors for error logging
  const errorColors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    bold: '\x1b[1m'
  };
  
  // แสดง error ที่ชัดเจนและสวยงาม
  console.error(`\n${errorColors.red}${errorColors.bold}🚨 [ERROR] ${timestamp} ${req.method} ${req.url}${errorColors.reset}`);
  console.error(`${errorColors.red}┌─ Message: ${err.message}${errorColors.reset}`);
  console.error(`${errorColors.red}├─ Type: ${err.name || 'Unknown'}${errorColors.reset}`);
  console.error(`${errorColors.red}├─ Status: ${err.status || err.statusCode || 500}${errorColors.reset}`);
  
  // แสดง SQL Error ถ้ามี (สำหรับ database errors)
  if ((err as any).sql) {
    console.error(`${errorColors.yellow}├─ SQL Query: ${(err as any).sql}${errorColors.reset}`);
  }
  if ((err as any).sqlMessage) {
    console.error(`${errorColors.yellow}├─ SQL Message: ${(err as any).sqlMessage}${errorColors.reset}`);
  }
  if ((err as any).errno) {
    console.error(`${errorColors.yellow}├─ SQL Error Code: ${(err as any).errno}${errorColors.reset}`);
  }
  
  // แสดง Request details
  const bodyStr = req.body ? JSON.stringify(req.body) : 'empty';
  const bodyDisplay = bodyStr.length > 200 ? bodyStr.substring(0, 200) + '...' : bodyStr;
  console.error(`${errorColors.blue}├─ Request Body: ${bodyDisplay}${errorColors.reset}`);
  console.error(`${errorColors.blue}├─ Query Params: ${JSON.stringify((req as any).query || {})}${errorColors.reset}`);
  console.error(`${errorColors.blue}├─ Headers Sent: ${(res as any).headersSent}${errorColors.reset}`);
  
  // แสดง Stack trace (แค่ส่วนที่สำคัญ)
  if (err.stack) {
    const stackLines = err.stack.split('\n').slice(0, 5); // แสดงแค่ 5 บรรทัดแรก
    console.error(`${errorColors.red}└─ Stack Trace:${errorColors.reset}`);
    stackLines.forEach((line: string, index: number) => {
      const prefix = index === stackLines.length - 1 ? '   └─' : '   ├─';
      console.error(`${errorColors.red}${prefix} ${line.trim()}${errorColors.reset}`);
    });
  }
  console.error(''); // เว้นบรรทัด
  
  // บันทึก log ข้อผิดพลาด
  try {
    if (logger && logger.request && typeof logger.request.error === 'function') {
      logger.request.error('ข้อผิดพลาดในแอปพลิเคชัน', {
        error: err.message,
        errorType: err.name,
        stack: err.stack,
        sqlQuery: (err as any).sql,
        sqlMessage: (err as any).sqlMessage,
        sqlErrorCode: (err as any).errno,
        path: (req as any).path,
        method: req.method,
        timestamp: timestamp,
        url: req.url,
        body: req.body ? JSON.stringify(req.body).substring(0, 500) : 'no body',
        queryParams: (req as any).query
      });
    } else {
      // Fallback error logging
      console.error(`${errorColors.red}[ERROR LOG] ${err.message}${errorColors.reset}`);
    }
  } catch (logError: any) {
    console.error(`${errorColors.red}[LOG ERROR] ไม่สามารถบันทึก error log ได้: ${logError.message}${errorColors.reset}`);
  }
  
  if (!(res as any).headersSent) {
    const statusCode = err.status || err.statusCode || 500;
    (res as any).status(statusCode).json({
      success: false,
      message: "เกิดข้อผิดพลาดภายในระบบ",
      error: err.message,
      errorType: err.name || 'Unknown',
      timestamp: timestamp,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        sqlQuery: (err as any).sql,
        sqlMessage: (err as any).sqlMessage,
        requestBody: req.body,
        queryParams: (req as any).query
      })
    });
  }
});

// Graceful shutdown function
async function gracefulShutdown(signal: string): Promise<void> {
  const timestamp: string = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
  console.log(`\n[${timestamp}] ได้รับสัญญาณ ${signal} - เริ่มต้นกระบวนการปิดระบบ`);
  
  try {
    // หยุด HTTP server ไม่ให้รับ request ใหม่
    console.log(`[${timestamp}] กำลังหยุด HTTP server...`);
    
    // หยุด cron jobs
    console.log(`[${timestamp}] กำลังหยุด cron jobs...`);
    // Add cron job stop logic here if needed
    
    // ปิด database connections
    console.log(`[${timestamp}] กำลังปิด database connections...`);
    if (db && typeof db.cleanStaleConnections === 'function') {
      await db.cleanStaleConnections();
    }
    
    console.log(`[${timestamp}] ระบบปิดเรียบร้อยแล้ว`);
    process.exit(0);
  } catch (error: any) {
    console.error(`[${timestamp}] เกิดข้อผิดพลาดในระหว่างการปิดระบบ:`, error);
    process.exit(1);
  }
}

// จับสัญญาณ shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const httpPort: number = parseInt(config.http_port as string, 10) || 5009;
const httpsPort: number = config.https_port || 5443;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',    // สีเขียวสำหรับสำเร็จ
  red: '\x1b[31m',      // สีแดงสำหรับ error
  bold: '\x1b[1m'       // ตัวหนา
};

// HTTP Server
const httpServer = http.createServer(app);

httpServer.listen(httpPort, (): void => {
  const timestamp: string = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
  console.log(`[${timestamp}] ${colors.green}✅ HTTP Server running on port ${httpPort}${colors.reset}`);
});

// HTTPS Server (if enabled)
if (config.https_enabled) {
  try {
    // อ่านไฟล์ใบรับรอง SSL
    const options = {
      key: readFileSync(config.key_path),
      cert: readFileSync(config.cert_path)
    };
    
    // รันเซิร์ฟเวอร์ HTTPS
    https.createServer(options, app).listen(httpsPort, () => {
      const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
      console.log(`[${timestamp}] ${colors.green}✅ HTTPS Server running on port ${httpsPort}${colors.reset}`);
    });
    
  } catch (error: any) {
    const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
    console.error(`[${timestamp}] ${colors.red}❌ HTTPS Error: ${error.message}${colors.reset}`);
  }
}

  // ปิดใช้งานชั่วคราว cron jobs
 //console.log('Starting cron jobs...');
 //startCronJobs();

export default app;


