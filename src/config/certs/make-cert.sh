#!/bin/bash

# สร้าง SSL certificate สำหรับใช้งานกับ HTTPS
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
    -subj "/C=TH/ST=Bangkok/L=Bangkok/O=Nursing System/OU=Development/CN=localhost"

echo "SSL Certificate ถูกสร้างเรียบร้อยแล้ว"
echo "  - cert.pem: Self-signed certificate"
echo "  - key.pem: Private key" 