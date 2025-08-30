@echo off
if "%~1"=="" (
    echo ❌ กรุณาระบุเส้นทางโค้ดใหม่
    echo 💡 ใช้งาน: update-production.bat "C:\path\to\new\code"
    pause
    exit /b 1
)

set NEW_CODE_PATH=%~1

echo 🔄 อัพเดทระบบ Nursing System - Production
echo ========================================

echo 📍 อัพเดทจาก: %NEW_CODE_PATH%
echo 📍 ไปยัง: production-build\

REM ตรวจสอบว่ามีโฟลเดอร์โค้ดใหม่หรือไม่
if not exist "%NEW_CODE_PATH%" (
    echo ❌ ไม่พบโฟลเดอร์: %NEW_CODE_PATH%
    pause
    exit /b 1
)

REM ตรวจสอบว่ามี production-build หรือไม่
if not exist "production-build" (
    echo ❌ ไม่พบโฟลเดอร์ production-build
    echo 💡 กรุณารัน scripts\deploy-production.bat ก่อน
    pause
    exit /b 1
)

REM สร้าง backup
for /f "tokens=1-4 delims=/ " %%i in ('date /t') do set dt=%%i%%j%%k
for /f "tokens=1-2 delims=: " %%i in ('time /t') do set tm=%%i%%j
set BACKUP_DIR=backup-%dt%-%tm%
set BACKUP_DIR=%BACKUP_DIR: =%

echo 💾 สร้าง backup: %BACKUP_DIR%
xcopy /E /I /Y production-build %BACKUP_DIR%\

cd production-build

REM หยุด server ก่อนอัพเดท
echo 🛑 หยุด server...
call stop-production.bat

REM บันทึกไฟล์ config เดิม
echo 💾 บันทึกไฟล์ config...
if exist "config\production.env" copy /Y config\production.env ..\temp-production.env
if exist "config\certs" xcopy /E /I /Y config\certs ..\temp-certs\

REM อัพเดทไฟล์โค้ด
echo 📋 อัพเดทไฟล์โค้ด...

REM คัดลอกไฟล์ใหม่ (ยกเว้น config และ node_modules)
xcopy /E /I /Y "%NEW_CODE_PATH%\*.js" .\
xcopy /E /I /Y "%NEW_CODE_PATH%\routes" routes\
xcopy /E /I /Y "%NEW_CODE_PATH%\controllers" controllers\
xcopy /E /I /Y "%NEW_CODE_PATH%\services" services\
xcopy /E /I /Y "%NEW_CODE_PATH%\middleware" middleware\
xcopy /E /I /Y "%NEW_CODE_PATH%\utils" utils\
xcopy /E /I /Y "%NEW_CODE_PATH%\prisma" prisma\
xcopy /E /I /Y "%NEW_CODE_PATH%\sql" sql\

REM คืนไฟล์ config
echo 🔄 คืนไฟล์ config...
if exist "..\temp-production.env" copy /Y ..\temp-production.env config\production.env
if exist "..\temp-certs" xcopy /E /I /Y ..\temp-certs\* config\certs\

REM ลบไฟล์ชั่วคราว
if exist "..\temp-production.env" del ..\temp-production.env
if exist "..\temp-certs" rd /s /q ..\temp-certs

REM ตรวจสอบว่ามี package.json ใหม่หรือไม่
if exist "%NEW_CODE_PATH%\package.json" (
    echo 📦 ตรวจสอบ dependencies...
    
    REM เปรียบเทียบ package.json (simple check)
    fc /B package.json "%NEW_CODE_PATH%\package.json" > nul
    if errorlevel 1 (
        echo 📦 อัพเดท dependencies...
        copy /Y "%NEW_CODE_PATH%\package.json" .\
        if exist "%NEW_CODE_PATH%\package-lock.json" copy /Y "%NEW_CODE_PATH%\package-lock.json" .\
        call npm ci --only=production --silent
    ) else (
        echo ✅ dependencies ไม่เปลี่ยนแปลง
    )
)

REM ทดสอบ syntax
echo 🔍 ทดสอบ syntax...
node -c server.js
if errorlevel 1 (
    echo ❌ Syntax ผิดพลาด - กำลังคืนค่า backup...
    cd ..
    rd /s /q production-build
    ren %BACKUP_DIR% production-build
    echo ✅ คืนค่า backup เรียบร้อย
    pause
    exit /b 1
)

REM เริ่ม server ใหม่
echo 🚀 เริ่ม server...
call start-production.bat

REM รอสักครู่แล้วทดสอบ
echo 🔍 ทดสอบ API...
timeout /t 5 /nobreak > nul

REM ทดสอบ API (ใช้ curl หรือ PowerShell)
curl -f http://localhost:5009/api/health > nul 2>&1
if errorlevel 1 (
    echo ❌ Server ไม่ตอบสนอง - กำลังคืนค่า backup...
    call stop-production.bat
    cd ..
    rd /s /q production-build
    ren %BACKUP_DIR% production-build
    cd production-build
    call start-production.bat
    echo ✅ คืนค่า backup เรียบร้อย
    pause
    exit /b 1
)

echo ✅ อัพเดทสำเร็จ!
echo 🗑️  ลบ backup...
cd ..
rd /s /q %BACKUP_DIR%

echo.
echo 🎉 อัพเดทระบบสำเร็จ!
echo ===================
echo 📅 เวลา: %date% %time%
echo 🌐 URL: http://localhost:5009
echo 📋 Log: type logs\production.log

pause 