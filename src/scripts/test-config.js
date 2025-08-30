const path = require('path');
const fs = require('fs');

console.log('🔍 ทดสอบ Configuration');
console.log('========================');

// ทดสอบ NODE_ENV
const environment = process.env.NODE_ENV || 'development';
console.log(`📍 Environment: ${environment}`);

// โหลด config
const config = require('./config/config');

console.log('\n📋 การตั้งค่าปัจจุบัน:');
console.log('-------------------');
console.log(`HTTP Port: ${config.http_port}`);
console.log(`HTTPS Enabled: ${config.https_enabled}`);
console.log(`HTTPS Port: ${config.https_port}`);
console.log(`Oracle User: ${config.oracle_user}`);
console.log(`MySQL Host: ${config.host}`);
console.log(`MySQL Database: ${config.mysql_database}`);
console.log(`Cert Path: ${config.cert_path}`);
console.log(`Key Path: ${config.key_path}`);

// ตรวจสอบไฟล์ที่จำเป็น
console.log('\n📁 ตรวจสอบไฟล์:');
console.log('-------------------');

const files = [
    { path: '.env', required: environment === 'development' },
    { path: 'config/production.env', required: environment === 'production' },
    { path: config.cert_path, required: config.https_enabled },
    { path: config.key_path, required: config.https_enabled }
];

files.forEach(file => {
    const exists = fs.existsSync(file.path);
    const status = exists ? '✅' : (file.required ? '❌' : '⚠️');
    const note = !exists && file.required ? ' (จำเป็น)' : '';
    console.log(`${status} ${file.path}${note}`);
});

// ตรวจสอบ Environment Variables
console.log('\n🔧 Environment Variables:');
console.log('-------------------------');
const envVars = [
    'NODE_ENV',
    'HTTP_PORT',
    'HTTPS_ENABLED',
    'NODE_ORACLEDB_USER',
    'NODE_MYSQL_HOST',
    'NODE_MYSQL_DATABASE',
    'SECRET_KEY',
    'REFRESH_SECRET_KEY'
];

envVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '❌';
    const displayValue = varName.includes('PASSWORD') || varName.includes('SECRET') 
        ? (value ? '[HIDDEN]' : 'ไม่มี') 
        : (value || 'ไม่มี');
    console.log(`${status} ${varName}: ${displayValue}`);
});

console.log('\n🎯 สรุป:');
console.log('--------');
if (environment === 'development') {
    console.log('✅ อยู่ใน Development mode - ใช้ไฟล์ .env');
} else if (environment === 'production') {
    console.log('✅ อยู่ใน Production mode - ใช้ไฟล์ config/production.env');
}

const hasErrors = files.some(file => file.required && !fs.existsSync(file.path)) ||
                 envVars.some(varName => !process.env[varName]);

if (hasErrors) {
    console.log('❌ พบปัญหาในการตั้งค่า กรุณาตรวจสอบไฟล์และตัวแปรที่ขาดหายไป');
    process.exit(1);
} else {
    console.log('✅ Configuration ถูกต้องครบถ้วน');
} 