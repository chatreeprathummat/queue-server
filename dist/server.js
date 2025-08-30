"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const app = express();
// เคลียร์ connection ที่ค้างอยู่ตอนเริ่มต้น server
const db = ManagementDB.getInstance();
db.cleanStaleConnections().then(() => {
    console.log('[Server Start] เคลียร์ connection ที่ค้างอยู่เรียบร้อย');
}).catch((err) => {
    console.error('[Server Start] เกิดข้อผิดพลาดในการเคลียร์ connection:', err);
});
// Environment variables ได้ถูกแสดงใน config.ts แล้ว
// ========================================
// Middleware Setup with Enhanced Logging
// ========================================
// สร้าง custom tokens สำหรับ Morgan
morgan.token('datetime-th', () => {
    return moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
});
morgan.token('client-ip', (req) => {
    const ip = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
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
const isDevelopment = process.env.NODE_ENV === 'development';
console.log(`[กำหนดค่า] NODE_ENV: ${process.env.NODE_ENV || 'undefined'}, isDevelopment: ${isDevelopment}`);
let morganFormat;
if (isDevelopment) {
    // Development - แสดงข้อมูลเต็ม พร้อม IP และ content-length
    morganFormat = '[:datetime-th] :client-ip :method :url :status :res[content-length] - :response-time ms';
}
else {
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
    verify: (req, res, buf, encoding) => {
        try {
            JSON.parse(buf.toString());
        }
        catch (err) {
            err.status = 400;
            err.body = buf;
            throw err;
        }
    }
}));
// JSON parsing error handler
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        // แปลง err.body เป็น string ก่อนใช้ substring
        let bodyDisplay = 'empty';
        if (err.body !== null && err.body !== undefined) {
            const bodyStr = typeof err.body === 'string' ? err.body : String(err.body);
            bodyDisplay = bodyStr.length > 500 ? bodyStr.substring(0, 500) + '...' : bodyStr;
        }
        console.error(`[JSON Parse Error] ${req.method} ${req.url}:`, {
            error: err.message,
            receivedBody: bodyDisplay,
            bodyType: typeof err.body,
            headers: req.headers
        });
        res.status(400).json({
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
    const healthCheckModule = require('./middleware/healthCheck');
    const systemHealthCheck = healthCheckModule.systemHealthCheck || healthCheckModule.default?.systemHealthCheck;
    if (typeof systemHealthCheck === 'function') {
        app.use('/api', systemHealthCheck);
        console.log('✅ โหลด healthCheck middleware สำเร็จ');
    }
    else {
        console.log('⚠️ ข้าม healthCheck middleware (ไม่ใช่ function)');
    }
}
catch (error) {
    console.warn('⚠️ ไม่สามารถโหลด healthCheck middleware:', error.message);
}
// Multi-tab handler middleware เพื่อป้องกัน request ค้างและจัดการ timeout
try {
    const multiTabHandlerModule = require('./middleware/multiTabHandler');
    const multiTabHandler = multiTabHandlerModule.multiTabHandler || multiTabHandlerModule.default || multiTabHandlerModule;
    if (typeof multiTabHandler === 'function') {
        app.use('/api', multiTabHandler);
        console.log('✅ โหลด multiTabHandler middleware สำเร็จ');
    }
    else {
        console.log('⚠️ ข้าม multiTabHandler middleware (ไม่ใช่ function)');
    }
}
catch (error) {
    console.warn('⚠️ ไม่สามารถโหลด multiTabHandler middleware:', error.message);
}
// Enhanced request logging middleware
app.use((req, res, next) => {
    const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
    let clientIP = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    // ปรับปรุงการแสดง IP ให้เข้าใจง่าย
    let ipDisplay = clientIP;
    if (clientIP === '::1') {
        ipDisplay = '127.0.0.1(localhost)';
    }
    else if (clientIP.startsWith('::ffff:')) {
        ipDisplay = clientIP.replace('::ffff:', '') + '(IPv4)';
    }
    // Safe logging - ไม่ให้ logging error กระทบระบบหลัก
    try {
        logger.request.info(`${req.method} ${req.url}`, {
            method: req.method,
            url: req.url,
            endpoint: req.originalUrl || req.url,
            clientIP: ipDisplay,
            originalIP: clientIP, // เก็บ IP ต้นฉบับด้วย
            userAgent: req.get('User-Agent') || 'unknown',
            timestamp: timestamp,
            headers: {
                'content-type': req.get('Content-Type'),
                'authorization': req.get('Authorization') ? 'Bearer [HIDDEN]' : 'none'
            }
        });
    }
    catch (logError) {
        console.log(`[${timestamp}] ${req.method} ${req.url} - Logging error: ${logError.message}`);
    }
    next();
});
// Test endpoints
app.get('/', (req, res) => {
    res.json({
        message: '🎉 TypeScript Server is working perfectly!',
        timestamp: new Date().toISOString(),
        server: 'TypeScript + Express',
        https: req.secure,
        version: '1.0.0'
    });
});
app.get('/test', (req, res) => {
    res.json({
        status: 'success',
        message: 'TypeScript server test endpoint',
        timestamp: new Date().toISOString(),
        https: req.secure
    });
});
// Auto-load routes จากโฟลเดอร์ routes
readdirSync('./src/routes').forEach((file) => {
    if (file.endsWith('.ts') || file.endsWith('.js')) {
        // try {
        const routeModule = require('./routes/' + file);
        // ตรวจสอบว่าเป็น ES6 module (default export) หรือ CommonJS
        const router = routeModule.default || routeModule;
        app.use('/api/inv', router);
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
app.use((err, req, res, next) => {
    const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
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
    if (err.sql) {
        console.error(`${errorColors.yellow}├─ SQL Query: ${err.sql}${errorColors.reset}`);
    }
    if (err.sqlMessage) {
        console.error(`${errorColors.yellow}├─ SQL Message: ${err.sqlMessage}${errorColors.reset}`);
    }
    if (err.errno) {
        console.error(`${errorColors.yellow}├─ SQL Error Code: ${err.errno}${errorColors.reset}`);
    }
    // แสดง Request details
    const bodyStr = req.body ? JSON.stringify(req.body) : 'empty';
    const bodyDisplay = bodyStr.length > 200 ? bodyStr.substring(0, 200) + '...' : bodyStr;
    console.error(`${errorColors.blue}├─ Request Body: ${bodyDisplay}${errorColors.reset}`);
    console.error(`${errorColors.blue}├─ Query Params: ${JSON.stringify(req.query || {})}${errorColors.reset}`);
    console.error(`${errorColors.blue}├─ Headers Sent: ${res.headersSent}${errorColors.reset}`);
    // แสดง Stack trace (แค่ส่วนที่สำคัญ)
    if (err.stack) {
        const stackLines = err.stack.split('\n').slice(0, 5); // แสดงแค่ 5 บรรทัดแรก
        console.error(`${errorColors.red}└─ Stack Trace:${errorColors.reset}`);
        stackLines.forEach((line, index) => {
            const prefix = index === stackLines.length - 1 ? '   └─' : '   ├─';
            console.error(`${errorColors.red}${prefix} ${line.trim()}${errorColors.reset}`);
        });
    }
    console.error(''); // เว้นบรรทัด
    // บันทึก log ข้อผิดพลาด
    try {
        logger.request.error('ข้อผิดพลาดในแอปพลิเคชัน', {
            error: err.message,
            errorType: err.name,
            stack: err.stack,
            sqlQuery: err.sql,
            sqlMessage: err.sqlMessage,
            sqlErrorCode: err.errno,
            path: req.path,
            method: req.method,
            timestamp: timestamp,
            url: req.url,
            body: req.body ? JSON.stringify(req.body).substring(0, 500) : 'no body',
            queryParams: req.query
        });
    }
    catch (logError) {
        console.error(`${errorColors.red}[LOG ERROR] ไม่สามารถบันทึก error log ได้: ${logError.message}${errorColors.reset}`);
    }
    if (!res.headersSent) {
        const statusCode = err.status || err.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            message: "เกิดข้อผิดพลาดภายในระบบ",
            error: err.message,
            errorType: err.name || 'Unknown',
            timestamp: timestamp,
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack,
                sqlQuery: err.sql,
                sqlMessage: err.sqlMessage,
                requestBody: req.body,
                queryParams: req.query
            })
        });
    }
});
// Graceful shutdown function
async function gracefulShutdown(signal) {
    const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
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
    }
    catch (error) {
        console.error(`[${timestamp}] เกิดข้อผิดพลาดในระหว่างการปิดระบบ:`, error);
        process.exit(1);
    }
}
// จับสัญญาณ shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Start server
const httpPort = parseInt(config.http_port, 10) || 5009;
const httpsPort = config.https_port || 5443;
// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m', // สีเขียวสำหรับสำเร็จ
    red: '\x1b[31m', // สีแดงสำหรับ error
    bold: '\x1b[1m' // ตัวหนา
};
// HTTP Server
const httpServer = http.createServer(app);
httpServer.listen(httpPort, () => {
    const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
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
    }
    catch (error) {
        const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
        console.error(`[${timestamp}] ${colors.red}❌ HTTPS Error: ${error.message}${colors.reset}`);
    }
}
// ปิดใช้งานชั่วคราว cron jobs
//console.log('Starting cron jobs...');
//startCronJobs();
exports.default = app;
