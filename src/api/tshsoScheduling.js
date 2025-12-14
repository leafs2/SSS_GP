// src/api/tshsoScheduling.js
// 手術排程 API (Node.js Express) - 完整版

import express from "express";
import { requireAuth } from "./middleware/checkAuth.js";

const router = express.Router();

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

/**
 * POST /api/tshso-scheduling/trigger
 * 手動觸發排程
 */
router.post("/trigger", requireAuth, async (req, res) => {
  try {
    const { date_range } = req.body; // 可選：指定日期範圍

    // 1. 查詢待排程手術
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
      return res.json({
        success: true,
        message: "沒有待排程的手術",
        data: [],
        statistics: {},
        failed_surgeries: [],
      });
    }

    // 2. 查詢可用手術室
    const roomsResult = await pool.query(`
      SELECT id, room_type, nurse_count, 
             morning_shift, night_shift, graveyard_shift
      FROM surgery_room
      WHERE room_type != 'RE'
      ORDER BY id
    `);

    // 3. 查詢現有排程（避免衝突）✅ 修正
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

    // 4. 呼叫 Python 演算法服務
    const pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

    // ✅ 序列化資料
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

    const pythonResponse = await fetch(
      `${pythonServiceUrl}/api/scheduling/trigger`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surgeries: serializedSurgeries, // ✅ 使用序列化資料
          available_rooms: serializedRooms, // ✅ 使用序列化資料
          existing_schedules: serializedSchedules, // ✅ 使用序列化資料
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

    // 5. 寫入排程結果到資料庫
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const result of pythonResult.results) {
        // 插入排程記錄
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

        // 更新手術狀態
        await client.query(
          `
          UPDATE surgery 
          SET status = 'scheduled' 
          WHERE surgery_id = $1
        `,
          [result.surgery_id]
        );
      }

      await client.query("COMMIT");

      console.log(`✅ 成功排程 ${pythonResult.results.length} 台手術`);

      res.json({
        success: true,
        message: `排程完成，成功排定 ${pythonResult.results.length} 台手術`,
        data: pythonResult.results,
        statistics: pythonResult.statistics,
        failed_surgeries: pythonResult.failed_surgeries,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("觸發排程失敗:", error);
    res.status(500).json({
      success: false,
      error: "觸發排程失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/tshso-scheduling/pending
 * 取得待排程清單
 */
router.get("/pending", requireAuth, async (req, res) => {
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
        s.*,
        st.surgery_name,
        e1.name as doctor_name,
        e2.name as assistant_doctor_name,
        p.name as patient_name,
        p.id_number as patient_id_number,
        d.name as department_name,
        srt.type_info as room_type_info
      FROM surgery s
      LEFT JOIN surgery_type_code st ON s.surgery_type_code = st.surgery_code
      LEFT JOIN employees e1 ON s.doctor_id = e1.employee_id
      LEFT JOIN employees e2 ON s.assistant_doctor_id = e2.employee_id
      LEFT JOIN patient p ON s.patient_id = p.patient_id
      LEFT JOIN departments d ON e1.department_code = d.code
      LEFT JOIN surgery_room_type srt ON s.surgery_room_type = srt.type
      WHERE s.status = 'pending'
        AND s.surgery_date BETWEEN $1 AND $2
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
 * GET /api/tshso-scheduling/pending/count
 * 取得待排程數量
 */
router.get("/pending/count", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM surgery WHERE status = 'pending'`
    );

    res.json({
      success: true,
      count: parseInt(result.rows[0].count),
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
