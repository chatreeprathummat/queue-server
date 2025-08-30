"use strict";
/**
 * =================================================================
 * Generate Plan Checker - ระบบตรวจสอบการ Generate Plan
 * =================================================================
 *
 * ฟีเจอร์:
 * - ตรวจสอบความถูกต้องของ plan ที่ generate แล้ว
 * - ตรวจสอบ duplicate generation
 * - บันทึก log การ generate plan
 * - สรุปสถิติการ generate
 *
 * @author Nursing System Development Team
 * @version 2.0
 * @date 2025-01-20
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDuplicateGeneration = checkDuplicateGeneration;
exports.logGeneration = logGeneration;
exports.getTodayGenerationStats = getTodayGenerationStats;
exports.checkGenerationHealth = checkGenerationHealth;
exports.cleanupOldLogs = cleanupOldLogs;
// Import with require for modules without type declarations
const planCheckerMoment = require('moment');
const checkerManagementDB = require('../../ManagementDB');
/**
 * ตรวจสอบว่ามีการ generate plan ไปแล้วหรือยัง
 */
async function checkDuplicateGeneration(planType) {
    const db = checkerManagementDB.getInstance();
    let connection = null;
    try {
        connection = await db.getConnection();
        const sql = `
      SELECT COUNT(*) as count
      FROM tbl_ur_generate_daily_log
      WHERE log_date = CURDATE()
      AND plan_type = ?
    `;
        const [rows] = await connection.query(sql, [planType]);
        return rows[0].count > 0;
    }
    catch (error) {
        console.error('Error in checkDuplicateGeneration:', {
            error: error.message,
            planType: planType
        });
        return false;
    }
    finally {
        //ปล่อย connection
        await checkerManagementDB.safeRelease(connection, 'checkDuplicateGeneration');
    }
}
/**
 * บันทึก log การ generate plan
 */
async function logGeneration(planType, status, details = {}) {
    const db = checkerManagementDB.getInstance();
    let connection = null;
    try {
        connection = await db.getConnection();
        // ตรวจสอบว่ามี log สำหรับวันนี้แล้วหรือยัง
        const checkSql = `
      SELECT id, total_processed, total_skipped, skipped_an_list, 
             start_time, error_details
      FROM tbl_ur_generate_daily_log
      WHERE log_date = CURDATE()
      AND plan_type = ?
    `;
        const [existingLogs] = await connection.query(checkSql, [planType]);
        const existingLog = existingLogs[0];
        let totalProcessed = details.totalProcessed || 0;
        let totalSkipped = details.skippedCount || 0;
        let skippedAnList = details.skippedAnList || [];
        let errorDetails = [];
        // จัดการข้อมูล error ถ้ามี
        if (status === 'error' && details.error) {
            errorDetails.push({
                an: details.an || 'unknown',
                error: details.error,
                stack: details.stack || '',
                timestamp: planCheckerMoment().format('YYYY-MM-DD HH:mm:ss')
            });
        }
        if (existingLog) {
            // อัปเดต log ที่มีอยู่
            let existingErrorDetails = [];
            let existingSkippedList = [];
            try {
                existingErrorDetails = existingLog.error_details ? JSON.parse(existingLog.error_details) : [];
                existingSkippedList = existingLog.skipped_an_list ? JSON.parse(existingLog.skipped_an_list) : [];
            }
            catch (parseError) {
                console.warn('Error parsing existing log details:', parseError.message);
            }
            // รวมข้อมูล
            totalProcessed += existingLog.total_processed;
            totalSkipped += existingLog.total_skipped;
            skippedAnList = [...existingSkippedList, ...skippedAnList];
            errorDetails = [...existingErrorDetails, ...errorDetails];
            const updateSql = `
        UPDATE tbl_ur_generate_daily_log
        SET total_processed = ?,
            total_skipped = ?,
            skipped_an_list = ?,
            error_details = ?,
            last_update = NOW(),
            status = ?
        WHERE id = ?
      `;
            await connection.query(updateSql, [
                totalProcessed,
                totalSkipped,
                JSON.stringify(skippedAnList),
                JSON.stringify(errorDetails),
                status,
                existingLog.id
            ]);
        }
        else {
            // สร้าง log ใหม่
            const insertSql = `
        INSERT INTO tbl_ur_generate_daily_log 
        (log_date, plan_type, total_processed, total_skipped, 
         skipped_an_list, error_details, start_time, status)
        VALUES (CURDATE(), ?, ?, ?, ?, ?, ?, ?)
      `;
            await connection.query(insertSql, [
                planType,
                totalProcessed,
                totalSkipped,
                JSON.stringify(skippedAnList),
                JSON.stringify(errorDetails),
                details.startTime || planCheckerMoment().format('YYYY-MM-DD HH:mm:ss'),
                status
            ]);
        }
        console.log(`[GeneratePlanChecker] Log updated for ${planType}: ${status}`, {
            totalProcessed,
            totalSkipped,
            errorCount: errorDetails.length
        });
    }
    catch (error) {
        console.error('Error in logGeneration:', {
            error: error.message,
            planType: planType,
            status: status
        });
    }
    finally {
        //ปล่อย connection
        await checkerManagementDB.safeRelease(connection, 'logGeneration');
    }
}
/**
 * ดึงสถิติการ generate plan ของวันนี้
 */
async function getTodayGenerationStats(planType) {
    const db = checkerManagementDB.getInstance();
    let connection = null;
    try {
        connection = await db.getConnection();
        let sql = `
      SELECT plan_type, total_processed, total_skipped, 
             skipped_an_list, error_details, start_time, 
             last_update, status, log_date
      FROM tbl_ur_generate_daily_log
      WHERE log_date = CURDATE()
    `;
        const params = [];
        if (planType) {
            sql += ' AND plan_type = ?';
            params.push(planType);
        }
        const [rows] = await connection.query(sql, params);
        // แปลง JSON strings กลับเป็น objects
        const stats = rows.map((row) => ({
            ...row,
            skipped_an_list: row.skipped_an_list ? JSON.parse(row.skipped_an_list) : [],
            error_details: row.error_details ? JSON.parse(row.error_details) : []
        }));
        return stats;
    }
    catch (error) {
        console.error('Error in getTodayGenerationStats:', error.message);
        return [];
    }
    finally {
        //ปล่อย connection
        await checkerManagementDB.safeRelease(connection, 'getTodayGenerationStats');
    }
}
/**
 * ตรวจสอบ health status ของระบบ generate plan
 */
async function checkGenerationHealth() {
    const db = checkerManagementDB.getInstance();
    let connection = null;
    try {
        connection = await db.getConnection();
        // ดึงสถิติย้อนหลัง 7 วัน
        const sql = `
      SELECT log_date, plan_type, total_processed, total_skipped, 
             status, start_time, last_update
      FROM tbl_ur_generate_daily_log
      WHERE log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      ORDER BY log_date DESC, plan_type
    `;
        const [rows] = await connection.query(sql);
        const healthStatus = {
            overall: 'healthy',
            last_7_days: rows,
            summary: {
                total_days: 0,
                successful_days: 0,
                failed_days: 0,
                average_processed: 0,
                average_skipped: 0
            },
            issues: []
        };
        // วิเคราะห์สถิติ
        if (rows.length > 0) {
            const totalProcessed = rows.reduce((sum, row) => sum + (row.total_processed || 0), 0);
            const totalSkipped = rows.reduce((sum, row) => sum + (row.total_skipped || 0), 0);
            const successfulDays = rows.filter((row) => row.status === 'success').length;
            healthStatus.summary.total_days = rows.length;
            healthStatus.summary.successful_days = successfulDays;
            healthStatus.summary.failed_days = rows.length - successfulDays;
            healthStatus.summary.average_processed = Math.round(totalProcessed / rows.length);
            healthStatus.summary.average_skipped = Math.round(totalSkipped / rows.length);
            // ตรวจสอบปัญหา
            if (successfulDays / rows.length < 0.8) {
                healthStatus.overall = 'warning';
                healthStatus.issues.push('Success rate below 80% in last 7 days');
            }
            if (healthStatus.summary.average_skipped > healthStatus.summary.average_processed * 0.2) {
                healthStatus.overall = 'warning';
                healthStatus.issues.push('High skip rate detected');
            }
            // ตรวจสอบว่าไม่มีการ generate วันนี้
            const todayLogs = rows.filter((row) => planCheckerMoment(row.log_date).format('YYYY-MM-DD') === planCheckerMoment().format('YYYY-MM-DD'));
            if (todayLogs.length === 0) {
                healthStatus.overall = 'critical';
                healthStatus.issues.push('No generation logs for today');
            }
        }
        else {
            healthStatus.overall = 'critical';
            healthStatus.issues.push('No generation logs found in last 7 days');
        }
        return healthStatus;
    }
    catch (error) {
        console.error('Error in checkGenerationHealth:', error.message);
        return {
            overall: 'error',
            error: error.message,
            issues: ['Unable to check generation health']
        };
    }
    finally {
        //ปล่อย connection
        await checkerManagementDB.safeRelease(connection, 'checkGenerationHealth');
    }
}
/**
 * ล้างข้อมูล log เก่า (เก็บไว้แค่ 30 วัน)
 */
async function cleanupOldLogs() {
    const db = checkerManagementDB.getInstance();
    let connection = null;
    try {
        connection = await db.getConnection();
        const sql = `
      DELETE FROM tbl_ur_generate_daily_log
      WHERE log_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `;
        const [result] = await connection.query(sql);
        console.log(`[GeneratePlanChecker] Cleaned up ${result.affectedRows} old log entries`);
    }
    catch (error) {
        console.error('Error in cleanupOldLogs:', error.message);
    }
    finally {
        //ปล่อย connection
        await checkerManagementDB.safeRelease(connection, 'cleanupOldLogs');
    }
}
