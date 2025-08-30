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

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

// Import with require for modules without type declarations
const reqLoggerMoment = require('moment') as any;

// Interface definitions
interface RequestLogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  url: string;
  statusCode?: number;
  userAgent?: string;
  ip: string;
  userId?: string;
  sessionId?: string;
  duration?: number;
  requestSize?: number;
  responseSize?: number;
  error?: string;
  userInfo?: any;
  apiEndpoint?: string;
  apiVersion?: string;
  params?: any;
  query?: any;
  body?: any;
  headers?: any;
  responseData?: any;
}

interface SecurityEvent {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  ip: string;
  userAgent?: string;
  userId?: string;
  requestId: string;
  timestamp: string;
  metadata?: any;
}

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestCount: number;
  errorCount: number;
  lastAccessed: string;
}

interface ApiUsageStats {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  averageResponseTime: number;
  uniqueUsers: number;
  uniqueIPs: number;
  topEndpoints: Array<{
    endpoint: string;
    count: number;
    avgTime: number;
  }>;
  errorSummary: Array<{
    error: string;
    count: number;
  }>;
}

interface RequestTracking {
  [requestId: string]: {
    startTime: number;
    request: Partial<RequestLogEntry>;
  };
}

interface LoggerConfig {
  logDir: string;
  maxFileSize: string;
  maxFiles: string;
  datePattern: string;
  level: string;
}

/**
 * Request Logger Class
 */
class RequestLogger {
  private logger!: winston.Logger;
  private securityLogger!: winston.Logger;
  private performanceLogger!: winston.Logger;
  private config: LoggerConfig;
  private requestTracking: RequestTracking;
  private performanceMetrics: Map<string, PerformanceMetrics>;

  constructor() {
    this.config = {
      logDir: path.join(__dirname, '../../../logs/request'),
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
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.config.logDir)) {
        fs.mkdirSync(this.config.logDir, { recursive: true });
      }
    } catch (error: any) {
      console.error('Failed to create log directory:', error.message);
    }
  }

  /**
   * กำหนดค่า Winston Loggers
   */
  private initializeLoggers(): void {
    // Main Request Logger
    this.logger = winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(this.config.logDir, `request-${reqLoggerMoment().format(this.config.datePattern)}.log`),
          maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
          maxFiles: parseInt(this.config.maxFiles)
        })
      ]
    });

    // Security Events Logger
    this.securityLogger = winston.createLogger({
      level: 'warn',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(this.config.logDir, `security-${reqLoggerMoment().format(this.config.datePattern)}.log`),
          maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
          maxFiles: parseInt(this.config.maxFiles)
        })
      ]
    });

    // Performance Logger
    this.performanceLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(this.config.logDir, `performance-${reqLoggerMoment().format(this.config.datePattern)}.log`),
          maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
          maxFiles: parseInt(this.config.maxFiles)
        })
      ]
    });
  }

  /**
   * สร้าง request ID
   */
  private generateRequestId(): string {
    return `req_${reqLoggerMoment().format('YYYYMMDD_HHmmss')}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * เริ่มต้น tracking request
   */
  startRequestTracking(req: Request): string {
    const requestId: string = this.generateRequestId();
    
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
    (req as any).requestId = requestId;

    return requestId;
  }

  /**
   * จบการ tracking และบันทึก log
   */
  finishRequestTracking(requestId: string, res: Response, error?: Error): void {
    const tracking = this.requestTracking[requestId];
    
    if (!tracking) {
      return;
    }

    const duration: number = Date.now() - tracking.startTime;
    const logEntry: RequestLogEntry = {
      ...tracking.request,
      statusCode: res.statusCode,
      duration,
      error: error?.message,
      timestamp: reqLoggerMoment().format('YYYY-MM-DD HH:mm:ss')
    } as RequestLogEntry;

    // บันทึก log
    if (this.logger) {
      this.logger.info('Request completed', logEntry);
    } else {
      console.log('Request completed:', logEntry);
    }

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
  private sanitizeHeaders(headers: any): any {
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
  private sanitizeBody(body: any): any {
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
  private updatePerformanceMetrics(logEntry: RequestLogEntry): void {
    const key: string = `${logEntry.method} ${logEntry.url}`;
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
    } else {
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
  private checkSecurityEvents(logEntry: RequestLogEntry, error?: Error): void {
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
  private isPotentialAttack(logEntry: RequestLogEntry): boolean {
    const suspiciousPatterns = [
      /[<>'"]/,  // XSS attempts
      /union.*select/i,  // SQL injection
      /script.*alert/i,  // XSS scripts
      /\.\.\/.*\.\.\//,  // Directory traversal
      /eval\s*\(/i,  // Code injection
    ];

    const urlToCheck: string = logEntry.url + JSON.stringify(logEntry.body || '');
    
    return suspiciousPatterns.some(pattern => pattern.test(urlToCheck));
  }

  /**
   * บันทึก security event
   */
  private logSecurityEvent(event: SecurityEvent): void {
    if (this.securityLogger) {
      this.securityLogger.warn('Security event detected', event);
    } else {
      console.warn('Security event detected:', event);
    }
  }

  /**
   * Express middleware สำหรับ request logging
   */
  middleware() {
    const self = this;
    return (req: Request, res: Response, next: NextFunction): void => {
      const requestId: string = self.startRequestTracking(req);

      // Override res.end เพื่อ capture response
      const originalEnd = res.end;
      res.end = function(this: Response, chunk?: any, encoding?: BufferEncoding | undefined): Response {
        self.finishRequestTracking(requestId, res);
        return originalEnd.call(this, chunk, encoding || 'utf8');
      } as any;

      // Handle errors
      res.on('error', (error: Error) => {
        self.finishRequestTracking(requestId, res, error);
      });

      next();
    };
  }

  /**
   * ดึงสถิติการใช้งาน API
   */
  getApiUsageStats(): ApiUsageStats {
    const stats: ApiUsageStats = {
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
    const endpoints: Array<{endpoint: string; count: number; avgTime: number}> = [];

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
  resetStats(): void {
    this.performanceMetrics.clear();
  }

  /**
   * ดึง performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics[] {
    return Array.from(this.performanceMetrics.values());
  }
}

/**
 * Wrapper function สำหรับ controller functions เพื่อจัดการ logging และ error handling
 * @param controllerFn - Controller function ที่ต้องการ wrap
 * @param timeoutMs - Timeout ในหน่วย milliseconds (default: 30000)
 * @returns Wrapped controller function
 */
export function wrapController(
  controllerFn: (req: Request, res: Response) => Promise<void>,
  timeoutMs: number = 30000
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = requestLogger.startRequestTracking(req);
    
    try {
      // สร้าง Promise สำหรับ timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
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
      
    } catch (error: any) {
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

export default requestLogger;
export { RequestLogger, RequestLogEntry, SecurityEvent, PerformanceMetrics, ApiUsageStats }; 