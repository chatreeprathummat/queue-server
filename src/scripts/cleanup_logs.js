#!/usr/bin/env node

/**
 * =================================================================
 * Log Cleanup Script - สคริปต์ล้าง Log Files เก่า
 * =================================================================
 * 
 * สคริปต์สำหรับล้าง log files ที่เก่ากว่าที่กำหนด
 * และย้ายไฟล์ที่สำคัญไปยัง archive folder
 * 
 * @author Nursing System Development Team
 * @version 1.0
 * @date 2025-06-06
 */

const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');

// กำหนดค่าการ cleanup
const CONFIG = {
  // จำนวนวันที่ต้องการเก็บไฟล์
  retentionDays: {
    request: 30,        // Request logs เก็บ 30 วัน
    connection: 7,      // Connection logs เก็บ 7 วัน  
    system: 90,         // System logs เก็บ 90 วัน
    autoGenerate: 60    // Auto-generate logs เก็บ 60 วัน
  },
  
  // โฟลเดอร์ logs
  logsDir: path.join(__dirname, '../logs'),
  archiveDir: path.join(__dirname, '../logs/archive'),
  
  // ขนาดไฟล์ที่ใหญ่เกินไป (MB)
  maxFileSizeMB: 100,
  
  // รูปแบบไฟล์ที่จะล้าง (regex)
  patterns: {
    request: /^request.*\.log$/,
    connection: /^connection.*\.log$/,
    system: /^system.*\.log$|^auth.*\.log$/,
    autoGenerate: /^auto-generate.*\.log$|^generate-plan.*\.log$/
  }
};

/**
 * ตรวจสอบว่าไฟล์เก่าเกินกำหนดหรือไม่
 */
function isFileOld(filePath, retentionDays) {
  try {
    const stats = require('fs').statSync(filePath);
    const fileDate = moment(stats.mtime);
    const cutoffDate = moment().subtract(retentionDays, 'days');
    return fileDate.isBefore(cutoffDate);
  } catch (error) {
    console.error(`ไม่สามารถตรวจสอบไฟล์ ${filePath}:`, error.message);
    return false;
  }
}

/**
 * ตรวจสอบขนาดไฟล์
 */
function isFileTooLarge(filePath) {
  try {
    const stats = require('fs').statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    return fileSizeMB > CONFIG.maxFileSizeMB;
  } catch (error) {
    console.error(`ไม่สามารถตรวจสอบขนาดไฟล์ ${filePath}:`, error.message);
    return false;
  }
}

/**
 * ย้ายไฟล์ไป archive
 */
async function moveToArchive(filePath, reason = '') {
  try {
    const fileName = path.basename(filePath);
    const archivePath = path.join(CONFIG.archiveDir, fileName);
    
    // สร้างโฟลเดอร์ archive หากไม่มี
    await fs.mkdir(CONFIG.archiveDir, { recursive: true });
    
    // ย้ายไฟล์
    await fs.rename(filePath, archivePath);
    console.log(`📦 ย้าย ${fileName} ไป archive ${reason}`);
    return true;
  } catch (error) {
    console.error(`❌ ไม่สามารถย้าย ${filePath} ไป archive:`, error.message);
    return false;
  }
}

/**
 * ลบไฟล์
 */
async function deleteFile(filePath, reason = '') {
  try {
    await fs.unlink(filePath);
    const fileName = path.basename(filePath);
    console.log(`🗑️  ลบ ${fileName} ${reason}`);
    return true;
  } catch (error) {
    console.error(`❌ ไม่สามารถลบ ${filePath}:`, error.message);
    return false;
  }
}

/**
 * ประมวลผลไฟล์ในโฟลเดอร์
 */
async function processFolder(folderPath, logType) {
  try {
    const files = await fs.readdir(folderPath);
    const pattern = CONFIG.patterns[logType];
    const retentionDays = CONFIG.retentionDays[logType];
    
    let processedCount = 0;
    let archivedCount = 0;
    let deletedCount = 0;
    
    console.log(`\n📁 ประมวลผล ${logType} logs ใน ${folderPath}`);
    console.log(`   - เก็บไฟล์ ${retentionDays} วัน`);
    console.log(`   - ไฟล์ทั้งหมด: ${files.length}`);
    
    for (const file of files) {
      if (!pattern.test(file)) continue;
      
      const filePath = path.join(folderPath, file);
      processedCount++;
      
      // ตรวจสอบว่าไฟล์ใหญ่เกินไป
      if (isFileTooLarge(filePath)) {
        if (await moveToArchive(filePath, '(ไฟล์ใหญ่เกินไป)')) {
          archivedCount++;
        }
        continue;
      }
      
      // ตรวจสอบว่าไฟล์เก่าเกินกำหนด
      if (isFileOld(filePath, retentionDays)) {
        // ไฟล์สำคัญ (system, auth) ย้ายไป archive
        if (logType === 'system' || file.includes('auth')) {
          if (await moveToArchive(filePath, '(ไฟล์เก่า)')) {
            archivedCount++;
          }
        } else {
          // ไฟล์อื่นๆ ลบทิ้ง
          if (await deleteFile(filePath, '(ไฟล์เก่า)')) {
            deletedCount++;
          }
        }
      }
    }
    
    console.log(`   ✅ ประมวลผล: ${processedCount}, archive: ${archivedCount}, ลบ: ${deletedCount}`);
    return { processedCount, archivedCount, deletedCount };
    
  } catch (error) {
    console.error(`❌ ไม่สามารถประมวลผลโฟลเดอร์ ${folderPath}:`, error.message);
    return { processedCount: 0, archivedCount: 0, deletedCount: 0 };
  }
}

/**
 * ประมวลผลโฟลเดอร์ auto-generate แยกต่างหาก
 */
async function processAutoGenerateFolder() {
  const autoGenPath = path.join(CONFIG.logsDir, 'auto-generate');
  return await processFolder(autoGenPath, 'autoGenerate');
}

/**
 * สร้างรายงานการ cleanup
 */
function generateReport(results) {
  const totalProcessed = results.reduce((sum, r) => sum + r.processedCount, 0);
  const totalArchived = results.reduce((sum, r) => sum + r.archivedCount, 0);
  const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 สรุปผลการ Cleanup Log Files');
  console.log('='.repeat(60));
  console.log(`📁 ไฟล์ที่ประมวลผล: ${totalProcessed}`);
  console.log(`📦 ไฟล์ที่ย้าย archive: ${totalArchived}`);
  console.log(`🗑️  ไฟล์ที่ลบ: ${totalDeleted}`);
  console.log(`💾 พื้นที่ที่ประหยัดได้: ~${(totalDeleted * 5).toFixed(1)} MB (ประมาณการ)`);
  console.log(`⏰ เวลาที่ทำการ cleanup: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
  console.log('='.repeat(60));
}

/**
 * ฟังก์ชันหลัก
 */
async function main() {
  console.log('🧹 เริ่มต้นการ Cleanup Log Files...');
  console.log(`📅 วันที่: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
  
  const results = [];
  
  // ประมวลผลแต่ละโฟลเดอร์
  const folders = [
    { path: path.join(CONFIG.logsDir, 'request'), type: 'request' },
    { path: path.join(CONFIG.logsDir, 'connection'), type: 'connection' },
    { path: path.join(CONFIG.logsDir, 'system'), type: 'system' }
  ];
  
  for (const folder of folders) {
    if (require('fs').existsSync(folder.path)) {
      const result = await processFolder(folder.path, folder.type);
      results.push(result);
    } else {
      console.log(`⚠️  โฟลเดอร์ ${folder.path} ไม่มีอยู่`);
    }
  }
  
  // ประมวลผล auto-generate folder
  if (require('fs').existsSync(path.join(CONFIG.logsDir, 'auto-generate'))) {
    const autoGenResult = await processAutoGenerateFolder();
    results.push(autoGenResult);
  }
  
  // สร้างรายงาน
  generateReport(results);
  
  console.log('\n✅ การ Cleanup Log Files เสร็จสิ้น!');
}

// รันสคริปต์หากถูกเรียกโดยตรง
if (require.main === module) {
  main().catch(error => {
    console.error('❌ เกิดข้อผิดพลาดในการ cleanup:', error);
    process.exit(1);
  });
}

module.exports = { main, CONFIG }; 