"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
// Import types with require for modules without type declarations
const moment = require('moment-timezone');
const cf = require('../config/config').default;
const { logger } = require('./logging');
/**
 * การตั้งค่า Connection Pool สำหรับฐานข้อมูล MySQL
 * ปรับปรุงเพื่อรองรับ Multi-Tab และป้องกัน Connection Issues
 */
// Debug config values ที่ ManagementDB ได้รับ
console.log('\n=== ManagementDB Config Debug ===');
console.log(`cf.host: "${cf.host || 'undefined'}"`);
console.log(`cf.mysql_user: "${cf.mysql_user || 'undefined'}"`);
console.log(`cf.mysql_password: "${cf.mysql_password ? '[SET]' : 'undefined'}"`);
console.log(`cf.mysql_database: "${cf.mysql_database || 'undefined'}"`);
console.log('===============================\n');
const connectionLimit = 25; // เพิ่มจาก 20 เป็น 25 เพื่อรองรับ multi-tab
const queueLimit = 30; // เพิ่มจาก 20 เป็น 30
const pool = promise_1.default.createPool({
    host: cf.host,
    user: cf.mysql_user,
    password: cf.mysql_password,
    database: cf.mysql_database,
    waitForConnections: true,
    connectionLimit: connectionLimit,
    queueLimit: queueLimit,
    idleTimeout: 120000, // ลดจาก 180000 เป็น 120000 (2 นาที)
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: '+07:00',
    multipleStatements: false,
    charset: 'utf8mb4'
    // หมายเหตุ: MySQL2 version ใหม่ไม่รองรับ acquireTimeout และ timeout
    // จะใช้ query timeout ผ่าน connection.execute() แทน
});
/**
 * Basic Pool Event Handlers - เก็บแค่ที่จำเป็น
 */
pool.on('connection', function (connection) {
    const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
    console.log(`[${timestamp}] MySQL Pool: เชื่อมต่อใหม่ #${connection.threadId}`);
    // Safe Log ใน connection logger
    try {
        if (logger && logger.connection && typeof logger.connection.info === 'function') {
            logger.connection.info('New MySQL connection established', {
                threadId: connection.threadId,
                timestamp: timestamp,
                event: 'connection_established'
            });
        }
    }
    catch (logError) {
        // Silent fail for logging
    }
});
pool.on('acquire', function (connection) {
    try {
        if (logger && logger.connection && typeof logger.connection.debug === 'function') {
            logger.connection.debug('Connection acquired from pool', {
                threadId: connection.threadId,
                event: 'connection_acquired'
            });
        }
    }
    catch (logError) {
        // Silent fail for logging
    }
});
pool.on('release', function (connection) {
    try {
        if (logger && logger.connection && typeof logger.connection.debug === 'function') {
            logger.connection.debug('Connection released to pool', {
                threadId: connection.threadId,
                event: 'connection_released'
            });
        }
    }
    catch (logError) {
        // Silent fail for logging
    }
});
/**
 * =================================================================
 * Class ManagementDB - Singleton Pattern
 * =================================================================
 */
class ManagementDB {
    constructor() {
        this.pool = pool;
        this.activeConnections = new Set();
        this.connectionStartTimes = new Map();
        this.statsStartTime = Date.now();
        this.totalConnectionsCreated = 0;
        this.totalConnectionsCleaned = 0;
        // ป้องกันการสร้าง instance ใหม่ถ้ามีอยู่แล้ว
        if (ManagementDB.instance) {
            return ManagementDB.instance;
        }
        const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
        console.log(`[${timestamp}] ManagementDB: กำลังสร้าง instance ใหม่`);
        // เริ่ม cleanup ทุก 5 นาที (แทนที่จะเป็น 30 วินาที)
        this.startBasicCleanup();
        // เริ่ม status monitoring ทุก 2 นาที
        this.startStatusMonitoring();
        console.log(`[${timestamp}] ManagementDB: พร้อมใช้งาน (Connection Limit: ${connectionLimit})`);
        // เก็บ instance สำหรับ Singleton Pattern
        ManagementDB.instance = this;
    }
    /**
     * Singleton Pattern - วิธีการรับ instance
     */
    static getInstance() {
        if (!ManagementDB.instance) {
            ManagementDB.instance = new ManagementDB();
        }
        return ManagementDB.instance;
    }
    /**
     * Basic Cleanup System - ทำความสะอาดทุก 5 นาที
     */
    startBasicCleanup() {
        const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
        console.log(`[${timestamp}] เริ่มต้น cleanup scheduler ทุก 5 นาที`);
        setInterval(() => {
            this.cleanStaleConnections();
        }, 300000); // 5 นาที
    }
    /**
     * Status Monitoring - แสดงสถานะทุก 2 นาที (ถ้ามี activity)
     */
    startStatusMonitoring() {
        const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
        console.log(`[${timestamp}] เริ่มต้น status monitoring ทุก 2 นาที`);
        setInterval(() => {
            if (this.activeConnections.size > 0) {
                this.logCurrentStatus();
            }
        }, 120000); // 2 นาที
    }
    /**
     * แสดงสถานะปัจจุบันของ Connection Pool
     */
    logCurrentStatus() {
        const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
        const status = this.getBasicStatus();
        const uptime = Math.round((Date.now() - this.statsStartTime) / 1000 / 60); // นาที
        console.log(`[${timestamp}] DB Pool Status: ${status.activeConnections}/${status.connectionLimit} (${status.usage}) | สร้าง: ${this.totalConnectionsCreated} | ทำความสะอาด: ${this.totalConnectionsCleaned} | Uptime: ${uptime}m`);
        // Safe Log สถิติ pool ลง connection logger
        try {
            if (logger && logger.connection && typeof logger.connection.info === 'function') {
                logger.connection.info('Database pool status', {
                    activeConnections: status.activeConnections,
                    connectionLimit: status.connectionLimit,
                    usage: status.usage,
                    poolStatus: status.poolStatus,
                    totalConnectionsCreated: this.totalConnectionsCreated,
                    totalConnectionsCleaned: this.totalConnectionsCleaned,
                    uptimeMinutes: uptime,
                    event: 'pool_status'
                });
            }
        }
        catch (logError) {
            // Silent fail for logging
        }
    }
    /**
     * =================================================================
     * ฟังก์ชันหลัก: รับ Connection จาก Pool (Simplified)
     * =================================================================
     */
    async getConnection() {
        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const startTime = Date.now();
        let connection = null;
        try {
            // ตรวจสอบสถานะ pool ก่อนขอ connection
            if (this.activeConnections.size >= 8) { // แจ้งเตือนเมื่อใกล้เต็ม (80% ของ 10)
                const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
                console.warn(`[${timestamp}] เตือน: Connection pool ใช้งาน ${this.activeConnections.size}/10 connections (${Math.round((this.activeConnections.size / 10) * 100)}%)`);
                try {
                    if (logger && logger.connection && typeof logger.connection.warn === 'function') {
                        logger.connection.warn('Connection pool near capacity', {
                            activeConnections: this.activeConnections.size,
                            connectionLimit: connectionLimit,
                            usage: `${Math.round((this.activeConnections.size / connectionLimit) * 100)}%`,
                            event: 'pool_near_capacity'
                        });
                    }
                }
                catch (logError) {
                    // Silent fail for logging
                }
            }
            // ขอ connection จาก pool พร้อม timeout ที่สั้นกว่า
            connection = await Promise.race([
                this.pool.getConnection(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000) // ลดเป็น 10 วินาที
                )
            ]);
            const duration = Date.now() - startTime;
            // แจ้งเตือนถ้าใช้เวลานานในการได้ connection
            if (duration > 3000) { // มากกว่า 3 วินาที
                const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
                console.warn(`[${timestamp}] การรอ connection ใช้เวลานาน: ${duration}ms [${connectionId}]`);
            }
            // เก็บข้อมูล tracking
            this.activeConnections.add(connection);
            this.connectionStartTimes.set(connection, Date.now());
            this.totalConnectionsCreated++;
            // เพิ่ม metadata
            connection.__connectionId = connectionId;
            connection.__createdAt = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
            // Log สำหรับการสร้าง connection - แสดงเสมอ
            const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
            console.log(`[${timestamp}] 🔗 DB Connection สร้างแล้ว [${connectionId}] ใช้เวลา: ${duration}ms | Active: ${this.activeConnections.size}/25`);
            try {
                if (logger && logger.connection && typeof logger.connection.info === 'function') {
                    logger.connection.info('Database connection created', {
                        connectionId: connectionId,
                        threadId: connection.threadId,
                        duration: `${duration}ms`,
                        activeConnections: this.activeConnections.size,
                        connectionLimit: connectionLimit,
                        event: 'connection_created'
                    });
                }
            }
            catch (logError) {
                // Silent fail for logging
            }
            // Customize release function
            const originalRelease = connection.release.bind(connection);
            connection.release = () => {
                try {
                    const duration = Date.now() - (this.connectionStartTimes.get(connection) || 0);
                    this.activeConnections.delete(connection);
                    this.connectionStartTimes.delete(connection);
                    // Log สำหรับการปล่อย connection - แสดงเสมอ
                    const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
                    const context = connection.__queryContext ? ` via ${connection.__queryContext}` : '';
                    console.log(`[${timestamp}] 🔓 DB Connection ปล่อยแล้ว [${connectionId}]${context} ใช้งาน: ${duration}ms | Active: ${this.activeConnections.size}/25`);
                    try {
                        if (logger && logger.connection && typeof logger.connection.info === 'function') {
                            logger.connection.info('Database connection released', {
                                connectionId: connectionId,
                                threadId: connection.threadId,
                                duration: `${duration}ms`,
                                context: connection.__queryContext || 'unknown',
                                activeConnections: this.activeConnections.size,
                                event: 'connection_released'
                            });
                        }
                    }
                    catch (logError) {
                        // Silent fail for logging
                    }
                    return originalRelease();
                }
                catch (releaseError) {
                    console.error(`Release error for connection [${connectionId}]:`, releaseError.message);
                    // ยังคงพยายาม release แม้จะมี error
                    try {
                        return originalRelease();
                    }
                    catch (finalError) {
                        console.error(`Final release error for connection [${connectionId}]:`, finalError.message);
                    }
                }
            };
            return connection;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
            console.error(`[${timestamp}] Error getting database connection:`, {
                error: error.message,
                connectionId: connectionId,
                duration: `${duration}ms`,
                activeConnections: this.activeConnections.size,
                poolUsage: `${Math.round((this.activeConnections.size / connectionLimit) * 100)}%`
            });
            // Safe logging to file
            try {
                if (logger && logger.connection && typeof logger.connection.error === 'function') {
                    logger.connection.error('Failed to get database connection', {
                        error: error.message,
                        stack: error.stack,
                        connectionId: connectionId,
                        duration: `${duration}ms`,
                        activeConnections: this.activeConnections.size,
                        poolUsage: `${Math.round((this.activeConnections.size / connectionLimit) * 100)}%`,
                        event: 'connection_error'
                    });
                }
                else {
                    console.log(`[ERROR] Logger not available for connection error logging`);
                }
            }
            catch (logError) {
                console.error(`[LOG ERROR] Failed to log connection error: ${logError.message}`);
            }
            throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        }
    }
    /**
     * =================================================================
     * Execute Query Helper
     * =================================================================
     */
    async executeQuery(sql, params = [], context = 'query') {
        let connection = null;
        const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
        try {
            connection = await this.getConnection();
            // เพิ่ม context สำหรับ executeQuery
            connection.__queryContext = `executeQuery(${context})`;
            const [result] = await connection.query(sql, params);
            return result;
        }
        catch (error) {
            // Colors for error logging
            const colors = {
                reset: '\x1b[0m',
                red: '\x1b[31m',
                yellow: '\x1b[33m',
                bold: '\x1b[1m'
            };
            console.error(`\n${colors.red}${colors.bold}🔴 [DB QUERY ERROR] ${timestamp} ${context}${colors.reset}`);
            console.error(`${colors.red}┌─ Error Message: ${error.message}${colors.reset}`);
            console.error(`${colors.red}├─ Error Code: ${error.code || 'Unknown'}${colors.reset}`);
            console.error(`${colors.red}├─ SQL State: ${error.sqlState || 'Unknown'}${colors.reset}`);
            console.error(`${colors.yellow}├─ SQL Query: ${sql}${colors.reset}`);
            console.error(`${colors.yellow}├─ Parameters: ${JSON.stringify(params)}${colors.reset}`);
            console.error(`${colors.red}└─ Context: ${context}${colors.reset}\n`);
            // Safe logging to file
            try {
                if (logger && logger.connection && typeof logger.connection.error === 'function') {
                    logger.connection.error('Database query error', {
                        error: error.message,
                        errorCode: error.code,
                        sqlState: error.sqlState,
                        sql: sql,
                        params: params,
                        context: context,
                        timestamp: timestamp
                    });
                }
                else {
                    console.log(`[${timestamp}] [WARNING] Logger not available for database query error logging`);
                }
            }
            catch (logError) {
                console.error(`[${timestamp}] [LOG ERROR] Failed to log database query error: ${logError.message}`);
            }
            throw error;
        }
        finally {
            if (connection) {
                // ใช้ customized release function ที่มี console log
                await ManagementDB.safeRelease(connection, context);
            }
        }
    }
    /**
     * =================================================================
     * Basic Cleanup (Simplified)
     * =================================================================
     */
    async cleanStaleConnections() {
        const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
        const now = Date.now();
        const staleTimeout = 180000; // 3 นาที (เปลี่ยนจาก 5 นาที)
        let cleanedCount = 0;
        let checkedCount = 0;
        console.log(`[${timestamp}] เริ่มต้น cleanup connections (ตรวจสอบ ${this.activeConnections.size} รายการ)`);
        for (const connection of Array.from(this.activeConnections)) {
            const startTime = this.connectionStartTimes.get(connection);
            checkedCount++;
            if (startTime && now - startTime > staleTimeout) {
                try {
                    const connectionAge = Math.round((now - startTime) / 1000); // วินาที
                    this.activeConnections.delete(connection);
                    this.connectionStartTimes.delete(connection);
                    connection.release();
                    cleanedCount++;
                    this.totalConnectionsCleaned++;
                    console.log(`[${timestamp}] ทำความสะอาด connection ที่ค้าง: ${connection.__connectionId || 'unknown'} (อายุ: ${connectionAge}s)`);
                }
                catch (error) {
                    console.error(`[${timestamp}] Error cleaning stale connection:`, error.message);
                }
            }
        }
        if (cleanedCount > 0) {
            console.log(`[${timestamp}] 🧹 ทำความสะอาดเสร็จสิ้น: ${cleanedCount}/${checkedCount} รายการ | Active: ${this.activeConnections.size}/25`);
        }
        else {
            console.log(`[${timestamp}] ✅ Cleanup เสร็จสิ้น: ไม่มี connection ที่ต้องทำความสะอาด (ตรวจสอบ ${checkedCount} รายการ)`);
        }
    }
    /**
     * =================================================================
     * Basic Status Check
     * =================================================================
     */
    getBasicStatus() {
        return {
            activeConnections: this.activeConnections.size,
            connectionLimit: connectionLimit, // อัปเดตให้ตรงกับค่าใหม่
            usage: `${Math.round((this.activeConnections.size / connectionLimit) * 100)}%`,
            poolStatus: this.activeConnections.size >= 8 ? 'WARNING' : 'OK'
        };
    }
    /**
     * =================================================================
     * Static Helper Methods - Safe Connection Management
     * =================================================================
     */
    /**
     * ปล่อย connection อย่างปลอดภัย
     * @param {MySQLConnection} connection - MySQL connection object
     * @param {string} operationContext - บริบทของการทำงาน สำหรับ debugging
     */
    static async safeRelease(connection, operationContext = 'unknown') {
        if (!connection)
            return;
        try {
            // ตรวจสอบว่า connection ยังใช้งานได้หรือไม่
            if (typeof connection.release === 'function') {
                connection.release();
            }
        }
        catch (error) {
            // ไม่ให้ throw error เพื่อป้องกันไม่ให้กระทบต่อการทำงานหลัก
            console.error(`เกิดข้อผิดพลาดในการปล่อย connection [${operationContext}]:`, error.message);
        }
    }
}
exports.default = ManagementDB;
