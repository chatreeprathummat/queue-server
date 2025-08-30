const ManagementDB = require("../services/ManagementDB");

/**
 * 📌 แปลง `Date` เป็น `YYYY-MM-DD HH:mm:ss` เพื่อใช้ในฐานข้อมูล
 * @param {Date} dateTime - Object Date ที่ต้องการฟอร์แมต
 * @returns {string} วันที่และเวลาที่ถูกต้อง (YYYY-MM-DD HH:mm:ss)
 */
function formatDateTime(dateTime) {
    if (!dateTime) return null;
    const pad = (num) => num.toString().padStart(2, "0");

    const year = dateTime.getFullYear();
    const month = pad(dateTime.getMonth() + 1); // getMonth() เริ่มจาก 0
    const day = pad(dateTime.getDate());
    const hours = pad(dateTime.getHours());
    const minutes = pad(dateTime.getMinutes());
    const seconds = pad(dateTime.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 📌 ดึงวันที่ (`date`), เวลา (`time`) และ `datetime` จากฐานข้อมูล
 * @returns {Promise<{ datetime: string, date: string, time: string }>} วันที่และเวลาในฐานข้อมูล
 */
async function getCurrentDateTimeFromDB() {
    const DB = new ManagementDB();
    let connection = null;
    
    try {
        connection = await DB.getConnection();
        // ✅ ดึงวัน-เวลาปัจจุบันจากฐานข้อมูล
        const [result] = await connection.query("SELECT NOW() AS current_datetime");

        if (!result || result.length === 0 || !result[0].current_datetime) {
            throw new Error("ไม่พบข้อมูลวันที่จากฐานข้อมูล");
        }

                // ✅ แปลง `string` เป็น `Date` Object ทันที
                const dateTime = new Date(result[0].current_datetime);

                return { 
                    currentDate: dateTime.toISOString().split("T")[0], // YYYY-MM-DD
                    currentTime: dateTime.toTimeString().split(" ")[0], // HH:mm:ss
                    currentDateTime: dateTime // ✅ คืนค่าเป็น `Date` Object
                };
    } catch (error) {
        console.error("❌ Error fetching current datetime:", error);
        throw new Error("Cannot fetch current datetime from database");
    } finally {
        if (connection) {
            await ManagementDB.safeRelease(connection, 'getCurrentDateTimeFromDB');
        }
    }
}

module.exports = {
    getCurrentDateTimeFromDB,
    formatDateTime
};
