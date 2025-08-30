/**
 * =================================================================
 * cronJobsOracleService.ts - ระบบ Cron Jobs สำหรับ Oracle Service
 * =================================================================
 * 
 * รวมฟังก์ชันการทำงานอัตโนมัติสำหรับ Oracle:
 * - Auto transfer ข้อมูลจาก Oracle ไป MySQL
 * - บันทึก transfer logs
 * - ตรวจสอบสถานะ Oracle connection
 * 
 * @author Nursing System Development Team
 * @version 1.0
 * @date 2025-01-20
 */

// Import with require for modules without type declarations
const cron = require('node-cron') as any;
const { autoTransferFromOracleToMySQL } = require('../controllers/OracleController') as any;
const cronManagementDB = require('./ManagementDB') as any;
const cronMoment = require('moment') as any;

// Interface definitions
interface LogData {
  sessionId: string;
  an?: string;
  transferType?: string;
  dataType?: string;
  status: string;
  oracleRecords?: number;
  insertedCount?: number;
  updatedCount?: number;
  errorCount?: number;
  errorMessage?: string;
  errorDetails?: any;
  transferDetails?: any;
  executionTime?: number;
  transferredBy?: string;
  startedAt: string;
  completedAt?: string;
}

interface TransferResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  sessionId?: string;
  executionTime?: number;
  statusCode?: number;
  skipped?: boolean;
  reason?: string;
  totalPatients?: number;
  processedCount?: number;
  successCount?: number;
  errorCount?: number;
}

interface MockRequest {
  body: {
    transferBy: string;
  };
}

interface MockResponse {
  json: (data: any) => void;
  status: (code: number) => {
    json: (data: any) => void;
  };
}

interface AutoTransferStatus {
  autoTransfer: {
    isRunning: boolean;
    schedule: string;
    description: string;
  };
  timezone: string;
}

interface CronTask {
  stop(): void;
  running: boolean;
}

// ตั้งค่าการทำงาน
const autoTransferSchedule: string = '0 * * * *';  // ทุกชั่วโมงตรง สำหรับ auto transfer

// ตัวแปรเก็บ cron job
let autoTransferTask: CronTask | null = null;

// Helper function สำหรับเขียน log การ transfer
const writeOracleTransferLog = async (logData: LogData): Promise<void> => {
    let connection: any = null;
    try {
        //เชื่อมต่อฐานข้อมูล
        const db = cronManagementDB.getInstance();
        connection = await db.getConnection();

        const insertLogSql: string = `
            INSERT INTO tbl_ur_transfer_logs 
            (transfer_session_id, an, transfer_type, data_type, status, oracle_records,
             inserted_count, updated_count, error_count, error_message, error_details,
             transfer_details, execution_time_ms, transferred_by, started_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await connection.query(insertLogSql, [
            logData.sessionId,
            logData.an || null,
            logData.transferType || 'AUTO',
            logData.dataType || 'COMPLETE',
            logData.status,
            logData.oracleRecords || 0,
            logData.insertedCount || 0,
            logData.updatedCount || 0,
            logData.errorCount || 0,
            logData.errorMessage || null,
            logData.errorDetails ? JSON.stringify(logData.errorDetails) : null,
            logData.transferDetails ? JSON.stringify(logData.transferDetails) : null,
            logData.executionTime || null,
            logData.transferredBy || 'auto-cronjob',
            logData.startedAt,
            logData.completedAt || null
        ]);
    } catch (error: any) {
        console.error('Error writing transfer log:', error);
    } finally {
        //ปล่อย connection
        await cronManagementDB.safeRelease(connection, 'writeTransferLog');
    }
};

/**
 * ฟังก์ชันหลักสำหรับ auto transfer ข้อมูลผู้ป่วย
 */
const cronJobsAutoTransDataFromOracleToMySQLService = async (sessionId: string | null = null): Promise<TransferResult> => {
    const startTime: number = Date.now();
    const autoSessionId: string = sessionId || `AUTO_${cronMoment().format('YYYYMMDD_HHmmss')}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[${autoSessionId}] เริ่มต้น Auto Transfer ข้อมูลผู้ป่วยที่ยังไม่ discharge`);
    
    try {
        // ตรวจสอบ Oracle availability ก่อนเริ่ม
        const oracleService = require('./oracleService') as any;
        const isOracleReady: boolean = await oracleService.isOracleReady();
        
        if (!isOracleReady) {
            console.warn(`[${autoSessionId}] Oracle Database ไม่พร้อมใช้งาน - ข้าม Auto Transfer รอบนี้`);
            return {
                success: true,
                message: "Auto Transfer ถูกข้ามเนื่องจาก Oracle Database ไม่พร้อมใช้งาน",
                data: {
                    sessionId: autoSessionId,
                    skipped: true,
                    reason: "Oracle Database unavailable",
                    totalPatients: 0,
                    processedCount: 0,
                    successCount: 0,
                    errorCount: 0,
                    executionTime: Date.now() - startTime
                }
            };
        }
        
        // เรียกใช้ auto transfer controller
        return new Promise<TransferResult>((resolve, reject) => {
            const mockReq: MockRequest = { body: { transferBy: 'auto-system' } };
            const mockRes: MockResponse = {
                json: (data: any) => resolve(data),
                status: (code: number) => ({
                    json: (data: any) => {
                        data.statusCode = code;
                        resolve(data);
                    }
                })
            };
            
            // เรียกใช้ฟังก์ชัน autoTransferFromOracleToMySQL
            const OracleController = require('../controllers/OracleController') as any;
            OracleController.autoTransferFromOracleToMySQL(mockReq, mockRes).catch(reject);
        });
        
    } catch (error: any) {
        console.error(`[${autoSessionId}] Auto Transfer failed:`, error.message);
        return {
            success: false,
            message: "Auto Transfer failed",
            error: error.message,
            sessionId: autoSessionId,
            executionTime: Date.now() - startTime
        };
    }
};

// ฟังก์ชันสำหรับทดสอบ auto transfer ทันที
async function testAutoTransfer(): Promise<TransferResult> {
    const currentTime = cronMoment().tz("Asia/Bangkok");
    console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] ทดสอบการ auto transfer ทันที`);
    
    try {
        const result: TransferResult = await cronJobsAutoTransDataFromOracleToMySQLService();
        console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] ทดสอบ auto transfer เสร็จสิ้น:`, result);
        return result;
    } catch (err: any) {
        console.error(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] เกิดข้อผิดพลาดในการทดสอบ auto transfer:`, err);
        return {
            success: false,
            message: err.message
        };
    }
}

// เริ่มต้น auto transfer cron job
function startAutoTransferCron(): CronTask | null {
    const currentTime = cronMoment().tz("Asia/Bangkok");
    console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] เริ่มต้นระบบ Auto Transfer Cron`);

    autoTransferTask = cron.schedule(autoTransferSchedule, async (): Promise<void> => {
        const triggerTime = cronMoment().tz("Asia/Bangkok");
        console.log(`[${triggerTime.format('YYYY-MM-DD HH:mm:ss')}] Cron Job เริ่มทำงาน - Auto Transfer ข้อมูลผู้ป่วยจาก Oracle`);
        
        await cronJobsAutoTransDataFromOracleToMySQLService();
        
        const endTime = cronMoment().tz("Asia/Bangkok");
        console.log(`[${endTime.format('YYYY-MM-DD HH:mm:ss')}] Cron Job เสร็จสิ้น - Auto Transfer`);
    }, {
        scheduled: true,
        timezone: "Asia/Bangkok"
    });

    console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] Auto Transfer Cron ถูกตั้งค่าแล้ว:`);
    console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] Schedule: ${autoTransferSchedule} (ทุกชั่วโมงตรง)`);
    console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] Timezone: Asia/Bangkok`);
    console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] Status: Active`);
    
    // ทดสอบการทำงานทันที (เฉพาะใน development)
    if (process.env.NODE_ENV === 'development') {
        console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] Development Mode: เปิดใช้งาน test functions`);
        console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] หากต้องการทดสอบ - uncomment บรรทัดใน cronJobsOracleService.js`);
        
        // setTimeout(() => {
        //     testAutoTransfer();
        // }, 10000); // รอ 10 วินาทีก่อนทดสอบ auto transfer
    }
    
    return autoTransferTask;
}

// ฟังก์ชันสำหรับหยุด auto transfer cron job
function stopAutoTransferCron(): void {
    const currentTime = cronMoment().tz("Asia/Bangkok");
    
    if (autoTransferTask) {
        autoTransferTask.stop();
        console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] Auto Transfer cron job stopped`);
    }
}

// ฟังก์ชันสำหรับดูสถานะ auto transfer cron job
function getAutoTransferStatus(): AutoTransferStatus {
    return {
        autoTransfer: {
            isRunning: autoTransferTask ? autoTransferTask.running : false,
            schedule: autoTransferSchedule,
            description: 'Auto Transfer ข้อมูลผู้ป่วยทุกชั่วโมง'
        },
        timezone: 'Asia/Bangkok'
    };
}

export {
    startAutoTransferCron,
    stopAutoTransferCron,
    getAutoTransferStatus,
    testAutoTransfer,
    cronJobsAutoTransDataFromOracleToMySQLService
}; 