// Import with require for modules without type declarations
const ManagementDB = require('../services/ManagementDB').default as any;
const { wrapController } = require("../services/logging/controllers/requestLogger") as any;
import { Request, Response } from 'express'; 

// Interface definitions
interface Units {
    unit_id: number;
    unit_name: string;
    unit_code: string;
    unit_description: string;
    unit_category: string;
    is_active: boolean;
    is_system_unit: boolean;
    display_order: number;
}


// ฟังก์ชั่นดึงรายการหน่วยนับ
export const getUnits = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const db = ManagementDB.getInstance();

        const sqlUnits = `
                SELECT *
                FROM tbl_inv_units
                ORDER BY display_order
        `;
        
        const units = await db.executeQuery(sqlUnits);
        
        // Filter ข้อมูลเฉพาะที่ต้องการ
        const unitsData = units.map((unit: Units) => ({
            unit_id: unit.unit_id,
            unit_name: unit.unit_name,
            unit_code: unit.unit_code,
            unit_category: unit.unit_category
        }));
        
        res.status(200).json({
            success: true,
            message: "ดึงข้อมูลหน่วยนับเรียบร้อยแล้ว",
            data: unitsData
        });
        
    } catch (error: any) {
        console.log('Units error:', error.message);
        
        console.error('Error fetching units:', error);
        res.status(500).json({
            success: false,
            error_code: "UNITS_FETCH_ERROR",
            status: "error",
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลหน่วยนับ",
            error: error.message
        });
    }
}, 15000);

// ฟังก์ชั่นสร้างหน่วยนับใหม่
export const createUnit = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        const { unit_name, unit_code, unit_category, created_by_user_id } = req.body;
        
        // Validation
        if (!unit_name || !unit_name.trim()) {
            res.status(400).json({
                success: false,
                error_code: "MISSING_UNIT_NAME",
                message: "กรุณาระบุชื่อหน่วยนับ"
            });
            return;
        }

        const db = ManagementDB.getInstance();

        // ตรวจสอบว่ามีอยู่แล้วหรือไม่
        const checkSql = `
            SELECT unit_id, unit_name 
            FROM tbl_inv_units 
            WHERE unit_name = ? OR unit_code = ?
        `;
        
        const existing = await db.executeQuery(checkSql, [unit_name.trim(), unit_code || '']);
        
        if (existing.length > 0) {
            res.status(200).json({
                success: true,
                message: "หน่วยนับมีอยู่ในระบบแล้ว",
                data: existing[0],
                is_existing: true
            });
            return;
        }

        // สร้างรหัสหน่วยนับอัตโนมัติถ้าไม่มี
        let finalUnitCode = unit_code;
        if (!finalUnitCode) {
            const cleanName = unit_name.replace(/[^a-zA-Z0-9ก-๙]/g, '').toUpperCase();
            finalUnitCode = cleanName.length > 0 ? cleanName.substring(0, 8) : 'CUSTOM';
        }

        // สร้างหน่วยนับใหม่
        const insertSql = `
            INSERT INTO tbl_inv_units (
                unit_name, 
                unit_code, 
                unit_description, 
                unit_category, 
                is_system_unit, 
                display_order,
                created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await db.executeQuery(insertSql, [
            unit_name.trim(),
            finalUnitCode,
            req.body.unit_description || null,
            unit_category || 'CUSTOM',
            0, // ไม่ใช่หน่วยนับของระบบ
            (await db.executeQuery('SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM tbl_inv_units'))[0].next_order,
            created_by_user_id || 'SYSTEM'
        ]);

        // ดึงข้อมูลหน่วยนับที่สร้างใหม่
        const newUnitSql = `
            SELECT unit_id, unit_name, unit_code, unit_category
            FROM tbl_inv_units 
            WHERE unit_id = ?
        `;
        
        const newUnit = await db.executeQuery(newUnitSql, [result.insertId]);
        
        res.status(201).json({
            success: true,
            message: `สร้างหน่วยนับ "${unit_name}" สำเร็จ`,
            data: newUnit[0],
            is_existing: false
        });
        
    } catch (error: any) {
        console.error('Error creating unit:', error);
        res.status(500).json({
            success: false,
            error_code: "UNIT_CREATE_ERROR",
            message: "เกิดข้อผิดพลาดในการสร้างหน่วยนับ",
            error: error.message
        });
    }
}, 8000);