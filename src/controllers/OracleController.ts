import { Request, Response } from 'express';

// Import with require for modules without type declarations
const ManagementDB = require('../services/ManagementDB').default as any;
const { logger } = require('../services/logging') as any;
const { wrapController } = require("../services/logging/controllers/requestLogger") as any; 
const Joi = require('joi') as any;

// Interface สำหรับข้อมูลผู้ป่วย
interface PatientData {
    hn: string;
    prename?: string;
    name?: string;
    lastName?: string;
    birthday?: string;
    sex?: string;
    idcard?: string;
    passportno?: string;
    lastAdmitAt?: string;
    usercreated?: string;
    datecreated?: string;
    userupdated?: string;
    dateupdated?: string;
    deleted?: string;
    userdeleted?: string;
    datedeleted?: string;
}

// API ดึงข้อมูลผู้ป่วยโดยระบุ HN จาก URL parameter
export const getPatientByHN = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        // รับ HN จาก query parameter หรือ URL parameter
        let hn = req.query.hn as string || req.params.hn;
        
        if (!hn) {
            res.status(400).json({
                success: false,
                message: "กรุณาระบุ HN",
                error: "HN is required"
            });
            return;
        }

        // Validate input - รับ HN แบบ x-xx, xx-xx, xxx-xx, xxxx-xx, xxxxx-xx, etc.
        const schema = Joi.object({
            hn: Joi.string().required().max(15).trim().pattern(/^\d{1,10}-\d{1,2}$/)
        });

        const { error } = schema.validate({ hn });

        if (error) {
            console.log('Validation error:', error.details[0].message);
            
            res.status(400).json({
                success: false,
                message: "รูปแบบ HN ไม่ถูกต้อง กรุณาใช้รูปแบบ x-xx (เช่น 1-68, 100-55, 10000-25, 123456-78)",
                error: error.details[0].message
            });
            return;
        }

        // แปลง HN จาก xxx-xx เป็น xxx/xx สำหรับ query ฐานข้อมูล
        const dbHn = hn.replace(/-/g, '/');
        
        const db = ManagementDB.getInstance();

        // SQL query สำหรับดึงข้อมูลผู้ป่วย
        const sqlGetPatient = `
            SELECT 
                hn,
                prename,
                name,
                lastName,
                birthday,
                sex,
                idcard,
                passportno,
                lastAdmitAt,
                usercreated,
                datecreated,
                userupdated,
                dateupdated,
                deleted,
                userdeleted,
                datedeleted
            FROM tbl_inv_patients
            WHERE hn = ? AND (deleted IS NULL OR deleted != 'Y')
        `;
        
        const patients = await db.executeQuery(sqlGetPatient, [dbHn]);
        
        if (!patients || patients.length === 0) {
            res.status(404).json({
                success: false,
                message: "ไม่พบข้อมูลผู้ป่วยที่ระบุ",
                data: null
            });
            return;
        }

        const patient = patients[0];
        
        // แปลงข้อมูลให้เหมาะสม
        const patientData: PatientData = {
            hn: patient.hn,
            prename: patient.prename || undefined,
            name: patient.name || undefined,
            lastName: patient.lastName || undefined,
            birthday: patient.birthday ? new Date(patient.birthday).toISOString().split('T')[0] : undefined,
            sex: patient.sex || undefined,
            idcard: patient.idcard || undefined,
            passportno: patient.passportno || undefined,
            lastAdmitAt: patient.lastAdmitAt ? new Date(patient.lastAdmitAt).toISOString().split('T')[0] : undefined,
            usercreated: patient.usercreated || undefined,
            datecreated: patient.datecreated || undefined,
            userupdated: patient.userupdated || undefined,
            dateupdated: patient.dateupdated || undefined,
            deleted: patient.deleted || undefined,
            userdeleted: patient.userdeleted || undefined,
            datedeleted: patient.datedeleted || undefined
        };

        // เพิ่มฟิลด์ fullName สำหรับความสะดวก
        const fullName = [patientData.prename, patientData.name, patientData.lastName]
            .filter(Boolean)
            .join(' ');
        
        res.json({
            success: true,
            message: "ดึงข้อมูลผู้ป่วยเรียบร้อยแล้ว",
            data: {
                ...patientData,
                fullName: fullName || null
            }
        });
        
    } catch (error: any) {
        console.error('Error fetching patient by HN:', error);
        
        res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย",
            error: error.message
        });
    }
}, 10000);

// API ดึงรายการผู้ป่วยทั้งหมด (สำหรับค้นหา)
export const getPatientList = wrapController(async (req: Request, res: Response): Promise<void> => {
    try {
        // Validate input
        const schema = Joi.object({
            search: Joi.string().optional().max(100).trim(),
            limit: Joi.number().integer().min(1).max(100).default(50),
            offset: Joi.number().integer().min(0).default(0)
        }).unknown(true);

        const { error, value } = schema.validate(req.body);

        if (error) {
            console.log('Validation error:', error.details[0].message);
            
            res.status(400).json({
                success: false,
                message: "ข้อมูลการค้นหาไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }

        const { search, limit, offset } = value;
        const db = ManagementDB.getInstance();

        let sqlGetPatients = `
            SELECT 
                hn,
                prename,
                name,
                lastName,
                birthday,
                sex,
                idcard,
                passportno,
                lastAdmitAt
            FROM tbl_inv_patients
            WHERE (deleted IS NULL OR deleted != 'Y')
        `;

        const params: any[] = [];

        // เพิ่มเงื่อนไขการค้นหา
        if (search && search.trim()) {
            sqlGetPatients += `
                AND (
                    hn LIKE ? OR 
                    name LIKE ? OR 
                    lastName LIKE ? OR 
                    idcard LIKE ?
                )
            `;
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sqlGetPatients += `
            ORDER BY hn
            LIMIT ? OFFSET ?
        `;
        
        params.push(limit, offset);
        
        const patients = await db.executeQuery(sqlGetPatients, params);
        
        // แปลงข้อมูลให้เหมาะสม
        const patientList = patients.map((patient: any) => {
            const fullName = [patient.prename, patient.name, patient.lastName]
                .filter(Boolean)
                .join(' ');
            
            return {
                hn: patient.hn,
                fullName: fullName || null,
                prename: patient.prename || null,
                name: patient.name || null,
                lastName: patient.lastName || null,
                birthday: patient.birthday ? new Date(patient.birthday).toISOString().split('T')[0] : null,
                sex: patient.sex || null,
                idcard: patient.idcard || null,
                passportno: patient.passportno || null,
                lastAdmitAt: patient.lastAdmitAt ? new Date(patient.lastAdmitAt).toISOString().split('T')[0] : null
            };
        });

        res.json({
            success: true,
            message: "ดึงรายการผู้ป่วยเรียบร้อยแล้ว",
            data: patientList,
            pagination: {
                limit,
                offset,
                total: patientList.length
            }
        });
        
    } catch (error: any) {
        console.error('Error fetching patient list:', error);
        
        res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาดในการดึงรายการผู้ป่วย",
            error: error.message
        });
    }
}, 10000); 