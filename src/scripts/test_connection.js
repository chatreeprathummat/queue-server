/**
 * Test Database Connection Script
 * สคริปต์ทดสอบการเชื่อมต่อฐานข้อมูล MySQL
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// โหลด environment variables
dotenv.config();

async function testConnection() {
  console.log('🔍 กำลังทดสอบการเชื่อมต่อฐานข้อมูล...\n');
  
  // แสดงการตั้งค่าที่จะใช้ (ไม่แสดง password)
  console.log('📋 การตั้งค่าที่ใช้:');
  console.log(`   Host: ${process.env.NODE_MYSQL_HOST || 'ไม่ได้ตั้งค่า'}`);
  console.log(`   Port: ${process.env.NODE_MYSQL_PORT || 'ไม่ได้ตั้งค่า (ใช้ 3306)'}`);
  console.log(`   User: ${process.env.NODE_MYSQL_USER || 'ไม่ได้ตั้งค่า'}`);
  console.log(`   Database: ${process.env.NODE_MYSQL_DATABASE || 'ไม่ได้ตั้งค่า'}`);
  console.log(`   Password: ${process.env.NODE_MYSQL_PASSWORD ? 'ตั้งค่าแล้ว' : 'ไม่ได้ตั้งค่า'}\n`);

  // ตรวจสอบว่าได้ตั้งค่าครบหรือไม่
  const requiredVars = ['NODE_MYSQL_HOST', 'NODE_MYSQL_USER', 'NODE_MYSQL_PASSWORD', 'NODE_MYSQL_DATABASE'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ ไม่พบการตั้งค่าต่อไปนี้ในไฟล์ .env:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n💡 กรุณาสร้างไฟล์ .env และตั้งค่าดังนี้:');
    console.error(`
NODE_MYSQL_HOST=localhost
NODE_MYSQL_USER=root
NODE_MYSQL_PASSWORD=your_password_here
NODE_MYSQL_DATABASE=nursing_system
    `);
    return;
  }

  try {
    // ทดสอบการเชื่อมต่อ (ลบ timeout option ที่ไม่รองรับ)
    console.log('🔗 กำลังเชื่อมต่อฐานข้อมูล...');
    const connection = await mysql.createConnection({
      host: process.env.NODE_MYSQL_HOST,
      port: parseInt(process.env.NODE_MYSQL_PORT || '3306', 10),
      user: process.env.NODE_MYSQL_USER,
      password: process.env.NODE_MYSQL_PASSWORD,
      database: process.env.NODE_MYSQL_DATABASE
    });
    
    console.log('✅ การเชื่อมต่อฐานข้อมูลสำเร็จ!');
    
    // ทดสอบ query พื้นฐาน (แก้ไข SQL syntax)
    console.log('🔍 กำลังทดสอบ query...');
    const [rows] = await connection.execute('SELECT 1 as test, NOW() as `current_time`');
    console.log('✅ ทดสอบ query สำเร็จ:', rows[0]);
    
    // แสดงข้อมูลเซิร์ฟเวอร์
    const [serverInfo] = await connection.execute('SELECT VERSION() as version');
    console.log('📊 MySQL Version:', serverInfo[0].version);
    
    // ตรวจสอบตารางในฐานข้อมูล
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`📋 จำนวนตารางในฐานข้อมูล: ${tables.length} ตาราง`);
    
    // ตรวจสอบตาราง authentication ที่สำคัญ
    console.log('\n🔍 กำลังตรวจสอบตาราง authentication...');
    const authTables = ['tbl_ur_auth_users', 'tbl_ur_auth_tokens', 'tbl_ur_auth_logs'];
    
    for (const tableName of authTables) {
      try {
        const [tableCheck] = await connection.execute(`SHOW TABLES LIKE '${tableName}'`);
        if (tableCheck.length > 0) {
          console.log(`✅ ตาราง ${tableName} พบแล้ว`);
        } else {
          console.log(`⚠️  ตาราง ${tableName} ไม่พบ`);
        }
      } catch (err) {
        console.log(`❌ ไม่สามารถตรวจสอบตาราง ${tableName}: ${err.message}`);
      }
    }
    
    await connection.end();
    console.log('\n🎉 การทดสอบสำเร็จทั้งหมด! ระบบสามารถเชื่อมต่อฐานข้อมูลได้แล้ว');
    
  } catch (error) {
    console.error('\n❌ การเชื่อมต่อฐานข้อมูลล้มเหลว!');
    console.error('📝 รายละเอียด Error:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code || 'ไม่ระบุ'}`);
    console.error(`   Errno: ${error.errno || 'ไม่ระบุ'}`);
    
    // แนะนำการแก้ไขตาม error code
    console.error('\n💡 คำแนะนำการแก้ไข:');
    if (error.code === 'ECONNREFUSED') {
      console.error('   - ตรวจสอบว่า MySQL Server ทำงานอยู่หรือไม่');
      console.error('   - รัน: net start mysql (Windows) หรือ sudo service mysql start (Linux)');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   - ตรวจสอบ username และ password ในไฟล์ .env');
      console.error('   - ตรวจสอบสิทธิ์การเข้าถึงฐานข้อมูล');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   - ฐานข้อมูลที่ระบุไม่มีอยู่');
      console.error('   - สร้างฐานข้อมูลใหม่: CREATE DATABASE nursing_system;');
    } else if (error.code === 'ENOTFOUND') {
      console.error('   - ตรวจสอบ hostname หรือ IP address ของฐานข้อมูล');
    } else if (error.code === 'ER_PARSE_ERROR') {
      console.error('   - มีปัญหา SQL syntax (แก้ไขแล้วในเวอร์ชันนี้)');
    }
  }
}

// รันการทดสอบ
testConnection().catch(console.error); 