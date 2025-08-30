"use strict";
/**
 * =================================================================
 * Safe Logger - ระบบ Logging ที่ปลอดภัยและไม่ทำให้ระบบหลักหยุดทำงาน
 * =================================================================
 *
 * ฟีเจอร์:
 * - Graceful error handling - ไม่ให้ logging error ทำให้ระบบหลักหยุด
 * - Circuit breaker pattern - หยุด logging ชั่วคราวเมื่อมีปัญหา
 * - Fallback logging - ใช้ console.log เมื่อไฟล์ logging ไม่สามารถใช้ได้
 * - Async logging - ไม่ block main thread
 * - Health monitoring - ตรวจสอบสถานะ logging system
 * - Auto recovery - พยายาม recover เมื่อปัญหาหายไป
 *
 * @author Nursing System Development Team
 * @version 1.0
 * @date 2025-06-06
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CIRCUIT_STATES = exports.SafeLogger = void 0;
exports.createSafeLogger = createSafeLogger;
exports.wrapLoggerObject = wrapLoggerObject;
exports.getLoggerHealth = getLoggerHealth;
// Import with require for modules without type declarations
const safeLoggerMoment = require('moment');
// Circuit Breaker State
const CIRCUIT_STATES = {
    CLOSED: 'CLOSED', // ปกติ
    OPEN: 'OPEN', // มีปัญหา ไม่ให้ใช้ file logging
    HALF_OPEN: 'HALF_OPEN' // ทดสอบการกลับมาใช้งาน
};
exports.CIRCUIT_STATES = CIRCUIT_STATES;
class SafeLogger {
    constructor(originalLogger, loggerName = 'unknown') {
        this.originalLogger = originalLogger;
        this.loggerName = loggerName;
        // Circuit Breaker Configuration
        this.circuitBreaker = {
            state: CIRCUIT_STATES.CLOSED,
            failureCount: 0,
            lastFailureTime: null,
            failureThreshold: 5, // ล้มเหลว 5 ครั้งแล้วเปิด circuit
            recoveryTimeout: 30000, // รอ 30 วินาที ก่อนลองใหม่
            halfOpenMaxAttempts: 3 // ทดสอบ 3 ครั้งใน half-open state
        };
        // Performance Monitoring
        this.stats = {
            totalLogs: 0,
            successfulLogs: 0,
            failedLogs: 0,
            lastError: null,
            lastErrorTime: null,
            averageLogTime: 0
        };
        // Health Check
        this.healthStatus = {
            isHealthy: true,
            lastHealthCheck: new Date(),
            consecutiveFailures: 0
        };
        // Fallback storage (in-memory buffer)
        this.fallbackBuffer = [];
        this.maxBufferSize = 1000;
        // Auto-recovery interval
        this.recoveryInterval = null;
        this.startRecoveryMonitoring();
    }
    /**
     * เริ่ม monitoring สำหรับ auto-recovery
     */
    startRecoveryMonitoring() {
        this.recoveryInterval = setInterval(() => {
            this.attemptRecovery();
        }, 60000); // ตรวจสอบทุก 1 นาที
    }
    /**
     * พยายาม recover จากปัญหา
     */
    async attemptRecovery() {
        if (this.circuitBreaker.state === CIRCUIT_STATES.OPEN) {
            const timeSinceLastFailure = Date.now() - (this.circuitBreaker.lastFailureTime || 0);
            if (timeSinceLastFailure > this.circuitBreaker.recoveryTimeout) {
                console.log(`[SafeLogger:${this.loggerName}] พยายาม recover logging system...`);
                this.circuitBreaker.state = CIRCUIT_STATES.HALF_OPEN;
                this.circuitBreaker.failureCount = 0;
            }
        }
    }
    /**
     * ตรวจสอบสถานะ circuit breaker
     */
    canAttemptLogging() {
        return this.circuitBreaker.state !== CIRCUIT_STATES.OPEN;
    }
    /**
     * บันทึกความล้มเหลว
     */
    recordFailure(error) {
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.lastFailureTime = Date.now();
        this.stats.failedLogs++;
        this.stats.lastError = error.message;
        this.stats.lastErrorTime = new Date();
        this.healthStatus.consecutiveFailures++;
        this.healthStatus.isHealthy = false;
        // เปิด circuit หากล้มเหลวเกินกำหนด
        if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
            this.circuitBreaker.state = CIRCUIT_STATES.OPEN;
            console.warn(`[SafeLogger:${this.loggerName}] Circuit breaker OPENED - ปิดการ logging ชั่วคราว`);
        }
    }
    /**
     * บันทึกความสำเร็จ
     */
    recordSuccess() {
        this.stats.successfulLogs++;
        this.healthStatus.consecutiveFailures = 0;
        // ปิด circuit หากอยู่ใน half-open และสำเร็จ
        if (this.circuitBreaker.state === CIRCUIT_STATES.HALF_OPEN) {
            this.circuitBreaker.state = CIRCUIT_STATES.CLOSED;
            this.circuitBreaker.failureCount = 0;
            this.healthStatus.isHealthy = true;
            console.log(`[SafeLogger:${this.loggerName}] Circuit breaker CLOSED - กลับมาใช้งานปกติ`);
        }
    }
    /**
     * Fallback logging เมื่อ file logging ไม่สามารถใช้ได้
     */
    fallbackLog(level, message, meta = {}) {
        try {
            const timestamp = safeLoggerMoment().format('YYYY-MM-DD HH:mm:ss');
            const logEntry = {
                timestamp,
                level,
                message,
                meta,
                logger: this.loggerName,
                fallback: true
            };
            // เก็บใน buffer
            if (this.fallbackBuffer.length >= this.maxBufferSize) {
                this.fallbackBuffer.shift(); // เอาตัวเก่าออก
            }
            this.fallbackBuffer.push(logEntry);
            // Console output เป็น fallback
            const consoleMessage = `[${timestamp}] [${level.toUpperCase()}] [${this.loggerName}] ${message}`;
            if (level === 'error') {
                console.error(consoleMessage, meta);
            }
            else if (level === 'warn') {
                console.warn(consoleMessage, meta);
            }
            else {
                console.log(consoleMessage, meta);
            }
        }
        catch (fallbackError) {
            // หากแม้แต่ fallback ก็ล้มเหลว ก็ไม่ทำอะไร (silent fail)
            // เพื่อไม่ให้กระทบระบบหลัก
        }
    }
    /**
     * Safe logging method หลัก
     */
    async safeLog(level, message, meta = {}) {
        const startTime = Date.now();
        this.stats.totalLogs++;
        try {
            // ตรวจสอบ circuit breaker
            if (!this.canAttemptLogging()) {
                this.fallbackLog(level, message, meta);
                return false;
            }
            // พยายาม log ด้วย original logger
            await this.logWithTimeout(level, message, meta);
            // บันทึกความสำเร็จ
            this.recordSuccess();
            // อัปเดต performance stats
            const logTime = Date.now() - startTime;
            this.stats.averageLogTime = (this.stats.averageLogTime + logTime) / 2;
            return true;
        }
        catch (error) {
            // บันทึกความล้มเหลว
            this.recordFailure(error);
            // ใช้ fallback logging
            this.fallbackLog(level, `${message} [FALLBACK: ${error.message}]`, meta);
            return false;
        }
    }
    /**
     * Log ด้วย timeout เพื่อป้องกัน hang
     */
    async logWithTimeout(level, message, meta, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Logging timeout after ${timeout}ms`));
            }, timeout);
            try {
                // เรียกใช้ original logger
                if (this.originalLogger && typeof this.originalLogger[level] === 'function') {
                    this.originalLogger[level](message, meta);
                    clearTimeout(timer);
                    resolve();
                }
                else {
                    clearTimeout(timer);
                    reject(new Error(`Logger method '${level}' not available`));
                }
            }
            catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }
    /**
     * Public logging methods
     */
    info(message, meta = {}) {
        // ใช้ setImmediate เพื่อทำให้ non-blocking
        setImmediate(() => this.safeLog('info', message, meta));
    }
    warn(message, meta = {}) {
        setImmediate(() => this.safeLog('warn', message, meta));
    }
    error(message, meta = {}) {
        setImmediate(() => this.safeLog('error', message, meta));
    }
    debug(message, meta = {}) {
        setImmediate(() => this.safeLog('debug', message, meta));
    }
    /**
     * ดึงสถิติการทำงาน
     */
    getStats() {
        return {
            ...this.stats,
            circuitBreaker: { ...this.circuitBreaker },
            healthStatus: { ...this.healthStatus },
            bufferSize: this.fallbackBuffer.length
        };
    }
    /**
     * รีเซ็ตสถิติ
     */
    resetStats() {
        this.stats = {
            totalLogs: 0,
            successfulLogs: 0,
            failedLogs: 0,
            lastError: null,
            lastErrorTime: null,
            averageLogTime: 0
        };
        this.healthStatus.consecutiveFailures = 0;
    }
    /**
     * บังคับ flush buffer ไป console
     */
    flushBuffer() {
        const bufferCopy = [...this.fallbackBuffer];
        this.fallbackBuffer = [];
        console.log(`[SafeLogger:${this.loggerName}] Flushing ${bufferCopy.length} buffered logs:`);
        bufferCopy.forEach((entry) => {
            console.log(JSON.stringify(entry));
        });
    }
    /**
     * ปิดระบบ (cleanup)
     */
    destroy() {
        if (this.recoveryInterval) {
            clearInterval(this.recoveryInterval);
            this.recoveryInterval = null;
        }
        this.flushBuffer(); // flush logs ที่เหลือ
    }
}
exports.SafeLogger = SafeLogger;
/**
 * Factory function สำหรับสร้าง Safe Logger
 */
function createSafeLogger(originalLogger, loggerName) {
    return new SafeLogger(originalLogger, loggerName);
}
/**
 * Wrapper สำหรับ winston logger object ทั้งหมด
 */
function wrapLoggerObject(loggerObject) {
    const safeLoggers = {};
    for (const [key, logger] of Object.entries(loggerObject)) {
        safeLoggers[key] = createSafeLogger(logger, key);
    }
    return safeLoggers;
}
/**
 * Health check function
 */
function getLoggerHealth(safeLoggers) {
    const health = {};
    for (const [key, logger] of Object.entries(safeLoggers)) {
        health[key] = logger.getStats();
    }
    return health;
}
