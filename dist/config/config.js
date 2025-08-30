"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Import dotenv with require since it might not have types
const dotenv = require('dotenv');
// โหลดไฟล์ environment ตาม NODE_ENV
const environment = process.env.NODE_ENV || 'development';
let envPath;
if (environment === 'production') {
    envPath = path_1.default.resolve(process.cwd(), 'config/production.env');
}
else {
    envPath = path_1.default.resolve(process.cwd(), '.env');
}
const envExists = fs_1.default.existsSync(envPath);
if (envExists) {
    console.log(`กำลังโหลดไฟล์ environment (${environment}) จาก: ${envPath}`);
    dotenv.config({ path: envPath });
}
else {
    console.warn(`ไม่พบไฟล์ environment ที่: ${envPath}`);
    console.log('ใช้ค่าเริ่มต้นและ system environment variables');
    dotenv.config();
}
// ตรวจสอบค่า environment variables ที่จำเป็น
const requiredEnvVars = ['HTTP_PORT', 'HTTPS_PORT', 'HTTPS_ENABLED'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.warn(`ไม่พบตัวแปรในไฟล์ .env: ${missingEnvVars.join(', ')}`);
    console.warn('ใช้ค่าเริ่มต้นสำหรับตัวแปรที่ไม่พบ');
}
const config = {
    //------For Oracle---------
    oracle_user: process.env.NODE_ORACLEDB_USER || '',
    oracle_password: process.env.NODE_ORACLEDB_PASSWORD || '',
    connectString: process.env.NODE_ORACLEDB_CONNECTIONSTRING || '',
    libdir: process.env.NODE_ORACLEDB_LIBDIR || '',
    //------For mysql----------
    host: process.env.NODE_MYSQL_HOST || '',
    mysql_user: process.env.NODE_MYSQL_USER || '',
    mysql_password: process.env.NODE_MYSQL_PASSWORD || '',
    mysql_database: process.env.NODE_MYSQL_DATABASE || '',
    //------For HTTPS----------
    https_enabled: (process.env.HTTPS_ENABLED || 'false').toLowerCase() === 'true',
    https_port: parseInt(process.env.HTTPS_PORT || '5443', 10),
    cert_path: process.env.CERT_PATH || './config/certs/cert.pem',
    key_path: process.env.KEY_PATH || './config/certs/key.pem',
    //------ for HTTP server----------
    http_port: parseInt(process.env.HTTP_PORT || '5009', 10),
};
// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m', // สีเขียวสำหรับทุกอย่างที่สำเร็จ
    bold: '\x1b[1m' // ตัวหนา
};
// แสดงการตั้งค่า server port
console.log('การตั้งค่าเซิร์ฟเวอร์: {');
console.log(`  https_enabled: ${colors.green}${config.https_enabled}${colors.reset},`);
console.log(`  http_port: ${colors.green}${config.http_port}${colors.reset},`);
console.log(`  https_port: ${colors.green}${config.https_port}${colors.reset},`);
console.log(`  cert_path: '${config.cert_path}',`);
console.log(`  key_path: '${config.key_path}'`);
console.log('}');
// Debug environment variables - เปิดใช้งานเพื่อ debug ปัญหา database
console.log('\n=== Environment Variables Debug ===');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'ไม่ได้ตั้งค่า (ใช้ development)'}`);
console.log(`NODE_MYSQL_HOST: "${process.env.NODE_MYSQL_HOST || 'ไม่ได้ตั้งค่า'}"`);
console.log(`NODE_MYSQL_USER: "${process.env.NODE_MYSQL_USER || 'ไม่ได้ตั้งค่า'}"`);
console.log(`NODE_MYSQL_PASSWORD: "${process.env.NODE_MYSQL_PASSWORD ? '[SET]' : 'ไม่ได้ตั้งค่า'}"`);
console.log(`NODE_MYSQL_DATABASE: "${process.env.NODE_MYSQL_DATABASE || 'ไม่ได้ตั้งค่า'}"`);
console.log(`HTTP_PORT: ${process.env.HTTP_PORT || 'ไม่ได้ตั้งค่า (ใช้ 5009)'}`);
console.log(`HTTPS_PORT: ${process.env.HTTPS_PORT || 'ไม่ได้ตั้งค่า (ใช้ 5443)'}`);
console.log(`HTTPS_ENABLED (raw): "${process.env.HTTPS_ENABLED}"`);
console.log(`HTTPS_ENABLED (parsed): ${(process.env.HTTPS_ENABLED || 'false').toLowerCase() === 'true'}`);
console.log('=====================================\n');
exports.default = config;
