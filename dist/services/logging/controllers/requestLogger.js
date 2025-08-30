"use strict";
/**
 * =================================================================
 * Request Logger - ระบบ Logging สำหรับ HTTP Requests และ API Calls
 * =================================================================
 *
 * ฟีเจอร์:
 * - บันทึก request/response logs
 * - Performance monitoring
 * - Error tracking
 * - Rate limiting detection
 * - Security event logging
 * - API usage statistics
 *
 * @author Nursing System Development Team
 * @version 2.0
 * @date 2025-06-06
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestLogger = void 0;
exports.wrapController = wrapController;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Import with require for modules without type declarations
const reqLoggerMoment = require('moment');
/**
 * Request Logger Class
 */
class RequestLogger {
    constructor() {
        this.config = {
            logDir: path_1.default.join(__dirname, '../../../logs/request'),
            maxFileSize: '20m',
            maxFiles: '14d',
            datePattern: 'YYYY-MM-DD',
            level: 'info'
        };
        this.requestTracking = {};
        this.performanceMetrics = new Map();
        this.ensureLogDirectory();
        this.initializeLoggers();
    }
    /**
     * สร้างโฟลเดอร์ logs ถ้ายังไม่มี
     */
    ensureLogDirectory() {
        try {
            if (!fs_1.default.existsSync(this.config.logDir)) {
                fs_1.default.mkdirSync(this.config.logDir, { recursive: true });
            }
        }
        catch (error) {
            console.error('Failed to create log directory:', error.message);
        }
    }
    /**
     * กำหนดค่า Winston Loggers
     */
    initializeLoggers() {
        // Main Request Logger
        this.logger = winston_1.default.createLogger({
            level: this.config.level,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
            transports: [
                new winston_1.default.transports.File({
                    filename: path_1.default.join(this.config.logDir, `request-${reqLoggerMoment().format(this.config.datePattern)}.log`),
                    maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
                    maxFiles: parseInt(this.config.maxFiles)
                })
            ]
        });
        // Security Events Logger
        this.securityLogger = winston_1.default.createLogger({
            level: 'warn',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            transports: [
                new winston_1.default.transports.File({
                    filename: path_1.default.join(this.config.logDir, `security-${reqLoggerMoment().format(this.config.datePattern)}.log`),
                    maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
                    maxFiles: parseInt(this.config.maxFiles)
                })
            ]
        });
        // Performance Logger
        this.performanceLogger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            transports: [
                new winston_1.default.transports.File({
                    filename: path_1.default.join(this.config.logDir, `performance-${reqLoggerMoment().format(this.config.datePattern)}.log`),
                    maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
                    maxFiles: parseInt(this.config.maxFiles)
                })
            ]
        });
    }
    /**
     * สร้าง request ID
     */
    generateRequestId() {
        return `req_${reqLoggerMoment().format('YYYYMMDD_HHmmss')}_${Math.random().toString(36).substr(2, 8)}`;
    }
    /**
     * เริ่มต้น tracking request
     */
    startRequestTracking(req) {
        const requestId = this.generateRequestId();
        // เก็บข้อมูลเบื้องต้น
        this.requestTracking[requestId] = {
            startTime: Date.now(),
            request: {
                requestId,
                method: req.method,
                url: req.url,
                ip: req.ip || req.connection.remoteAddress || 'unknown',
                userAgent: req.get('User-Agent'),
                timestamp: reqLoggerMoment().format('YYYY-MM-DD HH:mm:ss'),
                params: req.params,
                query: req.query,
                headers: this.sanitizeHeaders(req.headers),
                body: this.sanitizeBody(req.body)
            }
        };
        // เพิ่ม requestId ลง req object สำหรับ reference
        req.requestId = requestId;
        return requestId;
    }
    /**
     * จบการ tracking และบันทึก log
     */
    finishRequestTracking(requestId, res, error) {
        const tracking = this.requestTracking[requestId];
        if (!tracking) {
            return;
        }
        const duration = Date.now() - tracking.startTime;
        const logEntry = {
            ...tracking.request,
            statusCode: res.statusCode,
            duration,
            error: error?.message,
            timestamp: reqLoggerMoment().format('YYYY-MM-DD HH:mm:ss')
        };
        // บันทึก log
        this.logger.info('Request completed', logEntry);
        // อัปเดต performance metrics
        this.updatePerformanceMetrics(logEntry);
        // ตรวจสอบ security events
        this.checkSecurityEvents(logEntry, error);
        // ลบ tracking data
        delete this.requestTracking[requestId];
    }
    /**
     * ทำความสะอาด headers ที่ sensitive
     */
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        sensitiveHeaders.forEach(header => {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        });
        return sanitized;
    }
    /**
     * ทำความสะอาด request body ที่มี sensitive data
     */
    sanitizeBody(body) {
        if (!body || typeof body !== 'object') {
            return body;
        }
        const sanitized = { ...body };
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });
        return sanitized;
    }
    /**
     * อัปเดต performance metrics
     */
    updatePerformanceMetrics(logEntry) {
        const key = `${logEntry.method} ${logEntry.url}`;
        const existing = this.performanceMetrics.get(key);
        if (existing) {
            existing.requestCount++;
            existing.averageResponseTime = (existing.averageResponseTime + (logEntry.duration || 0)) / 2;
            existing.minResponseTime = Math.min(existing.minResponseTime, logEntry.duration || 0);
            existing.maxResponseTime = Math.max(existing.maxResponseTime, logEntry.duration || 0);
            existing.lastAccessed = logEntry.timestamp;
            if (logEntry.error) {
                existing.errorCount++;
            }
        }
        else {
            this.performanceMetrics.set(key, {
                endpoint: logEntry.url,
                method: logEntry.method,
                averageResponseTime: logEntry.duration || 0,
                minResponseTime: logEntry.duration || 0,
                maxResponseTime: logEntry.duration || 0,
                requestCount: 1,
                errorCount: logEntry.error ? 1 : 0,
                lastAccessed: logEntry.timestamp
            });
        }
    }
    /**
     * ตรวจสอบ security events
     */
    checkSecurityEvents(logEntry, error) {
        // ตรวจสอบ 401/403 errors
        if (logEntry.statusCode === 401 || logEntry.statusCode === 403) {
            this.logSecurityEvent({
                eventType: 'UNAUTHORIZED_ACCESS',
                severity: 'medium',
                description: `Unauthorized access attempt to ${logEntry.url}`,
                ip: logEntry.ip,
                userAgent: logEntry.userAgent,
                requestId: logEntry.requestId,
                timestamp: logEntry.timestamp,
                metadata: { statusCode: logEntry.statusCode }
            });
        }
        // ตรวจสอบ 500 errors
        if (logEntry.statusCode && logEntry.statusCode >= 500) {
            this.logSecurityEvent({
                eventType: 'SERVER_ERROR',
                severity: 'high',
                description: `Server error occurred: ${error?.message || 'Unknown error'}`,
                ip: logEntry.ip,
                requestId: logEntry.requestId,
                timestamp: logEntry.timestamp,
                metadata: {
                    statusCode: logEntry.statusCode,
                    error: error?.message,
                    stack: error?.stack
                }
            });
        }
        // ตรวจสอบ potential attacks
        if (this.isPotentialAttack(logEntry)) {
            this.logSecurityEvent({
                eventType: 'POTENTIAL_ATTACK',
                severity: 'high',
                description: 'Potential attack detected based on request patterns',
                ip: logEntry.ip,
                userAgent: logEntry.userAgent,
                requestId: logEntry.requestId,
                timestamp: logEntry.timestamp,
                metadata: {
                    url: logEntry.url,
                    method: logEntry.method,
                    body: logEntry.body
                }
            });
        }
    }
    /**
     * ตรวจสอบว่าเป็น potential attack หรือไม่
     */
    isPotentialAttack(logEntry) {
        const suspiciousPatterns = [
            /[<>'"]/, // XSS attempts
            /union.*select/i, // SQL injection
            /script.*alert/i, // XSS scripts
            /\.\.\/.*\.\.\//, // Directory traversal
            /eval\s*\(/i, // Code injection
        ];
        const urlToCheck = logEntry.url + JSON.stringify(logEntry.body || '');
        return suspiciousPatterns.some(pattern => pattern.test(urlToCheck));
    }
    /**
     * บันทึก security event
     */
    logSecurityEvent(event) {
        this.securityLogger.warn('Security event detected', event);
    }
    /**
     * Express middleware สำหรับ request logging
     */
    middleware() {
        const self = this;
        return (req, res, next) => {
            const requestId = self.startRequestTracking(req);
            // Override res.end เพื่อ capture response
            const originalEnd = res.end;
            res.end = function (chunk, encoding) {
                self.finishRequestTracking(requestId, res);
                return originalEnd.call(this, chunk, encoding || 'utf8');
            };
            // Handle errors
            res.on('error', (error) => {
                self.finishRequestTracking(requestId, res, error);
            });
            next();
        };
    }
    /**
     * ดึงสถิติการใช้งาน API
     */
    getApiUsageStats() {
        const stats = {
            totalRequests: 0,
            successfulRequests: 0,
            errorRequests: 0,
            averageResponseTime: 0,
            uniqueUsers: 0,
            uniqueIPs: 0,
            topEndpoints: [],
            errorSummary: []
        };
        let totalResponseTime = 0;
        const endpoints = [];
        for (const [key, metrics] of this.performanceMetrics.entries()) {
            stats.totalRequests += metrics.requestCount;
            stats.errorRequests += metrics.errorCount;
            stats.successfulRequests += (metrics.requestCount - metrics.errorCount);
            totalResponseTime += metrics.averageResponseTime * metrics.requestCount;
            endpoints.push({
                endpoint: key,
                count: metrics.requestCount,
                avgTime: metrics.averageResponseTime
            });
        }
        stats.averageResponseTime = stats.totalRequests > 0 ? totalResponseTime / stats.totalRequests : 0;
        stats.topEndpoints = endpoints.sort((a, b) => b.count - a.count).slice(0, 10);
        return stats;
    }
    /**
     * รีเซ็ตสถิติ
     */
    resetStats() {
        this.performanceMetrics.clear();
    }
    /**
     * ดึง performance metrics
     */
    getPerformanceMetrics() {
        return Array.from(this.performanceMetrics.values());
    }
}
exports.RequestLogger = RequestLogger;
/**
 * Wrapper function สำหรับ controller functions เพื่อจัดการ logging และ error handling
 * @param controllerFn - Controller function ที่ต้องการ wrap
 * @param timeoutMs - Timeout ในหน่วย milliseconds (default: 30000)
 * @returns Wrapped controller function
 */
function wrapController(controllerFn, timeoutMs = 30000) {
    return async (req, res, next) => {
        const startTime = Date.now();
        const requestId = requestLogger.startRequestTracking(req);
        try {
            // สร้าง Promise สำหรับ timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Request timeout after ${timeoutMs}ms`));
                }, timeoutMs);
            });
            // รัน controller function พร้อม timeout
            await Promise.race([
                controllerFn(req, res),
                timeoutPromise
            ]);
            // ถ้าสำเร็จ ให้บันทึก log
            requestLogger.finishRequestTracking(requestId, res);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // บันทึก error log
            requestLogger.finishRequestTracking(requestId, res, error);
            // ส่ง error response ถ้ายังไม่ได้ส่ง
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'เกิดข้อผิดพลาดภายในระบบ',
                    error: error.message,
                    requestId: requestId,
                    timestamp: new Date().toISOString()
                });
            }
        }
    };
}
// สร้าง singleton instance
const requestLogger = new RequestLogger();
exports.default = requestLogger;
