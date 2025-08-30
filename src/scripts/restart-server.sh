#!/bin/bash

echo "🔄 กำลัง restart server อย่างปลอดภัย..."

# หยุด nodemon processes ทั้งหมด
echo "⏹️  หยุด nodemon processes..."
pkill -f nodemon
pkill -f "node server"
pkill -f "node server.js"

# รอให้ processes ปิดอย่างสมบูรณ์
echo "⏳ รอให้ processes ปิดอย่างสมบูรณ์..."
sleep 3

# ตรวจสอบว่า port ว่างแล้วหรือไม่
HTTP_PORT=${HTTP_PORT:-5009}
echo "🔍 ตรวจสอบ port $HTTP_PORT..."

# สำหรับ Windows (ใช้ netstat)
if command -v netstat >/dev/null 2>&1; then
    PORT_IN_USE=$(netstat -ano | grep :$HTTP_PORT | grep LISTENING)
    if [ ! -z "$PORT_IN_USE" ]; then
        echo "⚠️  Port $HTTP_PORT ยังถูกใช้อยู่ กำลังหยุด process..."
        PID=$(echo $PORT_IN_USE | awk '{print $5}')
        taskkill //PID $PID //F 2>/dev/null || true
        sleep 2
    fi
fi

echo "✅ พร้อมเริ่ม server ใหม่"
echo "🚀 เริ่ม server ใน development mode..."

# เริ่ม server ใหม่
npm run dev 