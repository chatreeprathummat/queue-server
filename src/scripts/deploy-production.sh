#!/bin/bash

echo "🚀 เริ่มต้นการ Deploy ระบบไป Production"
echo "========================================"

# ตรวจสอบว่าอยู่ใน production mode หรือไม่
export NODE_ENV=production

# 1. สร้างโฟลเดอร์สำหรับ production
echo "📁 สร้างโฟลเดอร์ production..."
mkdir -p production-build
mkdir -p logs
mkdir -p config/certs/production

# 2. คัดลอกไฟล์ที่จำเป็นไปยัง production-build
echo "📋 คัดลอกไฟล์..."
cp -r *.js production-build/
cp -r routes production-build/
cp -r controllers production-build/
cp -r services production-build/
cp -r middleware production-build/
cp -r utils production-build/
cp -r config production-build/
cp -r prisma production-build/
cp -r sql production-build/
cp package.json production-build/
cp package-lock.json production-build/

# 3. ติดตั้ง dependencies สำหรับ production เท่านั้น
echo "📦 ติดตั้ง Production Dependencies..."
cd production-build
npm ci --only=production --silent

# 4. ตรวจสอบไฟล์ configuration
echo "🔍 ตรวจสอบ Configuration..."
if [ ! -f "config/production.env" ]; then
    echo "❌ ไม่พบไฟล์ config/production.env"
    echo "💡 กรุณาสร้างไฟล์ config/production.env และกำหนดค่าที่จำเป็น"
    exit 1
fi

# 5. ตรวจสอบ SSL Certificates (ถ้าใช้ HTTPS)
HTTPS_ENABLED=$(grep "HTTPS_ENABLED=true" config/production.env)
if [ ! -z "$HTTPS_ENABLED" ]; then
    echo "🔒 ตรวจสอบ SSL Certificates..."
    CERT_PATH=$(grep "CERT_PATH=" config/production.env | cut -d'=' -f2)
    KEY_PATH=$(grep "KEY_PATH=" config/production.env | cut -d'=' -f2)
    
    if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
        echo "❌ ไม่พบไฟล์ SSL Certificate"
        echo "💡 กรุณาวางไฟล์ SSL Certificate ในตำแหน่งที่ระบุ"
        echo "📍 CERT_PATH: $CERT_PATH"
        echo "📍 KEY_PATH: $KEY_PATH"
        exit 1
    fi
fi

# 6. ทดสอบการเชื่อมต่อ Database
echo "🗄️  ทดสอบการเชื่อมต่อ Database..."
# สร้างไฟล์ทดสอบเชื่อมต่อ database
cat > test-db-connection.js << 'EOF'
const config = require('./config/config');
const ManagementDB = require('./services/ManagementDB');

async function testConnections() {
    try {
        console.log('ทดสอบการเชื่อมต่อ Database...');
        const db = ManagementDB.getInstance();
        
        // ทดสอบการเชื่อมต่อ
        await db.testConnection();
        console.log('✅ เชื่อมต่อ Database สำเร็จ');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ ไม่สามารถเชื่อมต่อ Database:', error.message);
        process.exit(1);
    }
}

testConnections();
EOF

# รันทดสอบ
node test-db-connection.js
if [ $? -ne 0 ]; then
    echo "❌ การทดสอบ Database ล้มเหลว"
    rm test-db-connection.js
    exit 1
fi
rm test-db-connection.js

# 7. สร้างไฟล์ start script สำหรับ production
echo "📝 สร้าง Production Start Script..."
cat > start-production.sh << 'EOF'
#!/bin/bash

echo "🚀 เริ่มต้น Nursing System - Production Mode"
echo "==========================================="

# Set production environment
export NODE_ENV=production

# ตรวจสอบว่า server ยังทำงานอยู่หรือไม่
PID=$(pgrep -f "node server.js")
if [ ! -z "$PID" ]; then
    echo "⚠️  Server ยังทำงานอยู่ (PID: $PID)"
    echo "🛑 กำลังหยุด server เดิม..."
    kill $PID
    sleep 3
fi

# ตรวจสอบ Port
HTTP_PORT=$(grep "HTTP_PORT=" config/production.env | cut -d'=' -f2)
HTTP_PORT=${HTTP_PORT:-5009}

echo "🔍 ตรวจสอบ Port $HTTP_PORT..."
PORT_IN_USE=$(netstat -ano 2>/dev/null | grep ":$HTTP_PORT " | grep LISTENING)
if [ ! -z "$PORT_IN_USE" ]; then
    echo "⚠️  Port $HTTP_PORT ยังถูกใช้อยู่"
    # ใน Windows ใช้ taskkill, ใน Linux ใช้ kill
    if command -v taskkill >/dev/null 2>&1; then
        PID=$(echo $PORT_IN_USE | awk '{print $5}')
        taskkill //PID $PID //F 2>/dev/null
    else
        sudo fuser -k $HTTP_PORT/tcp 2>/dev/null
    fi
    sleep 2
fi

# เริ่ม server
echo "🚀 เริ่มระบบ Nursing System..."
echo "📅 เวลา: $(date)"
echo "🌐 Port: $HTTP_PORT"
echo "=============================="

nohup node server.js > ../logs/production.log 2>&1 &
PID=$!

echo "✅ ระบบเริ่มต้นแล้ว (PID: $PID)"
echo "📋 ดู log: tail -f ../logs/production.log"
echo "🔍 ตรวจสอบสถานะ: curl http://localhost:$HTTP_PORT/api/health"

# รอสักครู่แล้วตรวจสอบว่า server ทำงานหรือไม่
sleep 3
if ps -p $PID > /dev/null; then
    echo "🟢 Server ทำงานปกติ"
else
    echo "🔴 Server ไม่สามารถเริ่มต้นได้"
    echo "📋 ตรวจสอบ log: tail ../logs/production.log"
    exit 1
fi
EOF

chmod +x start-production.sh

# 8. สร้างไฟล์ stop script
cat > stop-production.sh << 'EOF'
#!/bin/bash

echo "🛑 หยุดระบบ Nursing System - Production"
echo "====================================="

# หา PID ของ server
PID=$(pgrep -f "node server.js")

if [ -z "$PID" ]; then
    echo "ℹ️  ไม่พบ server ที่ทำงานอยู่"
    exit 0
fi

echo "🔍 พบ server PID: $PID"
echo "🛑 กำลังหยุด server..."

# ส่งสัญญาณ SIGTERM ให้ graceful shutdown ก่อน
kill -TERM $PID

# รอให้หยุดภายใน 10 วินาที
for i in {1..10}; do
    if ! ps -p $PID > /dev/null; then
        echo "✅ Server หยุดเรียบร้อย"
        exit 0
    fi
    echo "⏳ รอ server หยุด... ($i/10)"
    sleep 1
done

# ถ้ายังไม่หยุด ใช้ force kill
echo "⚠️  Force kill server..."
kill -KILL $PID

if ! ps -p $PID > /dev/null; then
    echo "✅ Server หยุดเรียบร้อย (force)"
else
    echo "❌ ไม่สามารถหยุด server ได้"
    exit 1
fi
EOF

chmod +x stop-production.sh

# 9. สร้างไฟล์ restart script
cat > restart-production.sh << 'EOF'
#!/bin/bash

echo "🔄 Restart ระบบ Nursing System - Production"
echo "=========================================="

./stop-production.sh
sleep 2
./start-production.sh
EOF

chmod +x restart-production.sh

cd ..

echo ""
echo "✅ Production Deploy เสร็จสิ้น!"
echo "=============================="
echo "📁 ไฟล์ Production อยู่ที่: ./production-build/"
echo ""
echo "🚀 คำสั่งสำหรับใช้งาน:"
echo "   cd production-build"
echo "   ./start-production.sh     # เริ่ม server"
echo "   ./stop-production.sh      # หยุด server"  
echo "   ./restart-production.sh   # restart server"
echo ""
echo "📋 ตรวจสอบ log:"
echo "   tail -f logs/production.log"
echo ""
echo "🔍 ตรวจสอบสถานะ:"
echo "   curl http://localhost:5009/api/health"
echo ""
echo "⚠️  อย่าลืม:"
echo "   1. แก้ไขไฟล์ config/production.env ให้ถูกต้อง"
echo "   2. วาง SSL Certificates (ถ้าใช้ HTTPS)"
echo "   3. ตรวจสอบการเชื่อมต่อ Database" 