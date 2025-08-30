// @ts-nocheck
const oracledb = require('oracledb') as any;
const config = require('../config/config') as any;
const oracleServiceMoment = require("moment-timezone") as any;

class OracleService {
    private pool: any = null;
    private isOracleAvailable: boolean = true;
    private lastCheckTime: number = 0;
    private checkInterval: number = 300000;
    private enableHealthCheck: boolean = false;

    constructor() {
        // ตั้งค่า Oracle client (จำเป็นต้องระบุ path ของ Oracle Instant Client)
        if (config.libdir) {
            oracledb.initOracleClient({ libDir: config.libdir });
        }
        this.pool = null; // ตัวแปรสำหรับเก็บ pool
        this.isOracleAvailable = true; // Track Oracle availability
        this.lastCheckTime = 0; // เวลาตรวจสอบครั้งล่าสุด
        this.checkInterval = 300000; // ตรวจสอบทุก 5 นาที (300,000 ms)
        
        // 🔧 ปิด/เปิด Health Check Caching
        // false = ตรวจสอบทุกครั้ง (แนะนำระหว่างพัฒนา)
        // true = ตรวจสอบทุก 5 นาที (แนะนำใน production)
        this.enableHealthCheck = false;
    }

    // ฟังก์ชันสำหรับสร้าง connection pool (สร้างครั้งเดียวใช้ซ้ำ)
    async initPool() {
        if (this.pool) return; // ถ้ามี pool แล้วไม่ต้องสร้างใหม่
        
        try {
            // ตรวจสอบและปิด pool เก่าก่อน (ถ้ามี)
            try {
                const existingPool = oracledb.getPool('readOnlyPool');
                if (existingPool) {
                    await existingPool.close();
                    console.log('Closed existing Oracle pool');
                }
            } catch (err) {
                // ไม่มี pool เก่า หรือเกิด error ในการปิด - ไม่เป็นไร
            }

            this.pool = await oracledb.createPool({
                user: config.oracle_user,
                password: config.oracle_password,
                connectString: config.connectString,
                poolMin: 2,        // จำนวน connection ขั้นต่ำ
                poolMax: 10,       // จำนวน connection สูงสุด
                poolIncrement: 1,  // เพิ่มทีละกี่ connection
                poolTimeout: 60,   // ระยะเวลาที่ connection จะถูกปิดถ้าไม่ใช้งาน (วินาที)
                stmtCacheSize: 30, // จำนวน SQL statements ที่จะ cache
                events: false,     // ปิด events เพื่อลดการใช้ทรัพยากร
                externalAuth: false,
                homogeneous: true,
                poolAlias: 'readOnlyPool',
                _enableStats: false,
                queueTimeout: 60000, // เพิ่มการตั้งค่า timeout สำหรับคิวรอ connection (60 วินาที)
                connectTimeout: 15000 // เพิ่มการตั้งค่า timeout สำหรับการเชื่อมต่อใหม่ (15 วินาที)
            });
            console.log('Connection pool for Oracle created successfully');
            this.isOracleAvailable = true;
        } catch (error) {
            console.error('Error creating connection pool for Oracle:', error.message);
            this.isOracleAvailable = false;
            this.lastCheckTime = Date.now();
            throw error;
        }
    }

    // ฟังก์ชันสำหรับ query ทั่วไป (รับ sql และ params)
    async fetchDataOracle(sql, params = []) {
        // ตรวจสอบ Oracle availability ก่อน
        const isReady = await this.isOracleReady();
        if (!isReady) {
            console.warn(`[Oracle Service] Oracle Database ไม่พร้อมใช้งาน - ข้าม query operation`);
            return []; // Return empty array แทนการ throw error
        }

        let connectionOracle;
        try {
            await this.initPool(); // ตรวจสอบ pool
            connectionOracle = await this.pool.getConnection();
            const result = await connectionOracle.execute(sql, params, { 
                outFormat: oracledb.OUT_FORMAT_OBJECT,
                autoCommit: false, // ไม่จำเป็นต้อง commit เพราะเป็น read-only
                prefetchRows: 100 // เพิ่มประสิทธิภาพสำหรับข้อมูลขนาดใหญ่
            });
            return result.rows;
        } catch (error) {
            console.error('Error executing query for Oracle:', error.message);
            
            // Mark Oracle as unavailable หากเป็น connection error
            if (error.errorNum === 12170 || error.errorNum === 12154 || error.errorNum === 12541) {
                this.isOracleAvailable = false;
                this.lastCheckTime = Date.now();
                console.warn(`[Oracle Service] Oracle marked as unavailable due to connection error`);
            }
            
            return []; // Return empty array แทนการ throw error
        } finally {
            if (connectionOracle) {
                try {
                    await connectionOracle.close(); // คืน connection กลับ pool
                } catch (error) {
                    console.error('Error closing connection for Oracle:', error.message);
                }
            }
        }
    }

    // ฟังก์ชันสำหรับปิด pool (ควรเรียกใช้ตอนปิดแอพ)
    async closePool() {
        if (this.pool) {
            try {
                await this.pool.close();
                this.pool = null;
                console.log('Connection pool for Oracle closed successfully');
            } catch (error) {
                console.error('Error closing connection pool for Oracle:', error);
                throw error;
            }
        }
    }

    async checkPool() {
        if (!this.pool) return false;
        try {
            const connectionOracle = await this.pool.getConnection();
            await connectionOracle.ping();
            await connectionOracle.close();
            return true;
        } catch (error) {
            console.error('Pool health check for Oracle failed:', error);
            return false;
        }
    }

    // ฟังก์ชันตรวจสอบว่า Oracle พร้อมใช้งานหรือไม่
    async isOracleReady() {
        const now = Date.now();
        
        // หาก health check ถูกปิดใช้งาน จะตรวจสอบทุกครั้ง
        if (!this.enableHealthCheck) {
            try {
                await this.initPool();
                const isHealthy = await this.checkPool();
                this.isOracleAvailable = isHealthy;
                
                if (!isHealthy) {
                    console.warn(`[Oracle Health Check] Oracle Database ไม่พร้อมใช้งาน - จะข้าม Oracle operations`);
                }
                
                return isHealthy;
            } catch (error) {
                console.warn(`[Oracle Health Check] Oracle Database connection failed: ${error.message}`);
                this.isOracleAvailable = false;
                return false;
            }
        }
        
        // หาก Oracle ไม่พร้อมและยังไม่ถึงเวลาตรวจสอบใหม่ (เฉพาะเมื่อ health check เปิดใช้งาน)
        if (!this.isOracleAvailable && (now - this.lastCheckTime) < this.checkInterval) {
            return false;
        }
        
        // ตรวจสอบ Oracle connection
        try {
            await this.initPool();
            const isHealthy = await this.checkPool();
            this.isOracleAvailable = isHealthy;
            this.lastCheckTime = now;
            
            if (!isHealthy) {
                console.warn(`[Oracle Health Check] Oracle Database ไม่พร้อมใช้งาน - จะข้าม Oracle operations`);
            }
            
            return isHealthy;
        } catch (error) {
            console.warn(`[Oracle Health Check] Oracle Database connection failed: ${error.message}`);
            this.isOracleAvailable = false;
            this.lastCheckTime = now;
            return false;
        }
    }

    // ฟังก์ชันสำหรับตรวจสอบสถานะ health check
    getHealthCheckStatus() {
        return {
            enabled: this.enableHealthCheck,
            isOracleAvailable: this.isOracleAvailable,
            lastCheckTime: this.lastCheckTime,
            checkInterval: this.checkInterval,
            description: this.enableHealthCheck ? 'ตรวจสอบทุก 5 นาที' : 'ตรวจสอบทุกครั้ง',
            note: 'แก้ไขได้ที่ services/oracleService.js line ~13 (this.enableHealthCheck)'
        };
    }

    /**
     * ======================================================================
     * ฟังก์ชันสำหรับ Authentication และ User Management
     * ======================================================================
     */

    /**
     * ตรวจสอบ username และ password จาก Oracle
     * @param {string} username 
     * @param {string} password 
     * @returns {Object} ข้อมูล user หากตรวจสอบสำเร็จ
     */
    async validateUser(username, password) {
        // ตรวจสอบ Oracle availability ก่อน
        const isReady = await this.isOracleReady();
        if (!isReady) {
            console.warn(`[Oracle Auth] Oracle Database ไม่พร้อมใช้งาน - ข้าม user validation`);
            return null;
        }

        let connectionOracle;
        try {
            await this.initPool();
            connectionOracle = await this.pool.getConnection();

            // Query จริงจากฐานข้อมูล Oracle (รวม users และ doctors)
            const userQuery = `
                SELECT username, password, name, position, e_name, prename, pla_placecode
                FROM (
                    SELECT u.u_user_id username, u.checkword password, u.name, u.position, u.e_name, u.prename, u.pla_placecode
                    FROM utables u, urights ur
                    WHERE u.del_flag IS NULL
                    AND u.u_user_id = ur.uta_u_user_id
                    AND ur.pla_placecode IN ('3A','3B','4','5','6','NSR','ICU','SDU','SUP','COM')
                    GROUP BY u.u_user_id, u.checkword, u.name, u.position, u.e_name, u.prename, u.pla_placecode
                    
                    UNION
                    
                    SELECT d.doc_code, d.checkword, (d.name ||' '|| d.surname) name, 'Doctor' position, d.e_name, prename, dp.fullname pla_placecode
                    FROM doc_dbfs d, departs dp
                    WHERE d.del_flag IS NULL
                    AND d.dep_depend_on_id = dp.depend_on_id
                    AND d.prename IN ('นพ.','น.พ.','นพ','พญ.','พญ','พ.ญ')
                )
                WHERE username = :username 
                AND password = :password
            `;

            const result = await connectionOracle.execute(userQuery, {
                username: username,
                password: password
            });

            if (result.rows.length === 0) {
                console.warn(`[Oracle Auth] User validation failed for: ${username}`);
                return null; // ไม่พบ user หรือ password ผิด
            }

            // แปลงข้อมูลเป็น object (เอาข้อมูลแถวแรกเพราะ user ควรมีเพียงแถวเดียว)
            const userRow = result.rows[0];
            const userData = {
                username: userRow[0],
                password: userRow[1],
                fullName: userRow[2],
                position: userRow[3],
                englishName: userRow[4],
                prename: userRow[5],
                placecode: userRow[6], // placecode ที่ user มีสิทธิ์
                // เพิ่มข้อมูลอื่นๆ ที่ต้องการ
                email: null, // ไม่มีในฐานข้อมูล Oracle
                department: userRow[6], // ใช้ placecode แทน department ชั่วคราว
                employeeId: userRow[0], // ใช้ username เป็น employee ID
                status: 'ACTIVE', // สมมติว่า active
                createdDate: null,
                lastLogin: null
            };

            console.log(`[Oracle Auth] User validation successful for: ${username}`, {
                position: userData.position,
                placecode: userData.placecode
            });
            
            return userData;

        } catch (error) {
            console.error('[Oracle Auth] Error validating user:', {
                username: username,
                error: error.message,
                stack: error.stack
            });
            throw new Error('ไม่สามารถตรวจสอบข้อมูลจาก Oracle ได้');
        } finally {
            if (connectionOracle) {
                try {
                    await connectionOracle.close();
                } catch (error) {
                    console.error('[Oracle Auth] Error closing connection:', error.message);
                }
            }
        }
    }

    /**
     * ดึงข้อมูล user profile เพิ่มเติมจาก Oracle
     * @param {string} username 
     * @returns {Object} ข้อมูล user profile
     */
    async getUserProfile(username) {
        const isReady = await this.isOracleReady();
        if (!isReady) {
            console.warn(`[Oracle Profile] Oracle Database ไม่พร้อมใช้งาน - ข้าม get user profile`);
            return null;
        }

        let connectionOracle;
        try {
            await this.initPool();
            connectionOracle = await this.pool.getConnection();

            // Query profile พร้อม join ข้อมูลสิทธิ์วอร์ดทั้งหมด
            const profileQuery = `
                SELECT username, name, position, e_name, prename, 
                       LISTAGG(pla_placecode, ',') WITHIN GROUP (ORDER BY pla_placecode) as all_places
                FROM (
                    SELECT u.u_user_id username, u.name, u.position, u.e_name, u.prename, ur.pla_placecode
                    FROM utables u, urights ur
                    WHERE u.del_flag IS NULL
                    AND u.u_user_id = ur.uta_u_user_id
                    AND u.u_user_id = :username
                    
                    UNION
                    
                    SELECT d.doc_code, (d.name ||' '|| d.surname) name, 'Doctor' position, d.e_name, prename, dp.fullname pla_placecode
                    FROM doc_dbfs d, departs dp
                    WHERE d.del_flag IS NULL
                    AND d.dep_depend_on_id = dp.depend_on_id
                    AND d.prename IN ('นพ.','น.พ.','นพ','พญ.','พญ','พ.ญ')
                    AND d.doc_code = :username
                )
                GROUP BY username, name, position, e_name, prename
            `;

            const result = await connectionOracle.execute(profileQuery, {
                username: username
            });

            if (result.rows.length === 0) {
                return null;
            }

            const profileRow = result.rows[0];
            return {
                username: profileRow[0],
                fullName: profileRow[1],
                position: profileRow[2],
                englishName: profileRow[3],
                prename: profileRow[4],
                allPlaces: profileRow[5] ? profileRow[5].split(',') : [], // แยก placecode เป็น array
                email: null,
                department: profileRow[5], // ใช้ places แรกเป็น department
                employeeId: profileRow[0]
            };

        } catch (error) {
            console.error('[Oracle Profile] Error getting user profile:', {
                username: username,
                error: error.message
            });
            throw error;
        } finally {
            if (connectionOracle) {
                try {
                    await connectionOracle.close();
                } catch (error) {
                    console.error('[Oracle Profile] Error closing connection:', error.message);
                }
            }
        }
    }

    /**
     * อัพเดท last login ใน Oracle (สำหรับ utables เท่านั้น เพราะ doc_dbfs อาจไม่มี field นี้)
     * @param {string} username 
     */
    async updateLastLogin(username) {
        const isReady = await this.isOracleReady();
        if (!isReady) {
            console.warn(`[Oracle Update] Oracle Database ไม่พร้อมใช้งาน - ข้าม update last login`);
            return;
        }

        let connectionOracle;
        try {
            await this.initPool();
            connectionOracle = await this.pool.getConnection();

            // ตรวจสอบก่อนว่าเป็น user ประเภทไหน
            const checkUserTypeQuery = `
                SELECT 'STAFF' as user_type FROM utables WHERE u_user_id = :username AND del_flag IS NULL
                UNION
                SELECT 'DOCTOR' as user_type FROM doc_dbfs WHERE doc_code = :username AND del_flag IS NULL
            `;

            const userTypeResult = await connectionOracle.execute(checkUserTypeQuery, {
                username: username
            });

            if (userTypeResult.rows.length > 0) {
                const userType = userTypeResult.rows[0][0];
                
                if (userType === 'STAFF') {
                    // อัพเดทสำหรับพนักงาน (ถ้ามี field last_login)
                    const updateQuery = `
                        UPDATE utables 
                        SET last_login = SYSDATE 
                        WHERE u_user_id = :username
                    `;
                    
                    try {
                        await connectionOracle.execute(updateQuery, { username: username });
                        await connectionOracle.commit();
                        console.log(`[Oracle Update] Updated last_login for staff: ${username}`);
                    } catch (updateError) {
                        // ถ้า field last_login ไม่มีอยู่ จะไม่ error
                        console.log(`[Oracle Update] Cannot update last_login for staff ${username}: ${updateError.message}`);
                    }
                }
                
                // สำหรับ DOCTOR อาจไม่มี field last_login ใน doc_dbfs
                // ดังนั้นไม่ทำอะไร
            }

        } catch (error) {
            console.error('[Oracle Update] Error updating last login:', {
                username: username,
                error: error.message
            });
            // ไม่ throw error เพราะเป็น optional operation
        } finally {
            if (connectionOracle) {
                try {
                    await connectionOracle.close();
                } catch (error) {
                    console.error('[Oracle Update] Error closing connection:', error.message);
                }
            }
        }
    }

    /**
     * ดึงรายการวอร์ดทั้งหมดที่ user มีสิทธิ์เข้าถึงจาก Oracle
     * @param {string} username 
     * @returns {Array} รายการ placecode ที่มีสิทธิ์
     */
    async getUserPlaces(username) {
        const isReady = await this.isOracleReady();
        if (!isReady) {
            console.warn(`[Oracle Places] Oracle Database ไม่พร้อมใช้งาน - ข้าม get user places`);
            return [];
        }

        let connectionOracle;
        try {
            await this.initPool();
            connectionOracle = await this.pool.getConnection();

            const placesQuery = `
                SELECT DISTINCT pla_placecode
                FROM (
                    SELECT ur.pla_placecode
                    FROM utables u, urights ur
                    WHERE u.del_flag IS NULL
                    AND u.u_user_id = ur.uta_u_user_id
                    AND u.u_user_id = :username
                    
                    UNION
                    
                    SELECT dp.fullname pla_placecode
                    FROM doc_dbfs d, departs dp
                    WHERE d.del_flag IS NULL
                    AND d.dep_depend_on_id = dp.depend_on_id
                    AND d.prename IN ('นพ.','น.พ.','นพ','พญ.','พญ','พ.ญ')
                    AND d.doc_code = :username
                )
                ORDER BY pla_placecode
            `;

            const result = await connectionOracle.execute(placesQuery, {
                username: username
            });

            return result.rows.map(row => row[0]);

        } catch (error) {
            console.error('[Oracle Places] Error getting user places:', error.message);
            return [];
        } finally {
            if (connectionOracle) {
                try {
                    await connectionOracle.close();
                } catch (error) {
                    console.error('[Oracle Places] Error closing connection:', error.message);
                }
            }
        }
    }

    /**
     * ตรวจสอบสิทธิ์การเข้าถึงวอร์ดจาก Oracle
     * @param {string} username 
     * @param {string} placecode 
     * @returns {Object} ผลการตรวจสอบสิทธิ์
     */
    async validateWardAccess(username, placecode) {
        const isReady = await this.isOracleReady();
        if (!isReady) {
            console.warn(`[Oracle Ward] Oracle Database ไม่พร้อมใช้งาน - ข้าม ward validation`);
            throw new Error('Oracle Database ไม่พร้อมใช้งาน');
        }

        let connectionOracle;
        try {
            await this.initPool();
            connectionOracle = await this.pool.getConnection();

            // ขั้นตอนที่ 1: ตรวจสอบว่ามีสิทธิ์ SUP หรือ COM หรือไม่ (เข้าได้ทุกวอร์ด)
            const superUserQuery = `
                SELECT u.u_user_id username, ur.pla_placecode, 'SUPER_USER' as access_type
                FROM utables u, urights ur
                WHERE u.u_user_id = :username
                AND u.del_flag IS NULL
                AND u.u_user_id = ur.uta_u_user_id
                AND ur.pla_placecode IN ('SUP', 'COM')
                GROUP BY u.u_user_id, ur.pla_placecode
            `;

            const superUserResult = await connectionOracle.execute(superUserQuery, {
                username: username
            });

            // หากมีสิทธิ์ SUP หรือ COM ให้เข้าได้ทุกวอร์ด
            if (superUserResult.rows.length > 0) {
                const superUser = superUserResult.rows[0];
                console.log(`[Oracle Ward] Super user access granted for user: ${username}, privilege: ${superUser[1]}, target ward: ${placecode}`);
                
                return {
                    success: true,
                    message: `มีสิทธิ์เข้าถึงทุกวอร์ด (${superUser[1]})`,
                    username: superUser[0],
                    placecode: placecode, // ใช้ placecode ที่ต้องการเข้า
                    grantedPlacecode: superUser[1], // placecode ที่ให้สิทธิ์
                    accessType: 'SUPER_USER',
                    source: "Oracle"
                };
            }

            // ขั้นตอนที่ 2: ตรวจสอบสิทธิ์วอร์ดปกติ
            const wardAccessQuery = `
                SELECT u.u_user_id username, ur.pla_placecode
                FROM utables u, urights ur
                WHERE u.u_user_id = :username
                AND u.del_flag IS NULL
                AND u.u_user_id = ur.uta_u_user_id
                AND ur.pla_placecode IN ('3A','3B','4','5','6','NSR','ICU','SDU','SUP','COM')
                AND ur.pla_placecode = :placecode
                GROUP BY u.u_user_id, ur.pla_placecode
            `;

            const wardResult = await connectionOracle.execute(wardAccessQuery, {
                username: username,
                placecode: placecode
            });

            if (wardResult.rows.length === 0) {
                console.warn(`[Oracle Ward] Ward access denied for user: ${username}, ward: ${placecode}`);
                return {
                    success: false,
                    message: "ไม่มีสิทธิ์เข้าถึงวอร์ดนี้",
                    source: "Oracle"
                };
            }

            console.log(`[Oracle Ward] Ward access granted for user: ${username}, ward: ${placecode}`);
            return {
                success: true,
                message: "มีสิทธิ์เข้าถึงวอร์ด",
                username: wardResult.rows[0][0],
                placecode: wardResult.rows[0][1],
                accessType: 'NORMAL_USER',
                source: "Oracle"
            };

        } catch (error) {
            console.error('[Oracle Ward] Error validating ward access:', {
                username: username,
                placecode: placecode,
                error: error.message
            });
            
            // ส่ง error ไปให้ caller จัดการ fallback
            throw new Error(`Oracle ward validation failed: ${error.message}`);
        } finally {
            if (connectionOracle) {
                try {
                    await connectionOracle.close();
                } catch (error) {
                    console.error('[Oracle Ward] Error closing connection:', error.message);
                }
            }
        }
    }

    /**
     * ตรวจสอบสิทธิ์จาก Oracle เท่านั้น (ไม่ sync ข้อมูลกับ MySQL)
     * ใช้สำหรับฟังก์ชันที่ต้องการยืนยันตัวตนจาก Oracle แต่ไม่ต้องการซิงค์ข้อมูล
     * @param {string} username 
     * @param {string} decryptedPassword รหัสผ่านที่ถอดรหัสแล้ว
     * @returns {Object} ผลการตรวจสอบ
     */
    async validateOracleAuthOnly(username, decryptedPassword) {
        try {
            // ตรวจสอบ Oracle connection
            const oracleReady = await this.isOracleReady();
            if (!oracleReady) {
                return {
                    success: false,
                    message: "ระบบ Oracle Database ไม่พร้อมใช้งานขณะนี้",
                    error: "ORACLE_UNAVAILABLE",
                    details: {
                        source: "Oracle Connection",
                        suggestion: "กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ"
                    }
                };
            }

            // ตรวจสอบ username และ password จาก Oracle
            const oracleUser = await this.validateUser(username, decryptedPassword);
            if (!oracleUser) {
                return {
                    success: false,
                    message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
                    error: "INVALID_CREDENTIALS",
                    source: 'Oracle'
                };
            }

            return {
                success: true,
                message: "ตรวจสอบสิทธิ์จาก Oracle สำเร็จ",
                username: username,
                user: oracleUser,
                source: 'Oracle'
            };

        } catch (error) {
            console.error('[validateOracleAuthOnly] Error:', error.message);
            
            // ตรวจสอบประเภท Oracle error
            if (error.message.includes('TNS') || 
                error.message.includes('timeout') ||
                error.message.includes('Connection') ||
                error.message.includes('ECONNREFUSED')) {
                
                return {
                    success: false,
                    message: "ไม่สามารถเชื่อมต่อกับระบบ Oracle Database ได้",
                    error: "ORACLE_CONNECTION_ERROR",
                    details: {
                        source: "Oracle Database",
                        errorType: "Connection Failure",
                        suggestion: "กรุณาตรวจสอบการเชื่อมต่อเครือข่าย หรือติดต่อผู้ดูแลระบบ"
                    }
                };
            }

            return {
                success: false,
                message: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์",
                error: "ORACLE_ERROR",
                details: {
                    source: "Oracle Database",
                    suggestion: "กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ"
                }
            };
        }
    }
}

// สร้าง instance เดียวและ export ออกไป
const oracleService = new OracleService();

// จัดการปิด pool เมื่อแอพปิด (เช่น กด Ctrl+C)
process.on('SIGINT', async () => {
    try {
        await oracleService.closePool();
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown for Oracle:', error);
        process.exit(1);
    }
});

module.exports = oracleService; 

// เพิ่ม helper functions สำหรับ data transfer
/**
 * Helper function สำหรับ parse วันที่อย่างปลอดภัย
 * ตรวจสอบว่าข้อมูลเป็น null, undefined, หรือ empty string ก่อนใช้ moment
 */
const safeDateParse = (dateString, format = 'YYYY-MM-DD HH:mm:ss') => {
    // ตรวจสอบค่า null, undefined, empty string หรือ whitespace
    if (!dateString || 
        dateString === '' || 
        dateString === null || 
        dateString === undefined ||
        (typeof dateString === 'string' && dateString.trim() === '')) {
        return null;
    }
    
    // แปลงเป็น string และ trim whitespace
    const cleanDateString = String(dateString).trim();
    
    // ตรวจสอบอีกครั้งหลัง trim
    if (cleanDateString === '') {
        return null;
    }
    
    try {
        const momentDate = moment(cleanDateString);
        if (!momentDate.isValid()) {
            return null;
        }
        return momentDate.format(format);
    } catch (error) {
        console.warn(`safeDateParse: ไม่สามารถ parse วันที่ "${cleanDateString}":`, error.message);
        return null;
    }
};

/**
 * Helper function สำหรับเขียน log การ transfer
 */
const writeTransferLog = async (connection, logData) => {
    try {
        const insertLogSql = `
            INSERT INTO tbl_ur_transfer_logs 
            (transfer_session_id, an, transfer_type, data_type, status, oracle_records,
             inserted_count, updated_count, error_count, error_message, error_details,
             transfer_details, execution_time_ms, transferred_by, started_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await connection.execute(insertLogSql, [
            logData.sessionId,
            logData.an,
            logData.transferType,
            logData.dataType,
            logData.status,
            logData.oracleRecords || 0,
            logData.insertedCount || 0,
            logData.updatedCount || 0,
            logData.errorCount || 0,
            logData.errorMessage || null,
            logData.errorDetails ? JSON.stringify(logData.errorDetails) : null,
            logData.transferDetails ? JSON.stringify(logData.transferDetails) : null,
            logData.executionTime || null,
            logData.transferredBy || 'system',
            logData.startedAt,
            logData.completedAt || null
        ]);
    } catch (error) {
        console.error('Error writing transfer log:', error);
    }
};

/**
 * Helper function สำหรับ transfer ข้อมูล ptWard จาก Oracle มา MySQL
 * สามารถเรียกใช้จากทั้ง API และ function อื่นๆ
 * @param {string} an - รหัส AN ของผู้ป่วย
 * @param {object} mysqlConnection - MySQL connection object (required)
 * @param {string} transferBy - ผู้ทำการ transfer (default: 'system')
 * @returns {object} ผลลัพธ์การ transfer
 */
const performPtWardTransfer = async (an, mysqlConnection, transferBy = 'system') => {
    try {
        console.log(`[performPtWardTransfer] เริ่มต้น transfer ข้อมูล ptWard สำหรับ AN: ${an}`);
        
        // 1. ดึงข้อมูลจาก Oracle
        const oracleSql = `
            select ptward_no, (ipd_run_an ||'/'|| ipd_year_an) an, 
                   to_char(datetime_in,'YYYY-MM-DD HH24:MI:SS') datetime_in, 
                   to_char(datetime_out,'YYYY-MM-DD HH24:MI:SS') datetime_out,
                   bed_pla_placecode pla_placecode, bed_code, admit_flag, discharge_flag,
                   num_bed, user_created, to_char(date_created,'YYYY-MM-DD HH24:MI:SS') date_created, 
                   user_modified, to_char(date_modified,'YYYY-MM-DD HH24:MI:SS') date_modified
            from ptwards
            where (ipd_run_an ||'/'|| ipd_year_an) = :1
            order by ptward_no
        `;

        const oracleData = await oracleService.fetchDataOracle(oracleSql, [an]);

        if (!oracleData || oracleData.length === 0) {
            console.log(`[performPtWardTransfer] ไม่พบข้อมูล ptWard สำหรับ AN: ${an} ใน Oracle`);
            return {
                success: true,
                message: `ไม่พบข้อมูล ptward สำหรับ AN: ${an} ในฐานข้อมูล Oracle`,
                an: an,
                totalOracleRecords: 0,
                insertedCount: 0,
                updatedCount: 0,
                errorCount: 0,
                details: []
            };
        }

        // 2. ดึงข้อมูลที่มีอยู่แล้วใน MySQL สำหรับ AN นี้
        const mysqlCheckSql = `
            SELECT ptward_no 
            FROM tbl_ur_ptward 
            WHERE an = ? AND (deleted IS NULL OR deleted = '')
        `;
        const [existingRecords] = await mysqlConnection.execute(mysqlCheckSql, [an]);
        const existingPtwards = new Set(existingRecords.map(row => row.ptward_no.toString()));

        // 3. เตรียมตัวแปรสำหรับสถิติ
        let insertedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const details = [];

        // 4. วนลูปประมวลผลข้อมูลแต่ละรายการ
        for (const oracleRow of oracleData) {
            try {
                const ptward_no = oracleRow.PTWARD_NO.toString();
                const isExisting = existingPtwards.has(ptward_no);

                // แปลงข้อมูลจาก Oracle เป็นรูปแบบ MySQL
                const mysqlData = {
                    ptward_no: ptward_no,
                    an: oracleRow.AN,
                    datetime_in: safeDateParse(oracleRow.DATETIME_IN),
                    datetime_out: safeDateParse(oracleRow.DATETIME_OUT),
                    pla_placecode: oracleRow.PLA_PLACECODE || null,
                    pla_name: null,
                    bed_code: oracleRow.BED_CODE || null,
                    admit_flag: oracleRow.ADMIT_FLAG || null,
                    discharge_flag: oracleRow.DISCHARGE_FLAG || null
                };

                if (isExisting) {
                    // UPDATE ข้อมูลที่มีอยู่แล้ว
                    const updateSql = `
                        UPDATE tbl_ur_ptward 
                        SET an = ?, datetime_in = ?, datetime_out = ?, 
                            pla_placecode = ?, bed_code = ?, admit_flag = ?, 
                            discharge_flag = ?, userupdated = ?, dateupdated = NOW()
                        WHERE ptward_no = ? AND (deleted IS NULL OR deleted = '')
                    `;
                    await mysqlConnection.execute(updateSql, [
                        mysqlData.an, mysqlData.datetime_in, mysqlData.datetime_out,
                        mysqlData.pla_placecode, mysqlData.bed_code, mysqlData.admit_flag,
                        mysqlData.discharge_flag, transferBy, ptward_no
                    ]);
                    updatedCount++;
                    details.push({
                        ptward_no: ptward_no,
                        action: 'UPDATE',
                        status: 'SUCCESS'
                    });
                } else {
                    // INSERT ข้อมูลใหม่
                    const insertSql = `
                        INSERT INTO tbl_ur_ptward 
                        (ptward_no, an, datetime_in, datetime_out, pla_placecode, pla_name,
                         bed_code, admit_flag, discharge_flag, usercreated, datecreated)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    `;
                    await mysqlConnection.execute(insertSql, [
                        mysqlData.ptward_no, mysqlData.an, mysqlData.datetime_in,
                        mysqlData.datetime_out, mysqlData.pla_placecode, mysqlData.pla_name,
                        mysqlData.bed_code, mysqlData.admit_flag, mysqlData.discharge_flag,
                        transferBy
                    ]);
                    insertedCount++;
                    details.push({
                        ptward_no: ptward_no,
                        action: 'INSERT',
                        status: 'SUCCESS'
                    });
                }
            } catch (rowError) {
                console.error(`[performPtWardTransfer] Error processing ptward ${oracleRow.PTWARD_NO}:`, rowError.message);
                errorCount++;
                details.push({
                    ptward_no: oracleRow.PTWARD_NO.toString(),
                    action: 'ERROR',
                    error: rowError.message
                });
            }
        }

        console.log(`[performPtWardTransfer] Transfer สำเร็จ - AN: ${an}, Inserted: ${insertedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`);
        
        return {
            success: true,
            message: `Transfer ข้อมูล ptward สำหรับ AN: ${an} สำเร็จ`,
            an: an,
            totalOracleRecords: oracleData.length,
            insertedCount: insertedCount,
            updatedCount: updatedCount,
            errorCount: errorCount,
            transferBy: transferBy,
            transferAt: moment().tz("Asia/Bangkok").format('YYYY-MM-DD HH:mm:ss'),
            details: details
        };

    } catch (error) {
        console.error(`[performPtWardTransfer] Error for AN ${an}:`, error.message);
        return {
            success: false,
            message: `เกิดข้อผิดพลาดในการ transfer ข้อมูล ptward สำหรับ AN: ${an}`,
            error: error.message,
            an: an,
            totalOracleRecords: 0,
            insertedCount: 0,
            updatedCount: 0,
            errorCount: 0,
            details: []
        };
    }
};

/**
 * Helper function สำหรับ transfer ข้อมูล admission จาก Oracle มา MySQL
 * สามารถเรียกใช้จากทั้ง API และ function อื่นๆ
 * @param {string} an - รหัส AN ของผู้ป่วย
 * @param {object} mysqlConnection - MySQL connection object (required)
 * @param {string} transferBy - ผู้ทำการ transfer (default: 'system')
 * @returns {object} ผลลัพธ์การ transfer
 */
const performAdmissionTransfer = async (an, mysqlConnection, transferBy = 'system') => {
    try {
        console.log(`[performAdmissionTransfer] เริ่มต้น transfer ข้อมูล admission สำหรับ AN: ${an}`);
        
        // 1. ดึงข้อมูลจาก Oracle
        const oracleSql = `
            select (i.run_an ||'/'|| i.year_an) an, p.prename, p.name, p.surname lastname, 
                   to_char(p.birthday,'YYYY-MM-DD') birthday, p.sex, p.id_card idcard,
                   p.travel_book_no passportno, p.hn,
                   to_char(i.dateadmit,'YYYY-MM-DD') || ' ' || to_char(i.timeadmit,'HH24:MI:SS') dateadmit,
                   to_char(i.datedisch,'YYYY-MM-DD') || ' ' || to_char(i.timedisch,'HH24:MI:SS') datedisch,
                   i.admitregis userAdmit,
                   to_char(i.warddate,'YYYY-MM-DD') || ' ' || to_char(i.wardtime,'HH24:MI:SS') dateInward,
                   i.pla_placecode place, i.bed_no bed, i.prediagnos prediagnostics, 
                   i.att_doc doctorAdmit_code, i.doctordisc doctorDischarge_code, 
                   i.att_doc doctorAttending_code, i.pt_type_id patientType, i.opd_no opdno, 
                   i.age_day, i.age_month, i.age_year
            from ipdtrans i, patients p
            where (i.run_an ||'/'|| i.year_an) = :1
                and i.hn = p.hn(+)
            order by i.year_an, i.run_an
        `;

        const oracleData = await oracleService.fetchDataOracle(oracleSql, [an]);

        if (!oracleData || oracleData.length === 0) {
            console.log(`[performAdmissionTransfer] ไม่พบข้อมูล admission สำหรับ AN: ${an} ใน Oracle`);
            return {
                success: true,
                message: `ไม่พบข้อมูล admission สำหรับ AN: ${an} ในฐานข้อมูล Oracle`,
                an: an,
                totalOracleRecords: 0,
                insertedCount: 0,
                updatedCount: 0,
                errorCount: 0,
                details: []
            };
        }

        // 2. ตรวจสอบข้อมูลที่มีอยู่แล้วใน MySQL
        const mysqlCheckSql = `
            SELECT an 
            FROM tbl_ur_admissions 
            WHERE an = ? AND (deleted IS NULL OR deleted = '')
        `;
        const [existingRecords] = await mysqlConnection.execute(mysqlCheckSql, [an]);
        const isExisting = existingRecords.length > 0;

        // 3. เตรียมตัวแปรสำหรับสถิติ
        let insertedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const details = [];

        // 4. ประมวลผลข้อมูลแต่ละรายการ (ปกติจะมีแค่ 1 รายการต่อ AN)
        for (const oracleRow of oracleData) {
            try {
                // แปลงข้อมูลจาก Oracle เป็นรูปแบบ MySQL โดยใช้ safeDateParse
                const mysqlData = {
                    an: oracleRow.AN,
                    prename: oracleRow.PRENAME || null,
                    name: oracleRow.NAME || null,
                    lastName: oracleRow.LASTNAME || null,
                    birthday: safeDateParse(oracleRow.BIRTHDAY, 'YYYY-MM-DD'),
                    sex: oracleRow.SEX || null,
                    idcard: oracleRow.IDCARD || null,
                    passportno: oracleRow.PASSPORTNO || null,
                    hn: oracleRow.HN || null,
                    dateAdmit: safeDateParse(oracleRow.DATEADMIT),
                    dateDischarge: safeDateParse(oracleRow.DATEDISCH),
                    userAdmit: oracleRow.USERADMIT || null,
                    dateInward: safeDateParse(oracleRow.DATEINWARD),
                    place: oracleRow.PLACE || null,
                    bed: oracleRow.BED || null,
                    prediagnostics: oracleRow.PREDIAGNOSTICS || null,
                    doctorAdmit_code: oracleRow.DOCTORADMIT_CODE || null,
                    doctorDischarge_code: oracleRow.DOCTORDISCHARGE_CODE || null,
                    doctorAttending_code: oracleRow.DOCTORATTENDING_CODE || null,
                    patientType: oracleRow.PATIENTTYPE || null,
                    opdno: oracleRow.OPDNO || null,
                    age_day: oracleRow.AGE_DAY || null,
                    age_month: oracleRow.AGE_MONTH || null,
                    age_year: oracleRow.AGE_YEAR || null,
                    lastAdmitAt: null // จะค่อยกำหนดทีหลังหรือคำนวณจากข้อมูลอื่น
                };

                if (isExisting) {
                    // UPDATE ข้อมูลที่มีอยู่แล้ว
                    const updateSql = `
                        UPDATE tbl_ur_admissions 
                        SET prename = ?, name = ?, lastName = ?, birthday = ?, sex = ?, 
                            idcard = ?, passportno = ?, hn = ?, dateAdmit = ?, dateDischarge = ?,
                            userAdmit = ?, dateInward = ?, place = ?, bed = ?, prediagnostics = ?,
                            doctorAdmit_code = ?, doctorDischarge_code = ?, doctorAttending_code = ?,
                            patientType = ?, opdno = ?, age_day = ?, age_month = ?, age_year = ?,
                            lastAdmitAt = ?, userupdated = ?, dateupdated = NOW()
                        WHERE an = ? AND (deleted IS NULL OR deleted = '')
                    `;
                    await mysqlConnection.execute(updateSql, [
                        mysqlData.prename, mysqlData.name, mysqlData.lastName, mysqlData.birthday, mysqlData.sex,
                        mysqlData.idcard, mysqlData.passportno, mysqlData.hn, mysqlData.dateAdmit, mysqlData.dateDischarge,
                        mysqlData.userAdmit, mysqlData.dateInward, mysqlData.place, mysqlData.bed, mysqlData.prediagnostics,
                        mysqlData.doctorAdmit_code, mysqlData.doctorDischarge_code, mysqlData.doctorAttending_code,
                        mysqlData.patientType, mysqlData.opdno, mysqlData.age_day, mysqlData.age_month, mysqlData.age_year,
                        mysqlData.lastAdmitAt, transferBy, an
                    ]);
                    updatedCount++;
                    details.push({
                        an: an,
                        action: 'UPDATE',
                        status: 'SUCCESS'
                    });
                } else {
                    // INSERT ข้อมูลใหม่
                    const insertSql = `
                        INSERT INTO tbl_ur_admissions 
                        (an, prename, name, lastName, birthday, sex, idcard, passportno, hn,
                         dateAdmit, dateDischarge, userAdmit, dateInward, place, bed, prediagnostics,
                         doctorAdmit_code, doctorDischarge_code, doctorAttending_code, patientType,
                         opdno, age_day, age_month, age_year, lastAdmitAt, usercreated, datecreated)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    `;
                    await mysqlConnection.execute(insertSql, [
                        mysqlData.an, mysqlData.prename, mysqlData.name, mysqlData.lastName, mysqlData.birthday, mysqlData.sex,
                        mysqlData.idcard, mysqlData.passportno, mysqlData.hn, mysqlData.dateAdmit, mysqlData.dateDischarge,
                        mysqlData.userAdmit, mysqlData.dateInward, mysqlData.place, mysqlData.bed, mysqlData.prediagnostics,
                        mysqlData.doctorAdmit_code, mysqlData.doctorDischarge_code, mysqlData.doctorAttending_code, mysqlData.patientType,
                        mysqlData.opdno, mysqlData.age_day, mysqlData.age_month, mysqlData.age_year, mysqlData.lastAdmitAt, transferBy
                    ]);
                    insertedCount++;
                    details.push({
                        an: an,
                        action: 'INSERT',
                        status: 'SUCCESS'
                    });
                }
            } catch (rowError) {
                console.error(`[performAdmissionTransfer] Error processing admission AN ${oracleRow.AN}:`, rowError.message);
                errorCount++;
                details.push({
                    an: oracleRow.AN,
                    action: 'ERROR',
                    status: 'FAILED',
                    error: rowError.message
                });
            }
        }

        console.log(`[performAdmissionTransfer] Transfer สำเร็จ - AN: ${an}, Inserted: ${insertedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`);
        
        return {
            success: true,
            message: `Transfer ข้อมูล admission สำหรับ AN: ${an} สำเร็จ`,
            an: an,
            totalOracleRecords: oracleData.length,
            insertedCount: insertedCount,
            updatedCount: updatedCount,
            errorCount: errorCount,
            transferBy: transferBy,
            transferAt: moment().tz("Asia/Bangkok").format('YYYY-MM-DD HH:mm:ss'),
            details: details
        };

    } catch (error) {
        console.error(`[performAdmissionTransfer] Error for AN ${an}:`, error.message);
        return {
            success: false,
            message: `เกิดข้อผิดพลาดในการ transfer ข้อมูล admission สำหรับ AN: ${an}`,
            error: error.message,
            an: an,
            totalOracleRecords: 0,
            insertedCount: 0,
            updatedCount: 0,
            errorCount: 0,
            details: []
        };
    }
};

/**
 * Helper function สำหรับทำ complete transfer (ใช้ภายใน auto transfer)
 * Transfer ทั้ง ptWard และ admission data ในการเรียกครั้งเดียว
 * @param {string} an - รหัส AN ของผู้ป่วย
 * @param {object} mysqlConnection - MySQL connection object (required)
 * @param {string} sessionId - Session ID สำหรับ tracking
 * @param {string} transferBy - ผู้ทำการ transfer (default: 'auto-system')
 * @returns {object} ผลลัพธ์การ transfer
 */
const performAutoTransferFromOracleToMySQL = async (an, mysqlConnection, sessionId = null, transferBy = 'auto-system') => {
    try {
        // ตรวจสอบ Oracle availability ก่อน
        const isOracleReady = await oracleService.isOracleReady();
        if (!isOracleReady) {
            console.warn(`[${sessionId}] Oracle Database ไม่พร้อมใช้งาน - ข้าม transfer สำหรับ AN: ${an}`);
            return {
                success: false,
                totalOracleRecords: 0,
                totalInserted: 0,
                totalUpdated: 0,
                totalErrors: 0,
                skipped: true,
                error: "Oracle Database ไม่พร้อมใช้งาน - ข้าม transfer operation"
            };
        }
        
        // ตัวแปรสำหรับเก็บผลลัพธ์
        const results = {
            ptward: { totalOracleRecords: 0, insertedCount: 0, updatedCount: 0, errorCount: 0, details: [] },
            admission: { totalOracleRecords: 0, insertedCount: 0, updatedCount: 0, errorCount: 0, details: [] }
        };
        
        // ========================= PART 1: Transfer PtWard Data =========================
        try {
            console.log(`[${sessionId}] เริ่มต้น transfer ptWard สำหรับ AN: ${an}`);
            const ptWardResult = await performPtWardTransfer(an, mysqlConnection, transferBy);
            
            // แปลงผลลัพธ์จาก helper function มาใส่ใน results
            results.ptward.totalOracleRecords = ptWardResult.totalOracleRecords;
            results.ptward.insertedCount = ptWardResult.insertedCount;
            results.ptward.updatedCount = ptWardResult.updatedCount;
            results.ptward.errorCount = ptWardResult.errorCount;
            results.ptward.details = ptWardResult.details || [];
            
            if (!ptWardResult.success) {
                console.error(`[${sessionId}] PtWard transfer failed: ${ptWardResult.message}`);
            }
        } catch (ptwardError) {
            console.error(`[${sessionId}] PtWard transfer error:`, ptwardError.message);
            results.ptward.errorCount++;
            results.ptward.details.push({ action: 'ERROR', error: ptwardError.message });
        }
        
        // ========================= PART 2: Transfer Admission Data =========================
        try {
            console.log(`[${sessionId}] เริ่มต้น transfer admission สำหรับ AN: ${an}`);
            const admissionResult = await performAdmissionTransfer(an, mysqlConnection, transferBy);
            
            // แปลงผลลัพธ์จาก helper function มาใส่ใน results
            results.admission.totalOracleRecords = admissionResult.totalOracleRecords;
            results.admission.insertedCount = admissionResult.insertedCount;
            results.admission.updatedCount = admissionResult.updatedCount;
            results.admission.errorCount = admissionResult.errorCount;
            results.admission.details = admissionResult.details || [];
            
            if (!admissionResult.success) {
                console.error(`[${sessionId}] Admission transfer failed: ${admissionResult.message}`);
            }
        } catch (admissionError) {
            console.error(`[${sessionId}] Admission transfer error:`, admissionError.message);
            results.admission.errorCount++;
            results.admission.details.push({ action: 'ERROR', error: admissionError.message });
        }
        
        const totalOracleRecords = results.ptward.totalOracleRecords + results.admission.totalOracleRecords;
        const totalInserted = results.ptward.insertedCount + results.admission.insertedCount;
        const totalUpdated = results.ptward.updatedCount + results.admission.updatedCount;
        const totalErrors = results.ptward.errorCount + results.admission.errorCount;
        
        // ถือว่าสำเร็จถ้ามีการ insert หรือ update ได้บ้าง หรือไม่มี error ร้าวแรง
        const hasSuccessfulOperations = totalInserted > 0 || totalUpdated > 0;
        const isSuccess = hasSuccessfulOperations || (totalErrors === 0 && totalOracleRecords === 0);
        
        return {
            success: isSuccess,
            totalOracleRecords,
            totalInserted,
            totalUpdated,
            totalErrors,
            details: results,
            error: totalErrors > 0 ? `${totalErrors} warnings/errors occurred during transfer` : null
        };
        
    } catch (error) {
        return {
            success: false,
            totalOracleRecords: 0,
            totalInserted: 0,
            totalUpdated: 0,
            totalErrors: 1,
            error: error.message
        };
    }
};

// Export helper functions สำหรับใช้งานใน controller อื่น
module.exports.safeDateParse = safeDateParse;
module.exports.writeTransferLog = writeTransferLog;
module.exports.performPtWardTransfer = performPtWardTransfer;
module.exports.performAdmissionTransfer = performAdmissionTransfer;
module.exports.performAutoTransferFromOracleToMySQL = performAutoTransferFromOracleToMySQL; 