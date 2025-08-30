"use strict";
/**
 * =================================================================
 * multiTabHandler.ts - Multi-Tab Handler Middleware
 * =================================================================
 *
 * แก้ไขปัญหาการใช้งาน Multiple Tabs พร้อมกัน:
 * - ป้องกัน Request ค้าง
 * - จัดการ Connection Pool
 * - ป้องกัน Race Condition
 * - Request Timeout Management
 *
 * @author System Development Team
 * @version 1.0
 * @date 2025-01-20
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetMultiTabStats = exports.getMultiTabStats = exports.multiTabHandler = void 0;
// Import with require for modules without type declarations
const multiTabMoment = require('moment-timezone');
// เก็บสถิติการใช้งาน
const stats = {
    activeRequests: new Map(),
    totalRequests: 0,
    errorRequests: 0,
    timeoutRequests: 0,
    lastCleanup: Date.now()
};
// กำหนดค่า timeout สำหรับแต่ละประเภท API
const TIMEOUT_CONFIG = {
    // Critical APIs - เวลาสั้น
    'saveNCRecord': 30000, // 30 วินาที
    'deleteRecord': 20000, // 20 วินาที
    'updatePlan': 25000, // 25 วินาที
    // Query APIs - เวลาปานกลาง
    'getRecords': 15000, // 15 วินาที
    'getPlans': 12000, // 12 วินาที
    'scanNCCode': 10000, // 10 วินาที
    // Simple APIs - เวลาสั้น
    'health': 5000, // 5 วินาที
    'getNcCodes': 8000, // 8 วินาที
    // Default timeout
    'default': 60000 // 60 วินาที
};
/**
 * สร้าง unique request ID
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * ระบุประเภท API จาก URL
 */
function getApiType(url) {
    // ลำดับความสำคัญในการตรวจสอบ
    const patterns = [
        { pattern: /\/saveNCRecord/i, type: 'saveNCRecord' },
        { pattern: /\/delete.*record/i, type: 'deleteRecord' },
        { pattern: /\/update.*plan/i, type: 'updatePlan' },
        { pattern: /\/get.*records/i, type: 'getRecords' },
        { pattern: /\/get.*plans/i, type: 'getPlans' },
        { pattern: /\/scanNCCode/i, type: 'scanNCCode' },
        { pattern: /\/health/i, type: 'health' },
        { pattern: /\/get.*codes/i, type: 'getNcCodes' }
    ];
    for (const { pattern, type } of patterns) {
        if (pattern.test(url)) {
            return type;
        }
    }
    return 'default';
}
/**
 * ทำความสะอาด active requests ที่เก่า
 */
function cleanupOldRequests() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 นาที
    for (const [requestId, requestInfo] of stats.activeRequests) {
        if (now - requestInfo.startTime > maxAge) {
            console.log(`[MultiTab] ทำความสะอาด request เก่า: ${requestId}`);
            stats.activeRequests.delete(requestId);
        }
    }
    stats.lastCleanup = now;
}
/**
 * Main middleware function
 */
const multiTabHandler = (req, res, next) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    const apiType = getApiType(req.originalUrl);
    const timeout = TIMEOUT_CONFIG[apiType] || TIMEOUT_CONFIG.default;
    // ทำความสะอาดทุก 5 นาที
    if (startTime - stats.lastCleanup > 5 * 60 * 1000) {
        cleanupOldRequests();
    }
    console.log(`[MultiTab] ${requestId} เริ่มต้น: ${req.method} ${req.originalUrl} (timeout: ${timeout}ms)`);
    // บันทึกข้อมูล request
    const requestInfo = {
        id: requestId,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent') || 'Unknown',
        ip: req.ip || req.connection?.remoteAddress || 'unknown',
        startTime: startTime,
        apiType: apiType,
        timeout: timeout,
        status: 'active'
    };
    stats.activeRequests.set(requestId, requestInfo);
    stats.totalRequests++;
    // เพิ่ม request info ใน req object
    req.requestId = requestId;
    req.requestStartTime = startTime;
    req.apiType = apiType;
    // ตั้ง timeout สำหรับ request
    const timeoutHandler = setTimeout(() => {
        if (stats.activeRequests.has(requestId)) {
            console.error(`[MultiTab] ${requestId} TIMEOUT หลังจาก ${timeout}ms`);
            stats.timeoutRequests++;
            requestInfo.status = 'timeout';
            requestInfo.endTime = Date.now();
            requestInfo.duration = requestInfo.endTime - requestInfo.startTime;
            if (!res.headersSent) {
                res.status(408).json({
                    success: false,
                    message: 'การประมวลผลใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง',
                    errorCode: 'REQUEST_TIMEOUT',
                    requestId: requestId,
                    timeout: timeout
                });
            }
            // ไม่ลบออกจาก activeRequests ทันที เพื่อให้ cleanup ทำหน้าที่
        }
    }, timeout);
    // Override res.json เพื่อจัดการ response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        clearTimeout(timeoutHandler);
        if (stats.activeRequests.has(requestId)) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            requestInfo.status = 'completed';
            requestInfo.endTime = endTime;
            requestInfo.duration = duration;
            requestInfo.statusCode = res.statusCode;
            console.log(`[MultiTab] ${requestId} เสร็จสิ้น: ${res.statusCode} ใช้เวลา ${duration}ms`);
            // เพิ่ม response headers เพื่อช่วย debug
            res.set({
                'X-Request-ID': requestId,
                'X-Request-Duration': duration.toString(),
                'X-API-Type': apiType
            });
            // ลบออกจาก active requests หลังจาก 30 วินาที
            setTimeout(() => {
                stats.activeRequests.delete(requestId);
            }, 30000);
            // ตรวจสอบว่าเป็น error response หรือไม่
            if (body && typeof body === 'object' && !body.success && body.success !== undefined) {
                stats.errorRequests++;
            }
        }
        return originalJson(body);
    };
    // Override res.status().json() pattern
    const originalStatus = res.status.bind(res);
    res.status = function (code) {
        const statusRes = originalStatus(code);
        // Override json method on the returned object
        const statusOriginalJson = statusRes.json.bind(statusRes);
        statusRes.json = function (body) {
            clearTimeout(timeoutHandler);
            if (stats.activeRequests.has(requestId)) {
                const endTime = Date.now();
                const duration = endTime - startTime;
                requestInfo.status = 'completed';
                requestInfo.endTime = endTime;
                requestInfo.duration = duration;
                requestInfo.statusCode = code;
                console.log(`[MultiTab] ${requestId} เสร็จสิ้น: ${code} ใช้เวลา ${duration}ms`);
                // เพิ่ม response headers
                statusRes.set({
                    'X-Request-ID': requestId,
                    'X-Request-Duration': duration.toString(),
                    'X-API-Type': apiType
                });
                // ลบออกจาก active requests หลังจาก 30 วินาที
                setTimeout(() => {
                    stats.activeRequests.delete(requestId);
                }, 30000);
                // ตรวจสอบว่าเป็น error response หรือไม่
                if (body && typeof body === 'object' && !body.success && body.success !== undefined) {
                    stats.errorRequests++;
                }
            }
            return statusOriginalJson(body);
        };
        return statusRes;
    };
    // จัดการ error ที่อาจเกิดขึ้นใน request
    req.on('error', (err) => {
        console.error(`[MultiTab] ${requestId} Request Error:`, err.message);
        clearTimeout(timeoutHandler);
        if (stats.activeRequests.has(requestId)) {
            requestInfo.status = 'completed';
            requestInfo.endTime = Date.now();
            requestInfo.duration = requestInfo.endTime - requestInfo.startTime;
            stats.errorRequests++;
        }
    });
    // จัดการ connection close
    req.on('close', () => {
        console.log(`[MultiTab] ${requestId} Connection closed by client`);
        clearTimeout(timeoutHandler);
        if (stats.activeRequests.has(requestId)) {
            requestInfo.status = 'completed';
            requestInfo.endTime = Date.now();
            requestInfo.duration = requestInfo.endTime - requestInfo.startTime;
        }
    });
    next();
};
exports.multiTabHandler = multiTabHandler;
/**
 * ฟังก์ชันสำหรับดูสถิติการใช้งาน
 */
const getMultiTabStats = () => {
    const activeCount = stats.activeRequests.size;
    const activeRequests = Array.from(stats.activeRequests.values());
    // จัดกลุ่มตาม API type
    const apiTypeStats = {};
    activeRequests.forEach(req => {
        apiTypeStats[req.apiType] = (apiTypeStats[req.apiType] || 0) + 1;
    });
    return {
        timestamp: multiTabMoment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
        totalRequests: stats.totalRequests,
        activeRequests: activeCount,
        errorRequests: stats.errorRequests,
        timeoutRequests: stats.timeoutRequests,
        successRate: stats.totalRequests > 0 ?
            ((stats.totalRequests - stats.errorRequests - stats.timeoutRequests) / stats.totalRequests * 100).toFixed(2) + '%' :
            '100%',
        apiTypeBreakdown: apiTypeStats,
        activeRequestDetails: activeRequests.map(req => ({
            id: req.id,
            method: req.method,
            url: req.url,
            apiType: req.apiType,
            duration: Date.now() - req.startTime,
            timeout: req.timeout
        }))
    };
};
exports.getMultiTabStats = getMultiTabStats;
/**
 * ฟังก์ชันสำหรับ reset สถิติ
 */
const resetMultiTabStats = () => {
    stats.totalRequests = 0;
    stats.errorRequests = 0;
    stats.timeoutRequests = 0;
    stats.lastCleanup = Date.now();
    console.log(`[MultiTab] สถิติถูก reset เรียบร้อยแล้ว`);
};
exports.resetMultiTabStats = resetMultiTabStats;
