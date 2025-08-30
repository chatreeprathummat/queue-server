"use strict";
/**
 * ไฟล์รวม export สำหรับระบบ logging ทั้งหมด
 * เพิ่ม Safe Logger และ health monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CIRCUIT_STATES = exports.withTimeout = exports.wrapController = exports.resetStats = exports.logGeneratePlan = exports.logger = void 0;
exports.getLoggingHealth = getLoggingHealth;
exports.flushAllLoggers = flushAllLoggers;
exports.resetAllLoggerStats = resetAllLoggerStats;
exports.safeLog = safeLog;
// Import with require for modules without type declarations
const moment = require('moment');
const logger = require('./config/loggerConfig');
exports.logger = logger;
const { logGeneratePlan, resetStats } = require('./controllers/generatePlanLogger');
exports.logGeneratePlan = logGeneratePlan;
exports.resetStats = resetStats;
const { wrapController, withTimeout } = require('./controllers/requestLogger');
exports.wrapController = wrapController;
exports.withTimeout = withTimeout;
const { getLoggerHealth, CIRCUIT_STATES } = require('./safeLogger');
exports.CIRCUIT_STATES = CIRCUIT_STATES;
/**
 * ฟังก์ชันสำหรับตรวจสอบสุขภาพของ logging system
 */
function getLoggingHealth() {
    try {
        return getLoggerHealth(logger);
    }
    catch (error) {
        console.error('[Logging Health Check] Error:', error.message);
        return {
            error: error.message,
            timestamp: new Date(),
            status: 'unhealthy'
        };
    }
}
/**
 * ฟังก์ชันสำหรับ flush ข้อมูล buffer ของ Safe Loggers
 */
function flushAllLoggers() {
    try {
        Object.keys(logger).forEach((key) => {
            if (logger[key] && typeof logger[key].flushBuffer === 'function') {
                logger[key].flushBuffer();
            }
        });
        return { success: true, message: 'All loggers flushed successfully' };
    }
    catch (error) {
        console.error('[Logger Flush] Error:', error.message);
        return { success: false, error: error.message };
    }
}
/**
 * ฟังก์ชันสำหรับ reset สถิติของ Safe Loggers
 */
function resetAllLoggerStats() {
    try {
        Object.keys(logger).forEach((key) => {
            if (logger[key] && typeof logger[key].resetStats === 'function') {
                logger[key].resetStats();
            }
        });
        return { success: true, message: 'All logger stats reset successfully' };
    }
    catch (error) {
        console.error('[Logger Stats Reset] Error:', error.message);
        return { success: false, error: error.message };
    }
}
/**
 * Safe wrapper สำหรับการใช้ logger
 * ป้องกันไม่ให้ logging error ทำให้ระบบหลักหยุดทำงาน
 */
function safeLog(loggerName, level, message, meta = {}) {
    try {
        if (logger[loggerName] && typeof logger[loggerName][level] === 'function') {
            logger[loggerName][level](message, meta);
        }
        else {
            // Fallback to console logging
            console.log(`[FALLBACK LOG] [${loggerName}] [${level.toUpperCase()}] ${message}`, meta);
        }
    }
    catch (error) {
        // Silent fail - ไม่ให้ logging error กระทบระบบหลัก
        console.error(`[Safe Log Error] Logger: ${loggerName}, Level: ${level}, Error: ${error.message}`);
    }
}
