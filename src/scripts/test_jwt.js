/**
 * Test JWT Configuration Script
 * สคริปต์ทดสอบการตั้งค่า JWT และ Refresh Token
 */

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// โหลด environment variables
dotenv.config();

function testJWTConfiguration() {
  console.log('🔍 กำลังทดสอบการตั้งค่า JWT...\n');
  
  // ตรวจสอบการตั้งค่า JWT secrets
  console.log('📋 การตั้งค่า JWT:');
  console.log(`   SECRET_KEY: ${process.env.SECRET_KEY ? 'ตั้งค่าแล้ว' : '❌ ไม่ได้ตั้งค่า'}`);
  console.log(`   REFRESH_SECRET_KEY: ${process.env.REFRESH_SECRET_KEY ? 'ตั้งค่าแล้ว' : '❌ ไม่ได้ตั้งค่า'}\n`);

  // ตรวจสอบว่าได้ตั้งค่าครบหรือไม่
  const requiredVars = ['SECRET_KEY', 'REFRESH_SECRET_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ ไม่พบการตั้งค่าต่อไปนี้ในไฟล์ .env:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n💡 กรุณาเพิ่มการตั้งค่าดังนี้ในไฟล์ .env:');
    console.error(`
SECRET_KEY=nursing-system-secret-key-2024
REFRESH_SECRET_KEY=nursing-system-refresh-secret-key-2024
    `);
    return;
  }

  try {
    // สร้าง test payload
    const testPayload = {
      userId: 1,
      username: 'testuser',
      current_place: 'TEST01'
    };

    console.log('🔐 กำลังทดสอบการสร้าง JWT tokens...');

    // ทดสอบสร้าง Access Token
    const accessToken = jwt.sign(testPayload, process.env.SECRET_KEY, { expiresIn: '1h' });
    console.log('✅ สร้าง Access Token สำเร็จ');
    console.log(`   Token: ${accessToken.substring(0, 50)}...`);

    // ทดสอบสร้าง Refresh Token
    const refreshToken = jwt.sign(testPayload, process.env.REFRESH_SECRET_KEY, { expiresIn: '1d' });
    console.log('✅ สร้าง Refresh Token สำเร็จ');
    console.log(`   Token: ${refreshToken.substring(0, 50)}...\n`);

    // ทดสอบการ verify Access Token
    console.log('🔍 กำลังทดสอบการตรวจสอบ tokens...');
    
    const decodedAccess = jwt.verify(accessToken, process.env.SECRET_KEY);
    console.log('✅ ตรวจสอบ Access Token สำเร็จ');
    console.log(`   User ID: ${decodedAccess.userId}`);
    console.log(`   Username: ${decodedAccess.username}`);
    console.log(`   Place: ${decodedAccess.current_place}`);

    // ทดสอบการ verify Refresh Token
    const decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_SECRET_KEY);
    console.log('✅ ตรวจสอบ Refresh Token สำเร็จ');
    console.log(`   User ID: ${decodedRefresh.userId}`);
    console.log(`   Username: ${decodedRefresh.username}\n`);

    // ทดสอบการสร้าง token ใหม่จาก refresh token
    console.log('🔄 กำลังทดสอบการ refresh token...');
    const newAccessToken = jwt.sign(
      {
        userId: decodedRefresh.userId,
        username: decodedRefresh.username,
        current_place: decodedRefresh.current_place
      },
      process.env.SECRET_KEY,
      { expiresIn: '1h' }
    );
    console.log('✅ สร้าง Access Token ใหม่จาก Refresh Token สำเร็จ');

    console.log('\n🎉 การทดสอบ JWT สำเร็จทั้งหมด!');
    console.log('💡 ระบบ Authentication ควรทำงานได้ถูกต้องแล้ว');

  } catch (error) {
    console.error('\n❌ การทดสอบ JWT ล้มเหลว!');
    console.error('📝 รายละเอียด Error:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Name: ${error.name}`);
    
    console.error('\n💡 คำแนะนำการแก้ไข:');
    if (error.name === 'JsonWebTokenError') {
      console.error('   - ตรวจสอบว่า SECRET_KEY และ REFRESH_SECRET_KEY ตั้งค่าถูกต้อง');
      console.error('   - รีสตาร์ท server หลังจากแก้ไขไฟล์ .env');
    } else if (error.name === 'TokenExpiredError') {
      console.error('   - Token หมดอายุ (ปกติสำหรับการทดสอบ)');
    }
  }
}

// ทดสอบการเชื่อมต่อฐานข้อมูลด้วย
async function testDatabaseConnection() {
  console.log('\n🔗 กำลังทดสอบการเชื่อมต่อฐานข้อมูล...');
  
  const requiredDBVars = ['NODE_MYSQL_HOST', 'NODE_MYSQL_USER', 'NODE_MYSQL_PASSWORD', 'NODE_MYSQL_DATABASE'];
  const missingDBVars = requiredDBVars.filter(varName => !process.env[varName]);
  
  if (missingDBVars.length > 0) {
    console.error('❌ ไม่พบการตั้งค่าฐานข้อมูลในไฟล์ .env:');
    missingDBVars.forEach(varName => console.error(`   - ${varName}`));
    return;
  }

  try {
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.NODE_MYSQL_HOST,
      user: process.env.NODE_MYSQL_USER,
      password: process.env.NODE_MYSQL_PASSWORD,
      database: process.env.NODE_MYSQL_DATABASE,
      timeout: 5000
    });
    
    await connection.execute('SELECT 1');
    await connection.end();
    
    console.log('✅ การเชื่อมต่อฐานข้อมูลสำเร็จ!');
  } catch (error) {
    console.error('❌ การเชื่อมต่อฐานข้อมูลล้มเหลว:');
    console.error(`   ${error.message}`);
  }
}

// รันการทดสอบ
async function runAllTests() {
  console.log('=' .repeat(60));
  console.log('🧪 การทดสอบระบบ Authentication และฐานข้อมูล');
  console.log('=' .repeat(60));
  
  testJWTConfiguration();
  await testDatabaseConnection();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📝 หากการทดสอบผ่านทั้งหมด ให้รีสตาร์ท server แล้วทดสอบ API');
  console.log('=' .repeat(60));
}

runAllTests().catch(console.error); 