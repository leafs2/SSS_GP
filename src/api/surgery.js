// surgery.js
// 手術排程相關的 API 端點

import express from "express";
import { requireAuth } from "./middleware/checkAuth.js";

const router = express.Router();

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

/**
 * POST /api/surgery
 * 新增手術排程
 * 需要登入且為醫師角色
 */
router.post("/", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const employeeId = req.session.user.employee_id;
    const userRole = req.session.user.role;

    // 檢查是否為醫師
    if (userRole !== "D") {
      return res.status(403).json({
        success: false,
        error: "權限不足",
        message: "只有醫師可以新增手術排程",
      });
    }

    const {
      patientId,
      assistantDoctorId,
      surgeryTypeCode,
      surgeryRoomType,
      surgeryDate,
      duration,
      nurseCount,
    } = req.body;

    // 驗證必填欄位
    if (
      !patientId ||
      !surgeryTypeCode ||
      !surgeryRoomType ||
      !surgeryDate ||
      !duration ||
      !nurseCount
    ) {
      return res.status(400).json({
        success: false,
        error: "缺少必填欄位",
        message: "請填寫所有必填欄位",
      });
    }

    await client.query("BEGIN");

    // 1. 取得手術室類型代碼
    const roomTypeResult = await client.query(
      `SELECT type_code FROM surgery_room_type WHERE type = $1`,
      [surgeryRoomType]
    );

    if (roomTypeResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: "無效的手術室類型",
      });
    }

    const roomTypeCode = roomTypeResult.rows[0].type_code;

    // 2. 格式化手術日期為 YYMMDD
    const date = new Date(surgeryDate);
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const datePrefix = `${year}${month}${day}`;

    // 3. 取得當日該手術室類型的流水號
    const sequenceResult = await client.query(
      `SELECT surgery_id 
       FROM surgery 
       WHERE surgery_id LIKE $1
       ORDER BY surgery_id DESC 
       LIMIT 1`,
      [`${datePrefix}${roomTypeCode}%`]
    );

    let sequenceNumber = 1;
    if (sequenceResult.rows.length > 0) {
      const lastSurgeryId = sequenceResult.rows[0].surgery_id;
      const lastSequence = parseInt(lastSurgeryId.slice(-3));
      sequenceNumber = lastSequence + 1;
    }

    // 4. 生成完整的 surgery_id
    const surgeryId = `${datePrefix}${roomTypeCode}${sequenceNumber
      .toString()
      .padStart(3, "0")}`;

    // 5. 取得下一個 id (因為 id 不是 auto increment)
    const maxIdResult = await client.query(
      `SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM surgery`
    );
    const nextId = maxIdResult.rows[0].next_id;

    // 6. 插入手術記錄
    const insertResult = await client.query(
      `INSERT INTO surgery (
        id,
        surgery_id,
        doctor_id,
        assistant_doctor_id,
        surgery_type_code,
        patient_id,
        surgery_room_type,
        surgery_date,
        duration,
        nurse_count,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        nextId,
        surgeryId,
        employeeId,
        assistantDoctorId || null,
        surgeryTypeCode,
        patientId,
        surgeryRoomType,
        surgeryDate,
        duration,
        nurseCount,
      ]
    );

    await client.query("COMMIT");

    console.log("✅ 手術排程新增成功:", surgeryId);

    res.status(201).json({
      success: true,
      message: "手術排程新增成功",
      data: {
        surgery: insertResult.rows[0],
        surgeryId: surgeryId,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("新增手術排程失敗:", error);
    res.status(500).json({
      success: false,
      error: "新增手術排程失敗",
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/surgery/:surgeryId
 * 查詢特定手術排程
 */
router.get("/:surgeryId", requireAuth, async (req, res) => {
  try {
    const { surgeryId } = req.params;

    const result = await pool.query(
      `SELECT 
        s.*,
        p.name as patient_name,
        d.name as doctor_name,
        ad.name as assistant_doctor_name,
        st.surgery_name
      FROM surgery s
      LEFT JOIN patient p ON s.patient_id = p.patient_id
      LEFT JOIN employees d ON s.doctor_id = d.employee_id
      LEFT JOIN employees ad ON s.assistant_doctor_id = ad.employee_id
      LEFT JOIN surgery_type_code st ON s.surgery_type_code = st.surgery_code
      WHERE s.surgery_id = $1`,
      [surgeryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "找不到該手術排程",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("查詢手術排程失敗:", error);
    res.status(500).json({
      success: false,
      error: "查詢手術排程失敗",
      message: error.message,
    });
  }
});

export default router;
