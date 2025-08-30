import path from 'path';
import fs from 'fs';

// Import dotenv with require since it might not have types
const dotenv = require('dotenv') as any;

// Interface for configuration object
interface Config {
  oracle_user: string;
  oracle_password: string;
  connectString: string;
  libdir: string;
  host: string;
  mysql_user: string;
  mysql_password: string;
  mysql_database: string;
  mysql_port: number;
  https_enabled: boolean;
  https_port: number;
  cert_path: string;
  key_path: string;
  http_port: number;
}

// โหลดไฟล์ environment ตาม NODE_ENV
const environment: string = process.env.NODE_ENV || 'development';
let envPath: string;

if (environment === 'production') {
    envPath = path.resolve(process.cwd(), 'config/production.env');
} else {
    envPath = path.resolve(process.cwd(), '.env');
}

const envExists: boolean = fs.existsSync(envPath);

if (envExists) {
    console.log(`กำลังโหลดไฟล์ environment (${environment}) จาก: ${envPath}`);
    dotenv.config({ path: envPath });
} else {
    console.warn(`ไม่พบไฟล์ environment ที่: ${envPath}`);
    console.log('ใช้ค่าเริ่มต้นและ system environment variables');
    dotenv.config();
}

// ตรวจสอบค่า environment variables ที่จำเป็น
const requiredEnvVars: string[] = ['HTTP_PORT', 'HTTPS_PORT', 'HTTPS_ENABLED'];
const missingEnvVars: string[] = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.warn(`ไม่พบตัวแปรในไฟล์ .env: ${missingEnvVars.join(', ')}`);
    console.warn('ใช้ค่าเริ่มต้นสำหรับตัวแปรที่ไม่พบ');
}

const config: Config = {
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
    mysql_port: parseInt(process.env.NODE_MYSQL_PORT || '3307', 10),
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
    green: '\x1b[32m',    // สีเขียวสำหรับทุกอย่างที่สำเร็จ
    bold: '\x1b[1m'       // ตัวหนา
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
console.log(`NODE_MYSQL_PORT: "${process.env.NODE_MYSQL_PORT || 'ไม่ได้ตั้งค่า (ใช้ 3307)'}"`);
console.log(`NODE_MYSQL_USER: "${process.env.NODE_MYSQL_USER || 'ไม่ได้ตั้งค่า'}"`);
console.log(`NODE_MYSQL_PASSWORD: "${process.env.NODE_MYSQL_PASSWORD ? '[SET]' : 'ไม่ได้ตั้งค่า'}"`);
console.log(`NODE_MYSQL_DATABASE: "${process.env.NODE_MYSQL_DATABASE || 'ไม่ได้ตั้งค่า'}"`);
console.log(`HTTP_PORT: ${process.env.HTTP_PORT || 'ไม่ได้ตั้งค่า (ใช้ 5009)'}`);
console.log(`HTTPS_PORT: ${process.env.HTTPS_PORT || 'ไม่ได้ตั้งค่า (ใช้ 5443)'}`);
console.log(`HTTPS_ENABLED (raw): "${process.env.HTTPS_ENABLED}"`);
console.log(`HTTPS_ENABLED (parsed): ${(process.env.HTTPS_ENABLED || 'false').toLowerCase() === 'true'}`);
console.log('=====================================\n');

export default config;