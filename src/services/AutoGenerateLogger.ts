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

import fs from 'fs';
import path from 'path';

// Import with require for modules without type declarations
const autoGenerateMoment = require('moment-timezone') as any;

// Interface definitions
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
  processId?: string;
  planType?: string;
  sessionId?: string;
}

interface LogStats {
  totalLogs: number;
  infoLogs: number;
  warnLogs: number;
  errorLogs: number;
  lastLogTime?: string;
  oldestLogTime?: string;
}

interface LogFileInfo {
  fileName: string;
  filePath: string;
  size: number;
  createdDate: string;
  lastModified: string;
  exists: boolean;
}

interface CleanupResult {
  success: boolean;
  message: string;
  cleanedFiles: string[];
  errorFiles: string[];
  totalCleaned: number;
}

/**
 * Class สำหรับจัดการ Auto Generate Logs
 */
class AutoGenerateLogger {
  private logDir: string;
  private maxLogSize: number;
  private maxLogAge: number; // วัน
  private logFormat: string;

  constructor() {
    this.logDir = path.join(__dirname, '../logs/auto-generate');
    this.maxLogSize = 50 * 1024 * 1024; // 50MB
    this.maxLogAge = 30; // 30 วัน
    this.logFormat = 'YYYY-MM-DD';
    
    // สร้างโฟลเดอร์ log ถ้ายังไม่มี
    this.ensureLogDirectory();
  }

  /**
   * สร้างโฟลเดอร์ log ถ้ายังไม่มี
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.log(`[AutoGenerateLogger] สร้างโฟลเดอร์ log: ${this.logDir}`);
      }
    } catch (error: any) {
      console.error(`[AutoGenerateLogger] ไม่สามารถสร้างโฟลเดอร์ log ได้:`, error.message);
    }
  }

  /**
   * สร้างชื่อไฟล์ log ตามวันที่
   */
  private generateLogFileName(planType: string = 'general', date?: string): string {
    const logDate: string = date || autoGenerateMoment().tz('Asia/Bangkok').format(this.logFormat);
    return `auto-generate-${planType}-${logDate}.log`;
  }

  /**
   * เขียน log ลงไฟล์
   */
  async writeLog(entry: LogEntry): Promise<boolean> {
    try {
      const fileName: string = this.generateLogFileName(entry.planType || 'general');
      const filePath: string = path.join(this.logDir, fileName);
      
      const logLine: string = JSON.stringify({
        ...entry,
        timestamp: entry.timestamp || autoGenerateMoment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss')
      }) + '\n';

      // เขียนแบบ append
      await fs.promises.appendFile(filePath, logLine, 'utf8');
      return true;
    } catch (error: any) {
      console.error(`[AutoGenerateLogger] ไม่สามารถเขียน log ได้:`, error.message);
      return false;
    }
  }

  /**
   * บันทึก log info
   */
  async logInfo(message: string, details?: any, planType?: string, processId?: string): Promise<void> {
    const entry: LogEntry = {
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
  async logWarn(message: string, details?: any, planType?: string, processId?: string): Promise<void> {
    const entry: LogEntry = {
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
  async logError(message: string, details?: any, planType?: string, processId?: string): Promise<void> {
    const entry: LogEntry = {
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
  async readLogFile(fileName: string): Promise<LogEntry[]> {
    try {
      const filePath: string = path.join(this.logDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const content: string = await fs.promises.readFile(filePath, 'utf8');
      const lines: string[] = content.trim().split('\n').filter(line => line.trim());
      
      const logs: LogEntry[] = [];
      for (const line of lines) {
        try {
          const log: LogEntry = JSON.parse(line);
          logs.push(log);
        } catch (parseError: any) {
          console.warn(`[AutoGenerateLogger] ไม่สามารถ parse log line: ${line}`);
        }
      }
      
      return logs;
    } catch (error: any) {
      console.error(`[AutoGenerateLogger] ไม่สามารถอ่านไฟล์ log ได้:`, error.message);
      return [];
    }
  }

  /**
   * ดึงข้อมูลไฟล์ log ทั้งหมด
   */
  async getLogFiles(): Promise<LogFileInfo[]> {
    try {
      const files: string[] = await fs.promises.readdir(this.logDir);
      const logFiles: LogFileInfo[] = [];

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath: string = path.join(this.logDir, file);
          const stats = await fs.promises.stat(filePath);
          
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
    } catch (error: any) {
      console.error(`[AutoGenerateLogger] ไม่สามารถดึงรายการไฟล์ log ได้:`, error.message);
      return [];
    }
  }

  /**
   * วิเคราะห์สถิติ log
   */
  async analyzeLogStats(fileName: string): Promise<LogStats> {
    const logs: LogEntry[] = await this.readLogFile(fileName);
    
    const stats: LogStats = {
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
  async cleanupOldLogs(): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: true,
      message: '',
      cleanedFiles: [],
      errorFiles: [],
      totalCleaned: 0
    };

    try {
      const files: LogFileInfo[] = await this.getLogFiles();
      const cutoffDate = autoGenerateMoment().tz('Asia/Bangkok').subtract(this.maxLogAge, 'days');

      for (const file of files) {
        const fileDate = autoGenerateMoment(file.lastModified, 'YYYY-MM-DD HH:mm:ss').tz('Asia/Bangkok');
        
        // ลบไฟล์ที่เก่าเกินกำหนด หรือใหญ่เกินไป
        if (fileDate.isBefore(cutoffDate) || file.size > this.maxLogSize) {
          try {
            await fs.promises.unlink(file.filePath);
            result.cleanedFiles.push(file.fileName);
            result.totalCleaned++;
            
            const reason: string = fileDate.isBefore(cutoffDate) ? 'เก่าเกิน' : 'ใหญ่เกิน';
            console.log(`[AutoGenerateLogger] ลบไฟล์ log: ${file.fileName} (${reason})`);
          } catch (error: any) {
            result.errorFiles.push(file.fileName);
            console.error(`[AutoGenerateLogger] ไม่สามารถลบไฟล์ ${file.fileName}:`, error.message);
          }
        }
      }

      result.message = `ทำความสะอาดเสร็จสิ้น: ลบ ${result.totalCleaned} ไฟล์, ข้อผิดพลาด ${result.errorFiles.length} ไฟล์`;
      
      if (result.errorFiles.length > 0) {
        result.success = false;
      }

    } catch (error: any) {
      result.success = false;
      result.message = `เกิดข้อผิดพลาดในการทำความสะอาด: ${error.message}`;
      console.error(`[AutoGenerateLogger] Cleanup error:`, error);
    }

    return result;
  }

  /**
   * สร้าง session ID สำหรับ process
   */
  generateSessionId(prefix: string = 'GEN'): string {
    const timestamp: string = autoGenerateMoment().tz('Asia/Bangkok').format('YYYYMMDD_HHmmss');
    const random: string = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * บันทึก session start
   */
  async logSessionStart(sessionId: string, planType: string, details?: any): Promise<void> {
    await this.logInfo(
      `เริ่มต้น Generate ${planType} Plan Session`,
      {
        sessionId,
        planType,
        ...details
      },
      planType,
      sessionId
    );
  }

  /**
   * บันทึก session end
   */
  async logSessionEnd(sessionId: string, planType: string, success: boolean, details?: any): Promise<void> {
    const level = success ? 'info' : 'error';
    const message = `${success ? 'เสร็จสิ้น' : 'ล้มเหลว'} Generate ${planType} Plan Session`;
    
    const entry: LogEntry = {
      timestamp: autoGenerateMoment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
      level: level as 'info' | 'error',
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

// สร้าง singleton instance
const autoGenerateLogger = new AutoGenerateLogger();

export default autoGenerateLogger;
export { AutoGenerateLogger, LogEntry, LogStats, LogFileInfo, CleanupResult }; 