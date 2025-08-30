"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronJobsAutoTransDataFromOracleToMySQLService = void 0;
exports.startAutoTransferCron = startAutoTransferCron;
exports.stopAutoTransferCron = stopAutoTransferCron;
exports.getAutoTransferStatus = getAutoTransferStatus;
exports.testAutoTransfer = testAutoTransfer;
// Import with require for modules without type declarations
const cron = require('node-cron');
const { autoTransferFromOracleToMySQL } = require('../controllers/OracleController');
const cronManagementDB = require('./ManagementDB');
const cronMoment = require('moment');
// ตั้งค่าการทำงาน
const autoTransferSchedule = '0 * * * *'; // ทุกชั่วโมงตรง สำหรับ auto transfer
// ตัวแปรเก็บ cron job
let autoTransferTask = null;
// Helper function สำหรับเขียน log การ transfer
const writeOracleTransferLog = async (logData) => {
    let connection = null;
    try {
        //เชื่อมต่อฐานข้อมูล
        const db = cronManagementDB.getInstance();
        connection = await db.getConnection();
        const insertLogSql = `
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
    }
    catch (error) {
        console.error('Error writing transfer log:', error);
    }
    finally {
        //ปล่อย connection
        await cronManagementDB.safeRelease(connection, 'writeTransferLog');
    }
};
/**
 * ฟังก์ชันหลักสำหรับ auto transfer ข้อมูลผู้ป่วย
 */
const cronJobsAutoTransDataFromOracleToMySQLService = async (sessionId = null) => {
    const startTime = Date.now();
    const autoSessionId = sessionId || `AUTO_${cronMoment().format('YYYYMMDD_HHmmss')}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${autoSessionId}] เริ่มต้น Auto Transfer ข้อมูลผู้ป่วยที่ยังไม่ discharge`);
    try {
        // ตรวจสอบ Oracle availability ก่อนเริ่ม
        const oracleService = require('./oracleService');
        const isOracleReady = await oracleService.isOracleReady();
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
        return new Promise((resolve, reject) => {
            const mockReq = { body: { transferBy: 'auto-system' } };
            const mockRes = {
                json: (data) => resolve(data),
                status: (code) => ({
                    json: (data) => {
                        data.statusCode = code;
                        resolve(data);
                    }
                })
            };
            // เรียกใช้ฟังก์ชัน autoTransferFromOracleToMySQL
            const OracleController = require('../controllers/OracleController');
            OracleController.autoTransferFromOracleToMySQL(mockReq, mockRes).catch(reject);
        });
    }
    catch (error) {
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
exports.cronJobsAutoTransDataFromOracleToMySQLService = cronJobsAutoTransDataFromOracleToMySQLService;
// ฟังก์ชันสำหรับทดสอบ auto transfer ทันที
async function testAutoTransfer() {
    const currentTime = cronMoment().tz("Asia/Bangkok");
    console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] ทดสอบการ auto transfer ทันที`);
    try {
        const result = await cronJobsAutoTransDataFromOracleToMySQLService();
        console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] ทดสอบ auto transfer เสร็จสิ้น:`, result);
        return result;
    }
    catch (err) {
        console.error(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] เกิดข้อผิดพลาดในการทดสอบ auto transfer:`, err);
        return {
            success: false,
            message: err.message
        };
    }
}
// เริ่มต้น auto transfer cron job
function startAutoTransferCron() {
    const currentTime = cronMoment().tz("Asia/Bangkok");
    console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] เริ่มต้นระบบ Auto Transfer Cron`);
    autoTransferTask = cron.schedule(autoTransferSchedule, async () => {
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
function stopAutoTransferCron() {
    const currentTime = cronMoment().tz("Asia/Bangkok");
    if (autoTransferTask) {
        autoTransferTask.stop();
        console.log(`[${currentTime.format('YYYY-MM-DD HH:mm:ss')}] Auto Transfer cron job stopped`);
    }
}
// ฟังก์ชันสำหรับดูสถานะ auto transfer cron job
function getAutoTransferStatus() {
    return {
        autoTransfer: {
            isRunning: autoTransferTask ? autoTransferTask.running : false,
            schedule: autoTransferSchedule,
            description: 'Auto Transfer ข้อมูลผู้ป่วยทุกชั่วโมง'
        },
        timezone: 'Asia/Bangkok'
    };
}
