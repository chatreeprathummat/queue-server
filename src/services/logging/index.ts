/**
 * ไฟล์รวม export สำหรับระบบ logging ทั้งหมด
 * เพิ่ม Safe Logger และ health monitoring
 */

import fs from 'fs';
import path from 'path';

// Import with require for modules without type declarations
const moment = require('moment') as any;
const logger = require('./config/loggerConfig') as any;
const { logGeneratePlan, resetStats } = require('./controllers/generatePlanLogger') as any;
const { wrapController, withTimeout } = require('./controllers/requestLogger') as any;
const { getLoggerHealth, CIRCUIT_STATES } = require('./safeLogger') as any;

// Interface definitions
interface LoggerHealth {
  error?: string;
  timestamp: Date;
  status: string;
}

interface FlushResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface LoggerStatus {
  healthy: boolean;
  test?: boolean;
  queryDuration?: number;
  error?: string;
}

/**
 * ฟังก์ชันสำหรับตรวจสอบสุขภาพของ logging system
 */
function getLoggingHealth(): LoggerHealth {
  try {
    return getLoggerHealth(logger);
  } catch (error: any) {
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
function flushAllLoggers(): FlushResult {
  try {
    Object.keys(logger).forEach((key: string) => {
      if (logger[key] && typeof logger[key].flushBuffer === 'function') {
        logger[key].flushBuffer();
      }
    });
    return { success: true, message: 'All loggers flushed successfully' };
  } catch (error: any) {
    console.error('[Logger Flush] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ฟังก์ชันสำหรับ reset สถิติของ Safe Loggers
 */
function resetAllLoggerStats(): FlushResult {
  try {
    Object.keys(logger).forEach((key: string) => {
      if (logger[key] && typeof logger[key].resetStats === 'function') {
        logger[key].resetStats();
      }
    });
    return { success: true, message: 'All logger stats reset successfully' };
  } catch (error: any) {
    console.error('[Logger Stats Reset] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Safe wrapper สำหรับการใช้ logger
 * ป้องกันไม่ให้ logging error ทำให้ระบบหลักหยุดทำงาน
 */
function safeLog(loggerName: string, level: string, message: string, meta: any = {}): void {
  try {
    if (logger[loggerName] && typeof logger[loggerName][level] === 'function') {
      logger[loggerName][level](message, meta);
    } else {
      // Fallback to console logging
      console.log(`[FALLBACK LOG] [${loggerName}] [${level.toUpperCase()}] ${message}`, meta);
    }
  } catch (error: any) {
    // Silent fail - ไม่ให้ logging error กระทบระบบหลัก
    console.error(`[Safe Log Error] Logger: ${loggerName}, Level: ${level}, Error: ${error.message}`);
  }
}

export {
  logger,
  logGeneratePlan,
  resetStats,
  wrapController,
  withTimeout,
  
  // Safe Logger features
  getLoggingHealth,
  flushAllLoggers,
  resetAllLoggerStats,
  safeLog,
  CIRCUIT_STATES
};