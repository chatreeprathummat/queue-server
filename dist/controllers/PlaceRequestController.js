"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeDocumentCheckboxList = exports.placeGetRequest = exports.placeCreateRequest = void 0;
// Import with require for modules without type declarations
const ManagementDB = require('../services/ManagementDB').default;
const { logger } = require('../services/logging');
const DocumentUtils = require('../services/documentUtils');
const { wrapController } = require("../services/logging/controllers/requestLogger");
const Joi = require('joi');
const moment = require('moment');
// ฟังก์ชันสร้างคำขอเบิกใหม่
exports.placeCreateRequest = wrapController(async (req, res) => {
    let connection;
    try {
        // Validate input
        const schema = Joi.object({
            departmentId: Joi.number().integer().required().messages({
                'number.base': 'รหัสแผนกต้องเป็นตัวเลข',
                'number.integer': 'รหัสแผนกต้องเป็นจำนวนเต็ม',
                'any.required': 'กรุณาระบุรหัสแผนก'
            }),
            materialCategory: Joi.string().required().messages({
                'string.base': 'หมวดหมู่วัสดุต้องเป็นข้อความ',
                'any.required': 'กรุณาระบุหมวดหมู่วัสดุ'
            }),
            urgency: Joi.string().valid('normal', 'high', 'urgent').default('normal').messages({
                'string.base': 'ความเร่งด่วนต้องเป็นข้อความ',
                'any.only': 'ความเร่งด่วนต้องเป็น normal, high หรือ urgent'
            }),
            reason: Joi.string().allow(null, '').messages({
                'string.base': 'วัตถุประสงค์ต้องเป็นข้อความ'
            }),
            items: Joi.array().items(Joi.object({
                description: Joi.string().required().messages({
                    'string.base': 'รายละเอียดรายการต้องเป็นข้อความ',
                    'any.required': 'กรุณาระบุรายละเอียดรายการ'
                }),
                item_type: Joi.string().valid('เพื่อใช้', 'เพื่อจำหน่าย').default('เพื่อใช้').messages({
                    'string.base': 'ประเภทรายการต้องเป็นข้อความ',
                    'any.only': 'ประเภทรายการต้องเป็น เพื่อใช้ หรือ เพื่อจำหน่าย'
                }),
                hn: Joi.string().when('item_type', {
                    is: 'เพื่อจำหน่าย',
                    then: Joi.string().required().messages({
                        'string.base': 'HN ต้องเป็นข้อความ',
                        'any.required': 'กรุณาระบุ HN เมื่อเลือกประเภทเป็น "เพื่อจำหน่าย"'
                    }),
                    otherwise: Joi.string().allow(null, '')
                }),
                patient_name: Joi.string().when('item_type', {
                    is: 'เพื่อจำหน่าย',
                    then: Joi.string().required().messages({
                        'string.base': 'ชื่อผู้ป่วยต้องเป็นข้อความ',
                        'any.required': 'กรุณาระบุชื่อผู้ป่วยเมื่อเลือกประเภทเป็น "เพื่อจำหน่าย"'
                    }),
                    otherwise: Joi.string().allow(null, '')
                }),
                unit: Joi.string().required().messages({
                    'string.base': 'หน่วยนับต้องเป็นข้อความ',
                    'any.required': 'กรุณาระบุหน่วยนับ'
                }),
                quantity: Joi.number().positive().required().messages({
                    'number.base': 'จำนวนต้องเป็นตัวเลข',
                    'number.positive': 'จำนวนต้องเป็นค่าบวก',
                    'any.required': 'กรุณาระบุจำนวน'
                }),
                price: Joi.number().min(0).required().messages({
                    'number.base': 'ราคาต้องเป็นตัวเลข',
                    'number.min': 'ราคาต้องไม่น้อยกว่า 0',
                    'any.required': 'กรุณาระบุราคา'
                }),
                note: Joi.string().allow(null, '').messages({
                    'string.base': 'หมายเหตุต้องเป็นข้อความ'
                }),
                request_date: Joi.date().iso().allow(null).messages({
                    'date.base': 'วันที่ต้องการใช้ต้องเป็นรูปแบบวันที่',
                    'date.iso': 'วันที่ต้องการใช้ต้องเป็นรูปแบบ ISO (YYYY-MM-DD)'
                })
            })).min(1).required().messages({
                'array.min': 'กรุณาระบุรายการวัสดุอย่างน้อย 1 รายการ',
                'any.required': 'กรุณาระบุรายการวัสดุ'
            }),
            documents: Joi.array().items(Joi.object({
                document_type_id: Joi.number().integer().required(),
                other_document_name: Joi.string().allow(null, ''),
                is_required: Joi.boolean().default(false)
            })).optional()
        }).unknown(true);
        const { error, value } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                message: "ข้อมูลไม่ถูกต้อง",
                error: error.details[0].message
            });
            return;
        }
        const { departmentId, materialCategory, urgency = 'normal', reason = '', items, documents = [] } = value;
        // สร้างการเชื่อมต่อกับฐานข้อมูล
        const db = new ManagementDB();
        connection = await db.getConnection();
        // เริ่ม transaction
        await connection.beginTransaction();
        // 1. สร้างเลขที่คำขอเบิกใหม่
        // ตรวจสอบ user ที่มีอยู่จริงในระบบ หรือสร้างใหม่
        let requesterUserId = null;
        try {
            const [existingUsers] = await connection.execute(`SELECT UserID FROM tbl_inv_users ORDER BY UserID LIMIT 1`);
            if (existingUsers.length > 0) {
                requesterUserId = existingUsers[0].UserID;
            }
            else {
                // ถ้าไม่มี user ให้สร้าง system user
                const [insertResult] = await connection.execute(`INSERT INTO tbl_inv_users (UserName, Email, FullName, IsActive, CreatedDate) 
                     VALUES ('system', 'system@system.local', 'System User', 1, NOW())`);
                requesterUserId = insertResult.insertId;
                console.log('Created system user with ID:', requesterUserId);
            }
        }
        catch (userError) {
            console.warn('Could not get/create user, will use NULL:', userError.message);
            requesterUserId = null;
        }
        const requisitionId = await DocumentUtils.generateDocumentNumber(connection, 'RQ');
        // 2. บันทึกข้อมูลคำขอเบิก header
        const [result] = await connection.execute(`INSERT INTO tbl_inv_requisitions 
             (id, department_id, requester_id, request_date, material_category, urgency, reason, current_status) 
             VALUES (?, ?, ?, NOW(), ?, ?, ?, 'REQ_DRAFT')`, [requisitionId, departmentId, requesterUserId, materialCategory, urgency, reason]);
        // 3. บันทึกรายการสินค้าและจัดการ Status แต่ละ Item
        const createdItemIds = [];
        for (const item of items) {
            // 3.1 บันทึกข้อมูล Item
            const [itemResult] = await connection.execute(`INSERT INTO tbl_inv_requisition_items 
                 (requisition_id, description, item_type, hn, patient_name, unit, quantity, price, note, request_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                requisitionId,
                item.description,
                item.item_type || 'เพื่อใช้',
                item.hn || null,
                item.patient_name || null,
                item.unit,
                item.quantity,
                item.price,
                item.note || null,
                item.request_date || null
            ]);
            const itemId = itemResult.insertId;
            createdItemIds.push(itemId);
            // 3.2 กำหนด Status เริ่มต้นสำหรับ Item
            const initialStatus = 'REQ_DRAFT';
            const priorityLevel = urgency === 'urgent' ? 'URGENT' : urgency === 'high' ? 'HIGH' : 'NORMAL';
            // 3.3 บันทึก Current Status ของ Item (ไม่ใช้ Foreign Key ก่อน)
            await connection.execute(`INSERT INTO tbl_inv_status_item_current 
                 (item_id, current_status_code, current_status_since, last_comment, priority_level, estimated_completion) 
                 VALUES (?, ?, NOW(), ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`, [
                itemId,
                initialStatus,
                `สร้างรายการใหม่: ${item.description}`,
                priorityLevel
            ]);
            // 3.4 บันทึก Event Log สำหรับการสร้าง Item
            await connection.execute(`INSERT INTO tbl_inv_item_event_logs 
                 (item_id, event_type, new_status_code, event_description, 
                  changed_by, ip_address, user_agent, additional_data) 
                 VALUES (?, 'CREATE', ?, ?, ?, ?, ?, ?)`, [
                itemId,
                initialStatus,
                `สร้างรายการขอเบิก: ${item.description} จำนวน ${item.quantity} ${item.unit}`,
                requesterUserId, // อาจเป็น null ถ้าไม่มี user
                req.ip || 'unknown',
                req.get('User-Agent') || 'unknown',
                JSON.stringify({
                    requisition_id: requisitionId,
                    item_type: item.item_type,
                    quantity: item.quantity,
                    price: item.price,
                    unit: item.unit,
                    hn: item.hn || null,
                    patient_name: item.patient_name || null
                })
            ]);
        }
        // 4. บันทึกประเภทเอกสารแนบแบบ Checkbox (ถ้ามี)
        if (documents && documents.length > 0) {
            for (const doc of documents) {
                await connection.execute(`INSERT INTO tbl_inv_requisition_document_types 
                     (requisition_id, document_type_id, other_document_name, is_required) 
                     VALUES (?, ?, ?, ?)`, [
                    requisitionId,
                    doc.document_type_id,
                    doc.other_document_name || null,
                    doc.is_required || false
                ]);
                // Log การเลือกประเภทเอกสาร สำหรับ Event Logs
                for (const itemId of createdItemIds) {
                    await connection.execute(`INSERT INTO tbl_inv_item_event_logs 
                         (item_id, event_type, event_description, changed_by, additional_data) 
                         VALUES (?, 'UPDATE', ?, ?, ?)`, [
                        itemId,
                        `เลือกประเภทเอกสาร: ${doc.other_document_name || 'ประเภทเอกสาร ID ' + doc.document_type_id}`,
                        requesterUserId, // อาจเป็น null ถ้าไม่มี user
                        JSON.stringify({
                            action: 'select_document_type',
                            document_type_id: doc.document_type_id,
                            other_document_name: doc.other_document_name,
                            is_required: doc.is_required
                        })
                    ]);
                }
            }
        }
        // 5. บันทึกประวัติสถานะระดับ Requisition (เก็บไว้เพื่อ Backward Compatibility)
        await connection.execute(`INSERT INTO tbl_inv_status_logs 
             (requisition_id, previous_status, new_status, changed_by, comment) 
             VALUES (?, NULL, 'REQ_DRAFT', ?, 'สร้างคำขอเบิกใหม่')`, [requisitionId, requesterUserId] // อาจเป็น null ถ้าไม่มี user
        );
        // 6. ตรวจสอบ Auto Transition (ถ้ามี)
        // ตัวอย่าง: ถ้าเป็น urgency = 'urgent' อาจจะ auto submit เลย
        if (urgency === 'urgent') {
            try {
                // ตรวจสอบ Workflow Rule สำหรับ Auto Transition
                const [workflowCheck] = await connection.execute(`SELECT * FROM tbl_inv_status_workflow 
                     WHERE from_status_code = 'REQ_DRAFT' AND to_status_code = 'REQ_SUBMITTED' 
                     AND auto_transition = 1 AND is_active = 1`, []);
                if (workflowCheck.length > 0) {
                    // Auto submit สำหรับ urgent requests
                    const newStatus = 'REQ_SUBMITTED';
                    // อัพเดท Status ทุก Item
                    for (const itemId of createdItemIds) {
                        await connection.execute(`UPDATE tbl_inv_status_item_current 
                             SET current_status_code = ?, current_status_since = NOW(), 
                                 last_comment = ? 
                             WHERE item_id = ?`, [newStatus, 'Auto Submit - Urgent Request', itemId]);
                        // Log การเปลี่ยนสถานะ
                        await connection.execute(`INSERT INTO tbl_inv_item_event_logs 
                             (item_id, event_type, previous_status_code, new_status_code, 
                              event_description, changed_by, additional_data) 
                             VALUES (?, 'STATUS_CHANGE', ?, ?, ?, ?, ?)`, [
                            itemId,
                            'REQ_DRAFT',
                            newStatus,
                            'Auto Submit เนื่องจากเป็น Urgent Request',
                            requesterUserId, // อาจเป็น null ถ้าไม่มี user
                            JSON.stringify({ auto_transition: true, reason: 'urgent_priority' })
                        ]);
                    }
                    // อัพเดท Requisition Header
                    await connection.execute(`UPDATE tbl_inv_requisitions SET current_status = ? WHERE id = ?`, [newStatus, requisitionId]);
                }
            }
            catch (autoTransitionError) {
                console.warn('Auto transition failed:', autoTransitionError);
                // ไม่หยุดการทำงาน ให้คง Status เดิม
            }
        }
        // Commit Transaction
        await connection.commit();
        // ดึงข้อมูลสถานะปัจจุบันของ Items ที่สร้าง
        const [itemsStatus] = await connection.execute(`SELECT ic.item_id, ic.current_status_code, sm.status_name_th, sm.status_color
             FROM tbl_inv_status_item_current ic
             JOIN tbl_inv_status_master sm ON ic.current_status_code = sm.status_code
             WHERE ic.item_id IN (${createdItemIds.map(() => '?').join(',')})`, createdItemIds);
        // ส่งข้อมูลกลับไปยัง client
        res.status(201).json({
            success: true,
            message: 'สร้างคำขอเบิกเรียบร้อยแล้ว',
            data: {
                requisitionId,
                status: urgency === 'urgent' ? 'REQ_SUBMITTED' : 'REQ_DRAFT',
                itemsCreated: createdItemIds.length,
                items: itemsStatus.map((item) => ({
                    itemId: item.item_id,
                    status: item.current_status_code,
                    statusName: item.status_name_th,
                    statusColor: item.status_color
                })),
                autoSubmitted: urgency === 'urgent'
            }
        });
    }
    catch (error) {
        // Rollback กรณีเกิดข้อผิดพลาด
        if (connection) {
            await connection.rollback();
        }
        // Colors for error logging
        const colors = {
            reset: '\x1b[0m',
            red: '\x1b[31m',
            yellow: '\x1b[33m',
            bold: '\x1b[1m'
        };
        const timestamp = new Date().toISOString();
        console.error(`\n${colors.red}${colors.bold}🚨 [CONTROLLER ERROR] ${timestamp} PlaceCreateRequest${colors.reset}`);
        console.error(`${colors.red}┌─ Message: ${error.message}${colors.reset}`);
        console.error(`${colors.red}├─ Type: ${error.name || 'Unknown'}${colors.reset}`);
        console.error(`${colors.red}├─ Status: ${error.status || error.statusCode || 500}${colors.reset}`);
        // แสดง SQL Error ถ้ามี
        if (error.sql) {
            console.error(`${colors.yellow}├─ SQL Query: ${error.sql}${colors.reset}`);
        }
        if (error.sqlMessage) {
            console.error(`${colors.yellow}├─ SQL Message: ${error.sqlMessage}${colors.reset}`);
        }
        if (error.errno) {
            console.error(`${colors.yellow}├─ SQL Error Code: ${error.errno}${colors.reset}`);
        }
        // แสดง Stack trace (แค่ส่วนที่สำคัญ)
        if (error.stack) {
            const stackLines = error.stack.split('\n').slice(0, 3);
            console.error(`${colors.red}└─ Stack Trace:${colors.reset}`);
            stackLines.forEach((line, index) => {
                const prefix = index === stackLines.length - 1 ? '   └─' : '   ├─';
                console.error(`${colors.red}${prefix} ${line.trim()}${colors.reset}`);
            });
        }
        console.error(''); // เว้นบรรทัด
        // Safe logging - ตรวจสอบว่า logger มีอยู่หรือไม่
        try {
            if (logger && logger.request && typeof logger.request.error === 'function') {
                logger.request.error('Error creating requisition:', {
                    error: error.message,
                    stack: error.stack,
                    sqlQuery: error.sql,
                    sqlMessage: error.sqlMessage,
                    sqlErrorCode: error.errno
                });
            }
            else {
                console.error(`${colors.yellow}[WARNING] Logger not available for file logging${colors.reset}`);
            }
        }
        catch (logError) {
            console.error(`${colors.red}[LOG ERROR] Failed to log error: ${logError.message}${colors.reset}`);
        }
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างคำขอเบิก',
            error: error.message,
            timestamp: timestamp,
            ...(process.env.NODE_ENV === 'development' && {
                stack: error.stack,
                sqlQuery: error.sql,
                sqlMessage: error.sqlMessage
            })
        });
    }
    finally {
        // ปิดการเชื่อมต่อฐานข้อมูล
        if (connection) {
            connection.release();
        }
    }
}, 30000);
// ดึงข้อมูลคำขอเบิกทั้งหมด
exports.placeGetRequest = wrapController(async (req, res) => {
    try {
        const db = ManagementDB.getInstance();
        // ดึงพารามิเตอร์สำหรับการกรอง
        const { departmentID, statusID, fromDate, toDate, page = 1, itemsPerPage = 20 } = req.query;
        const limit = parseInt(itemsPerPage);
        const offset = (parseInt(page) - 1) * limit;
        // SQL สำหรับดึงข้อมูลคำขอเบิก
        let sql = `
            SELECT r.RequisitionID, r.RequisitionNumber, r.RequestDate, r.StatusID, 
                r.Priority, r.TotalItems, r.Purpose, r.NeedByDate,
                r.ApprovedByHeadID, r.ApprovedHeadDate, r.ApprovedByManagerID, r.ApprovedManagerDate,
                d.DepartmentName, d.DepartmentID,
                u.UserName as RequestUserName, u.UserID as RequestUserID,
                s.StatusName,
                ah.UserName as ApprovedByHeadName,
                am.UserName as ApprovedByManagerName,
                (SELECT SUM(EstimatedTotalPrice) FROM tbl_inv_requestitems WHERE RequisitionID = r.RequisitionID) as TotalPrice,
                (SELECT DISTINCT CategoryID FROM tbl_inv_requestitems WHERE RequisitionID = r.RequisitionID LIMIT 1) as MainCategoryID
            FROM tbl_inv_request r
            LEFT JOIN tbl_inv_departments d ON r.DepartmentID = d.DepartmentID
            LEFT JOIN tbl_inv_users u ON r.RequestUserID = u.UserID
            LEFT JOIN tbl_inv_status s ON r.StatusID = s.StatusID
            LEFT JOIN tbl_inv_users ah ON r.ApprovedByHeadID = ah.UserID
            LEFT JOIN tbl_inv_users am ON r.ApprovedByManagerID = am.UserID
            LEFT JOIN tbl_inv_categories c ON (
                SELECT DISTINCT CategoryID FROM tbl_inv_requestitems 
                WHERE RequisitionID = r.RequisitionID LIMIT 1
            ) = c.CategoryID
            WHERE 1=1
        `;
        const params = [];
        // เพิ่มเงื่อนไขการกรอง
        if (departmentID) {
            sql += ' AND r.DepartmentID = ?';
            params.push(departmentID);
        }
        if (statusID) {
            sql += ' AND r.StatusID = ?';
            params.push(statusID);
        }
        if (fromDate) {
            sql += ' AND DATE(r.RequestDate) >= ?';
            params.push(fromDate);
        }
        if (toDate) {
            sql += ' AND DATE(r.RequestDate) <= ?';
            params.push(toDate);
        }
        // เรียงลำดับตาม RequestDate ล่าสุด
        sql += ' ORDER BY r.RequestDate DESC';
        // เพิ่ม LIMIT และ OFFSET
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
        // ดึงข้อมูลคำขอเบิก
        let requisitions = await db.fetchData(sql, params);
        // ดึงข้อมูลหมวดหมู่
        const categorySql = `SELECT CategoryID, CategoryName FROM tbl_inv_categories`;
        const categories = await db.fetchData(categorySql, []);
        const categoryMap = {};
        categories.forEach(category => {
            categoryMap[category.CategoryID] = category.CategoryName;
        });
        // นับจำนวนรายการทั้งหมด
        let countSql = `
            SELECT COUNT(*) as total
            FROM tbl_inv_request r
            WHERE 1=1
        `;
        const countParams = [];
        if (departmentID) {
            countSql += ' AND r.DepartmentID = ?';
            countParams.push(departmentID);
        }
        if (statusID) {
            countSql += ' AND r.StatusID = ?';
            countParams.push(statusID);
        }
        if (fromDate) {
            countSql += ' AND DATE(r.RequestDate) >= ?';
            countParams.push(fromDate);
        }
        if (toDate) {
            countSql += ' AND DATE(r.RequestDate) <= ?';
            countParams.push(toDate);
        }
        const countResult = await db.fetchData(countSql, countParams);
        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limit);
        // แปลงข้อมูลให้ตรงตาม format ที่ต้องการ
        const formattedRequests = await Promise.all(requisitions.map(async (req) => {
            // ดึงข้อมูลรายการ items ของคำขอเบิกนี้
            const itemsSql = `
                SELECT 
                    ri.*, 
                    c.CategoryName,
                    u.UnitName
                FROM tbl_inv_requestitems ri
                LEFT JOIN tbl_inv_categories c ON ri.CategoryID = c.CategoryID
                LEFT JOIN tbl_inv_units u ON ri.UnitID = u.UnitID
                WHERE ri.RequisitionID = ?
            `;
            const items = await db.fetchData(itemsSql, [req.RequisitionID]);
            // ดึงเอกสารแนบที่เกี่ยวข้องกับคำขอเบิกนี้
            const documentsSql = `
                SELECT 
                    d.id, 
                    d.document_type_id, 
                    dt.name as document_type_name,
                    d.original_filename,
                    d.file_path,
                    d.file_type,
                    d.file_size,
                    d.custom_title,
                    d.created_at,
                    dr.reference_id,
                    dr.reference_type,
                    ps.name as stage_name
                FROM documents d
                JOIN document_references dr ON d.id = dr.document_id
                JOIN document_types dt ON d.document_type_id = dt.id
                JOIN process_stages ps ON dr.stage_id = ps.id
                WHERE dr.reference_type = 'REQUEST' AND dr.reference_id = ?
                ORDER BY d.created_at DESC
            `;
            const documents = await db.fetchData(documentsSql, [req.RequisitionID.toString()]);
            // ดึงข้อมูลเอกสารแนบและรูปภาพของแต่ละรายการ
            for (let i = 0; i < items.length; i++) {
                // ดึงเอกสารแนบของรายการ
                if (items[i].AttachmentsID) {
                    const itemDocSql = `
                        SELECT 
                            d.id, 
                            d.document_type_id, 
                            dt.name as document_type_name,
                            d.original_filename,
                            d.file_path,
                            d.file_type,
                            d.file_size,
                            d.custom_title,
                            d.created_at
                        FROM documents d
                        JOIN document_types dt ON d.document_type_id = dt.id
                        WHERE d.id = ?
                    `;
                    const itemDocs = await db.fetchData(itemDocSql, [items[i].AttachmentsID]);
                    items[i].attachments = itemDocs.length > 0 ? itemDocs[0] : null;
                }
                // แยกประเภทเอกสารและรูปภาพ
                const documentImages = documents.filter((doc) => doc.file_type.startsWith('image/') &&
                    ['SPEC', 'CATALOG', 'OTHER'].includes(doc.document_type_name));
                // เพิ่มข้อมูลให้รายการ
                items[i].documentImages = documentImages.map((img) => ({
                    id: img.id,
                    fileName: img.original_filename,
                    fileType: img.file_type,
                    filePath: img.file_path
                }));
            }
            // แปลงข้อมูลให้ตรงกับรูปแบบที่ต้องการ
            return {
                requestId: req.RequisitionNumber,
                requisitionID: req.RequisitionID,
                date: req.RequestDate,
                status: req.StatusName.toLowerCase(),
                statusID: req.StatusID,
                department: req.DepartmentName,
                requesterName: req.RequestUserName,
                category: categoryMap[req.MainCategoryID] || 'ไม่ระบุ',
                itemCount: req.TotalItems,
                totalPrice: req.TotalPrice || 0,
                priority: req.Priority,
                purpose: req.Purpose,
                needByDate: req.NeedByDate,
                approvedBy: req.ApprovedByHeadName,
                approvedDate: req.ApprovedHeadDate,
                approvedByManager: req.ApprovedByManagerName,
                approvedManagerDate: req.ApprovedManagerDate,
                attachments: documents.length,
                attachmentsList: documents.map((doc) => ({
                    id: doc.id,
                    fileName: doc.original_filename,
                    fileType: doc.file_type,
                    fileSize: doc.file_size,
                    filePath: doc.file_path,
                    documentType: doc.document_type_name,
                    title: doc.custom_title || doc.original_filename,
                    createdAt: doc.created_at,
                    isImage: doc.file_type.startsWith('image/')
                })),
                items: items.map((item) => ({
                    itemId: item.RequestItemID,
                    description: item.ItemDescription,
                    category: item.CategoryName,
                    quantity: item.Quantity,
                    unit: item.UnitName,
                    estimatedUnitPrice: item.EstimatedUnitPrice,
                    estimatedTotalPrice: item.EstimatedTotalPrice,
                    status: item.StatusID,
                    specifications: item.Specifications,
                    notes: item.Notes,
                    attachments: item.attachments,
                    images: item.documentImages || []
                }))
            };
        }));
        res.json({
            status: "success",
            data: {
                totalItems,
                totalPages,
                currentPage: parseInt(page),
                itemsPerPage: limit,
                requests: formattedRequests
            }
        });
    }
    catch (error) {
        // Colors for error logging
        const colors = {
            reset: '\x1b[0m',
            red: '\x1b[31m',
            yellow: '\x1b[33m',
            bold: '\x1b[1m'
        };
        const timestamp = new Date().toISOString();
        console.error(`\n${colors.red}${colors.bold}🚨 [CONTROLLER ERROR] ${timestamp} PlaceGetRequest${colors.reset}`);
        console.error(`${colors.red}┌─ Message: ${error.message}${colors.reset}`);
        console.error(`${colors.red}├─ Type: ${error.name || 'Unknown'}${colors.reset}`);
        console.error(`${colors.red}├─ Status: ${error.status || error.statusCode || 500}${colors.reset}`);
        // แสดง SQL Error ถ้ามี
        if (error.sql) {
            console.error(`${colors.yellow}├─ SQL Query: ${error.sql}${colors.reset}`);
        }
        if (error.sqlMessage) {
            console.error(`${colors.yellow}├─ SQL Message: ${error.sqlMessage}${colors.reset}`);
        }
        if (error.errno) {
            console.error(`${colors.yellow}├─ SQL Error Code: ${error.errno}${colors.reset}`);
        }
        // แสดง Stack trace (แค่ส่วนที่สำคัญ)
        if (error.stack) {
            const stackLines = error.stack.split('\n').slice(0, 3);
            console.error(`${colors.red}└─ Stack Trace:${colors.reset}`);
            stackLines.forEach((line, index) => {
                const prefix = index === stackLines.length - 1 ? '   └─' : '   ├─';
                console.error(`${colors.red}${prefix} ${line.trim()}${colors.reset}`);
            });
        }
        console.error(''); // เว้นบรรทัด
        // Safe logging - ตรวจสอบว่า logger มีอยู่หรือไม่
        try {
            if (logger && logger.request && typeof logger.request.error === 'function') {
                logger.request.error('Error fetching requisitions', {
                    error: error.message,
                    stack: error.stack,
                    sqlQuery: error.sql,
                    sqlMessage: error.sqlMessage,
                    sqlErrorCode: error.errno
                });
            }
            else {
                console.error(`${colors.yellow}[WARNING] Logger not available for file logging${colors.reset}`);
            }
        }
        catch (logError) {
            console.error(`${colors.red}[LOG ERROR] Failed to log error: ${logError.message}${colors.reset}`);
        }
        res.status(500).json({
            status: "error",
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำขอเบิก',
            error: error.message,
            timestamp: timestamp,
            ...(process.env.NODE_ENV === 'development' && {
                stack: error.stack,
                sqlQuery: error.sql,
                sqlMessage: error.sqlMessage
            })
        });
    }
}, 30000);
// ดึงข้อมูลเอกสารแนบของคำขอเบิก
exports.placeDocumentCheckboxList = wrapController(async (req, res) => {
    try {
        const db = ManagementDB.getInstance();
        const sql = `
            SELECT *
            FROM tbl_inv_document_types
            WHERE is_active= '1'
            ORDER BY display_order
        `;
        const documentTypes = await db.executeQuery(sql);
        res.json({
            status: "success",
            data: documentTypes.map((type) => ({
                id: type.id,
                code: type.code,
                name: type.name,
                description: type.description
            }))
        });
    }
    catch (error) {
        // Colors for error logging
        const colors = {
            reset: '\x1b[0m',
            red: '\x1b[31m',
            yellow: '\x1b[33m',
            bold: '\x1b[1m'
        };
        const timestamp = new Date().toISOString();
        console.error(`\n${colors.red}${colors.bold}🚨 [CONTROLLER ERROR] ${timestamp} PlaceDocumentCheckboxList${colors.reset}`);
        console.error(`${colors.red}┌─ Message: ${error.message}${colors.reset}`);
        console.error(`${colors.red}├─ Type: ${error.name || 'Unknown'}${colors.reset}`);
        console.error(`${colors.red}├─ Status: ${error.status || error.statusCode || 500}${colors.reset}`);
        // แสดง SQL Error ถ้ามี
        if (error.sql) {
            console.error(`${colors.yellow}├─ SQL Query: ${error.sql}${colors.reset}`);
        }
        if (error.sqlMessage) {
            console.error(`${colors.yellow}├─ SQL Message: ${error.sqlMessage}${colors.reset}`);
        }
        if (error.errno) {
            console.error(`${colors.yellow}├─ SQL Error Code: ${error.errno}${colors.reset}`);
        }
        // แสดง Stack trace (แค่ส่วนที่สำคัญ)
        if (error.stack) {
            const stackLines = error.stack.split('\n').slice(0, 3);
            console.error(`${colors.red}└─ Stack Trace:${colors.reset}`);
            stackLines.forEach((line, index) => {
                const prefix = index === stackLines.length - 1 ? '   └─' : '   ├─';
                console.error(`${colors.red}${prefix} ${line.trim()}${colors.reset}`);
            });
        }
        console.error(''); // เว้นบรรทัด
        // Safe logging - ตรวจสอบว่า logger มีอยู่หรือไม่
        try {
            if (logger && logger.request && typeof logger.request.error === 'function') {
                logger.request.error('Error fetching document types', {
                    error: error.message,
                    stack: error.stack,
                    sqlQuery: error.sql,
                    sqlMessage: error.sqlMessage,
                    sqlErrorCode: error.errno
                });
            }
            else {
                console.error(`${colors.yellow}[WARNING] Logger not available for file logging${colors.reset}`);
            }
        }
        catch (logError) {
            console.error(`${colors.red}[LOG ERROR] Failed to log error: ${logError.message}${colors.reset}`);
        }
        res.status(500).json({
            status: "error",
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลเอกสารแนบ",
            error: error.message,
            timestamp: timestamp,
            ...(process.env.NODE_ENV === 'development' && {
                stack: error.stack,
                sqlQuery: error.sql,
                sqlMessage: error.sqlMessage
            })
        });
    }
}, 8000); // 8 seconds
// Helper function สำหรับดึง Document Type ID
async function getDocumentTypeId(connection, code) {
    try {
        const sql = "SELECT id FROM document_types WHERE code = ?";
        const [result] = await connection.query(sql, [code]);
        if (result.length) {
            return result[0].id;
        }
        // ถ้าไม่มี ให้ใช้ประเภท 'OTHER'
        const otherSql = "SELECT id FROM document_types WHERE code = 'OTHER'";
        const [otherResult] = await connection.query(otherSql);
        if (otherResult.length) {
            return otherResult[0].id;
        }
        return '11'; // Fallback เป็น ID ของ "อื่นๆ" (จากข้อมูลตัวอย่าง)
    }
    catch (error) {
        console.error("Error getting document type ID:", error);
        return '11'; // Fallback
    }
}
// Helper function สำหรับดึง Stage ID
async function getStageId(connection, code) {
    try {
        const sql = "SELECT id FROM process_stages WHERE code = ?";
        const [result] = await connection.query(sql, [code]);
        if (result.length) {
            return result[0].id;
        }
        return 1; // Fallback เป็น ID ของขั้นตอนแรก
    }
    catch (error) {
        console.error("Error getting stage ID:", error);
        return 1; // Fallback
    }
}
