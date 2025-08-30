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

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Import with require for modules without type declarations
const genPlanLoggerMoment = require('moment') as any;

// Interface definitions
interface PlanGenerationEntry {
  sessionId: string;
  planType: 'NC' | 'VS' | 'BOTH';
  timestamp: string;
  step: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  patientCount?: number;
  generatedPlans?: number;
  skippedPlans?: number;
  errorCount?: number;
  duration?: number;
  memoryUsage?: number;
  errorMessage?: string;
  details?: any;
  metadata?: any;
}

interface PlanValidationEntry {
  sessionId: string;
  planId: string;
  planType: 'NC' | 'VS';
  timestamp: string;
  validationStatus: 'valid' | 'invalid' | 'warning';
  validationErrors?: string[];
  validationWarnings?: string[];
  patientId?: string;
  details?: any;
}

interface GenerationMetrics {
  sessionId: string;
  planType: 'NC' | 'VS' | 'BOTH';
  startTime: string;
  endTime?: string;
  totalDuration?: number;
  totalPatients: number;
  processedPatients: number;
  successfulPlans: number;
  failedPlans: number;
  skippedPlans: number;
  averageTimePerPlan?: number;
  peakMemoryUsage?: number;
  errors: Array<{
    error: string;
    count: number;
  }>;
  warnings: Array<{
    warning: string;
    count: number;
  }>;
}

interface PerformanceSnapshot {
  timestamp: string;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage?: number;
  activeConnections?: number;
  processedCount?: number;
  remainingCount?: number;
}

interface LoggerConfig {
  logDir: string;
  maxFileSize: string;
  maxFiles: string;
  datePattern: string;
  level: string;
}

interface GenerationSession {
  sessionId: string;
  planType: 'NC' | 'VS' | 'BOTH';
  startTime: number;
  metrics: GenerationMetrics;
  performanceSnapshots: PerformanceSnapshot[];
}

interface SessionTracking {
  [sessionId: string]: GenerationSession;
}

/**
 * Generate Plan Logger Class
 */
class GeneratePlanLogger {
  private logger!: winston.Logger;
  private metricsLogger!: winston.Logger;
  private performanceLogger!: winston.Logger;
  private validationLogger!: winston.Logger;
  private config: LoggerConfig;
  private sessionTracking: SessionTracking;

  constructor() {
    this.config = {
      logDir: path.join(__dirname, '../../../logs/generate-plan'),
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
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.config.logDir)) {
        fs.mkdirSync(this.config.logDir, { recursive: true });
      }
    } catch (error: any) {
      console.error('Failed to create generate plan log directory:', error.message);
    }
  }

  /**
   * กำหนดค่า Winston Loggers
   */
  private initializeLoggers(): void {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    // Main Generation Logger
    this.logger = winston.createLogger({
      level: this.config.level,
      format: logFormat,
      transports: [
        new winston.transports.File({
          filename: path.join(this.config.logDir, `generate-plan-${genPlanLoggerMoment().format(this.config.datePattern)}.log`),
          maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
          maxFiles: parseInt(this.config.maxFiles)
        })
      ]
    });

    // Metrics Logger
    this.metricsLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      transports: [
        new winston.transports.File({
          filename: path.join(this.config.logDir, `metrics-${genPlanLoggerMoment().format(this.config.datePattern)}.log`),
          maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
          maxFiles: parseInt(this.config.maxFiles)
        })
      ]
    });

    // Performance Logger
    this.performanceLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      transports: [
        new winston.transports.File({
          filename: path.join(this.config.logDir, `performance-${genPlanLoggerMoment().format(this.config.datePattern)}.log`),
          maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
          maxFiles: parseInt(this.config.maxFiles)
        })
      ]
    });

    // Validation Logger
    this.validationLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      transports: [
        new winston.transports.File({
          filename: path.join(this.config.logDir, `validation-${genPlanLoggerMoment().format(this.config.datePattern)}.log`),
          maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
          maxFiles: parseInt(this.config.maxFiles)
        })
      ]
    });
  }

  /**
   * เริ่มต้น session การ generate plan
   */
  startGenerationSession(sessionId: string, planType: 'NC' | 'VS' | 'BOTH', totalPatients: number): void {
    const timestamp: string = genPlanLoggerMoment().format('YYYY-MM-DD HH:mm:ss');
    
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

    const entry: PlanGenerationEntry = {
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
  logGenerationStep(sessionId: string, step: string, status: 'started' | 'in_progress' | 'completed' | 'failed', details?: any): void {
    const entry: PlanGenerationEntry = {
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
  logPlanSuccess(sessionId: string, planType: 'NC' | 'VS',  patientId: string, details?: any): void {
    const session = this.sessionTracking[sessionId];
    if (session) {
      session.metrics.processedPatients++;
      session.metrics.successfulPlans++;
    }

    const entry: PlanGenerationEntry = {
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
  logPlanError(sessionId: string, planType: 'NC' | 'VS', patientId: string, error: Error, details?: any): void {
    const session = this.sessionTracking[sessionId];
    if (session) {
      session.metrics.processedPatients++;
      session.metrics.failedPlans++;
      
      // เพิ่ม error ใน summary
      const existingError = session.metrics.errors.find(e => e.error === error.message);
      if (existingError) {
        existingError.count++;
      } else {
        session.metrics.errors.push({ error: error.message, count: 1 });
      }
    }

    const entry: PlanGenerationEntry = {
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
  logPlanValidation(sessionId: string, planId: string, planType: 'NC' | 'VS', validationStatus: 'valid' | 'invalid' | 'warning', validationErrors?: string[], validationWarnings?: string[], details?: any): void {
    const entry: PlanValidationEntry = {
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
    } else if (validationStatus === 'warning') {
      this.validationLogger.warn('Plan validation warnings', entry);
    } else {
      this.validationLogger.info('Plan validation passed', entry);
    }
  }

  /**
   * บันทึก performance snapshot
   */
  private capturePerformanceSnapshot(sessionId: string): void {
    const session = this.sessionTracking[sessionId];
    if (!session) return;

    const memUsage = process.memoryUsage();
    const snapshot: PerformanceSnapshot = {
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
  finishGenerationSession(sessionId: string, success: boolean = true): GenerationMetrics | null {
    const session = this.sessionTracking[sessionId];
    if (!session) {
      console.warn(`Session ${sessionId} not found for finishing`);
      return null;
    }

    const endTime: string = genPlanLoggerMoment().format('YYYY-MM-DD HH:mm:ss');
    const totalDuration: number = Date.now() - session.startTime;

    // อัปเดต metrics
    session.metrics.endTime = endTime;
    session.metrics.totalDuration = totalDuration;
    
    if (session.metrics.successfulPlans > 0) {
      session.metrics.averageTimePerPlan = totalDuration / session.metrics.successfulPlans;
    }

    // คำนวณ peak memory usage
    if (session.performanceSnapshots.length > 0) {
      session.metrics.peakMemoryUsage = Math.max(
        ...session.performanceSnapshots.map(s => s.memoryUsage.used)
      );
    }

    const entry: PlanGenerationEntry = {
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
  getSessionMetrics(sessionId: string): GenerationMetrics | null {
    const session = this.sessionTracking[sessionId];
    return session ? { ...session.metrics } : null;
  }

  /**
   * ดึงรายการ active sessions
   */
  getActiveSessions(): string[] {
    return Object.keys(this.sessionTracking);
  }

  /**
   * ล้าง session ที่ hang (อายุเกิน 2 ชั่วโมง)
   */
  cleanupHangingSessions(): void {
    const now: number = Date.now();
    const twoHours: number = 2 * 60 * 60 * 1000;

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
  logWarning(sessionId: string, message: string, details?: any): void {
    const session = this.sessionTracking[sessionId];
    if (session) {
      const existingWarning = session.metrics.warnings.find(w => w.warning === message);
      if (existingWarning) {
        existingWarning.count++;
      } else {
        session.metrics.warnings.push({ warning: message, count: 1 });
      }
    }

    const entry: PlanGenerationEntry = {
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

// สร้าง singleton instance
const generatePlanLogger = new GeneratePlanLogger();

export default generatePlanLogger;
export { 
  GeneratePlanLogger, 
  PlanGenerationEntry, 
  PlanValidationEntry, 
  GenerationMetrics, 
  PerformanceSnapshot 
}; 