/**
 * Authentication Utilities
 * ฟังก์ชันช่วยเหลือสำหรับการจัดการ authentication และข้อมูลผู้ใช้
 */

// Import with require for modules without type declarations
const jwt = require('jsonwebtoken') as any;
const ManagementDB = require("../services/ManagementDB") as any;
const CryptoJS = require('crypto-js') as any;
const moment = require('moment') as any;
const { getClientIP } = require("../services/logging/authLogger") as any;

// Express types
import { Request, Response } from 'express';

// Interface definitions
interface DecryptResult {
  success: boolean;
  password: string | null;
  error?: string;
}

interface UserData {
  id: string | number;
  username: string;
  current_place: string;
}

interface PermissionCheckResult {
  hasPermission: boolean;
  message: string;
  error?: string;
  requireVerification?: boolean;
  details?: {
    action: string;
    username: string;
    permission: string;
  };
}

interface TokenValidationResult {
  valid: boolean;
  decoded?: any;
  error?: string;
  expired?: boolean;
}

interface TokenStatus {
  isValid: boolean;
  isExpired: boolean;
  remainingTime: number;
  shouldRefresh: boolean;
  status: string;
}

interface TokenHeaders {
  'X-Token-Expired-At'?: string;
  'X-Token-Remaining-Time'?: string;
  'X-Token-Remaining-Minutes'?: string;
  'X-Token-Should-Refresh'?: string;
  'X-Token-Status'?: string;
}

/**
 * ฟังก์ชันถอดรหัสผ่าน
 * @param {string} password - รหัสผ่านที่อาจเข้ารหัสหรือไม่
 * @param {boolean} isEncrypted - สถานะว่าเข้ารหัสหรือไม่ (default: false)
 * @returns {DecryptResult} ผลการถอดรหัส
 */
function decryptPassword(password: string, isEncrypted: boolean | string = false): DecryptResult {
    try {
        // แปลง isEncrypted ให้เป็น boolean ที่ถูกต้อง
        // รองรับทั้ง boolean และ string
        let isEncryptedBool: boolean;
        if (typeof isEncrypted === 'string') {
            isEncryptedBool = isEncrypted.toLowerCase() === 'true';
        } else {
            isEncryptedBool = Boolean(isEncrypted);
        }
        
        // ถ้าไม่ได้เข้ารหัส ส่งกลับเลย
        if (!isEncryptedBool) {
            return {
                success: true,
                password: password
            };
        }

        // ถ้าไม่มีรหัสผ่าน
        if (!password || password.trim() === '') {
            return {
                success: false,
                password: null,
                error: "รหัสผ่านไม่สามารถเป็นค่าว่างได้"
            };
        }

        // ถอดรหัสผ่าน
        const secretKey: string = process.env.SECRET_KEY || 'nursing-system-secret-key';
        const decryptedPassword: string = CryptoJS.AES.decrypt(password, secretKey).toString(CryptoJS.enc.Utf8);
        
        if (!decryptedPassword || decryptedPassword.trim() === '') {
            return {
                success: false,
                password: null,
                error: "รหัสผ่านที่เข้ารหัสไม่ถูกต้อง"
            };
        }

        return {
            success: true,
            password: decryptedPassword
        };

    } catch (err: any) {
        console.error("Error decrypting password:", err);
        return {
            success: false,
            password: null,
            error: "ไม่สามารถถอดรหัสรหัสผ่านได้"
        };
    }
}

/**
 * ฟังก์ชันดึงข้อมูลผู้ใช้จาก JWT token ที่ถูกถอดรหัสแล้ว
 * @param {Request} req - Express request object
 * @returns {UserData} ข้อมูลผู้ใช้
 */
function getUserFromToken(req: Request & { user?: any }): UserData {
    if (!req.user) {
        throw new Error('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
    }
    
    return {
        id: req.user.id,
        username: req.user.username,
        current_place: req.user.current_place
    };
}

/**
 * ฟังก์ชันดึง username จาก JWT token
 * @param {Request} req - Request object
 * @returns {string|null} username หรือ null ถ้าไม่พบ
 */
function getUsernameFromToken(req: Request): string | null {
    try {
        const token: string | undefined = req.headers.authorization?.split(' ')[1];
        if (!token) return null;
        
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        return decoded.username || null;
    } catch (error: any) {
        console.error("Error extracting username from token:", error);
        return null;
    }
}

/**
 * ฟังก์ชันตรวจสอบสิทธิ์การบันทึกพร้อมยืนยันตัวตน
 * @param {Request} req - Request object
 * @param {string} action - ประเภทการดำเนินการ (CREATE, UPDATE, DELETE)
 * @param {string} permissionCode - รหัสสิทธิ์ที่ต้องการตรวจสอบ เช่น 'SAVE_VS_RECORD'
 * @returns {Promise<PermissionCheckResult>} ผลการตรวจสอบ
 */
async function checkSavePermissionWithVerify(req: Request, action: string = 'CREATE', permissionCode: string): Promise<PermissionCheckResult> {
    try {
        // ตรวจสอบว่ามีข้อมูลยืนยันตัวตนหรือไม่
        const { username, password, isEncrypted } = req.body;
        
        if (!username || !password) {
            return {
                hasPermission: false,
                message: "กรุณาระบุชื่อผู้ใช้และรหัสผ่านสำหรับยืนยันตัวตน",
                error: "VERIFICATION_REQUIRED",
                requireVerification: true
            };
        }

        // ถอดรหัสรหัสผ่านโดยใช้ฟังก์ชันกลาง
        const decryptResult: DecryptResult = decryptPassword(password, isEncrypted);
        if (!decryptResult.success) {
            return {
                hasPermission: false,
                message: decryptResult.error || "เกิดข้อผิดพลาดในการถอดรหัส",
                error: "DECRYPT_ERROR"
            };
        }

        const decryptedPassword: string = decryptResult.password!;

        //เชื่อมต่อฐานข้อมูล
        const db = ManagementDB.getInstance();

        // ตรวจสอบข้อมูลผู้ใช้และรหัสผ่าน
        const checkUserSql: string = `
            SELECT * 
            FROM tbl_ur_auth_users 
            WHERE username = ? 
            AND (del_flag IS NULL OR del_flag='')
        `;

        const rows = await db.executeQuery(checkUserSql, [username],'checkUserSql');

        if (rows.length === 0) {
            return {
                hasPermission: false,
                message: "ชื่อผู้ใช้งานไม่ถูกต้อง",
                error: "USER_NOT_FOUND"
            };
        }

        const user = rows[0];

        // ตรวจสอบรหัสผ่าน
        if (user.password !== decryptedPassword) {
            return {
                hasPermission: false,
                message: "รหัสผ่านไม่ถูกต้อง",
                error: "INVALID_PASSWORD"
            };
        }

        // ตรวจสอบสิทธิ์การบันทึก
        const checkPermissionSql: string = `
            SELECT 
                u.username,
                u.role_id,
                r.role_name,
                p.permission_code,
                p.permission_name
            FROM tbl_ur_auth_users u
            JOIN tbl_ur_auth_roles r ON u.role_id = r.id
            JOIN tbl_ur_auth_role_permissions rp ON r.id = rp.role_id
            JOIN tbl_ur_auth_permissions p ON rp.permission_id = p.id
            WHERE u.username = ?
            AND p.permission_code = ?
            AND (u.del_flag IS NULL OR u.del_flag = '')
            AND (r.del_flag IS NULL OR r.del_flag = '')
            AND (rp.del_flag IS NULL OR rp.del_flag = '')
            AND (p.del_flag IS NULL OR p.del_flag = '')
        `;

        const permissions = await db.executeQuery(checkPermissionSql, [user.username, permissionCode],'checkPermissionSql');

        if (permissions.length === 0) {
            return {
                hasPermission: false,
                message: `คุณไม่มีสิทธิ์ในการ${getActionDescription(action)}`,
                error: "PERMISSION_DENIED",
                details: {
                    action: action,
                    username: user.username,
                    permission: permissionCode
                }
            };
        }

        return {
            hasPermission: true,
            message: `ยืนยันตัวตนสำเร็จ มีสิทธิ์ในการ${getActionDescription(action)}`
        };

    } catch (error: any) {
        console.error("Error checking save permission with verify:", error);
        return {
            hasPermission: false,
            message: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์",
            error: "SYSTEM_ERROR"
        };
    }
}

/**
 * แปลงชื่อ action เป็นภาษาไทย
 */
function getActionDescription(action: string): string {
    const descriptions: { [key: string]: string } = {
        'CREATE': 'สร้างข้อมูล',
        'UPDATE': 'แก้ไขข้อมูล',
        'DELETE': 'ลบข้อมูล',
        'READ': 'อ่านข้อมูล'
    };
    return descriptions[action.toUpperCase()] || 'ดำเนินการ';
}

/**
 * ตรวจสอบ JWT token แบบพื้นฐาน (ไม่ return decoded)
 */
function validateJWTTokenOnly(token: string): TokenValidationResult {
    try {
        if (!token) {
            return {
                valid: false,
                error: 'ไม่พบ token'
            };
        }

        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        
        if (!decoded) {
            return {
                valid: false,
                error: 'Token ไม่ถูกต้อง'
            };
        }

        // ตรวจสอบ expiration
        const now: number = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < now) {
            return {
                valid: false,
                expired: true,
                error: 'Token หมดอายุแล้ว'
            };
        }

        return {
            valid: true,
            decoded: decoded
        };

    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return {
                valid: false,
                expired: true,
                error: 'Token หมดอายุแล้ว'
            };
        }
        
        return {
            valid: false,
            error: 'Token ไม่ถูกต้อง: ' + error.message
        };
    }
}

/**
 * สร้าง tokens (access และ refresh)
 */
function generateTokens(payload: any): { accessToken: string; refreshToken: string } {
    const accessToken: string = jwt.sign(
        payload,
        process.env.SECRET_KEY,
        { expiresIn: '8h' }
    );
    
    const refreshToken: string = jwt.sign(
        { 
            userId: payload.userId || payload.id,
            username: payload.username 
        },
        process.env.SECRET_KEY,
        { expiresIn: '7d' }
    );
    
    return { accessToken, refreshToken };
}

/**
 * คำนวณสถานะของ token
 */
function calculateTokenStatus(decoded: any): TokenStatus {
    const now: number = Math.floor(Date.now() / 1000);
    const remainingTime: number = decoded.exp - now;
    const shouldRefresh: boolean = remainingTime < 1800; // น้อยกว่า 30 นาที
    
    return {
        isValid: remainingTime > 0,
        isExpired: remainingTime <= 0,
        remainingTime: Math.max(0, remainingTime),
        shouldRefresh: shouldRefresh,
        status: remainingTime <= 0 ? 'expired' : shouldRefresh ? 'refresh_needed' : 'valid'
    };
}

/**
 * สร้างข้อมูล device info
 */
function createDeviceInfo(req: Request, extraData: any = {}): any {
    return {
        ip: getClientIP(req),
        userAgent: req.get('User-Agent') || 'unknown',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        ...extraData
    };
}

/**
 * สร้างข้อมูล log details
 */
function createLogDetails(action: string, extraDetails: any = {}): any {
    return {
        action: action,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        ...extraDetails
    };
}

/**
 * จัดการ JWT error
 */
function handleJWTError(error: any): { status: number; message: string; error: string } {
    if (error.name === 'TokenExpiredError') {
        return {
            status: 401,
            message: 'Token หมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่',
            error: 'TOKEN_EXPIRED'
        };
    } else if (error.name === 'JsonWebTokenError') {
        return {
            status: 401,
            message: 'Token ไม่ถูกต้อง',
            error: 'INVALID_TOKEN'
        };
    } else {
        return {
            status: 500,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบ token',
            error: 'TOKEN_VERIFICATION_ERROR'
        };
    }
}

/**
 * สร้าง headers สำหรับ token status
 */
function createTokenHeaders(tokenStatus: TokenStatus): TokenHeaders {
    return {
        'X-Token-Expired-At': tokenStatus.isExpired ? 'true' : 'false',
        'X-Token-Remaining-Time': tokenStatus.remainingTime.toString(),
        'X-Token-Remaining-Minutes': Math.floor(tokenStatus.remainingTime / 60).toString(),
        'X-Token-Should-Refresh': tokenStatus.shouldRefresh ? 'true' : 'false',
        'X-Token-Status': tokenStatus.status
    };
}

/**
 * ตรวจสอบ Oracle authentication แบบง่าย
 */
async function validateOracleAuthOnly(username: string, password: string, isEncrypted: boolean = false): Promise<any> {
    // Implementation would go here
    // This is a placeholder for Oracle authentication
    return {
        success: false,
        message: 'Oracle authentication not implemented'
    };
}

export {
    decryptPassword,
    getUserFromToken,
    getUsernameFromToken,
    checkSavePermissionWithVerify,
    getActionDescription,
    validateJWTTokenOnly,
    generateTokens,
    calculateTokenStatus,
    createDeviceInfo,
    createLogDetails,
    handleJWTError,
    createTokenHeaders,
    validateOracleAuthOnly
}; 