/**
 * =================================================================
 * cronJobs.ts - ระบบ Cron Jobs สำหรับการทำงานอัตโนมัติ
 * =================================================================
 * 
 * รวมฟังก์ชันการทำงานอัตโนมัติต่างๆ:
 * - Auto generate plans (NC และ VS)
 * - ทำความสะอาด logs เก่า
 * - ตรวจสอบสุขภาพระบบ
 * 
 * @author Nursing System Development Team
 * @version 1.0
 * @date 2025-01-20
 */

// Import with require for modules without type declarations
const cron = require('node-cron') as any;
const { autoGenerateVSPlan } = require('../controllers/AutoGenerateVSPlanController') as any;
const { autoGenerateNCPlan } = require('../controllers/AutoGenerateNCPlanController') as any;
const { checkDuplicateGeneration, logGeneration } = require('./logging/controllers/generatePlanChecker') as any;
const { logGeneratePlan } = require('../services/logging') as any;
const moment = require('moment') as any;
const ManagementDB = require('./ManagementDB') as any;
const { logger } = require('./logging') as any;

// Interface definitions
interface GenerationResult {
  success: boolean;
  message: string;
  processedCount?: number;
  skippedCount?: number;
  errorCount?: number;
  details?: any;
}

interface CronTask {
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'running' | 'idle' | 'error';
}

interface CronJobStatus {
  totalJobs: number;
  activeJobs: number;
  lastHealthCheck: Date;
  systemStatus: 'healthy' | 'warning' | 'error';
  jobs: CronTask[];
}

// ตัวแปรเก็บสถานะ cron jobs
let cronJobsStatus: CronJobStatus = {
  totalJobs: 0,
  activeJobs: 0,
  lastHealthCheck: new Date(),
  systemStatus: 'healthy',
  jobs: []
};

/**
 * สร้าง unique ID สำหรับ generation process
 */
function generateProcessId(): string {
  return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * บันทึก log การทำงานของ cron job
 */
async function logCronActivity(jobName: string, status: 'start' | 'success' | 'error', details: any = {}): Promise<void> {
  try {
    const timestamp: string = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
    
    logger.system.info(`Cron Job: ${jobName}`, {
      jobName,
      status,
      timestamp,
      details,
      event: 'cron_job_activity'
    });

    // อัปเดตสถานะใน memory
    const jobIndex = cronJobsStatus.jobs.findIndex(job => job.name === jobName);
    if (jobIndex !== -1) {
      cronJobsStatus.jobs[jobIndex].status = status === 'start' ? 'running' : 
                                            status === 'success' ? 'idle' : 'error';
      cronJobsStatus.jobs[jobIndex].lastRun = new Date();
    }

  } catch (error: any) {
    console.error(`Error logging cron activity for ${jobName}:`, error.message);
  }
}

/**
 * ฟังก์ชันทำความสะอาด logs เก่า
 */
async function cleanupOldLogs(): Promise<GenerationResult> {
  const processId: string = generateProcessId();
  
  try {
    await logCronActivity('cleanup-logs', 'start', { processId });
    
    const timestamp: string = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
    console.log(`[${timestamp}] เริ่มต้นทำความสะอาด logs เก่า [${processId}]`);

    // ทำความสะอาด logs ที่เก่ากว่า 30 วัน
    const db = ManagementDB.getInstance();
    
    const cleanupSql: string = `
      DELETE FROM tbl_ur_generate_daily_log 
      WHERE log_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `;

    const result = await db.executeQuery(cleanupSql, [], 'cleanupOldLogs');
    
    const affectedRows: number = result.affectedRows || 0;
    const successMessage: string = `ทำความสะอาด logs เก่าเสร็จสิ้น: ลบ ${affectedRows} รายการ`;
    
    console.log(`[${timestamp}] ${successMessage} [${processId}]`);
    
    await logCronActivity('cleanup-logs', 'success', { 
      processId, 
      affectedRows,
      message: successMessage
    });

    return {
      success: true,
      message: successMessage,
      processedCount: affectedRows
    };

  } catch (error: any) {
    const errorMessage: string = `เกิดข้อผิดพลาดในการทำความสะอาด logs: ${error.message}`;
    console.error(`[Cleanup Error] ${errorMessage} [${processId}]`);
    
    await logCronActivity('cleanup-logs', 'error', { 
      processId, 
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      message: errorMessage,
      errorCount: 1
    };
  }
}

/**
 * ฟังก์ชันตรวจสอบสุขภาพระบบ
 */
async function systemHealthCheck(): Promise<GenerationResult> {
  const processId: string = generateProcessId();
  
  try {
    await logCronActivity('health-check', 'start', { processId });
    
    const timestamp: string = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
    console.log(`[${timestamp}] เริ่มต้นตรวจสอบสุขภาพระบบ [${processId}]`);

    const db = ManagementDB.getInstance();
    const healthResult = await db.checkConnectionHealth();
    
    if (healthResult.healthy) {
      const successMessage: string = `ระบบทำงานปกติ (${healthResult.queryDuration}ms)`;
      console.log(`[${timestamp}] ${successMessage} [${processId}]`);
      
      await logCronActivity('health-check', 'success', { 
        processId, 
        queryDuration: healthResult.queryDuration,
        message: successMessage
      });

      cronJobsStatus.systemStatus = 'healthy';
      cronJobsStatus.lastHealthCheck = new Date();

      return {
        success: true,
        message: successMessage,
        details: healthResult
      };
    } else {
      const errorMessage: string = `ระบบมีปัญหา: ${healthResult.error}`;
      console.warn(`[${timestamp}] ${errorMessage} [${processId}]`);
      
      await logCronActivity('health-check', 'error', { 
        processId, 
        error: healthResult.error,
        message: errorMessage
      });

      cronJobsStatus.systemStatus = 'error';
      cronJobsStatus.lastHealthCheck = new Date();

      return {
        success: false,
        message: errorMessage,
        details: healthResult
      };
    }

  } catch (error: any) {
    const errorMessage: string = `เกิดข้อผิดพลาดในการตรวจสอบสุขภาพระบบ: ${error.message}`;
    console.error(`[Health Check Error] ${errorMessage} [${processId}]`);
    
    await logCronActivity('health-check', 'error', { 
      processId, 
      error: error.message,
      stack: error.stack
    });

    cronJobsStatus.systemStatus = 'error';
    cronJobsStatus.lastHealthCheck = new Date();

    return {
      success: false,
      message: errorMessage,
      errorCount: 1
    };
  }
}

/**
 * ฟังก์ชันทำความสะอาด connection pool
 */
async function cleanupConnections(): Promise<GenerationResult> {
  const processId: string = generateProcessId();
  
  try {
    await logCronActivity('cleanup-connections', 'start', { processId });
    
    const timestamp: string = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
    console.log(`[${timestamp}] เริ่มต้นทำความสะอาด connections [${processId}]`);

    const db = ManagementDB.getInstance();
    await db.cleanStaleConnections();
    
    const successMessage: string = 'ทำความสะอาด connections เสร็จสิ้น';
    console.log(`[${timestamp}] ${successMessage} [${processId}]`);
    
    await logCronActivity('cleanup-connections', 'success', { 
      processId, 
      message: successMessage
    });

    return {
      success: true,
      message: successMessage
    };

  } catch (error: any) {
    const errorMessage: string = `เกิดข้อผิดพลาดในการทำความสะอาด connections: ${error.message}`;
    console.error(`[Connection Cleanup Error] ${errorMessage} [${processId}]`);
    
    await logCronActivity('cleanup-connections', 'error', { 
      processId, 
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      message: errorMessage,
      errorCount: 1
    };
  }
}

/**
 * เพิ่ม cron job ใหม่ใน status tracking
 */
function addCronJob(name: string, schedule: string, description: string): void {
  const newJob: CronTask = {
    name,
    schedule,
    description,
    enabled: true,
    status: 'idle'
  };
  
  cronJobsStatus.jobs.push(newJob);
  cronJobsStatus.totalJobs++;
}

/**
 * ฟังก์ชันเริ่มต้น cron jobs ทั้งหมด
 */
function startCronJobs(): void {
  const timestamp: string = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
  console.log(`[${timestamp}] กำลังเริ่มต้น cron jobs...`);

  // รีเซ็ตสถานะ
  cronJobsStatus = {
    totalJobs: 0,
    activeJobs: 0,
    lastHealthCheck: new Date(),
    systemStatus: 'healthy',
    jobs: []
  };

  // 1. ทำความสะอาด logs เก่าทุกวันเวลา 02:00
  cron.schedule('0 2 * * *', async () => {
    cronJobsStatus.activeJobs++;
    await cleanupOldLogs();
    cronJobsStatus.activeJobs--;
  }, {
    scheduled: true,
    timezone: "Asia/Bangkok"
  });
  addCronJob('cleanup-logs', '0 2 * * *', 'ทำความสะอาด logs เก่าทุกวันเวลา 02:00');

  // 2. ตรวจสอบสุขภาพระบบทุก 30 นาที
  cron.schedule('*/30 * * * *', async () => {
    cronJobsStatus.activeJobs++;
    await systemHealthCheck();
    cronJobsStatus.activeJobs--;
  }, {
    scheduled: true,
    timezone: "Asia/Bangkok"
  });
  addCronJob('health-check', '*/30 * * * *', 'ตรวจสอบสุขภาพระบบทุก 30 นาที');

  // 3. ทำความสะอาด connections ทุก 15 นาที
  cron.schedule('*/15 * * * *', async () => {
    cronJobsStatus.activeJobs++;
    await cleanupConnections();
    cronJobsStatus.activeJobs--;
  }, {
    scheduled: true,
    timezone: "Asia/Bangkok"
  });
  addCronJob('cleanup-connections', '*/15 * * * *', 'ทำความสะอาด connections ทุก 15 นาที');

  console.log(`[${timestamp}] เริ่มต้น cron jobs เสร็จสิ้น (${cronJobsStatus.totalJobs} jobs)`);
  
  // บันทึก log การเริ่มต้น
  logger.system.info('Cron jobs started', {
    totalJobs: cronJobsStatus.totalJobs,
    timestamp: timestamp,
    event: 'cron_jobs_started'
  });
}

/**
 * ฟังก์ชันดึงสถานะ cron jobs
 */
function getCronJobsStatus(): CronJobStatus {
  return { ...cronJobsStatus };
}

/**
 * ฟังก์ชันหยุด cron jobs ทั้งหมด
 */
function stopCronJobs(): void {
  const timestamp: string = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
  console.log(`[${timestamp}] กำลังหยุด cron jobs...`);
  
  // หยุด cron jobs (ถ้ามี reference)
  // cron.destroy() // ถ้าต้องการหยุดทั้งหมด
  
  cronJobsStatus.activeJobs = 0;
  cronJobsStatus.systemStatus = 'healthy';
  
  logger.system.info('Cron jobs stopped', {
    timestamp: timestamp,
    event: 'cron_jobs_stopped'
  });
  
  console.log(`[${timestamp}] หยุด cron jobs เสร็จสิ้น`);
}

export {
  startCronJobs,
  stopCronJobs,
  getCronJobsStatus,
  cleanupOldLogs,
  systemHealthCheck,
  cleanupConnections
}; 