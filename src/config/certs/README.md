# SSL Certificates

โฟลเดอร์นี้ใช้สำหรับเก็บไฟล์ certificates สำหรับการใช้งาน HTTPS

## ไฟล์ที่ต้องมี
- `key.pem`: Private key 
- `cert.pem`: Certificate file

## การสร้าง Self-signed Certificate สำหรับการทดสอบ

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

หมายเหตุ: ไฟล์ certificate ที่สร้างด้วยวิธีนี้เหมาะสำหรับการทดสอบเท่านั้น ไม่ควรใช้ในการผลิตจริง 