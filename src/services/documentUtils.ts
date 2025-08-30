/**
 * =================================================================
 * documentUtils.ts - Document Utilities
 * =================================================================
 * 
 * รวมฟังก์ชันสำหรับ:
 * - สร้างเลขที่เอกสาร
 * - จัดการ running numbers
 * - ฟอร์แมตเลขที่เอกสาร
 * 
 * @author System Development Team
 * @version 1.0
 * @date 2025-01-20
 */

// Import with require for modules without type declarations
const docMoment = require('moment-timezone') as any;

// Interface definitions
interface DocumentNumber {
    prefix: string;
    year: string;
    month: string;
    sequence: string;
    fullNumber: string;
}

interface RunningNumberRecord {
    id: number;
    document_type: string;
    yearmonth_code: string;
    last_running_number: number;
    prefix: string;
    created_at: Date;
    updated_at: Date;
}

/**
 * สร้างเลขที่เอกสารใหม่
 * @param connection - Database connection
 * @param prefix - Prefix ของเอกสาร (เช่น RQ, PR, PO)
 * @returns Promise<string> - เลขที่เอกสารที่สร้างขึ้น
 */
export async function generateDocumentNumber(connection: any, prefix: string): Promise<string> {
    try {
        const now = docMoment().tz('Asia/Bangkok');
        const yearmonth = now.format('YYMM'); // รวมปีเดือนเป็นรหัส YYMM
        
        // ตรวจสอบว่ามี running number สำหรับเดือนนี้หรือไม่
        const checkSql = `
            SELECT last_running_number 
            FROM tbl_inv_document_running_numbers 
            WHERE document_type = ? AND yearmonth_code = ?
        `;
        
        const [existing] = await connection.query(checkSql, [prefix, yearmonth]);
        
        let nextNumber: number;
        
        if (existing.length > 0) {
            // อัปเดต running number
            nextNumber = existing[0].last_running_number + 1;
            const updateSql = `
                UPDATE tbl_inv_document_running_numbers 
                SET last_running_number = ?, updated_at = NOW() 
                WHERE document_type = ? AND yearmonth_code = ?
            `;
            await connection.query(updateSql, [nextNumber, prefix, yearmonth]);
        } else {
            // สร้าง running number ใหม่
            nextNumber = 1;
            const insertSql = `
                INSERT INTO tbl_inv_document_running_numbers (document_type, yearmonth_code, last_running_number, prefix, created_at, updated_at) 
                VALUES (?, ?, ?, ?, NOW(), NOW())
            `;
            await connection.query(insertSql, [prefix, yearmonth, nextNumber, prefix]);
        }
        
        // สร้างเลขที่เอกสาร
        const sequence = nextNumber.toString().padStart(4, '0');
        const documentNumber = `${prefix}${yearmonth}${sequence}`;
        
        return documentNumber;
        
    } catch (error: any) {
        console.error('Error generating document number:', error);
        // Fallback: สร้างเลขที่จาก timestamp
        const timestamp = Date.now().toString().slice(-8);
        return `${prefix}${timestamp}`;
    }
}

/**
 * รีเซ็ต running number สำหรับเดือนใหม่
 * @param connection - Database connection
 * @param prefix - Prefix ของเอกสาร
 */
export async function resetMonthlyRunningNumber(connection: any, prefix: string): Promise<void> {
    try {
        const now = docMoment().tz('Asia/Bangkok');
        const currentYearMonth = now.format('YYMM');
        
        // ลบ running number ของเดือนก่อน
        const deleteSql = `
            DELETE FROM tbl_inv_document_running_numbers 
            WHERE document_type = ? AND yearmonth_code < ?
        `;
        await connection.query(deleteSql, [prefix, currentYearMonth]);
        
        console.log(`Reset running number for ${prefix} - YearMonth: ${currentYearMonth}`);
        
    } catch (error: any) {
        console.error('Error resetting monthly running number:', error);
    }
}

/**
 * ดึงข้อมูล running number ปัจจุบัน
 * @param connection - Database connection
 * @param prefix - Prefix ของเอกสาร
 * @returns Promise<RunningNumberRecord | null>
 */
export async function getCurrentRunningNumber(connection: any, prefix: string): Promise<RunningNumberRecord | null> {
    try {
        const now = docMoment().tz('Asia/Bangkok');
        const yearmonth = now.format('YYMM');
        
        const sql = `
            SELECT * FROM tbl_inv_document_running_numbers 
            WHERE document_type = ? AND yearmonth_code = ?
        `;
        
        const [result] = await connection.query(sql, [prefix, yearmonth]);
        
        return result.length > 0 ? result[0] : null;
        
    } catch (error: any) {
        console.error('Error getting current running number:', error);
        return null;
    }
}

/**
 * แยกข้อมูลจากเลขที่เอกสาร
 * @param documentNumber - เลขที่เอกสาร
 * @returns DocumentNumber | null
 */
export function parseDocumentNumber(documentNumber: string): DocumentNumber | null {
    try {
        // รูปแบบ: RQ2412001 (Prefix + YY + MM + Sequence)
        const match = documentNumber.match(/^([A-Z]+)(\d{2})(\d{2})(\d{4})$/);
        
        if (!match) {
            return null;
        }
        
        return {
            prefix: match[1],
            year: match[2],
            month: match[3],
            sequence: match[4],
            fullNumber: documentNumber
        };
        
    } catch (error: any) {
        console.error('Error parsing document number:', error);
        return null;
    }
}

/**
 * ตรวจสอบว่าเลขที่เอกสารถูกต้องหรือไม่
 * @param documentNumber - เลขที่เอกสาร
 * @param expectedPrefix - Prefix ที่คาดหวัง
 * @returns boolean
 */
export function validateDocumentNumber(documentNumber: string, expectedPrefix?: string): boolean {
    try {
        const parsed = parseDocumentNumber(documentNumber);
        
        if (!parsed) {
            return false;
        }
        
        if (expectedPrefix && parsed.prefix !== expectedPrefix) {
            return false;
        }
        
        // ตรวจสอบว่าปีและเดือนไม่เกินปัจจุบัน
        const now = docMoment().tz('Asia/Bangkok');
        const currentYear = parseInt(now.format('YY'));
        const currentMonth = parseInt(now.format('MM'));
        
        const docYear = parseInt(parsed.year);
        const docMonth = parseInt(parsed.month);
        
        if (docYear > currentYear || (docYear === currentYear && docMonth > currentMonth)) {
            return false;
        }
        
        return true;
        
    } catch (error: any) {
        console.error('Error validating document number:', error);
        return false;
    }
}

/**
 * สร้างเลขที่เอกสารแบบง่าย (ไม่ใช้ database)
 * @param prefix - Prefix ของเอกสาร
 * @returns string
 */
export function generateSimpleDocumentNumber(prefix: string): string {
    const now = docMoment().tz('Asia/Bangkok');
    const year = now.format('YY');
    const month = now.format('MM');
    const day = now.format('DD');
    const time = now.format('HHmmss');
    
    return `${prefix}${year}${month}${day}${time}`;
}

// Export default object for CommonJS compatibility
const DocumentUtils = {
    generateDocumentNumber,
    resetMonthlyRunningNumber,
    getCurrentRunningNumber,
    parseDocumentNumber,
    validateDocumentNumber,
    generateSimpleDocumentNumber
};

export default DocumentUtils; 