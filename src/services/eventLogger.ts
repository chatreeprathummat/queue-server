/**
 * Event Logger Service for Inventory Management System
 * จัดการการบันทึก event logs แบบมีระบบ rollback และยืดหยุ่น
 */

import { Request } from 'express';

// ประเภท Event Type ที่สนับสนุน
export type EventType = 
    | 'CREATE' 
    | 'UPDATE' 
    | 'DELETE' 
    | 'APPROVE' 
    | 'REJECT' 
    | 'INFO_REQ'
    | 'CANCEL'
    | 'DOCUMENT_ATTACHED'
    | 'STATUS_CHANGE'
    | 'SYSTEM';

// Interface สำหรับข้อมูล Event Log
export interface EventLogData {
    item_id: number;
    event_type: EventType;
    new_status_code?: string;
    event_description: string;
    ip_address?: string;
    user_agent?: string;
    additional_data?: Record<string, any>;
    created_by_user_id: string;
    req?: Request; // optional - ถ้าส่งมาจะดึง IP และ User-Agent อัตโนมัติ
}

// Interface สำหรับผลลัพธ์การบันทึก
export interface EventLogResult {
    success: boolean;
    event_log_id?: number;
    error?: string;
    item_id: number;
}

// Interface สำหรับ Batch Logging
export interface BatchEventLogResult {
    success: boolean;
    total_logs: number;
    successful_logs: number;
    failed_logs: number;
    results: EventLogResult[];
    rollback_executed?: boolean;
}

/**
 * ฟังก์ชันบันทึก Event Log เดี่ยว
 * @param connection - Database connection (transaction connection)
 * @param eventData - ข้อมูล event ที่ต้องการบันทึก
 * @returns Promise<EventLogResult>
 */
export async function logItemEvent(
    connection: any, 
    eventData: EventLogData
): Promise<EventLogResult> {
    try {
        // ตรวจสอบข้อมูลที่จำเป็น
        if (!eventData.item_id || !eventData.event_type || !eventData.event_description || !eventData.created_by_user_id) {
            throw new Error('ข้อมูล event log ไม่ครบถ้วน: ต้องมี item_id, event_type, event_description, created_by_user_id');
        }

        // ดึง IP และ User-Agent จาก Request ถ้ามี
        const ip_address = eventData.ip_address || eventData.req?.ip || 'unknown';
        const user_agent = eventData.user_agent || eventData.req?.get('User-Agent') || 'unknown';

        // เตรียม additional_data
        const additional_data = eventData.additional_data ? JSON.stringify(eventData.additional_data) : null;

        // บันทึกลงฐานข้อมูล (ลบฟิลด์ changed_by ออกแล้ว)
        const [result] = await connection.execute(
            `INSERT INTO tbl_inv_item_event_logs 
             (item_id, event_type, new_status_code, event_description, 
              ip_address, user_agent, additional_data, created_by_user_id, date_created) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                eventData.item_id,
                eventData.event_type,
                eventData.new_status_code || null,
                eventData.event_description,
                ip_address,
                user_agent,
                additional_data,
                eventData.created_by_user_id
            ]
        );

        return {
            success: true,
            event_log_id: result.insertId,
            item_id: eventData.item_id
        };

    } catch (error: any) {
        console.error('Error logging event:', error);
        return {
            success: false,
            error: error.message,
            item_id: eventData.item_id
        };
    }
}

/**
 * ฟังก์ชันบันทึก Event Log หลายรายการพร้อมระบบ Rollback
 * @param connection - Database connection (transaction connection)
 * @param eventsData - Array ของข้อมูล event ที่ต้องการบันทึก
 * @param rollbackOnError - ถ้า true จะ rollback transaction ทั้งหมดเมื่อมี error
 * @returns Promise<BatchEventLogResult>
 */
export async function logItemEventsBatch(
    connection: any, 
    eventsData: EventLogData[],
    rollbackOnError: boolean = true
): Promise<BatchEventLogResult> {
    const results: EventLogResult[] = [];
    let successfulLogs = 0;
    let failedLogs = 0;
    let rollbackExecuted = false;

    try {
        // บันทึกทีละรายการ
        for (const eventData of eventsData) {
            const result = await logItemEvent(connection, eventData);
            results.push(result);
            
            if (result.success) {
                successfulLogs++;
            } else {
                failedLogs++;
                
                // ถ้าตั้งค่า rollback และมี error ให้หยุดและ rollback
                if (rollbackOnError) {
                    console.error(`Event logging failed for item_id ${result.item_id}: ${result.error}`);
                    throw new Error(`Event logging failed: ${result.error}`);
                }
            }
        }

        return {
            success: failedLogs === 0,
            total_logs: eventsData.length,
            successful_logs: successfulLogs,
            failed_logs: failedLogs,
            results: results
        };

    } catch (error: any) {
        console.error('Batch event logging failed:', error);
        
        // ถ้าอยู่ใน transaction และต้องการ rollback
        if (rollbackOnError && connection.rollback) {
            try {
                await connection.rollback();
                rollbackExecuted = true;
                console.log('Transaction rolled back due to event logging error');
            } catch (rollbackError: any) {
                console.error('Rollback failed:', rollbackError);
            }
        }

        return {
            success: false,
            total_logs: eventsData.length,
            successful_logs: successfulLogs,
            failed_logs: failedLogs + 1,
            results: results,
            rollback_executed: rollbackExecuted
        };
    }
}

/**
 * ฟังก์ชันสร้าง Event Log Data แบบง่าย
 * @param item_id - ID ของ item
 * @param event_type - ประเภท event
 * @param description - คำอธิบาย event
 * @param created_by_user_id - ID ของผู้สร้าง
 * @param options - ตัวเลือกเพิ่มเติม
 * @returns EventLogData
 */
export function createEventLogData(
    item_id: number,
    event_type: EventType,
    description: string,
    created_by_user_id: string,
    options: {
        new_status_code?: string;
        additional_data?: Record<string, any>;
        req?: Request;
        ip_address?: string;
        user_agent?: string;
    } = {}
): EventLogData {
    return {
        item_id,
        event_type,
        event_description: description,
        created_by_user_id,
        new_status_code: options.new_status_code,
        additional_data: options.additional_data,
        req: options.req,
        ip_address: options.ip_address,
        user_agent: options.user_agent
    };
}

/**
 * Helper functions สำหรับสร้าง Event Log แต่ละประเภท
 */

// สร้าง Event Log สำหรับการสร้างรายการใหม่
export function createNewItemEvent(
    item_id: number,
    description: string,
    created_by_user_id: string,
    new_status_code: string,
    additional_data?: Record<string, any>,
    req?: Request
): EventLogData {
    return createEventLogData(
        item_id,
        'CREATE',
        `สร้างรายการใหม่: ${description}`,
        created_by_user_id,
        { new_status_code, additional_data, req }
    );
}

// สร้าง Event Log สำหรับการอนุมัติ
export function createApprovalEvent(
    item_id: number,
    description: string,
    approved_by_user_id: string,
    new_status_code: string,
    additional_data?: Record<string, any>,
    req?: Request
): EventLogData {
    return createEventLogData(
        item_id,
        'APPROVE',
        `อนุมัติ: ${description}`,
        approved_by_user_id,
        { new_status_code, additional_data, req }
    );
}

// สร้าง Event Log สำหรับการปฏิเสธ
export function createRejectionEvent(
    item_id: number,
    description: string,
    rejected_by_user_id: string,
    new_status_code: string,
    reason?: string,
    additional_data?: Record<string, any>,
    req?: Request
): EventLogData {
    return createEventLogData(
        item_id,
        'REJECT',
        `ปฏิเสธ: ${description}${reason ? ` | เหตุผล: ${reason}` : ''}`,
        rejected_by_user_id,
        { new_status_code, additional_data, req }
    );
}

// สร้าง Event Log สำหรับการเปลี่ยนสถานะ
export function createStatusChangeEvent(
    item_id: number,
    description: string,
    changed_by_user_id: string,
    old_status: string,
    new_status: string,
    additional_data?: Record<string, any>,
    req?: Request
): EventLogData {
    return createEventLogData(
        item_id,
        'STATUS_CHANGE',
        `เปลี่ยนสถานะ: ${description} | ${old_status} → ${new_status}`,
        changed_by_user_id,
        { new_status_code: new_status, additional_data, req }
    );
}

// สร้าง Event Log สำหรับการแนบเอกสาร
export function createDocumentAttachEvent(
    item_id: number,
    document_description: string,
    attached_by_user_id: string,
    additional_data?: Record<string, any>,
    req?: Request
): EventLogData {
    return createEventLogData(
        item_id,
        'DOCUMENT_ATTACHED',
        `แนบเอกสาร: ${document_description}`,
        attached_by_user_id,
        { additional_data, req }
    );
}

// สร้าง Event Log สำหรับการยกเลิก
export function createCancellationEvent(
    item_id: number,
    description: string,
    cancelled_by_user_id: string,
    new_status_code: string,
    reason?: string,
    additional_data?: Record<string, any>,
    req?: Request
): EventLogData {
    return createEventLogData(
        item_id,
        'CANCEL',
        `ยกเลิก: ${description}${reason ? ` | เหตุผล: ${reason}` : ''}`,
        cancelled_by_user_id,
        { new_status_code, additional_data, req }
    );
}

/**
 * ตัวอย่างการใช้งาน:
 * 
 * // 1. บันทึก Event เดี่ยว
 * const eventData = createNewItemEvent(
 *     itemId, 
 *     'กระดาษ A4', 
 *     'USER001', 
 *     'REQ_PENDING_DEPT_APPROVAL',
 *     { quantity: 100, price: 500 },
 *     req
 * );
 * const result = await logItemEvent(connection, eventData);
 * 
 * // 2. บันทึก Event หลายรายการ
 * const events = [
 *     createNewItemEvent(item1Id, 'สินค้า 1', 'USER001', 'PENDING'),
 *     createNewItemEvent(item2Id, 'สินค้า 2', 'USER001', 'PENDING')
 * ];
 * const batchResult = await logItemEventsBatch(connection, events, true);
 * 
 * // 3. บันทึก Event การอนุมัติ
 * const approvalEvent = createApprovalEvent(
 *     itemId,
 *     'อนุมัติรายการขอเบิก',
 *     'MANAGER001',
 *     'APPROVED',
 *     { approved_quantity: 50 }
 * );
 * await logItemEvent(connection, approvalEvent);
 */ 