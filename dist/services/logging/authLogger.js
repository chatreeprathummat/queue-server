"use strict";
/**
 * =================================================================
 * authLogger.ts - ระบบ Logging สำหรับ Authentication
 * =================================================================
 *
 * รวมฟังก์ชันการ logging ที่เกี่ยวข้องกับ authentication
 * - สร้าง log details
 * - สร้าง device info
 * - บันทึก activity logs
 *
 * @author Nursing System Development Team
 * @version 1.0
 * @date 2025-01-20
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTION_TYPES = void 0;
exports.getClientIP = getClientIP;
exports.createDeviceInfo = createDeviceInfo;
exports.createLogDetails = createLogDetails;
exports.logActivity = logActivity;
exports.logLogin = logLogin;
exports.logLogout = logLogout;
exports.logRefreshToken = logRefreshToken;
exports.logPermissionCheck = logPermissionCheck;
exports.logVerifyForSave = logVerifyForSave;
exports.logPasswordVerify = logPasswordVerify;
// Import with require for modules without type declarations
const ManagementDB = require("../ManagementDB");
/**
 * ENUM สำหรับ action_type ในฐานข้อมูล
 */
const ACTION_TYPES = {
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    PASSWORD_VERIFY: 'PASSWORD_VERIFY',
    FAILED_LOGIN: 'FAILED_LOGIN',
    CHECK_PERMISSION: 'CHECK_PERMISSION',
    REFRESH_LOGIN: 'REFRESH_LOGIN',
    VERIFY_FOR_SAVE: 'VERIFY_FOR_SAVE'
};
exports.ACTION_TYPES = ACTION_TYPES;
/**
 * ดึง IP address ของ client
 * @param {Request} req Express request object
 * @returns {string} IP address
 */
function getClientIP(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const xForwardedFor = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return xForwardedFor?.split(',')[0] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.connection?.socket?.remoteAddress ||
        '0.0.0.0';
}
/**
 * สร้างข้อมูล device info สำหรับบันทึกใน token table
 * @param {Request} req Express request object
 * @param {any} extraData ข้อมูลเพิ่มเติม
 * @returns {string} JSON string ของ device info
 */
function createDeviceInfo(req, extraData = {}) {
    const deviceInfo = {
        ip: getClientIP(req),
        userAgent: req.headers['user-agent'] || '',
        timestamp: new Date().toISOString(),
        ...extraData
    };
    return JSON.stringify(deviceInfo);
}
/**
 * สร้างข้อมูล log details สำหรับบันทึกลงฐานข้อมูล
 * @param {string} action การกระทำ
 * @param {any} extraDetails รายละเอียดเพิ่มเติม
 * @returns {string} JSON string ของ log details
 */
function createLogDetails(action, extraDetails = {}) {
    const details = {
        action: action,
        timestamp: new Date().toISOString(),
        ...extraDetails
    };
    return JSON.stringify(details);
}
/**
 * บันทึก activity log ลงฐานข้อมูล
 * @param {LogActivityParams} params พารามิเตอร์สำหรับ logging
 * @returns {Promise<boolean>} สำเร็จหรือไม่
 */
async function logActivity(params) {
    try {
        const { username, actionType, status, req, details } = params;
        // ตรวจสอบว่า actionType ถูกต้องหรือไม่
        if (!Object.values(ACTION_TYPES).includes(actionType)) {
            console.error(`[AuthLogger] Invalid action_type: ${actionType}`);
            return false;
        }
        //เชื่อมต่อฐานข้อมูล
        const db = ManagementDB.getInstance();
        const logSql = `
            INSERT INTO tbl_ur_auth_logs 
            (username, action_type, status, ip_address, user_agent, details)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await db.executeInsert(logSql, [
            username,
            actionType,
            status,
            getClientIP(req),
            req.headers['user-agent'] || '',
            details
        ], 'logActivity');
        return true;
    }
    catch (error) {
        console.error('[AuthLogger] Error logging activity:', error);
        return false;
    }
}
/**
 * บันทึก login activity
 * @param {LogLoginParams} params พารามิเตอร์ login
 * @returns {Promise<boolean>} สำเร็จหรือไม่
 */
async function logLogin(params) {
    const { username, req, success, loginType = 'Standard', extraData = {} } = params;
    const actionType = success ? ACTION_TYPES.LOGIN : ACTION_TYPES.FAILED_LOGIN;
    const status = success ? 1 : 0;
    const details = createLogDetails(`เข้าสู่ระบบแบบ ${loginType}`, {
        loginType: loginType,
        result: success ? 'สำเร็จ' : 'ไม่สำเร็จ',
        ...extraData
    });
    return await logActivity({
        username,
        actionType,
        status,
        req,
        details
    });
}
/**
 * บันทึก logout activity
 * @param {string} username username
 * @param {Request} req Express request object
 * @returns {Promise<boolean>} สำเร็จหรือไม่
 */
async function logLogout(username, req) {
    const details = createLogDetails('ออกจากระบบ');
    return await logActivity({
        username,
        actionType: ACTION_TYPES.LOGOUT,
        status: 1,
        req,
        details
    });
}
/**
 * บันทึก refresh token activity
 * @param {string} username username
 * @param {Request} req Express request object
 * @param {any} extraData ข้อมูลเพิ่มเติม
 * @returns {Promise<boolean>} สำเร็จหรือไม่
 */
async function logRefreshToken(username, req, extraData = {}) {
    const details = createLogDetails('รีเฟรช token', extraData);
    return await logActivity({
        username,
        actionType: ACTION_TYPES.REFRESH_LOGIN,
        status: 1,
        req,
        details
    });
}
/**
 * บันทึก permission check activity
 * @param {string} username username
 * @param {Request} req Express request object
 * @param {string} permissionCode รหัสสิทธิ์ที่ตรวจสอบ
 * @param {string} roleName ชื่อ role
 * @returns {Promise<boolean>} สำเร็จหรือไม่
 */
async function logPermissionCheck(username, req, permissionCode, roleName) {
    const details = createLogDetails('CHECK_PERMISSION', {
        description: 'ตรวจสอบสิทธิ์การเข้าถึง API',
        permission: permissionCode,
        role: roleName
    });
    return await logActivity({
        username,
        actionType: ACTION_TYPES.CHECK_PERMISSION,
        status: 1,
        req,
        details
    });
}
/**
 * บันทึก verification activity สำหรับการบันทึก
 * @param {string} username username
 * @param {Request} req Express request object
 * @param {string} permissionCode รหัสสิทธิ์
 * @param {string} action ประเภทการกระทำ
 * @returns {Promise<boolean>} สำเร็จหรือไม่
 */
async function logVerifyForSave(username, req, permissionCode, action) {
    const details = createLogDetails(`ยืนยันตัวตนสำหรับ${getActionDescription(action)}`, {
        permissionCode: permissionCode,
        result: 'สำเร็จ'
    });
    return await logActivity({
        username,
        actionType: ACTION_TYPES.VERIFY_FOR_SAVE,
        status: 1,
        req,
        details
    });
}
/**
 * บันทึก password verification activity
 * @param {string} username username
 * @param {Request} req Express request object
 * @param {boolean} success สำเร็จหรือไม่
 * @returns {Promise<boolean>} สำเร็จหรือไม่
 */
async function logPasswordVerify(username, req, success = true) {
    const details = createLogDetails('ตรวจสอบรหัสผ่าน', {
        result: success ? 'สำเร็จ' : 'ไม่สำเร็จ'
    });
    return await logActivity({
        username,
        actionType: ACTION_TYPES.PASSWORD_VERIFY,
        status: success ? 1 : 0,
        req,
        details
    });
}
/**
 * แปลงประเภทการดำเนินการเป็นภาษาไทย
 * @param {string} action ประเภทการดำเนินการ
 * @returns {string} คำอธิบายภาษาไทย
 */
function getActionDescription(action) {
    switch (action) {
        case 'CREATE': return 'บันทึกข้อมูล';
        case 'UPDATE': return 'แก้ไขข้อมูล';
        case 'DELETE': return 'ลบข้อมูล';
        case 'APPROVE': return 'อนุมัติข้อมูล';
        default: return 'ดำเนินการ';
    }
}
