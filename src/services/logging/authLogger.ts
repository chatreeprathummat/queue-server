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

// Import with require for modules without type declarations
const ManagementDB = require("../ManagementDB") as any;

// Express types
import { Request } from 'express';

// Interface definitions
interface ActionTypes {
  LOGIN: string;
  LOGOUT: string;
  PASSWORD_VERIFY: string;
  FAILED_LOGIN: string;
  CHECK_PERMISSION: string;
  REFRESH_LOGIN: string;
  VERIFY_FOR_SAVE: string;
}

interface LogActivityParams {
  username: string;
  actionType: string;
  status: number;
  req: Request;
  details: string;
}

interface LogLoginParams {
  username: string;
  req: Request;
  success: boolean;
  loginType?: string;
  extraData?: any;
}

interface DeviceInfo {
  ip: string;
  userAgent: string;
  timestamp: string;
  [key: string]: any;
}

interface LogDetails {
  action: string;
  timestamp: string;
  [key: string]: any;
}

/**
 * ENUM สำหรับ action_type ในฐานข้อมูล
 */
const ACTION_TYPES: ActionTypes = {
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT', 
    PASSWORD_VERIFY: 'PASSWORD_VERIFY',
    FAILED_LOGIN: 'FAILED_LOGIN',
    CHECK_PERMISSION: 'CHECK_PERMISSION',
    REFRESH_LOGIN: 'REFRESH_LOGIN',
    VERIFY_FOR_SAVE: 'VERIFY_FOR_SAVE'
};

/**
 * ดึง IP address ของ client
 * @param {Request} req Express request object
 * @returns {string} IP address
 */
function getClientIP(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    const xForwardedFor = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    
    return xForwardedFor?.split(',')[0] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           (req.connection as any)?.socket?.remoteAddress || 
           '0.0.0.0';
}

/**
 * สร้างข้อมูล device info สำหรับบันทึกใน token table
 * @param {Request} req Express request object
 * @param {any} extraData ข้อมูลเพิ่มเติม
 * @returns {string} JSON string ของ device info
 */
function createDeviceInfo(req: Request, extraData: any = {}): string {
    const deviceInfo: DeviceInfo = {
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
function createLogDetails(action: string, extraDetails: any = {}): string {
    const details: LogDetails = {
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
async function logActivity(params: LogActivityParams): Promise<boolean> {
    try {
        const { username, actionType, status, req, details } = params;
        
        // ตรวจสอบว่า actionType ถูกต้องหรือไม่
        if (!Object.values(ACTION_TYPES).includes(actionType)) {
            console.error(`[AuthLogger] Invalid action_type: ${actionType}`);
            return false;
        }

        //เชื่อมต่อฐานข้อมูล
        const db = ManagementDB.getInstance();

        const logSql: string = `
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

    } catch (error: any) {
        console.error('[AuthLogger] Error logging activity:', error);
        return false;
    }
}

/**
 * บันทึก login activity
 * @param {LogLoginParams} params พารามิเตอร์ login
 * @returns {Promise<boolean>} สำเร็จหรือไม่
 */
async function logLogin(params: LogLoginParams): Promise<boolean> {
    const { username, req, success, loginType = 'Standard', extraData = {} } = params;
    
    const actionType: string = success ? ACTION_TYPES.LOGIN : ACTION_TYPES.FAILED_LOGIN;
    const status: number = success ? 1 : 0;
    
    const details: string = createLogDetails(`เข้าสู่ระบบแบบ ${loginType}`, {
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
async function logLogout(username: string, req: Request): Promise<boolean> {
    const details: string = createLogDetails('ออกจากระบบ');

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
async function logRefreshToken(username: string, req: Request, extraData: any = {}): Promise<boolean> {
    const details: string = createLogDetails('รีเฟรช token', extraData);

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
async function logPermissionCheck(username: string, req: Request, permissionCode: string, roleName: string): Promise<boolean> {
    const details: string = createLogDetails('CHECK_PERMISSION', {
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
async function logVerifyForSave(username: string, req: Request, permissionCode: string, action: string): Promise<boolean> {
    const details: string = createLogDetails(`ยืนยันตัวตนสำหรับ${getActionDescription(action)}`, {
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
async function logPasswordVerify(username: string, req: Request, success: boolean = true): Promise<boolean> {
    const details: string = createLogDetails('ตรวจสอบรหัสผ่าน', {
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
function getActionDescription(action: string): string {
    switch (action) {
        case 'CREATE': return 'บันทึกข้อมูล';
        case 'UPDATE': return 'แก้ไขข้อมูล';
        case 'DELETE': return 'ลบข้อมูล';
        case 'APPROVE': return 'อนุมัติข้อมูล';
        default: return 'ดำเนินการ';
    }
}

export {
    ACTION_TYPES,
    getClientIP,
    createDeviceInfo,
    createLogDetails,
    logActivity,
    logLogin,
    logLogout,
    logRefreshToken,
    logPermissionCheck,
    logVerifyForSave,
    logPasswordVerify
}; 