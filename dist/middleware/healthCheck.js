"use strict";
/**
 * =================================================================
 * healthCheck.ts - Middleware สำหรับตรวจสอบสถานะระบบ
 * =================================================================
 *
 * รวมฟังก์ชันการตรวจสอบสถานะระบบ:
 * - Memory usage monitoring
 * - System uptime tracking
 * - Rate limiting
 * - Critical API protection
 *
 * @author System Development Team
 * @version 1.0
 * @date 2025-01-20
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHealthResponse = exports.rateLimitCheck = exports.criticalApiCheck = exports.systemHealthCheck = void 0;
// Import with require for modules without type declarations
const healthMoment = require('moment-timezone');
const { logger } = require('../services/logging');
// Health Check Response Standards สำหรับ Frontend
const createHealthResponse = (success, message, details = {}, errorCode = null) => {
    const response = {
        success,
        message,
        timestamp: healthMoment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
        serverStatus: {
            memory: details.memory || null,
            uptime: details.uptime || null,
            status: success ? 'healthy' : 'unhealthy'
        }
    };
    if (errorCode) {
        response.errorCode = errorCode;
    }
    if (details.retryAfter) {
        response.retryAfter = details.retryAfter;
    }
    return response;
};
exports.createHealthResponse = createHealthResponse;
// Middleware สำหรับตรวจสอบสถานะระบบก่อนประมวลผล API
const systemHealthCheck = (req, res, next) => {
    try {
        // ตรวจสอบ Memory usage
        const memoryUsage = process.memoryUsage();
        const memoryUsageGB = memoryUsage.rss / 1024 / 1024 / 1024;
        const memoryUsageMB = memoryUsage.rss / 1024 / 1024;
        // ตรวจสอบ Uptime
        const uptimeSeconds = process.uptime();
        const uptimeHours = uptimeSeconds / 3600;
        // เพิ่มข้อมูล health ใน response header สำหรับ frontend
        res.set({
            'X-Server-Status': 'healthy',
            'X-Server-Uptime': Math.floor(uptimeSeconds).toString(),
            'X-Server-Memory-MB': Math.floor(memoryUsageMB).toString(),
            'X-Server-Memory-GB': memoryUsageGB.toFixed(2),
            'X-Server-Timestamp': healthMoment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
            'X-API-Version': '1.0.0'
        });
        // ตรวจสอบ Memory usage สูง
        if (memoryUsageGB > 2) {
            logger.system.warn('Memory usage สูง', {
                memoryUsageGB: memoryUsageGB.toFixed(2),
                memoryUsageMB: Math.floor(memoryUsageMB),
                endpoint: req.originalUrl,
                method: req.method,
                clientIP: req.ip
            });
            // ถ้า Memory เกิน 2.5GB ให้หยุดการประมวลผล
            if (memoryUsageGB > 2.5) {
                res.status(503).json(createHealthResponse(false, 'ระบบใช้หน่วยความจำมากเกินไป กรุณาลองใหม่ในอีกสักครู่', {
                    memory: `${memoryUsageGB.toFixed(2)}GB`,
                    uptime: `${uptimeHours.toFixed(1)} ชั่วโมง`,
                    retryAfter: 60
                }, 'HIGH_MEMORY_USAGE'));
                return;
            }
        }
        // ตรวจสอบ Uptime ยาวนาน
        if (uptimeHours > 72) {
            logger.system.info('ระบบทำงานต่อเนื่องยาวนาน', {
                uptimeHours: uptimeHours.toFixed(2),
                suggestion: 'ควรพิจารณา restart ระบบ',
                endpoint: req.originalUrl
            });
        }
        next();
    }
    catch (error) {
        const err = error;
        logger.system.error('Health Check Middleware Error', {
            error: err.message,
            stack: err.stack,
            endpoint: req.originalUrl,
            method: req.method,
            clientIP: req.ip
        });
        // ถ้า health check ผิดพลาด ให้ส่ง error response
        res.status(503).json(createHealthResponse(false, 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง', {
            retryAfter: 30
        }, 'HEALTH_CHECK_ERROR'));
    }
};
exports.systemHealthCheck = systemHealthCheck;
// Middleware สำหรับ API ที่สำคัญ (เช่น การ login, การบันทึกข้อมูล)
const criticalApiCheck = (req, res, next) => {
    try {
        const memoryUsage = process.memoryUsage();
        const memoryUsageGB = memoryUsage.rss / 1024 / 1024 / 1024;
        const memoryUsageMB = memoryUsage.rss / 1024 / 1024;
        // ตรวจสอบ Memory สำหรับ Critical API (เข้มงวดกว่า)
        if (memoryUsageGB > 1.5) {
            logger.system.error('Memory เกินขีดจำกัดสำหรับ Critical API', {
                memoryUsageGB: memoryUsageGB.toFixed(2),
                memoryUsageMB: Math.floor(memoryUsageMB),
                endpoint: req.originalUrl,
                method: req.method,
                clientIP: req.ip,
                userAgent: req.get('User-Agent') || 'unknown'
            });
            res.status(503).json(createHealthResponse(false, 'ระบบกำลังใช้งานหนัก กรุณารอสักครู่แล้วลองใหม่', {
                memory: `${memoryUsageGB.toFixed(2)}GB`,
                uptime: `${(process.uptime() / 3600).toFixed(1)} ชั่วโมง`,
                retryAfter: 30
            }, 'CRITICAL_HIGH_MEMORY'));
            return;
        }
        // ตรวจสอบ Load average (ถ้ามี)
        if (process.platform !== 'win32') {
            const os = require('os');
            const loadAvg = os.loadavg();
            if (loadAvg[0] > 5) { // 1-minute load average
                logger.system.warn('System Load สูงสำหรับ Critical API', {
                    loadAverage: loadAvg,
                    endpoint: req.originalUrl,
                    method: req.method
                });
            }
        }
        next();
    }
    catch (error) {
        const err = error;
        logger.system.error('Critical API Check Error', {
            error: err.message,
            stack: err.stack,
            endpoint: req.originalUrl,
            method: req.method
        });
        // ถ้าตรวจสอบไม่ได้ ให้ผ่านไปต่อ (fail-safe)
        next();
    }
};
exports.criticalApiCheck = criticalApiCheck;
// Middleware สำหรับจัดการ Rate Limiting (เพิ่มเติม)
const rateLimitCheck = (maxRequests = 100, windowMs = 60000) => {
    const requests = new Map();
    return (req, res, next) => {
        const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
        const currentTime = Date.now();
        const windowStart = currentTime - windowMs;
        // ล้างข้อมูลเก่า
        if (requests.has(clientIP)) {
            const userRequests = requests.get(clientIP).filter((time) => time > windowStart);
            requests.set(clientIP, userRequests);
        }
        else {
            requests.set(clientIP, []);
        }
        const userRequests = requests.get(clientIP);
        if (userRequests.length >= maxRequests) {
            logger.system.warn('Rate limit exceeded', {
                clientIP,
                requestCount: userRequests.length,
                endpoint: req.originalUrl,
                method: req.method
            });
            res.status(429).json(createHealthResponse(false, 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่', {
                retryAfter: Math.ceil(windowMs / 1000)
            }, 'RATE_LIMIT_EXCEEDED'));
            return;
        }
        userRequests.push(currentTime);
        next();
    };
};
exports.rateLimitCheck = rateLimitCheck;
