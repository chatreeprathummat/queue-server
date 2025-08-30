"use strict";
/**
 * =================================================================
 * Generate Plan Logger - ระบบ Logging สำหรับ Plan Generation Process
 * =================================================================
 *
 * ฟีเจอร์:
 * - บันทึก log การ generate plan
 * - Performance monitoring สำหรับ plan generation
 * - Error tracking และ diagnostics
 * - Success/failure statistics
 * - Plan generation metrics
 * - Session tracking
 * - Plan validation logging
 *
 * @author Nursing System Development Team
 * @version 2.0
 * @date 2025-06-06
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratePlanLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Import with require for modules without type declarations
const genPlanLoggerMoment = require('moment');
/**
 * Generate Plan Logger Class
 */
class GeneratePlanLogger {
    constructor() {
        this.config = {
            logDir: path_1.default.join(__dirname, '../../../logs/generate-plan'),
            maxFileSize: '50m',
            maxFiles: '30d',
            datePattern: 'YYYY-MM-DD',
            level: 'info'
        };
        this.sessionTracking = {};
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
            console.error('Failed to create generate plan log directory:', error.message);
        }
    }
    /**
     * กำหนดค่า Winston Loggers
     */
    initializeLoggers() {
        const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
        // Main Generation Logger
        this.logger = winston_1.default.createLogger({
            level: this.config.level,
            format: logFormat,
            transports: [
                new winston_1.default.transports.File({
                    filename: path_1.default.join(this.config.logDir, `generate-plan-${genPlanLoggerMoment().format(this.config.datePattern)}.log`),
                    maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
                    maxFiles: parseInt(this.config.maxFiles)
                })
            ]
        });
        // Metrics Logger
        this.metricsLogger = winston_1.default.createLogger({
            level: 'info',
            format: logFormat,
            transports: [
                new winston_1.default.transports.File({
                    filename: path_1.default.join(this.config.logDir, `metrics-${genPlanLoggerMoment().format(this.config.datePattern)}.log`),
                    maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
                    maxFiles: parseInt(this.config.maxFiles)
                })
            ]
        });
        // Performance Logger
        this.performanceLogger = winston_1.default.createLogger({
            level: 'info',
            format: logFormat,
            transports: [
                new winston_1.default.transports.File({
                    filename: path_1.default.join(this.config.logDir, `performance-${genPlanLoggerMoment().format(this.config.datePattern)}.log`),
                    maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
                    maxFiles: parseInt(this.config.maxFiles)
                })
            ]
        });
        // Validation Logger
        this.validationLogger = winston_1.default.createLogger({
            level: 'info',
            format: logFormat,
            transports: [
                new winston_1.default.transports.File({
                    filename: path_1.default.join(this.config.logDir, `validation-${genPlanLoggerMoment().format(this.config.datePattern)}.log`),
                    maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
                    maxFiles: parseInt(this.config.maxFiles)
                })
            ]
        });
    }
    /**
     * เริ่มต้น session การ generate plan
     */
    startGenerationSession(sessionId, planType, totalPatients) {
        const timestamp = genPlanLoggerMoment().format('YYYY-MM-DD HH:mm:ss');
        this.sessionTracking[sessionId] = {
            sessionId,
            planType,
            startTime: Date.now(),
            metrics: {
                sessionId,
                planType,
                startTime: timestamp,
                totalPatients,
                processedPatients: 0,
                successfulPlans: 0,
                failedPlans: 0,
                skippedPlans: 0,
                errors: [],
                warnings: []
            },
            performanceSnapshots: []
        };
        const entry = {
            sessionId,
            planType,
            timestamp,
            step: 'session_start',
            status: 'started',
            patientCount: totalPatients,
            details: {
                startTime: timestamp,
                planType,
                totalPatients
            }
        };
        this.logger.info('Generation session started', entry);
    }
    /**
     * บันทึก log สำหรับขั้นตอนการ generate
     */
    logGenerationStep(sessionId, step, status, details) {
        const entry = {
            sessionId,
            planType: this.sessionTracking[sessionId]?.planType || 'NC',
            timestamp: genPlanLoggerMoment().format('YYYY-MM-DD HH:mm:ss'),
            step,
            status,
            details
        };
        this.logger.info(`Generation step: ${step}`, entry);
        // บันทึก performance snapshot
        this.capturePerformanceSnapshot(sessionId);
    }
    /**
     * บันทึก log เมื่อ generate plan สำเร็จ
     */
    logPlanSuccess(sessionId, planType, patientId, details) {
        const session = this.sessionTracking[sessionId];
        if (session) {
            session.metrics.processedPatients++;
            session.metrics.successfulPlans++;
        }
        const entry = {
            sessionId,
            planType,
            timestamp: genPlanLoggerMoment().format('YYYY-MM-DD HH:mm:ss'),
            step: 'plan_generated',
            status: 'completed',
            details: {
                patientId,
                planType,
                ...details
            }
        };
        this.logger.info('Plan generated successfully', entry);
    }
    /**
     * บันทึก log เมื่อ generate plan ล้มเหลว
     */
    logPlanError(sessionId, planType, patientId, error, details) {
        const session = this.sessionTracking[sessionId];
        if (session) {
            session.metrics.processedPatients++;
            session.metrics.failedPlans++;
            // เพิ่ม error ใน summary
            const existingError = session.metrics.errors.find(e => e.error === error.message);
            if (existingError) {
                existingError.count++;
            }
            else {
                session.metrics.errors.push({ error: error.message, count: 1 });
            }
        }
        const entry = {
            sessionId,
            planType,
            timestamp: genPlanLoggerMoment().format('YYYY-MM-DD HH:mm:ss'),
            step: 'plan_generation_failed',
            status: 'failed',
            errorMessage: error.message,
            details: {
                patientId,
                planType,
                error: error.message,
                stack: error.stack,
                ...details
            }
        };
        this.logger.error('Plan generation failed', entry);
    }
    /**
     * บันทึก plan validation
     */
    logPlanValidation(sessionId, planId, planType, validationStatus, validationErrors, validationWarnings, details) {
        const entry = {
            sessionId,
            planId,
            planType,
            timestamp: genPlanLoggerMoment().format('YYYY-MM-DD HH:mm:ss'),
            validationStatus,
            validationErrors,
            validationWarnings,
            details
        };
        if (validationStatus === 'invalid') {
            this.validationLogger.error('Plan validation failed', entry);
        }
        else if (validationStatus === 'warning') {
            this.validationLogger.warn('Plan validation warnings', entry);
        }
        else {
            this.validationLogger.info('Plan validation passed', entry);
        }
    }
    /**
     * บันทึก performance snapshot
     */
    capturePerformanceSnapshot(sessionId) {
        const session = this.sessionTracking[sessionId];
        if (!session)
            return;
        const memUsage = process.memoryUsage();
        const snapshot = {
            timestamp: genPlanLoggerMoment().format('YYYY-MM-DD HH:mm:ss'),
            memoryUsage: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            processedCount: session.metrics.processedPatients,
            remainingCount: session.metrics.totalPatients - session.metrics.processedPatients
        };
        session.performanceSnapshots.push(snapshot);
        this.performanceLogger.info('Performance snapshot', snapshot);
    }
    /**
     * จบ session การ generate plan
     */
    finishGenerationSession(sessionId, success = true) {
        const session = this.sessionTracking[sessionId];
        if (!session) {
            console.warn(`Session ${sessionId} not found for finishing`);
            return null;
        }
        const endTime = genPlanLoggerMoment().format('YYYY-MM-DD HH:mm:ss');
        const totalDuration = Date.now() - session.startTime;
        // อัปเดต metrics
        session.metrics.endTime = endTime;
        session.metrics.totalDuration = totalDuration;
        if (session.metrics.successfulPlans > 0) {
            session.metrics.averageTimePerPlan = totalDuration / session.metrics.successfulPlans;
        }
        // คำนวณ peak memory usage
        if (session.performanceSnapshots.length > 0) {
            session.metrics.peakMemoryUsage = Math.max(...session.performanceSnapshots.map(s => s.memoryUsage.used));
        }
        const entry = {
            sessionId,
            planType: session.planType,
            timestamp: endTime,
            step: 'session_end',
            status: success ? 'completed' : 'failed',
            patientCount: session.metrics.totalPatients,
            generatedPlans: session.metrics.successfulPlans,
            skippedPlans: session.metrics.skippedPlans,
            errorCount: session.metrics.failedPlans,
            duration: totalDuration,
            details: session.metrics
        };
        this.logger.info('Generation session finished', entry);
        this.metricsLogger.info('Session metrics', session.metrics);
        // คืนค่า metrics และลบ session
        const metrics = { ...session.metrics };
        delete this.sessionTracking[sessionId];
        return metrics;
    }
    /**
     * ดึงสถิติการ generate plans
     */
    getSessionMetrics(sessionId) {
        const session = this.sessionTracking[sessionId];
        return session ? { ...session.metrics } : null;
    }
    /**
     * ดึงรายการ active sessions
     */
    getActiveSessions() {
        return Object.keys(this.sessionTracking);
    }
    /**
     * ล้าง session ที่ hang (อายุเกิน 2 ชั่วโมง)
     */
    cleanupHangingSessions() {
        const now = Date.now();
        const twoHours = 2 * 60 * 60 * 1000;
        for (const [sessionId, session] of Object.entries(this.sessionTracking)) {
            if (now - session.startTime > twoHours) {
                console.warn(`Cleaning up hanging session: ${sessionId}`);
                this.finishGenerationSession(sessionId, false);
            }
        }
    }
    /**
     * บันทึก warning
     */
    logWarning(sessionId, message, details) {
        const session = this.sessionTracking[sessionId];
        if (session) {
            const existingWarning = session.metrics.warnings.find(w => w.warning === message);
            if (existingWarning) {
                existingWarning.count++;
            }
            else {
                session.metrics.warnings.push({ warning: message, count: 1 });
            }
        }
        const entry = {
            sessionId,
            planType: session?.planType || 'NC',
            timestamp: genPlanLoggerMoment().format('YYYY-MM-DD HH:mm:ss'),
            step: 'warning',
            status: 'in_progress',
            details: {
                message,
                ...details
            }
        };
        this.logger.warn(message, entry);
    }
}
exports.GeneratePlanLogger = GeneratePlanLogger;
// สร้าง singleton instance
const generatePlanLogger = new GeneratePlanLogger();
exports.default = generatePlanLogger;
