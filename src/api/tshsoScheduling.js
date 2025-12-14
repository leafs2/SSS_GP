// src/api/tshsoScheduling.js
// 手術排程 API (Node.js Express) - 完整版

import express from "express";
import { requireAuth } from "./middleware/checkAuth.js";

const router = express.Router();

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

// 記錄最後排程時間
let lastScheduleTime = null;

/**
 * 核心邏輯：執行排程運算
 * @param {Object} date_range - 可選，日期範圍 {start, end}
 * @returns {Object} 排程結果
 */
const executeSchedulingLogic = async (date_range = null) => {
  const globalStart = Date.now();
  console.log(
    `\n[TS-HSO] 開始執行排程核心邏輯... Time: ${new Date().toISOString()}`
  );

  try {
    // --- Step 1: 資料讀取 ---
    const step1Start = Date.now();
    console.log("[TS-HSO] 步驟 1/5: 讀取資料庫...");

    const surgeriesQuery = `
      SELECT 
        surgery_id, doctor_id, assistant_doctor_id,
        surgery_type_code, patient_id, surgery_room_type,
        surgery_date, duration, nurse_count
      FROM surgery
      WHERE status = 'pending'
      ${date_range ? "AND surgery_date BETWEEN $1 AND $2" : ""}
      ORDER BY surgery_date, created_at
    `;

    const surgeriesResult = date_range
      ? await pool.query(surgeriesQuery, [date_range.start, date_range.end])
      : await pool.query(surgeriesQuery);

    if (surgeriesResult.rows.length === 0) {
      console.log("[TS-HSO] 無待排程手術，流程結束。");
      return {
        success: true,
        message: "沒有待排程的手術",
        data: [],
        statistics: {},
        failed_surgeries: [],
      };
    }

    const roomsResult = await pool.query(`
      SELECT id, room_type, nurse_count, 
             morning_shift, night_shift, graveyard_shift
      FROM surgery_room
      WHERE room_type != 'RE'
      ORDER BY id
    `);

    const existingSchedulesResult = await pool.query(`
      SELECT 
        sct.surgery_id, 
        sct.room_id, 
        s.surgery_date,
        sct.start_time, 
        sct.end_time, 
        sct.cleanup_end_time
      FROM surgery_correct_time sct
      JOIN surgery s ON sct.surgery_id = s.surgery_id
      WHERE s.surgery_date >= CURRENT_DATE
    `);

    console.log(`[TS-HSO] 資料讀取完成 (耗時 ${Date.now() - step1Start}ms)`);

    // --- Step 2: 資料序列化 ---
    const serializedSurgeries = surgeriesResult.rows.map((s) => ({
      surgery_id: s.surgery_id,
      doctor_id: s.doctor_id,
      assistant_doctor_id: s.assistant_doctor_id || null,
      surgery_type_code: s.surgery_type_code,
      patient_id: s.patient_id,
      surgery_room_type: s.surgery_room_type,
      surgery_date:
        s.surgery_date instanceof Date
          ? s.surgery_date.toISOString().split("T")[0]
          : s.surgery_date,
      duration: parseFloat(s.duration),
      nurse_count: parseInt(s.nurse_count),
    }));

    const serializedRooms = roomsResult.rows.map((r) => ({
      id: r.id,
      room_type: r.room_type,
      nurse_count: parseInt(r.nurse_count),
      morning_shift: Boolean(r.morning_shift),
      night_shift: Boolean(r.night_shift),
      graveyard_shift: Boolean(r.graveyard_shift),
    }));

    const serializedSchedules = existingSchedulesResult.rows.map((s) => ({
      surgery_id: s.surgery_id,
      room_id: s.room_id,
      scheduled_date:
        s.surgery_date instanceof Date
          ? s.surgery_date.toISOString().split("T")[0]
          : s.surgery_date,
      start_time:
        typeof s.start_time === "string"
          ? s.start_time
          : s.start_time.toString(),
      end_time:
        typeof s.end_time === "string" ? s.end_time : s.end_time.toString(),
      cleanup_end_time:
        typeof s.cleanup_end_time === "string"
          ? s.cleanup_end_time
          : s.cleanup_end_time.toString(),
    }));

    // --- Step 3: 呼叫演算法 ---
    const algoStart = Date.now();
    console.log("[TS-HSO] 步驟 2/5: 呼叫 Python 演算法服務...");

    const pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
    const pythonResponse = await fetch(
      `${pythonServiceUrl}/api/scheduling/trigger`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surgeries: serializedSurgeries,
          available_rooms: serializedRooms,
          existing_schedules: serializedSchedules,
          config: {
            ga_generations: 100,
            ga_population: 50,
            ahp_weights: {
              duration: 0.4,
              fragment: 0.3,
              doctor: 0.2,
              waiting: 0.1,
            },
          },
        }),
      }
    );

    if (!pythonResponse.ok) {
      const error = await pythonResponse.json();
      throw new Error(error.detail || "Python 服務執行失敗");
    }

    const pythonResult = await pythonResponse.json();
    console.log(`[TS-HSO] 演算法計算完成 (耗時 ${Date.now() - algoStart}ms)`);

    // --- Step 4: 記錄分配結果明細 ---
    console.log("[TS-HSO] 步驟 3/5: 分配結果明細:");
    pythonResult.results.forEach((res, index) => {
      console.log(
        `         ${index + 1}. [${res.surgery_id}] -> 房:${
          res.room_id
        } | 時間:${res.start_time}~${
          res.end_time
        } | AHP分數:${res.ahp_score?.toFixed(2)}`
      );
    });

    // --- Step 5: 寫入資料庫 ---
    const dbStart = Date.now();
    console.log("[TS-HSO] 步驟 4/5: 寫入資料庫交易...");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const result of pythonResult.results) {
        await client.query(
          `
          INSERT INTO surgery_correct_time 
          (surgery_id, room_id, start_time, end_time, cleanup_end_time)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (surgery_id) 
          DO UPDATE SET
            room_id = EXCLUDED.room_id,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            cleanup_end_time = EXCLUDED.cleanup_end_time
        `,
          [
            result.surgery_id,
            result.room_id,
            result.start_time,
            result.end_time,
            result.cleanup_end_time,
          ]
        );

        await client.query(
          `UPDATE surgery SET status = 'scheduled' WHERE surgery_id = $1`,
          [result.surgery_id]
        );
      }

      await client.query("COMMIT");
      console.log(`[TS-HSO] 資料庫寫入完成 (耗時 ${Date.now() - dbStart}ms)`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[TS-HSO] 資料庫寫入失敗，交易已 rollback");
      throw error;
    } finally {
      client.release();
    }

    const totalDuration = Date.now() - globalStart;
    console.log(`[TS-HSO] 🏁 流程結束。總耗時: ${totalDuration}ms`);

    // ✅ 更新最後排程時間
    lastScheduleTime = new Date();

    return {
      success: true,
      message: `排程完成，成功排定 ${pythonResult.results.length} 台手術`,
      data: pythonResult.results,
      statistics: pythonResult.statistics,
      failed_surgeries: pythonResult.failed_surgeries,
      duration: totalDuration,
      timestamp: lastScheduleTime,
    };
  } catch (error) {
    console.error(`[TS-HSO] 排程核心邏輯錯誤: ${error.message}`);
    throw error; // 拋出錯誤讓呼叫者處理
  }
};

/**
 * POST /api/tshso-scheduling/trigger
 * 手動觸發排程
 */
router.post("/trigger", requireAuth, async (req, res) => {
  try {
    const { date_range } = req.body;
    const result = await executeSchedulingLogic(date_range);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "觸發排程失敗",
      message: error.message,
    });
  }
});

/**
 * POST /api/tshso-scheduling/auto-check
 * 自動檢查並觸發排程 (給前端新增手術後呼叫)
 */
router.post("/auto-check", requireAuth, async (req, res) => {
  try {
    // 檢查是否有待排程手術
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM surgery WHERE status = 'pending'`
    );
    const pendingCount = parseInt(countResult.rows[0].count);

    // 這裡您可以設定閾值，例如 pendingCount >= 1 就觸發
    if (pendingCount > 0) {
      console.log(
        `[Auto-Check] 發現 ${pendingCount} 筆待排程手術，執行排程...`
      );
      const result = await executeSchedulingLogic();

      return res.json({
        success: true,
        triggered: true,
        message: "自動排程執行完畢",
        ...result,
      });
    }

    return res.json({
      success: true,
      triggered: false,
      message: "無待排程手術，未觸發",
      pendingCount,
    });
  } catch (error) {
    console.error("自動檢查失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tshso-scheduling/pending/count
 * 取得待排程數量 (可選日期範圍，並回傳最後排程時間)
 */
router.get("/pending/count", requireAuth, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `SELECT COUNT(*) as count FROM surgery WHERE status = 'pending'`;
    let params = [];

    // 如果有提供日期，加入過濾條件
    if (start_date && end_date) {
      query += ` AND surgery_date BETWEEN $1 AND $2`;
      params = [start_date, end_date];
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: parseInt(result.rows[0].count),
      // 回傳伺服器記錄的最後演算法執行時間
      last_updated: lastScheduleTime ? lastScheduleTime.toISOString() : null,
    });
  } catch (error) {
    console.error("取得待排程數量失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得待排程數量失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/tshso-scheduling/pending
 * 取得待排程清單 (包含完整資訊) - 這是清單視窗需要的 API
 */
router.get("/pending", requireAuth, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // 檢查參數
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: "請提供 start_date 和 end_date",
      });
    }

    const query = `
      SELECT s.*, st.surgery_name, e1.name as doctor_name, e2.name as assistant_doctor_name, 
             p.name as patient_name, p.id_number as patient_id_number, d.name as department_name, 
             srt.type_info as room_type_info
      FROM surgery s
      LEFT JOIN surgery_type_code st ON s.surgery_type_code = st.surgery_code
      LEFT JOIN employees e1 ON s.doctor_id = e1.employee_id
      LEFT JOIN employees e2 ON s.assistant_doctor_id = e2.employee_id
      LEFT JOIN patient p ON s.patient_id = p.patient_id
      LEFT JOIN departments d ON e1.department_code = d.code
      LEFT JOIN surgery_room_type srt ON s.surgery_room_type = srt.type
      WHERE s.status = 'pending' AND s.surgery_date BETWEEN $1 AND $2
      ORDER BY s.surgery_date, s.created_at
    `;

    const result = await pool.query(query, [start_date, end_date]);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("取得待排程清單失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得待排程清單失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/tshso-scheduling/results/range
 * 取得日期範圍的排程結果
 */
router.get("/results/range", requireAuth, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: "請提供 start_date 和 end_date",
      });
    }

    const query = `
      SELECT 
        sct.surgery_id,
        sct.room_id,
        sct.start_time,
        sct.end_time,
        sct.cleanup_end_time,
        s.surgery_date,
        s.surgery_type_code,
        s.doctor_id,
        s.duration,
        st.surgery_name,
        e1.name as doctor_name,
        p.name as patient_name,
        sr.room_type
      FROM surgery_correct_time sct
      JOIN surgery s ON sct.surgery_id = s.surgery_id
      LEFT JOIN surgery_type_code st ON s.surgery_type_code = st.surgery_code
      LEFT JOIN employees e1 ON s.doctor_id = e1.employee_id
      LEFT JOIN patient p ON s.patient_id = p.patient_id
      LEFT JOIN surgery_room sr ON sct.room_id = sr.id
      WHERE s.surgery_date BETWEEN $1 AND $2
      ORDER BY s.surgery_date, sct.room_id, sct.start_time
    `;

    const result = await pool.query(query, [start_date, end_date]);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("取得排程結果失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得排程結果失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/tshso-scheduling/results/all_scheduled
 * 取得「所有」已排程的手術資料 (優化前端效能用)
 * 直接撈取 surgery_correct_time 並關聯 surgery 資訊
 */
router.get("/results/all_scheduled", requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT 
        sct.surgery_id,
        sct.room_id,
        sct.start_time,
        sct.end_time,
        sct.cleanup_end_time,
        s.surgery_date,
        s.surgery_type_code,
        s.doctor_id,
        s.duration,
        s.status,
        st.surgery_name,
        e.name as doctor_name,
        p.name as patient_name,
        sr.room_type
      FROM surgery_correct_time sct
      JOIN surgery s ON sct.surgery_id = s.surgery_id
      LEFT JOIN surgery_type_code st ON s.surgery_type_code = st.surgery_code
      LEFT JOIN employees e ON s.doctor_id = e.employee_id
      LEFT JOIN patient p ON s.patient_id = p.patient_id
      LEFT JOIN surgery_room sr ON sct.room_id = sr.id
      ORDER BY s.surgery_date, sct.room_id, sct.start_time
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("取得所有排程結果失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得排程結果失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/tshso-scheduling/results/:date
 * 取得指定日期的排程結果
 */
router.get("/results/:date", requireAuth, async (req, res) => {
  try {
    const { date } = req.params;

    const query = `
      SELECT 
        sct.surgery_id,
        sct.room_id,
        sct.start_time,
        sct.end_time,
        sct.cleanup_end_time,
        s.surgery_date,
        s.surgery_type_code,
        s.doctor_id,
        s.assistant_doctor_id,
        s.duration,
        st.surgery_name,
        e1.name as doctor_name,
        e2.name as assistant_doctor_name,
        p.name as patient_name,
        sr.room_type
      FROM surgery_correct_time sct
      JOIN surgery s ON sct.surgery_id = s.surgery_id
      LEFT JOIN surgery_type_code st ON s.surgery_type_code = st.surgery_code
      LEFT JOIN employees e1 ON s.doctor_id = e1.employee_id
      LEFT JOIN employees e2 ON s.assistant_doctor_id = e2.employee_id
      LEFT JOIN patient p ON s.patient_id = p.patient_id
      LEFT JOIN surgery_room sr ON sct.room_id = sr.id
      WHERE s.surgery_date = $1
      ORDER BY sct.room_id, sct.start_time
    `;

    const result = await pool.query(query, [date]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("取得排程結果失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得排程結果失敗",
      message: error.message,
    });
  }
});

/**
 * DELETE /api/tshso-scheduling/schedule/:surgeryId
 * 刪除排程記錄
 */
router.delete("/schedule/:surgeryId", requireAuth, async (req, res) => {
  try {
    const { surgeryId } = req.params;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 刪除排程
      await client.query(
        `DELETE FROM surgery_correct_time WHERE surgery_id = $1`,
        [surgeryId]
      );

      // 將手術狀態改回 pending
      await client.query(
        `UPDATE surgery SET status = 'pending' WHERE surgery_id = $1`,
        [surgeryId]
      );

      await client.query("COMMIT");

      console.log(`✅ 已刪除手術 ${surgeryId} 的排程`);

      res.json({
        success: true,
        message: "排程已刪除",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("刪除排程失敗:", error);
    res.status(500).json({
      success: false,
      error: "刪除排程失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/tshso-scheduling/room/:roomId
 * 取得指定手術室的排程
 */
router.get("/room/:roomId", requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: "請提供 date",
      });
    }

    const query = `
      SELECT 
        sct.surgery_id,
        sct.room_id,
        sct.start_time,
        sct.end_time,
        sct.cleanup_end_time,
        s.surgery_date,
        s.surgery_type_code,
        s.doctor_id,
        s.duration,
        st.surgery_name,
        e.name as doctor_name,
        p.name as patient_name
      FROM surgery_correct_time sct
      JOIN surgery s ON sct.surgery_id = s.surgery_id
      LEFT JOIN surgery_type_code st ON s.surgery_type_code = st.surgery_code
      LEFT JOIN employees e ON s.doctor_id = e.employee_id
      LEFT JOIN patient p ON s.patient_id = p.patient_id
      WHERE sct.room_id = $1 AND s.surgery_date = $2
      ORDER BY sct.start_time
    `;

    const result = await pool.query(query, [roomId, date]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("取得手術室排程失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得手術室排程失敗",
      message: error.message,
    });
  }
});

export default router;
