"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentLevels = exports.LOG_LEVELS = exports.original = void 0;
exports.getLogFileName = getLogFileName;
const path_1 = __importDefault(require("path"));
// Import with require for modules without type declarations
const winston = require('winston');
const { wrapLoggerObject } = require('../safeLogger');
/**
 * สร้างชื่อไฟล์ log ตามวันที่ปัจจุบัน
 */
function getLogFileName(baseName) {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${baseName}-${dateStr}.log`;
}
/**
 * กำหนดรูปแบบ log สำหรับการบันทึกลงไฟล์
 * - เพิ่ม timestamp รูปแบบ YYYY-MM-DD HH:mm:ss
 * - แปลงเป็น JSON format
 */
const logFormat = winston.format.combine(winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
}), winston.format.json());
/**
 * กำหนดรูปแบบ log สำหรับแสดงใน console
 * - เพิ่มสี
 * - แสดงผลแบบ simple format
 */
const consoleFormat = winston.format.combine(winston.format.colorize(), winston.format.simple());
// ตรวจสอบ environment สำหรับการตั้งค่า logging level
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
// กำหนด log levels ตาม environment
const LOG_LEVELS = {
    development: {
        connection: 'debug', // debug ทุกอย่างใน development
        request: 'debug',
        system: 'debug',
        generatePlan: 'info', // เพิ่มจาก error เป็น info
        auth: 'debug'
    },
    production: {
        connection: 'warn', // production ใช้ระดับสูงกว่า
        request: 'info',
        system: 'info',
        generatePlan: 'error',
        auth: 'info'
    }
};
exports.LOG_LEVELS = LOG_LEVELS;
const currentLevels = isDevelopment ? LOG_LEVELS.development : LOG_LEVELS.production;
exports.currentLevels = currentLevels;
// Logger configuration console output ถูกปิดใช้งาน
// console.log(`[Logger Config] Environment: ${process.env.NODE_ENV}, isDevelopment: ${isDevelopment}`);
// console.log(`[Logger Config] Log Levels:`, currentLevels);
/**
 * สร้าง transports array ตาม environment
 */
function createTransports(logType, level) {
    const transports = [];
    // File transports (ทุก environment)
    const logPaths = {
        connection: {
            info: path_1.default.join(__dirname, '../../../logs/connection/', getLogFileName('connection')),
            error: path_1.default.join(__dirname, '../../../logs/connection/', getLogFileName('connection-error'))
        },
        request: {
            info: path_1.default.join(__dirname, '../../../logs/request/', getLogFileName('request')),
            error: path_1.default.join(__dirname, '../../../logs/request/', getLogFileName('request-error'))
        },
        system: {
            info: path_1.default.join(__dirname, '../../../logs/system/', getLogFileName('system')),
            error: path_1.default.join(__dirname, '../../../logs/system/', getLogFileName('system-error'))
        },
        generatePlan: {
            info: path_1.default.join(__dirname, '../../../logs/auto-generate/', getLogFileName('generate-plan')),
            error: path_1.default.join(__dirname, '../../../logs/auto-generate/', getLogFileName('generate-plan-error'))
        },
        auth: {
            info: path_1.default.join(__dirname, '../../../logs/system/', getLogFileName('auth')),
            error: path_1.default.join(__dirname, '../../../logs/system/', getLogFileName('auth-error'))
        }
    };
    // เพิ่ม file transports
    if (logPaths[logType]) {
        // Info level file
        transports.push(new winston.transports.File({
            filename: logPaths[logType].info,
            level: 'debug' // เก็บทุก level ลงไฟล์
        }));
        // Error level file (แยกไฟล์)
        transports.push(new winston.transports.File({
            filename: logPaths[logType].error,
            level: 'error'
        }));
    }
    // Console transport ถูกปิดใช้งาน - บันทึกเฉพาะลงไฟล์
    // if (isDevelopment && logType !== 'connection') {
    //   transports.push(new winston.transports.Console({
    //     format: winston.format.combine(
    //       winston.format.colorize(),
    //       winston.format.timestamp({
    //         format: 'YYYY-MM-DD HH:mm:ss'  // เพิ่มรูปแบบ timestamp
    //       }),
    //       winston.format.printf(({ timestamp, level, message, ...meta }) => {
    //         const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    //         return `[${timestamp}] [${logType.toUpperCase()}] ${level}: ${message}${metaString}`;
    //       })
    //     ),
    //     level: level  // ใช้ level ที่กำหนด
    //   }));
    // }
    return transports;
}
/**
 * สร้าง winston logger instances (Original)
 * จัดระเบียบแยกโฟลเดอร์ตามประเภท:
 * - auto-generate/: สำหรับบันทึก log การ generate plan
 * - request/: สำหรับบันทึก log การเรียก API
 * - connection/: สำหรับบันทึก log เกี่ยวกับ database connection
 * - system/: สำหรับบันทึก log ระบบทั่วไป
 */
const originalLogger = {
    // Generate Plan Logs - เก็บในโฟลเดอร์ auto-generate
    generatePlan: winston.createLogger({
        level: currentLevels.generatePlan,
        format: logFormat,
        transports: createTransports('generatePlan', currentLevels.generatePlan)
    }),
    // Request Logs - เก็บในโฟลเดอร์ request
    request: winston.createLogger({
        level: currentLevels.request,
        format: logFormat,
        transports: createTransports('request', currentLevels.request)
    }),
    // Connection Logs - เก็บในโฟลเดอร์ connection  
    connection: winston.createLogger({
        level: currentLevels.connection,
        format: logFormat,
        transports: createTransports('connection', currentLevels.connection)
    }),
    // System Logs - เก็บในโฟลเดอร์ system
    system: winston.createLogger({
        level: currentLevels.system,
        format: logFormat,
        transports: createTransports('system', currentLevels.system)
    }),
    // Authentication Logs
    auth: winston.createLogger({
        level: currentLevels.auth,
        format: logFormat,
        transports: createTransports('auth', currentLevels.auth)
    })
};
exports.original = originalLogger;
/**
 * สร้าง Safe Logger instances ที่ครอบ winston loggers
 * ใช้ SafeLogger pattern เพื่อป้องกันไม่ให้ logging errors กระทบระบบหลัก
 */
const safeLogger = wrapLoggerObject(originalLogger);
// Logger configuration summary ถูกปิดใช้งาน
// console.log(`[Logger Config] Loggers created with levels:
//   - connection: ${currentLevels.connection}
//   - request: ${currentLevels.request}
//   - system: ${currentLevels.system}
//   - generatePlan: ${currentLevels.generatePlan}
//   - auth: ${currentLevels.auth}
//   - Console output: ${isDevelopment ? 'enabled' : 'disabled'}`);
// Export ทั้ง safe logger และ original logger (สำหรับกรณีฉุกเฉิน)
exports.default = safeLogger;
