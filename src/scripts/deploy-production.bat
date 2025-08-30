@echo off
echo 🚀 เริ่มต้นการ Deploy ระบบไป Production
echo ========================================

REM ตรวจสอบว่าอยู่ใน production mode หรือไม่
set NODE_ENV=production

REM 1. สร้างโฟลเดอร์สำหรับ production
echo 📁 สร้างโฟลเดอร์ production...
if not exist "production-build" mkdir production-build
if not exist "logs" mkdir logs
if not exist "config\certs\production" mkdir config\certs\production

REM 2. คัดลอกไฟล์ที่จำเป็นไปยัง production-build
echo 📋 คัดลอกไฟล์...
xcopy /E /I /Y *.js production-build\
xcopy /E /I /Y routes production-build\routes\
xcopy /E /I /Y controllers production-build\controllers\
xcopy /E /I /Y services production-build\services\
xcopy /E /I /Y middleware production-build\middleware\
xcopy /E /I /Y utils production-build\utils\
xcopy /E /I /Y config production-build\config\
xcopy /E /I /Y prisma production-build\prisma\
xcopy /E /I /Y sql production-build\sql\
copy /Y package.json production-build\
copy /Y package-lock.json production-build\

REM 3. ติดตั้ง dependencies สำหรับ production เท่านั้น
echo 📦 ติดตั้ง Production Dependencies...
cd production-build
call npm ci --only=production --silent

REM 4. ตรวจสอบไฟล์ configuration
echo 🔍 ตรวจสอบ Configuration...
if not exist "config\production.env" (
    echo ❌ ไม่พบไฟล์ config\production.env
    echo 💡 กรุณาสร้างไฟล์ config\production.env และกำหนดค่าที่จำเป็น
    pause
    exit /b 1
)

REM 5. สร้างไฟล์ start script สำหรับ production
echo 📝 สร้าง Production Start Script...

REM สร้างไฟล์ start-production.bat
echo @echo off > start-production.bat
echo echo 🚀 เริ่มต้น Nursing System - Production Mode >> start-production.bat
echo echo =========================================== >> start-production.bat
echo set NODE_ENV=production >> start-production.bat
echo. >> start-production.bat
echo REM ตรวจสอบว่า server ยังทำงานอยู่หรือไม่ >> start-production.bat
echo for /f "tokens=5" %%%%a in ('netstat -ano ^| findstr :5009') do taskkill /PID %%%%a /F 2^>nul >> start-production.bat
echo. >> start-production.bat
echo echo 🚀 เริ่มระบบ Nursing System... >> start-production.bat
echo echo 📅 เวลา: %%date%% %%time%% >> start-production.bat
echo echo 🌐 Port: 5009 >> start-production.bat
echo echo ============================== >> start-production.bat
echo. >> start-production.bat
echo start /B node server.js ^> ..\logs\production.log 2^>^&1 >> start-production.bat
echo echo ✅ ระบบเริ่มต้นแล้ว >> start-production.bat
echo echo 📋 ดู log: type ..\logs\production.log >> start-production.bat
echo pause >> start-production.bat

REM สร้างไฟล์ stop-production.bat
echo @echo off > stop-production.bat
echo echo 🛑 หยุดระบบ Nursing System - Production >> stop-production.bat
echo echo ===================================== >> stop-production.bat
echo. >> stop-production.bat
echo for /f "tokens=5" %%%%a in ('netstat -ano ^| findstr :5009') do ( >> stop-production.bat
echo     echo 🔍 พบ server PID: %%%%a >> stop-production.bat
echo     echo 🛑 กำลังหยุด server... >> stop-production.bat
echo     taskkill /PID %%%%a /F >> stop-production.bat
echo     echo ✅ Server หยุดเรียบร้อย >> stop-production.bat
echo     goto :done >> stop-production.bat
echo ^) >> stop-production.bat
echo echo ℹ️  ไม่พบ server ที่ทำงานอยู่ >> stop-production.bat
echo :done >> stop-production.bat
echo pause >> stop-production.bat

REM สร้างไฟล์ restart-production.bat
echo @echo off > restart-production.bat
echo echo 🔄 Restart ระบบ Nursing System - Production >> restart-production.bat
echo echo ========================================== >> restart-production.bat
echo call stop-production.bat >> restart-production.bat
echo timeout /t 2 /nobreak ^> nul >> restart-production.bat
echo call start-production.bat >> restart-production.bat

cd ..

echo.
echo ✅ Production Deploy เสร็จสิ้น!
echo ==============================
echo 📁 ไฟล์ Production อยู่ที่: .\production-build\
echo.
echo 🚀 คำสั่งสำหรับใช้งาน:
echo    cd production-build
echo    start-production.bat     # เริ่ม server
echo    stop-production.bat      # หยุด server
echo    restart-production.bat   # restart server
echo.
echo 📋 ตรวจสอบ log:
echo    type logs\production.log
echo.
echo 🔍 ตรวจสอบสถานะ:
echo    curl http://localhost:5009/api/health
echo.
echo ⚠️  อย่าลืม:
echo    1. แก้ไขไฟล์ config\production.env ให้ถูกต้อง
echo    2. วาง SSL Certificates (ถ้าใช้ HTTPS)
echo    3. ตรวจสอบการเชื่อมต่อ Database
echo.
pause 