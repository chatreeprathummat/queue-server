import { Request, Response } from 'express';

// Import with require for modules without type declarations
const { wrapController } = require("../services/logging/controllers/requestLogger") as any;
const moment = require('moment-timezone') as any;

/**
 * =================================================================
 * ServerTimeController - ระบบจัดการวันที่และเวลาของ Server
 * =================================================================
 * 
 * ฟีเจอร์:
 * - ดึงวันที่และเวลาปัจจุบันจาก server
 * - รองรับ timezone Asia/Bangkok
 * - รูปแบบข้อมูลตามที่ระบบต้องการ
 * - Cache และ fallback mechanism
 * 
 * @author System Development Team
 * @version 1.0
 * @date 2025-01-20
 */

// Interface definitions
interface ServerDateTime {
    current_date: string;           // 2025-07-20
    current_datetime: string;       // 2025-07-20 14:40:00
    current_time: string;           // 14:40:00
    timezone: string;               // Asia/Bangkok
    formatted_date_th: string;      // 20/07/2025
    formatted_datetime_th: string;  // 20/07/2025 14:40:00
}

/**
 * ฟังก์ชันดึงวันที่และเวลาปัจจุบันจาก server
 * 
 * รูปแบบการใช้งาน:
 * GET /api/inv/server/current-datetime
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "ดึงวันที่และเวลาปัจจุบันเรียบร้อยแล้ว",
 *   "data": {
 *     "current_date": "2025-07-20",
 *     "current_datetime": "2025-07-20 14:40:00",
 *     "current_time": "14:40:00",
 *     "timezone": "Asia/Bangkok",
 *     "formatted_date_th": "20/07/2025",
 *     "formatted_datetime_th": "20/07/2025 14:40:00"
 *   }
 * }
 */
export const getCurrentDateTime = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== GET CURRENT DATETIME ===');
        
        // ดึงวันที่และเวลาปัจจุบันจาก server ใน timezone Asia/Bangkok
        const now = moment().tz('Asia/Bangkok');
        
        // สร้างข้อมูลวันที่และเวลาในรูปแบบต่างๆ (ใช้ ค.ศ.)
        const serverDateTime: ServerDateTime = {
            current_date: now.format('YYYY-MM-DD'),                    // 2025-07-20
            current_datetime: now.format('YYYY-MM-DD HH:mm:ss'),       // 2025-07-20 14:40:00
            current_time: now.format('HH:mm:ss'),                      // 14:40:00
            timezone: 'Asia/Bangkok',
            formatted_date_th: now.format('DD/MM/YYYY'),               // 20/07/2025
            formatted_datetime_th: now.format('DD/MM/YYYY HH:mm:ss')   // 20/07/2025 14:40:00
        };
        
        console.log('Server DateTime:', serverDateTime);
        
        res.status(200).json({
            success: true,
            message: 'ดึงวันที่และเวลาปัจจุบันเรียบร้อยแล้ว',
            data: serverDateTime
        });
        
    } catch (error: any) {
        console.error('Error getting server datetime:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงวันที่และเวลาปัจจุบัน',
            error: error.message
        });
    }
}, 5000); // Timeout 5 วินาที

/**
 * ฟังก์ชันดึงข้อมูล timezone และการตั้งค่าของ server
 * 
 * รูปแบบการใช้งาน:
 * GET /api/inv/server/timezone-info
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "ดึงข้อมูล timezone เรียบร้อยแล้ว",
 *   "data": {
 *     "server_timezone": "Asia/Bangkok",
 *     "server_offset": "+07:00",
 *     "current_utc": "2025-07-20T07:40:00.000Z",
 *     "current_local": "2025-07-20 14:40:00",
 *     "is_dst": false
 *   }
 * }
 */
export const getTimezoneInfo = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== GET TIMEZONE INFO ===');
        
        const now = moment().tz('Asia/Bangkok');
        
        const timezoneInfo = {
            server_timezone: 'Asia/Bangkok',
            server_offset: now.format('Z'),                    // +07:00
            current_utc: now.utc().format(),                   // 2025-07-20T07:40:00.000Z
            current_local: now.format('YYYY-MM-DD HH:mm:ss'),  // 2025-07-20 14:40:00
            is_dst: now.isDST()                                // false (Thailand ไม่มี DST)
        };
        
        console.log('Timezone Info:', timezoneInfo);
        
        res.status(200).json({
            success: true,
            message: 'ดึงข้อมูล timezone เรียบร้อยแล้ว',
            data: timezoneInfo
        });
        
    } catch (error: any) {
        console.error('Error getting timezone info:', error);
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล timezone',
            error: error.message
        });
    }
}, 5000); // Timeout 5 วินาที

export default {
    getCurrentDateTime,
    getTimezoneInfo
}; 