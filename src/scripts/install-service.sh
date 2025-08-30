#!/bin/bash

echo "🔧 ติดตั้ง Nursing System เป็น Service"
echo "======================================"

# ตรวจสอบว่าใช้ systemd หรือไม่
if ! command -v systemctl &> /dev/null; then
    echo "❌ ระบบไม่รองรับ systemd"
    exit 1
fi

# ขอ path ของ production-build
INSTALL_PATH=$(realpath production-build)
if [ ! -d "$INSTALL_PATH" ]; then
    echo "❌ ไม่พบโฟลเดอร์ production-build"
    exit 1
fi

echo "📍 ติดตั้งจาก: $INSTALL_PATH"

# สร้างไฟล์ service
cat > nursing-system.service << EOF
[Unit]
Description=Nursing System Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_PATH
ExecStart=/usr/bin/node server.js
ExecStop=/bin/kill -SIGTERM \$MAINPID
Restart=always
RestartSec=3
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# คัดลอกไฟล์ service
sudo cp nursing-system.service /etc/systemd/system/
sudo chmod 644 /etc/systemd/system/nursing-system.service

# reload systemd
sudo systemctl daemon-reload

# enable service
sudo systemctl enable nursing-system

echo "✅ ติดตั้ง service สำเร็จ!"
echo ""
echo "🚀 คำสั่งสำหรับใช้งาน:"
echo "   sudo systemctl start nursing-system    # เริ่ม service"
echo "   sudo systemctl stop nursing-system     # หยุด service"
echo "   sudo systemctl restart nursing-system  # restart service"
echo "   sudo systemctl status nursing-system   # ดูสถานะ"
echo "   sudo journalctl -u nursing-system -f   # ดู log"
echo ""
echo "🔄 Service จะเริ่มต้นอัตโนมัติเมื่อ reboot"

# ลบไฟล์ชั่วคราว
rm nursing-system.service 