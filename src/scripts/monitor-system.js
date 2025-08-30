const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('======================================');
console.log('Nursing System - Advanced Monitor');
console.log('======================================');

// ตรวจสอบสถานะ server
function checkServerStatus() {
    return new Promise((resolve) => {
        const curl = spawn('curl', ['-s', 'http://localhost:5009/api/health']);
        let data = '';
        
        curl.stdout.on('data', (chunk) => {
            data += chunk;
        });
        
        curl.on('close', (code) => {
            if (code === 0) {
                try {
                    const health = JSON.parse(data);
                    resolve({
                        status: 'running',
                        uptime: Math.floor(health.uptime),
                        memory: Math.floor(health.memory.rss / 1024 / 1024), // MB
                        timestamp: health.timestamp
                    });
                } catch (e) {
                    resolve({ status: 'error', error: 'Invalid JSON response' });
                }
            } else {
                resolve({ status: 'stopped' });
            }
        });
    });
}

// ดู log file
function tailLogFile() {
    const logPath = path.join(__dirname, 'logs', 'production.log');
    
    if (!fs.existsSync(logPath)) {
        console.log('❌ Log file not found:', logPath);
        return;
    }
    
    console.log('📋 Log file found:', logPath);
    console.log('📊 Monitoring logs... (Press Ctrl+C to stop)');
    console.log('==========================================');
    
    // อ่าน log ล่าสุด 10 บรรทัด
    const logContent = fs.readFileSync(logPath, 'utf8');
    const lines = logContent.split('\n').slice(-10);
    lines.forEach(line => {
        if (line.trim()) console.log(line);
    });
    
    console.log('==========================================');
    console.log('Real-time monitoring:');
    
    // Monitor แบบ real-time
    fs.watchFile(logPath, (curr, prev) => {
        if (curr.mtime > prev.mtime) {
            const newContent = fs.readFileSync(logPath, 'utf8');
            const newLines = newContent.split('\n');
            const lastLine = newLines[newLines.length - 2]; // -2 เพราะบรรทัดสุดท้ายมักจะเป็น empty
            
            if (lastLine && lastLine.trim()) {
                const timestamp = new Date().toLocaleString('th-TH');
                console.log(`[${timestamp}] ${lastLine}`);
            }
        }
    });
}

// แสดงสถานะระบบ
async function showSystemStatus() {
    const status = await checkServerStatus();
    
    console.log('\n🔍 Server Status:');
    console.log('================');
    
    if (status.status === 'running') {
        console.log('✅ Server: Running');
        console.log(`⏱️  Uptime: ${status.uptime} seconds`);
        console.log(`💾 Memory: ${status.memory} MB`);
        console.log(`📅 Last Check: ${status.timestamp}`);
    } else if (status.status === 'stopped') {
        console.log('❌ Server: Stopped');
    } else {
        console.log('⚠️  Server: Error -', status.error);
    }
    
    console.log('================\n');
}

// Main function
async function main() {
    // แสดงสถานะเริ่มต้น
    await showSystemStatus();
    
    // เริ่ม monitor logs
    tailLogFile();
    
    // แสดงสถานะทุก 30 วินาที
    setInterval(showSystemStatus, 30000);
}

// จัดการ Ctrl+C
process.on('SIGINT', () => {
    console.log('\n👋 Stopping monitor...');
    process.exit(0);
});

// เริ่มต้น
main().catch(console.error); 