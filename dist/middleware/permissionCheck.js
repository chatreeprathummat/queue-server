"use strict";
/**
 * =================================================================
 * permissionCheck.ts - Middleware สำหรับตรวจสอบสิทธิ์
 * =================================================================
 *
 * รวม middleware สำหรับ authentication และ authorization
 *
 * @author System Development Team
 * @version 1.0
 * @date 2025-01-20
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAnyPermission = exports.checkPermission = exports.authCheck = void 0;
// Import with require for modules without type declarations
const jwt = require('jsonwebtoken');
const ManagementDB = require("../services/ManagementDB");
const { calculateTokenStatus, createTokenHeaders, handleJWTError } = require("../utils/authUtils");
const { logPermissionCheck } = require("../services/logging/authLogger");
const { wrapController } = require("../services/logging/controllers/requestLogger");
const permissionMoment = require('moment');
/**
 * ฟังก์ชัน middleware สำหรับตรวจสอบ JWT token และสิทธิ์พื้นฐาน
 *
 * ใช้โดย:
 * - ทุก API route ที่ต้องการ authentication
 * - เป็น middleware แรกในลำดับ
 *
 * ฟังก์ชันนี้:
 * - ตรวจสอบ JWT token จาก header
 * - ตรวจสอบ token ในฐานข้อมูล (is_revoked, expires_at)
 * - อัปเดต last_active ของ user
 * - ส่ง token status ผ่าน response headers
 */
exports.authCheck = wrapController(async (req, res, next) => {
    const authStartTime = Date.now();
    try {
        console.log(`[AUTH_CHECK] เริ่มต้นการตรวจสอบ authentication`);
        // ตรวจสอบว่ามี token หรือไม่
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.log(`[AUTH_CHECK] ไม่พบ token ใน authorization header`);
            res.status(401).json({
                success: false,
                message: "ไม่พบ token กรุณาเข้าสู่ระบบใหม่"
            });
            return;
        }
        try {
            // ตรวจสอบ token ด้วย JWT
            console.log(`[AUTH_CHECK] ตรวจสอบ JWT signature`);
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            console.log(`[AUTH_CHECK] JWT verification สำเร็จ สำหรับ ${decoded.username}`);
            // ใช้ executeTransaction สำหรับ database operations
            console.log(`[AUTH_CHECK] กำลังเชื่อมต่อ database สำหรับ ${decoded.username}`);
            const db = ManagementDB.getInstance();
            const result = await db.executeTransaction(async (connection) => {
                console.log(`[AUTH_CHECK] เชื่อมต่อ database สำเร็จ ใช้เวลา: ${Date.now() - authStartTime}ms`);
                console.log(`[AUTH_CHECK] ตรวจสอบ token ในระบบสำหรับ ${decoded.username}`);
                const checkTokenSql = `
                    SELECT t.*, u.username, u.role_id
                    FROM tbl_ur_auth_tokens t
                    JOIN tbl_ur_auth_users u ON t.username = u.username
                    WHERE t.token = ?
                    AND t.is_revoked = 0
                    AND t.expires_at > NOW()
                `;
                const [rows] = await connection.execute(checkTokenSql, [token]);
                console.log(`[AUTH_CHECK] พบ active token จำนวน: ${rows.length} รายการ`);
                if (rows.length === 0) {
                    console.log(`[AUTH_CHECK] ไม่พบ active token, ตรวจสอบสถานะ token สำหรับ ${decoded.username}`);
                    // ตรวจสอบว่า token หมดอายุหรือถูกยกเลิก
                    const checkExpiredSql = `
                        SELECT t.*, u.username
                        FROM tbl_ur_auth_tokens t
                        JOIN tbl_ur_auth_users u ON t.username = u.username
                        WHERE t.token = ?
                    `;
                    const [expiredRows] = await connection.execute(checkExpiredSql, [token]);
                    console.log(`[AUTH_CHECK] พบ token records จำนวน: ${expiredRows.length} รายการ`);
                    if (expiredRows.length > 0) {
                        if (expiredRows[0].is_revoked === 1) {
                            console.log(`[AUTH_CHECK] token ถูกยกเลิกแล้วสำหรับ ${decoded.username}`);
                            throw new Error('TOKEN_REVOKED');
                        }
                        else if (new Date(expiredRows[0].expires_at) < new Date()) {
                            console.log(`[AUTH_CHECK] token หมดอายุแล้วสำหรับ ${decoded.username}`);
                            throw new Error('TOKEN_EXPIRED');
                        }
                    }
                    console.log(`[AUTH_CHECK] ไม่พบ token ในระบบสำหรับ ${decoded.username}`);
                    throw new Error('TOKEN_NOT_FOUND');
                }
                // อัพเดท last_active
                console.log(`[AUTH_CHECK] กำลัง update last_active สำหรับ ${decoded.username}`);
                const currentTime = permissionMoment().format('YYYY-MM-DD HH:mm:ss');
                const updateLastActiveSql = `
                    UPDATE tbl_ur_auth_users 
                    SET last_active = ?
                    WHERE id = ?
                `;
                await connection.execute(updateLastActiveSql, [currentTime, decoded.userId]);
                console.log(`[AUTH_CHECK] update last_active เสร็จสิ้น`);
                return { decoded, tokenRows: rows };
            }, 'authCheck');
            // เพิ่มข้อมูลผู้ใช้ใน request
            console.log(`[AUTH_CHECK] กำลัง setup user context สำหรับ ${result.decoded.username}`);
            req.user = {
                id: result.decoded.userId,
                username: result.decoded.username,
                current_place: result.decoded.current_place
            };
            // คำนวณข้อมูลสถานะ token
            console.log(`[AUTH_CHECK] กำลังคำนวณ token status สำหรับ ${result.decoded.username}`);
            const tokenStatus = calculateTokenStatus(result.decoded);
            // เพิ่มข้อมูลสถานะ token ใน response headers
            const headers = createTokenHeaders(tokenStatus);
            res.set(headers);
            const totalDuration = Date.now() - authStartTime;
            console.log(`[AUTH_CHECK] authentication สำเร็จสำหรับ ${result.decoded.username} ใช้เวลาทั้งหมด: ${totalDuration}ms`);
            next();
        }
        catch (err) {
            const totalDuration = Date.now() - authStartTime;
            // จัดการ custom errors จาก transaction
            if (err.message === 'TOKEN_REVOKED') {
                console.log(`[AUTH_CHECK] token ถูกยกเลิก ใช้เวลา: ${totalDuration}ms`);
                res.status(401).json({
                    success: false,
                    message: "token ถูกยกเลิกแล้ว กรุณาเข้าสู่ระบบใหม่"
                });
                return;
            }
            else if (err.message === 'TOKEN_EXPIRED') {
                console.log(`[AUTH_CHECK] token หมดอายุ ใช้เวลา: ${totalDuration}ms`);
                res.status(401).json({
                    success: false,
                    message: "token หมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่"
                });
                return;
            }
            else if (err.message === 'TOKEN_NOT_FOUND') {
                console.log(`[AUTH_CHECK] ไม่พบ token ใช้เวลา: ${totalDuration}ms`);
                res.status(401).json({
                    success: false,
                    message: "ไม่พบ token ในระบบ กรุณาเข้าสู่ระบบใหม่"
                });
                return;
            }
            // จัดการ JWT errors
            console.error(`[AUTH_CHECK] JWT error ใช้เวลา: ${totalDuration}ms -`, err.message);
            const jwtError = handleJWTError(err);
            res.status(jwtError.status).json({
                success: false,
                message: jwtError.message
            });
        }
    }
    catch (err) {
        const totalDuration = Date.now() - authStartTime;
        console.error(`[AUTH_CHECK ERROR] ผิดพลาดในการ auth check ใช้เวลา: ${totalDuration}ms -`, err.message);
        console.error(`[AUTH_CHECK ERROR] Stack trace:`, err.stack);
        res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง",
            duration: `${totalDuration}ms`
        });
    }
}, 15000); // Timeout 15 วินาที
/**
 * ฟังก์ชัน middleware สำหรับตรวจสอบสิทธิ์ API ตาม permission code
 *
 * ใช้โดย:
 * - API routes ที่ต้องการ specific permission
 * - ใช้หลังจาก authCheck middleware
 * ตัวอย่างการใช้งาน:
 * router.get('/api/users', authCheck, checkPermission('READ_USERS'), getUserList);
 * router.post('/api/save', authCheck, checkPermission('SAVE_DATA'), saveData);
 */
const checkPermission = (permissionCode) => {
    return wrapController(async (req, res, next) => {
        const permissionStartTime = Date.now();
        try {
            const username = req.user.username;
            console.log(`[PERMISSION_CHECK] เริ่มต้นการตรวจสอบสิทธิ์ ${permissionCode} สำหรับ ${username}`);
            console.log(`[PERMISSION_CHECK] ใช้ executeQuery ของ ManagementDB`);
            // ใช้ executeQuery ของ ManagementDB (จัดการ connection อัตโนมัติ)
            const db = ManagementDB.getInstance();
            const permissionCheckSql = `
                SELECT 
                    p.permission_code,
                    p.permission_name,
                    r.role_name
                FROM tbl_ur_auth_users u
                JOIN tbl_ur_auth_roles r ON u.role_id = r.id
                JOIN tbl_ur_auth_role_permissions rp ON r.id = rp.role_id
                JOIN tbl_ur_auth_permissions p ON rp.permission_id = p.id
                WHERE u.username = ? AND p.permission_code = ?
            `;
            const permissionRows = await db.executeQuery(permissionCheckSql, [username, permissionCode], 'checkPermission');
            const totalDuration = Date.now() - permissionStartTime;
            console.log(`[PERMISSION_CHECK] ตรวจสอบสิทธิ์เสร็จสิ้น ใช้เวลา: ${totalDuration}ms`);
            if (permissionRows.length === 0) {
                console.log(`[PERMISSION_CHECK] ไม่มีสิทธิ์ ${permissionCode} สำหรับ ${username}`);
                // บันทึก log การตรวจสอบสิทธิ์
                await logPermissionCheck({
                    username: username,
                    permissionCode: permissionCode,
                    hasPermission: false,
                    endpoint: req.originalUrl,
                    method: req.method,
                    clientIP: req.ip,
                    userAgent: req.get('User-Agent') || 'unknown',
                    duration: totalDuration
                });
                res.status(403).json({
                    success: false,
                    message: `ไม่มีสิทธิ์ในการเข้าถึง (${permissionCode})`,
                    errorCode: 'INSUFFICIENT_PERMISSION'
                });
                return;
            }
            console.log(`[PERMISSION_CHECK] มีสิทธิ์ ${permissionCode} สำหรับ ${username} (${permissionRows[0].role_name})`);
            // บันทึก log การตรวจสอบสิทธิ์
            await logPermissionCheck({
                username: username,
                permissionCode: permissionCode,
                permissionName: permissionRows[0].permission_name,
                hasPermission: true,
                userRole: permissionRows[0].role_name,
                endpoint: req.originalUrl,
                method: req.method,
                clientIP: req.ip,
                userAgent: req.get('User-Agent') || 'unknown',
                duration: totalDuration
            });
            next();
        }
        catch (err) {
            const totalDuration = Date.now() - permissionStartTime;
            console.error(`[PERMISSION_CHECK ERROR] ผิดพลาดในการตรวจสอบสิทธิ์ ${permissionCode} ใช้เวลา: ${totalDuration}ms -`, err.message);
            console.error(`[PERMISSION_CHECK ERROR] Stack trace:`, err.stack);
            res.status(500).json({
                success: false,
                message: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ กรุณาลองใหม่อีกครั้ง",
                duration: `${totalDuration}ms`
            });
        }
    }, 10000); // Timeout 10 วินาที
};
exports.checkPermission = checkPermission;
/**
 * ฟังก์ชันสำหรับตรวจสอบสิทธิ์แบบ flexible
 * สามารถใช้ตรวจสอบหลาย permission codes พร้อมกัน (OR condition)
 */
const checkAnyPermission = (permissionCodes) => {
    return wrapController(async (req, res, next) => {
        const permissionStartTime = Date.now();
        try {
            const username = req.user.username;
            console.log(`[ANY_PERMISSION_CHECK] เริ่มต้นการตรวจสอบสิทธิ์ [${permissionCodes.join(', ')}] สำหรับ ${username}`);
            const db = ManagementDB.getInstance();
            const placeholders = permissionCodes.map(() => '?').join(',');
            const permissionCheckSql = `
                SELECT 
                    p.permission_code,
                    p.permission_name,
                    r.role_name
                FROM tbl_ur_auth_users u
                JOIN tbl_ur_auth_roles r ON u.role_id = r.id
                JOIN tbl_ur_auth_role_permissions rp ON r.id = rp.role_id
                JOIN tbl_ur_auth_permissions p ON rp.permission_id = p.id
                WHERE u.username = ? AND p.permission_code IN (${placeholders})
            `;
            const permissionRows = await db.executeQuery(permissionCheckSql, [username, ...permissionCodes], 'checkAnyPermission');
            const totalDuration = Date.now() - permissionStartTime;
            console.log(`[ANY_PERMISSION_CHECK] ตรวจสอบสิทธิ์เสร็จสิ้น ใช้เวลา: ${totalDuration}ms`);
            if (permissionRows.length === 0) {
                console.log(`[ANY_PERMISSION_CHECK] ไม่มีสิทธิ์ใดๆ ใน [${permissionCodes.join(', ')}] สำหรับ ${username}`);
                res.status(403).json({
                    success: false,
                    message: `ไม่มีสิทธิ์ในการเข้าถึง (ต้องการสิทธิ์: ${permissionCodes.join(' หรือ ')})`,
                    errorCode: 'INSUFFICIENT_PERMISSION'
                });
                return;
            }
            const foundPermissions = permissionRows.map((row) => row.permission_code);
            console.log(`[ANY_PERMISSION_CHECK] มีสิทธิ์ [${foundPermissions.join(', ')}] สำหรับ ${username}`);
            next();
        }
        catch (err) {
            const totalDuration = Date.now() - permissionStartTime;
            console.error(`[ANY_PERMISSION_CHECK ERROR] ผิดพลาดในการตรวจสอบสิทธิ์ ใช้เวลา: ${totalDuration}ms -`, err.message);
            res.status(500).json({
                success: false,
                message: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ กรุณาลองใหม่อีกครั้ง",
                duration: `${totalDuration}ms`
            });
        }
    }, 10000);
};
exports.checkAnyPermission = checkAnyPermission;
