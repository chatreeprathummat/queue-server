# ขั้นตอนตั้งค่าโปรเจกต์
1. npm init -y                         # สร้าง package.json
2. npm install typescript --save-dev   # ติดตั้ง TypeScript
3. npx tsc --init                      # สร้าง tsconfig.json
# ติดตั้งเครื่องมือรัน .ts ได้ทันที (แบบไม่ต้อง build)
1. npm install ts-node ts-node-dev @types/node --save-dev
# ติดตั้ง Express และ Type Definitions
1. npm install express@4 #ติดตั้ง express version4
2. npm install --save-dev @types/express
3. npm install dotenv

# ติดตั้ง Middleware สำคัญ (ใช้ใน app.ts)
1. npm install morgan
2. npm install --save-dev @types/morgan  //morgan แสดง log เวลามี request เช่น GET /user 20
3. npm install cors
4. npm install --save-dev @types/cors //อนุญาตให้ frontend เรียก API ข้าม domain ได้
5. npm install helmet                 //helmet ป้องกัน header-based attack เช่น XSS, clickjacking
6. npm install typescript --save-dev	//dotenv ใช้โหลดค่าจาก .env เช่น PORT, DB_URL

# ติดตั้ง ไลบรารี่ ที่ต้องใช้
1. npm install moment //สำหรับจัดการวันเวลา
2. npm install moment-timezone //จัดการ Time zone
3. npm install joi //สำหรับตรวจสอบ/validate ข้อมูล (input validation)
4. npm install --save-dev @types/joi 

4. npm install winston //ตัวจัดการ logging
# เชื่อมต่อฐานข้อมูล
1. npm install mysql2 //คำสั่งติดตั้ง mysql2 (พร้อม TypeScript)

# สร้างไฟล์
1. สร้าง Folder =>> src เพื่อเก็บ Source Code TypeScript
2. สร้าง Folder =>> dist เพื่อเก็บ Source Code Java Scritp หลังจากที่ Compile เป็น js

# แก้ไขบางค่าใน tsconfig.json (ให้รองรับโค้ด Node):
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}

# เพิ่ม Script ใน package.json
"scripts": {
  "dev": "ts-node-dev src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}

# inventory-server2
