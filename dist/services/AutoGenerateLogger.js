"use strict";
/**
 * =================================================================
 * AutoGenerateLogger.ts - ระบบ Logging สำหรับ Auto Generate Process
 * =================================================================
 *
 * รวมฟังก์ชันการ logging ที่เกี่ยวข้องกับ auto generate:
 * - บันทึก log การ generate plans
 * - ตรวจสอบและจัดการ log files
 * - สร้าง reports และสถิติ
 *
 * @author Nursing System Development Team
 * @version 1.0
 * @date 2025-01-20
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoGenerateLogger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Import with require for modules without type declarations
const autoGenerateMoment = require('moment-timezone');
/**
 * Class สำหรับจัดการ Auto Generate Logs
 */
class AutoGenerateLogger {
    constructor() {
        this.logDir = path_1.default.join(__dirname, '../logs/auto-generate');
        this.maxLogSize = 50 * 1024 * 1024; // 50MB
        this.maxLogAge = 30; // 30 วัน
        this.logFormat = 'YYYY-MM-DD';
        // สร้างโฟลเดอร์ log ถ้ายังไม่มี
        this.ensureLogDirectory();
    }
    /**
     * สร้างโฟลเดอร์ log ถ้ายังไม่มี
     */
    ensureLogDirectory() {
        try {
            if (!fs_1.default.existsSync(this.logDir)) {
                fs_1.default.mkdirSync(this.logDir, { recursive: true });
                console.log(`[AutoGenerateLogger] สร้างโฟลเดอร์ log: ${this.logDir}`);
            }
        }
        catch (error) {
            console.error(`[AutoGenerateLogger] ไม่สามารถสร้างโฟลเดอร์ log ได้:`, error.message);
        }
    }
    /**
     * สร้างชื่อไฟล์ log ตามวันที่
     */
    generateLogFileName(planType = 'general', date) {
        const logDate = date || autoGenerateMoment().tz('Asia/Bangkok').format(this.logFormat);
        return `auto-generate-${planType}-${logDate}.log`;
    }
    /**
     * เขียน log ลงไฟล์
     */
    async writeLog(entry) {
        try {
            const fileName = this.generateLogFileName(entry.planType || 'general');
            const filePath = path_1.default.join(this.logDir, fileName);
            const logLine = JSON.stringify({
                ...entry,
                timestamp: entry.timestamp || autoGenerateMoment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss')
            }) + '\n';
            // เขียนแบบ append
            await fs_1.default.promises.appendFile(filePath, logLine, 'utf8');
            return true;
        }
        catch (error) {
            console.error(`[AutoGenerateLogger] ไม่สามารถเขียน log ได้:`, error.message);
            return false;
        }
    }
    /**
     * บันทึก log info
     */
    async logInfo(message, details, planType, processId) {
        const entry = {
            timestamp: autoGenerateMoment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
            level: 'info',
            message,
            details,
            planType,
            processId
        };
        await this.writeLog(entry);
    }
    /**
     * บันทึก log warning
     */
    async logWarn(message, details, planType, processId) {
        const entry = {
            timestamp: autoGenerateMoment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
            level: 'warn',
            message,
            details,
            planType,
            processId
        };
        await this.writeLog(entry);
    }
    /**
     * บันทึก log error
     */
    async logError(message, details, planType, processId) {
        const entry = {
            timestamp: autoGenerateMoment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
            level: 'error',
            message,
            details,
            planType,
            processId
        };
        await this.writeLog(entry);
    }
    /**
     * อ่าน log จากไฟล์
     */
    async readLogFile(fileName) {
        try {
            const filePath = path_1.default.join(this.logDir, fileName);
            if (!fs_1.default.existsSync(filePath)) {
                return [];
            }
            const content = await fs_1.default.promises.readFile(filePath, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.trim());
            const logs = [];
            for (const line of lines) {
                try {
                    const log = JSON.parse(line);
                    logs.push(log);
                }
                catch (parseError) {
                    console.warn(`[AutoGenerateLogger] ไม่สามารถ parse log line: ${line}`);
                }
            }
            return logs;
        }
        catch (error) {
            console.error(`[AutoGenerateLogger] ไม่สามารถอ่านไฟล์ log ได้:`, error.message);
            return [];
        }
    }
    /**
     * ดึงข้อมูลไฟล์ log ทั้งหมด
     */
    async getLogFiles() {
        try {
            const files = await fs_1.default.promises.readdir(this.logDir);
            const logFiles = [];
            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path_1.default.join(this.logDir, file);
                    const stats = await fs_1.default.promises.stat(filePath);
                    logFiles.push({
                        fileName: file,
                        filePath: filePath,
                        size: stats.size,
                        createdDate: autoGenerateMoment(stats.birthtime).tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
                        lastModified: autoGenerateMoment(stats.mtime).tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
                        exists: true
                    });
                }
            }
            return logFiles.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
        }
        catch (error) {
            console.error(`[AutoGenerateLogger] ไม่สามารถดึงรายการไฟล์ log ได้:`, error.message);
            return [];
        }
    }
    /**
     * วิเคราะห์สถิติ log
     */
    async analyzeLogStats(fileName) {
        const logs = await this.readLogFile(fileName);
        const stats = {
            totalLogs: logs.length,
            infoLogs: logs.filter(log => log.level === 'info').length,
            warnLogs: logs.filter(log => log.level === 'warn').length,
            errorLogs: logs.filter(log => log.level === 'error').length
        };
        if (logs.length > 0) {
            stats.oldestLogTime = logs[0].timestamp;
            stats.lastLogTime = logs[logs.length - 1].timestamp;
        }
        return stats;
    }
    /**
     * ทำความสะอาดไฟล์ log เก่า
     */
    async cleanupOldLogs() {
        const result = {
            success: true,
            message: '',
            cleanedFiles: [],
            errorFiles: [],
            totalCleaned: 0
        };
        try {
            const files = await this.getLogFiles();
            const cutoffDate = autoGenerateMoment().tz('Asia/Bangkok').subtract(this.maxLogAge, 'days');
            for (const file of files) {
                const fileDate = autoGenerateMoment(file.lastModified, 'YYYY-MM-DD HH:mm:ss').tz('Asia/Bangkok');
                // ลบไฟล์ที่เก่าเกินกำหนด หรือใหญ่เกินไป
                if (fileDate.isBefore(cutoffDate) || file.size > this.maxLogSize) {
                    try {
                        await fs_1.default.promises.unlink(file.filePath);
                        result.cleanedFiles.push(file.fileName);
                        result.totalCleaned++;
                        const reason = fileDate.isBefore(cutoffDate) ? 'เก่าเกิน' : 'ใหญ่เกิน';
                        console.log(`[AutoGenerateLogger] ลบไฟล์ log: ${file.fileName} (${reason})`);
                    }
                    catch (error) {
                        result.errorFiles.push(file.fileName);
                        console.error(`[AutoGenerateLogger] ไม่สามารถลบไฟล์ ${file.fileName}:`, error.message);
                    }
                }
            }
            result.message = `ทำความสะอาดเสร็จสิ้น: ลบ ${result.totalCleaned} ไฟล์, ข้อผิดพลาด ${result.errorFiles.length} ไฟล์`;
            if (result.errorFiles.length > 0) {
                result.success = false;
            }
        }
        catch (error) {
            result.success = false;
            result.message = `เกิดข้อผิดพลาดในการทำความสะอาด: ${error.message}`;
            console.error(`[AutoGenerateLogger] Cleanup error:`, error);
        }
        return result;
    }
    /**
     * สร้าง session ID สำหรับ process
     */
    generateSessionId(prefix = 'GEN') {
        const timestamp = autoGenerateMoment().tz('Asia/Bangkok').format('YYYYMMDD_HHmmss');
        const random = Math.random().toString(36).substr(2, 6).toUpperCase();
        return `${prefix}_${timestamp}_${random}`;
    }
    /**
     * บันทึก session start
     */
    async logSessionStart(sessionId, planType, details) {
        await this.logInfo(`เริ่มต้น Generate ${planType} Plan Session`, {
            sessionId,
            planType,
            ...details
        }, planType, sessionId);
    }
    /**
     * บันทึก session end
     */
    async logSessionEnd(sessionId, planType, success, details) {
        const level = success ? 'info' : 'error';
        const message = `${success ? 'เสร็จสิ้น' : 'ล้มเหลว'} Generate ${planType} Plan Session`;
        const entry = {
            timestamp: autoGenerateMoment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
            level: level,
            message,
            details: {
                sessionId,
                planType,
                success,
                ...details
            },
            planType,
            processId: sessionId
        };
        await this.writeLog(entry);
    }
}
exports.AutoGenerateLogger = AutoGenerateLogger;
// สร้าง singleton instance
const autoGenerateLogger = new AutoGenerateLogger();
exports.default = autoGenerateLogger;
