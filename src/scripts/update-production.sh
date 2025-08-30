#!/bin/bash

echo "🔄 อัพเดทระบบ Nursing System - Production"
echo "========================================"

# ตรวจสอบพารามิเตอร์
if [ $# -eq 0 ]; then
    echo "❌ กรุณาระบุเส้นทางโค้ดใหม่"
    echo "💡 ใช้งาน: ./update-production.sh /path/to/new/code"
    exit 1
fi

NEW_CODE_PATH="$1"

# ตรวจสอบว่ามีโฟลเดอร์โค้ดใหม่หรือไม่
if [ ! -d "$NEW_CODE_PATH" ]; then
    echo "❌ ไม่พบโฟลเดอร์: $NEW_CODE_PATH"
    exit 1
fi

# ตรวจสอบว่ามี production-build หรือไม่
if [ ! -d "production-build" ]; then
    echo "❌ ไม่พบโฟลเดอร์ production-build"
    echo "💡 กรุณารัน ./scripts/deploy-production.sh ก่อน"
    exit 1
fi

echo "📍 อัพเดทจาก: $NEW_CODE_PATH"
echo "📍 ไปยัง: production-build/"

# สร้าง backup
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
echo "💾 สร้าง backup: $BACKUP_DIR"
cp -r production-build "$BACKUP_DIR"

cd production-build

# หยุด server ก่อนอัพเดท
echo "🛑 หยุด server..."
./stop-production.sh

# บันทึกไฟล์ config เดิม
echo "💾 บันทึกไฟล์ config..."
cp config/production.env ../temp-production.env 2>/dev/null || true
cp -r config/certs ../temp-certs 2>/dev/null || true

# อัพเดทไฟล์โค้ด
echo "📋 อัพเดทไฟล์โค้ด..."

# คัดลอกไฟล์ใหม่ (ยกเว้น config และ node_modules)
rsync -av --exclude='node_modules' --exclude='config/production.env' --exclude='config/certs' "$NEW_CODE_PATH/" ./

# คืนไฟล์ config
echo "🔄 คืนไฟล์ config..."
cp ../temp-production.env config/production.env 2>/dev/null || true
cp -r ../temp-certs/* config/certs/ 2>/dev/null || true

# ลบไฟล์ชั่วคราว
rm -f ../temp-production.env
rm -rf ../temp-certs

# ตรวจสอบว่ามี package.json ใหม่หรือไม่
if [ -f "$NEW_CODE_PATH/package.json" ]; then
    echo "📦 ตรวจสอบ dependencies..."
    
    # เปรียบเทียบ package.json
    CURRENT_HASH=$(md5sum package.json | cut -d' ' -f1)
    NEW_HASH=$(md5sum "$NEW_CODE_PATH/package.json" | cut -d' ' -f1)
    
    if [ "$CURRENT_HASH" != "$NEW_HASH" ]; then
        echo "📦 อัพเดท dependencies..."
        cp "$NEW_CODE_PATH/package.json" ./
        cp "$NEW_CODE_PATH/package-lock.json" ./ 2>/dev/null || true
        npm ci --only=production --silent
    else
        echo "✅ dependencies ไม่เปลี่ยนแปลง"
    fi
fi

# ทดสอบ configuration
echo "🔍 ทดสอบ configuration..."
node -e "
try {
    const config = require('./config/config');
    console.log('✅ Configuration ถูกต้อง');
} catch(err) {
    console.log('❌ Configuration ผิดพลาด:', err.message);
    process.exit(1);
}
"

if [ $? -ne 0 ]; then
    echo "❌ Configuration ผิดพลาด - กำลังคืนค่า backup..."
    cd ..
    rm -rf production-build
    mv "$BACKUP_DIR" production-build
    echo "✅ คืนค่า backup เรียบร้อย"
    exit 1
fi

# ทดสอบ syntax
echo "🔍 ทดสอบ syntax..."
node -c server.js
if [ $? -ne 0 ]; then
    echo "❌ Syntax ผิดพลาด - กำลังคืนค่า backup..."
    cd ..
    rm -rf production-build
    mv "$BACKUP_DIR" production-build
    echo "✅ คืนค่า backup เรียบร้อย"
    exit 1
fi

# เริ่ม server ใหม่
echo "🚀 เริ่ม server..."
./start-production.sh

# รอสักครู่แล้วทดสอบ
sleep 5

# ทดสอบว่า server ทำงานหรือไม่
HTTP_PORT=$(grep "HTTP_PORT=" config/production.env | cut -d'=' -f2)
HTTP_PORT=${HTTP_PORT:-5009}

echo "🔍 ทดสอบ API..."
curl -f http://localhost:$HTTP_PORT/api/health > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ อัพเดทสำเร็จ!"
    echo "🗑️  ลบ backup..."
    cd ..
    rm -rf "$BACKUP_DIR"
    echo ""
    echo "📋 ตรวจสอบ log:"
    echo "   tail -f logs/production.log"
    echo ""
    echo "🔍 ทดสอบระบบ:"
    echo "   curl http://localhost:$HTTP_PORT/api/health"
else
    echo "❌ Server ไม่ตอบสนอง - กำลังคืนค่า backup..."
    ./stop-production.sh
    cd ..
    rm -rf production-build
    mv "$BACKUP_DIR" production-build
    cd production-build
    ./start-production.sh
    echo "✅ คืนค่า backup เรียบร้อย"
    exit 1
fi

echo ""
echo "🎉 อัพเดทระบบสำเร็จ!"
echo "==================="
echo "📅 เวลา: $(date)"
echo "🌐 URL: http://localhost:$HTTP_PORT"
echo "📋 Log: tail -f ../logs/production.log" 