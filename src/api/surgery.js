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
 * GET /api/surgery/pending/list
 * 獲取待排程手術清單
 * 可選參數: startDate, endDate (用於篩選特定週的手術)
 */
router.get("/pending/list", requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        s.id,
        s.surgery_id,
        s.doctor_id,
        s.assistant_doctor_id,
        s.surgery_type_code,
        s.patient_id,
        s.surgery_room_type,
        s.surgery_date,
        s.duration,
        s.nurse_count,
        s.created_at,
        p.name as patient_name,
        p.id_number as patient_id_number,
        d.name as doctor_name,
        ad.name as assistant_doctor_name,
        st.surgery_name,
        st.main_subjects,
        dept.name as department_name,
        srt.type_info as room_type_info
      FROM surgery s
      LEFT JOIN patient p ON s.patient_id = p.patient_id
      LEFT JOIN employees d ON s.doctor_id = d.employee_id
      LEFT JOIN employees ad ON s.assistant_doctor_id = ad.employee_id
      LEFT JOIN surgery_type_code st ON s.surgery_type_code = st.surgery_code
      LEFT JOIN departments dept ON st.main_subjects = dept.code
      LEFT JOIN surgery_room_type srt ON s.surgery_room_type = srt.type
      WHERE NOT EXISTS (
        SELECT 1 FROM surgery_correct_time sct 
        WHERE sct.surgery_id = s.surgery_id
      )
    `;

    const params = [];

    // 如果有指定日期範圍,加入篩選條件
    if (startDate && endDate) {
      query += ` AND s.surgery_date >= $1 AND s.surgery_date <= $2`;
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ` AND s.surgery_date >= $1`;
      params.push(startDate);
    } else if (endDate) {
      query += ` AND s.surgery_date <= $1`;
      params.push(endDate);
    }

    query += ` ORDER BY s.surgery_date ASC, s.created_at ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("獲取待排程手術清單失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取待排程手術清單失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/surgery/pending/count
 * 獲取待排程手術數量（按週分組）
 */
router.get("/pending/count", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        DATE_TRUNC('week', s.surgery_date) as week_start,
        COUNT(*) as count
      FROM surgery s
      WHERE NOT EXISTS (
        SELECT 1 FROM surgery_correct_time sct 
        WHERE sct.surgery_id = s.surgery_id
      )
      GROUP BY DATE_TRUNC('week', s.surgery_date)
      ORDER BY week_start
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("獲取待排程數量失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取待排程數量失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/surgery/today/list
 * 獲取今日手術列表 (包含排程資訊與實際執行時間)
 */
router.get("/today/list", requireAuth, async (req, res) => {
  try {
    const { employee_id, role } = req.session.user;

    let sql = `
      SELECT 
        s.surgery_id,
        s.status,
        s.duration as estimated_duration_hours,
        p.name as patient_name,
        st.surgery_name,
        sct.room_id,
        (s.surgery_date + sct.start_time) as scheduled_start_time,
        
        -- 實際時間維持轉為 UTC 輸出，確保前端計算正確
        sct.actual_start_time AT TIME ZONE 'UTC' as actual_start_time,
        sct.actual_end_time AT TIME ZONE 'UTC' as actual_end_time,
        
        COALESCE(sct.extension_minutes, 0) as extension_minutes
      FROM surgery s
      JOIN patient p ON s.patient_id = p.patient_id
      JOIN surgery_type_code st ON s.surgery_type_code = st.surgery_code
      JOIN surgery_correct_time sct ON s.surgery_id = sct.surgery_id
      
      -- [修正重點] 強制轉換為台北時間來判斷日期
      WHERE s.surgery_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date
    `;

    const params = [];

    if (role === "D") {
      sql += ` AND s.doctor_id = $1`;
      params.push(employee_id);
    } else if (role === "A") {
      sql += ` AND s.assistant_doctor_id = $1`;
      params.push(employee_id);
    } else if (role === "N") {
      sql += ` AND sct.room_id IN (SELECT surgery_room_id FROM nurse_schedule WHERE employee_id = $1)`;
      params.push(employee_id);
    }

    sql += ` ORDER BY sct.start_time ASC`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("獲取今日手術失敗:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/surgery/monthly
 * 獲取個人月排程 (根據角色區分資料來源)
 * Query: ?year=2023&month=12
 *
 * 🔧 已修改：加入助手醫師和護理師資料
 */
router.get("/monthly", requireAuth, async (req, res) => {
  try {
    const { employee_id, role } = req.session.user;
    const { year, month } = req.query;

    if (!year || !month) {
      return res
        .status(400)
        .json({ success: false, message: "請提供年份與月份" });
    }

    let sql = `
      SELECT 
        s.id,
        s.surgery_id,
        s.status,
        s.surgery_date,
        s.duration as estimated_duration,
        p.name as patient_name,
        p.gender as patient_gender,
        p.birth_date,
        st.surgery_name,
        sct.room_id,
        (s.surgery_date + sct.start_time) as start_time_full,
        (s.surgery_date + sct.end_time) as end_time_full,
        -- 加入主刀醫師名稱
        d.name as doctor_name,
        -- 加入助手醫師名稱
        ad.name as assistant_doctor_name
      FROM surgery s
      JOIN patient p ON s.patient_id = p.patient_id
      JOIN surgery_type_code st ON s.surgery_type_code = st.surgery_code
      LEFT JOIN surgery_correct_time sct ON s.surgery_id = sct.surgery_id
      LEFT JOIN employees d ON s.doctor_id = d.employee_id
      LEFT JOIN employees ad ON s.assistant_doctor_id = ad.employee_id
      WHERE EXTRACT(YEAR FROM s.surgery_date) = $1 
      AND EXTRACT(MONTH FROM s.surgery_date) = $2
    `;

    const params = [year, month];

    // --- 角色過濾邏輯 ---
    if (role === "D") {
      sql += ` AND s.doctor_id = $3`;
      params.push(employee_id);
    } else if (role === "A") {
      sql += ` AND s.assistant_doctor_id = $3`;
      params.push(employee_id);
    } else if (role === "N") {
      sql += ` 
        AND (
          -- 情況1: 固定護理師 - 該護理師被分配到該手術房，且當天沒休假
          (
            sct.room_id IN (
              SELECT surgery_room_id 
              FROM nurse_schedule 
              WHERE employee_id = $3
            )
            AND NOT EXISTS (
              SELECT 1 FROM nurse_dayoff nd
              WHERE nd.id = $3 
              AND nd.day_off = (
                CASE EXTRACT(DOW FROM s.surgery_date)
                  WHEN 0 THEN 7  -- 週日
                  ELSE EXTRACT(DOW FROM s.surgery_date)::integer
                END
              )
            )
          )
          OR
          -- 情況2: 流動護理師 - 根據星期幾查 nurse_float
          EXISTS (
            SELECT 1 FROM nurse_float nf
            WHERE nf.employee_id = $3
            AND (
              (EXTRACT(DOW FROM s.surgery_date) = 0 AND nf.sun = sct.room_id) OR
              (EXTRACT(DOW FROM s.surgery_date) = 1 AND nf.mon = sct.room_id) OR
              (EXTRACT(DOW FROM s.surgery_date) = 2 AND nf.tues = sct.room_id) OR
              (EXTRACT(DOW FROM s.surgery_date) = 3 AND nf.wed = sct.room_id) OR
              (EXTRACT(DOW FROM s.surgery_date) = 4 AND nf.thu = sct.room_id) OR
              (EXTRACT(DOW FROM s.surgery_date) = 5 AND nf.fri = sct.room_id) OR
              (EXTRACT(DOW FROM s.surgery_date) = 6 AND nf.sat = sct.room_id)
            )
          )
        )
      `;
      params.push(employee_id);
    }

    sql += ` ORDER BY s.surgery_date ASC, sct.start_time ASC`;

    const result = await pool.query(sql, params);

    // 為每個手術查詢分配的護理師（固定 + 流動）
    const surgeriesWithNurses = await Promise.all(
      result.rows.map(async (surgery) => {
        if (
          !surgery.room_id ||
          !surgery.surgery_date ||
          !surgery.start_time_full
        ) {
          return { ...surgery, nurses: [] };
        }

        // 1. 判斷手術時間屬於哪個班別
        const surgeryStart = new Date(surgery.start_time_full);
        const hour = surgeryStart.getHours();

        let schedulingTime;
        if (hour >= 8 && hour < 16) {
          schedulingTime = "早班";
        } else if (hour >= 16 && hour < 24) {
          schedulingTime = "晚班";
        } else {
          schedulingTime = "大夜班";
        }

        // 2. 計算是星期幾 (0=週日, 1=週一, ..., 6=週六)
        const surgeryDate = new Date(surgery.surgery_date);
        const dayOfWeek = surgeryDate.getDay(); // 0-6

        // 轉換為資料庫的 day_off 格式 (1=週一, 7=週日)
        const dayOffId = dayOfWeek === 0 ? 7 : dayOfWeek;

        // 轉換為 nurse_float 的欄位名稱
        const dayColumns = ["sun", "mon", "tues", "wed", "thu", "fri", "sat"];
        const dayColumn = dayColumns[dayOfWeek];

        // 3. 查詢固定護理師（排除當天休假的）
        const fixedNursesQuery = `
          SELECT DISTINCT
            e.employee_id,
            e.name,
            'fixed' as nurse_type
          FROM nurse_schedule ns
          JOIN employees e ON ns.employee_id = e.employee_id
          WHERE ns.surgery_room_id = $1
            AND ns.scheduling_time = $2
            AND e.status = 'active'
            -- 排除當天休假的護理師
            AND NOT EXISTS (
              SELECT 1 FROM nurse_dayoff nd
              WHERE nd.id = e.employee_id AND nd.day_off = $3
            )
          ORDER BY e.name
        `;

        const fixedNurses = await pool.query(fixedNursesQuery, [
          surgery.room_id,
          schedulingTime,
          dayOffId,
        ]);

        // 4. 查詢流動護理師（當天分配到該手術房的）
        const floatNursesQuery = `
          SELECT DISTINCT
            e.employee_id,
            e.name,
            'float' as nurse_type
          FROM nurse_float nf
          JOIN nurse_schedule ns ON nf.employee_id = ns.employee_id
          JOIN employees e ON nf.employee_id = e.employee_id
          WHERE nf.${dayColumn} = $1
            AND ns.scheduling_time = $2
            AND e.status = 'active'
          ORDER BY e.name
        `;

        const floatNurses = await pool.query(floatNursesQuery, [
          surgery.room_id,
          schedulingTime,
        ]);

        // 5. 合併固定和流動護理師
        const allNurses = [...fixedNurses.rows, ...floatNurses.rows];

        return {
          ...surgery,
          nurses: allNurses,
        };
      })
    );

    res.json({
      success: true,
      data: surgeriesWithNurses,
    });
  } catch (error) {
    console.error("獲取月排程失敗:", error);
    res.status(500).json({ success: false, message: error.message });
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

/**
 * POST /api/surgery/:surgeryId/start
 * 啟動手術 (紀錄實際開始時間)
 */
router.post("/:surgeryId/start", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { surgeryId } = req.params;
    await client.query("BEGIN");

    // 1. 更新 surgery 狀態
    await client.query(
      `UPDATE surgery SET status = 'in-progress' WHERE surgery_id = $1`,
      [surgeryId]
    );

    // 2. 更新 surgery_correct_time 實際開始時間
    await client.query(
      `UPDATE surgery_correct_time 
       SET actual_start_time = CURRENT_TIMESTAMP 
       WHERE surgery_id = $1`,
      [surgeryId]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "手術已啟動" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("啟動手術失敗:", error);
    res.status(500).json({ success: false, message: "啟動手術失敗" });
  } finally {
    client.release();
  }
});

/**
 * POST /api/surgery/:surgeryId/extend
 * 延長手術時間 (預設增加 30 分鐘)
 */
router.post("/:surgeryId/extend", requireAuth, async (req, res) => {
  try {
    const { surgeryId } = req.params;
    const { minutes } = req.body; // 前端傳來 30

    await pool.query(
      `UPDATE surgery_correct_time 
       SET extension_minutes = COALESCE(extension_minutes, 0) + $2
       WHERE surgery_id = $1`,
      [surgeryId, minutes || 30]
    );

    res.json({ success: true, message: "手術時間已延長" });
  } catch (error) {
    console.error("延長手術失敗:", error);
    res.status(500).json({ success: false, message: "延長手術失敗" });
  }
});

/**
 * POST /api/surgery/:surgeryId/finish
 * 結束手術 (紀錄實際結束時間)
 */
router.post("/:surgeryId/finish", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { surgeryId } = req.params;
    await client.query("BEGIN");

    // 1. 更新 surgery 狀態
    await client.query(
      `UPDATE surgery SET status = 'completed' WHERE surgery_id = $1`,
      [surgeryId]
    );

    // 2. 更新 surgery_correct_time 實際結束時間
    await client.query(
      `UPDATE surgery_correct_time 
       SET actual_end_time = CURRENT_TIMESTAMP 
       WHERE surgery_id = $1`,
      [surgeryId]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "手術已結束" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("結束手術失敗:", error);
    res.status(500).json({ success: false, message: "結束手術失敗" });
  } finally {
    client.release();
  }
});

export default router;
