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

import { Request, Response, NextFunction } from 'express';

// Import with require for modules without type declarations
const healthMoment = require('moment-timezone') as any;
const { logger } = require('../services/logging') as any;

// Interface definitions
interface HealthDetails {
    memory?: string | null;
    uptime?: string | null;
    retryAfter?: number;
}

interface HealthResponse {
    success: boolean;
    message: string;
    timestamp: string;
    serverStatus: {
        memory: string | null;
        uptime: string | null;
        status: string;
    };
    errorCode?: string;
    retryAfter?: number;
}

interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
}

interface RequestMap {
    [key: string]: number[];
}

// Health Check Response Standards สำหรับ Frontend
const createHealthResponse = (
    success: boolean, 
    message: string, 
    details: HealthDetails = {}, 
    errorCode: string | null = null
): HealthResponse => {
    const response: HealthResponse = {
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

// Middleware สำหรับตรวจสอบสถานะระบบก่อนประมวลผล API
const systemHealthCheck = (req: Request, res: Response, next: NextFunction): void => {
    try {
        // ตรวจสอบ Memory usage
        const memoryUsage: MemoryUsage = process.memoryUsage();
        const memoryUsageGB: number = memoryUsage.rss / 1024 / 1024 / 1024;
        const memoryUsageMB: number = memoryUsage.rss / 1024 / 1024;
        
        // ตรวจสอบ Uptime
        const uptimeSeconds: number = process.uptime();
        const uptimeHours: number = uptimeSeconds / 3600;
        
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
                res.status(503).json(createHealthResponse(
                    false,
                    'ระบบใช้หน่วยความจำมากเกินไป กรุณาลองใหม่ในอีกสักครู่',
                    {
                        memory: `${memoryUsageGB.toFixed(2)}GB`,
                        uptime: `${uptimeHours.toFixed(1)} ชั่วโมง`,
                        retryAfter: 60
                    },
                    'HIGH_MEMORY_USAGE'
                ));
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
    } catch (error: unknown) {
        const err = error as Error;
        logger.system.error('Health Check Middleware Error', {
            error: err.message,
            stack: err.stack,
            endpoint: req.originalUrl,
            method: req.method,
            clientIP: req.ip
        });
        
        // ถ้า health check ผิดพลาด ให้ส่ง error response
        res.status(503).json(createHealthResponse(
            false,
            'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง',
            {
                retryAfter: 30
            },
            'HEALTH_CHECK_ERROR'
        ));
    }
};

// Middleware สำหรับ API ที่สำคัญ (เช่น การ login, การบันทึกข้อมูล)
const criticalApiCheck = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const memoryUsage: MemoryUsage = process.memoryUsage();
        const memoryUsageGB: number = memoryUsage.rss / 1024 / 1024 / 1024;
        const memoryUsageMB: number = memoryUsage.rss / 1024 / 1024;
        
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
            
            res.status(503).json(createHealthResponse(
                false,
                'ระบบกำลังใช้งานหนัก กรุณารอสักครู่แล้วลองใหม่',
                {
                    memory: `${memoryUsageGB.toFixed(2)}GB`,
                    uptime: `${(process.uptime() / 3600).toFixed(1)} ชั่วโมง`,
                    retryAfter: 30
                },
                'CRITICAL_HIGH_MEMORY'
            ));
            return;
        }
        
        // ตรวจสอบ Load average (ถ้ามี)
        if (process.platform !== 'win32') {
            const os = require('os') as any;
            const loadAvg: number[] = os.loadavg();
            if (loadAvg[0] > 5) { // 1-minute load average
                logger.system.warn('System Load สูงสำหรับ Critical API', {
                    loadAverage: loadAvg,
                    endpoint: req.originalUrl,
                    method: req.method
                });
            }
        }
        
        next();
    } catch (error: unknown) {
        const err = error as Error;
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

// Middleware สำหรับจัดการ Rate Limiting (เพิ่มเติม)
const rateLimitCheck = (maxRequests: number = 100, windowMs: number = 60000) => {
    const requests = new Map<string, number[]>();
    
    return (req: Request, res: Response, next: NextFunction): void => {
        const clientIP: string = req.ip || req.connection?.remoteAddress || 'unknown';
        const currentTime: number = Date.now();
        const windowStart: number = currentTime - windowMs;
        
        // ล้างข้อมูลเก่า
        if (requests.has(clientIP)) {
            const userRequests: number[] = requests.get(clientIP)!.filter((time: number) => time > windowStart);
            requests.set(clientIP, userRequests);
        } else {
            requests.set(clientIP, []);
        }
        
        const userRequests: number[] = requests.get(clientIP)!;
        
        if (userRequests.length >= maxRequests) {
            logger.system.warn('Rate limit exceeded', {
                clientIP,
                requestCount: userRequests.length,
                endpoint: req.originalUrl,
                method: req.method
            });
            
            res.status(429).json(createHealthResponse(
                false,
                'คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่',
                {
                    retryAfter: Math.ceil(windowMs / 1000)
                },
                'RATE_LIMIT_EXCEEDED'
            ));
            return;
        }
        
        userRequests.push(currentTime);
        next();
    };
};

// Export functions
export {
    systemHealthCheck,
    criticalApiCheck,
    rateLimitCheck,
    createHealthResponse
}; 