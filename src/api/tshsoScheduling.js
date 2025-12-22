// src/api/tshsoScheduling.js
// 手術排程 API (Node.js Express) - 完整版

import express from "express";
import { requireAuth } from "./middleware/checkAuth.js";

const router = express.Router();
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

// 記錄最後排程時間
let lastScheduleTime = null;

// 確保日期輸出為 YYYY-MM-DD (使用本地時間避免時區誤差)
const formatDateToLocal = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// 確保時間格式為 HH:MM:SS
const formatTime = (timeInput) => {
  if (!timeInput) return "00:00:00";
  if (typeof timeInput === "string") return timeInput;
  if (timeInput instanceof Date) {
    return timeInput.toTimeString().split(" ")[0];
  }
  return String(timeInput);
};

const updateExpiredSurgeries = async () => {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 將日期小於今天 且 狀態為 scheduled 的手術轉為 completed
    const updateQuery = `
      UPDATE surgery 
      SET status = 'completed' 
      WHERE surgery_date < CURRENT_DATE 
      AND status = 'scheduled'
      RETURNING surgery_id
    `;

    const result = await client.query(updateQuery);
    await client.query("COMMIT");

    if (result.rowCount > 0) {
      console.log(
        `[TS-HSO] ✅ 自動維護：已將 ${result.rowCount} 筆過期手術轉為 completed`
      );
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`[TS-HSO] ❌ 更新過期手術失敗: ${error.message}`);
  } finally {
    client.release();
  }
};

/**
 * @param {Object} date_range - 日期範圍 {start, end}
 * @param {Boolean} forceAllFuture - 是否強制重排所有未來日期的手術 (啟動時使用)
 */
const executeSchedulingLogic = async (
  date_range = null,
  forceAllFuture = false
) => {
  const globalStart = Date.now();
  console.log(
    `\n[TS-HSO] 開始執行排程核心邏輯 (${
      forceAllFuture ? "啟動全域重排" : "定期檢查"
    })... Time: ${new Date().toISOString()}`
  );

  try {
    // --- Step 1: 找出需要重排的日期 ---
    let targetDatesQuery = "";
    let targetDatesParams = [];

    if (forceAllFuture) {
      // [模式 A] 啟動時：找出所有 "今天以後" 且 "有未完成手術(scheduled/pending)" 的日期
      targetDatesQuery = `
        SELECT DISTINCT surgery_date 
        FROM surgery 
        WHERE surgery_date >= CURRENT_DATE
        AND status IN ('pending', 'scheduled')
      `;
    } else {
      // [模式 B] 定期檢查：只針對 "有新掛號(pending)" 的日期進行重排
      targetDatesQuery = `
        SELECT DISTINCT surgery_date 
        FROM surgery 
        WHERE status = 'pending'
        ${date_range ? "AND surgery_date BETWEEN $1 AND $2" : ""}
      `;
      if (date_range) targetDatesParams = [date_range.start, date_range.end];
    }

    const targetDatesResult = await pool.query(
      targetDatesQuery,
      targetDatesParams
    );

    // 轉為 YYYY-MM-DD 字串陣列
    const targetDates = targetDatesResult.rows.map((row) =>
      formatDateToLocal(row.surgery_date)
    );

    if (targetDates.length === 0) {
      console.log("[TS-HSO] 目前無須重排的日期，流程結束。");
      return { success: true, message: "無待排程手術" };
    }

    console.log(
      `[TS-HSO] 目標重排日期 (${targetDates.length}天): ${targetDates.join(
        ", "
      )}`
    );

    // --- Step 2: 讀取這些日期的「所有」手術 (包含 scheduled 和 pending) ---
    // 全域重排關鍵：抓取所有手術重新洗牌
    const surgeriesQuery = `
      SELECT 
        surgery_id, doctor_id, assistant_doctor_id,
        surgery_type_code, patient_id, surgery_room_type,
        surgery_date, duration, nurse_count, status
      FROM surgery
      WHERE surgery_date = ANY($1::date[]) 
      AND status IN ('pending', 'scheduled')
      ORDER BY surgery_date, created_at
    `;

    const surgeriesResult = await pool.query(surgeriesQuery, [targetDates]);
    const allSurgeries = surgeriesResult.rows;

    console.log(`[TS-HSO] 共讀取 ${allSurgeries.length} 筆手術準備重排`);

    // 讀取手術室資訊
    const roomsResult = await pool.query(`
      SELECT id, room_type, nurse_count, 
             morning_shift, night_shift, graveyard_shift
      FROM surgery_room
      WHERE room_type != 'RE'
      ORDER BY id
    `);

    const doctorSchedulesQuery = `
      SELECT 
        ds.employee_id,
        ds.monday, ds.tuesday, ds.wednesday, ds.thursday,
        ds.friday, ds.saturday, ds.sunday
      FROM doctor_schedule ds
      WHERE ds.employee_id IN (
        SELECT DISTINCT doctor_id FROM surgery 
        WHERE surgery_date = ANY($1::date[])
        AND status IN ('pending', 'scheduled')
      )
    `;

    const doctorSchedulesResult = await pool.query(doctorSchedulesQuery, [
      targetDates,
    ]);

    // 轉換為 Python 可用的格式
    const doctorSchedules = {};
    doctorSchedulesResult.rows.forEach((row) => {
      doctorSchedules[row.employee_id] = {
        monday: row.monday,
        tuesday: row.tuesday,
        wednesday: row.wednesday,
        thursday: row.thursday,
        friday: row.friday,
        saturday: row.saturday,
        sunday: row.sunday,
      };
    });

    console.log(
      `[TS-HSO] 讀取 ${Object.keys(doctorSchedules).length} 位醫師的排班資料`
    );

    // --- Step 3: 資料序列化 ---
    const serializedSurgeries = allSurgeries.map((s) => ({
      surgery_id: s.surgery_id,
      doctor_id: s.doctor_id,
      assistant_doctor_id: s.assistant_doctor_id || null,
      surgery_type_code: s.surgery_type_code,
      patient_id: s.patient_id,
      surgery_room_type: s.surgery_room_type,
      surgery_date: formatDateToLocal(s.surgery_date),
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

    // --- Step 4: 呼叫 Python 演算法 ---
    const algoStart = Date.now();
    console.log(`[TS-HSO] 呼叫 Python 演算法服務...`);

    const pythonServiceUrl =
      process.env.PYTHON_API_URL || "http://localhost:8000";

    const pythonResponse = await fetch(
      `${pythonServiceUrl}/api/scheduling/trigger`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surgeries: serializedSurgeries,
          available_rooms: serializedRooms,
          existing_schedules: [],
          doctor_schedules: doctorSchedules,
          config: {
            mode: "global_rescheduling",
            ga_generations: 100,
            ga_population: 50,
            // AHP 權重設定
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
      let errorDetail = await pythonResponse.text();
      try {
        const jsonErr = JSON.parse(errorDetail);
        errorDetail = JSON.stringify(jsonErr.detail);
      } catch (e) {}
      throw new Error(
        `Python API Error (${pythonResponse.status}): ${errorDetail}`
      );
    }

    const pythonResult = await pythonResponse.json();
    if (!pythonResult.success) {
      throw new Error(`演算法計算失敗: ${pythonResult.message}`);
    }

    console.log(`[TS-HSO] 演算法計算完成 (耗時 ${Date.now() - algoStart}ms)`);

    // --- Step 5: 寫入資料庫 ---
    const dbStart = Date.now();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 5.1 清除這些日期所有的舊排程 (避免衝突)
      const deleteQuery = `
        DELETE FROM surgery_correct_time 
        WHERE surgery_id IN (
            SELECT surgery_id FROM surgery 
            WHERE surgery_date = ANY($1::date[])
        )
      `;
      await client.query(deleteQuery, [targetDates]);

      // 5.2 寫入新的排程結果
      for (const result of pythonResult.results) {
        await client.query(
          `
          INSERT INTO surgery_correct_time 
          (surgery_id, room_id, start_time, end_time, cleanup_end_time)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            result.surgery_id,
            result.room_id,
            result.start_time,
            result.end_time,
            result.cleanup_end_time,
          ]
        );

        // 更新狀態為 scheduled
        await client.query(
          `UPDATE surgery SET status = 'scheduled' WHERE surgery_id = $1`,
          [result.surgery_id]
        );
      }

      await client.query("COMMIT");
      console.log(`[TS-HSO] 資料庫更新完成 (耗時 ${Date.now() - dbStart}ms)`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[TS-HSO] 資料庫交易失敗:", error);
      throw error;
    } finally {
      client.release();
    }

    // --- Step 6: 顯示詳細分數與分配結果 (Console Log) ---
    console.log("\n==================================================");
    console.log("             📋 TS-HSO 排程結果報告              ");
    console.log("==================================================");
    console.log("手術ID      | 手術室 | 時段            | AHP分數");
    console.log("------------|--------|-----------------|---------");

    // 依日期和手術室排序顯示
    const sortedResults = pythonResult.results.sort((a, b) => {
      if (a.room_id === b.room_id) {
        return a.start_time.localeCompare(b.start_time);
      }
      return a.room_id.localeCompare(b.room_id);
    });

    sortedResults.forEach((res) => {
      const score =
        res.ahp_score !== undefined ? Number(res.ahp_score).toFixed(2) : "N/A";
      console.log(
        `${res.surgery_id.padEnd(11)} | ${res.room_id.padEnd(
          6
        )} | ${res.start_time.substring(0, 5)}-${res.end_time.substring(
          0,
          5
        )}   | ${score}`
      );
    });
    console.log("==================================================\n");

    const totalDuration = Date.now() - globalStart;
    console.log(`[TS-HSO] 🏁 流程結束。總耗時: ${totalDuration}ms`);
    lastScheduleTime = new Date();

    return {
      success: true,
      message: `全域重排完成，共處理 ${pythonResult.results.length} 台手術`,
      data: pythonResult.results,
      statistics: pythonResult.statistics,
      duration: totalDuration,
      timestamp: lastScheduleTime,
    };
  } catch (error) {
    console.error(`[TS-HSO] 排程核心邏輯錯誤: ${error.message}`);
    throw error;
  }
};

let isSchedulerRunning = false;

const runScheduledJob = async (isStartup = false) => {
  if (isSchedulerRunning) {
    console.log("[TS-HSO] ⏳ 上次排程未完成，跳過...");
    return;
  }

  isSchedulerRunning = true;
  try {
    // 1. 啟動時：先維護過期狀態
    if (isStartup) {
      await updateExpiredSurgeries();
    }

    // 2. 執行排程
    // isStartup = true -> 強制全域重排所有未來手術
    // isStartup = false -> 只針對有新掛號的日子重排
    const result = await executeSchedulingLogic(null, isStartup);

    if (result && result.success && result.data && result.data.length > 0) {
      // 成功時已在 executeSchedulingLogic 內部印出詳細報告
    }
  } catch (error) {
    console.error("[TS-HSO] ❌ 排程服務錯誤:", error.message);
  } finally {
    isSchedulerRunning = false;
  }
};

export const startPeriodicScheduleService = () => {
  const INTERVAL_MINUTES = 5;

  console.log(`[TS-HSO] ✅ 排程服務已啟動 (週期: ${INTERVAL_MINUTES}分)`);

  // 設定定期執行 (每 5 分鐘跑一般檢查)
  setInterval(async () => {
    await runScheduledJob(false);
  }, INTERVAL_MINUTES * 60 * 1000);

  // 伺服器啟動時，立即執行一次 (Startup模式：全域重排)
  // 使用 setTimeout稍微延遲 3 秒，確保 DB 連線池已完全就緒
  setTimeout(() => {
    runScheduledJob(true);
  }, 3000);
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
