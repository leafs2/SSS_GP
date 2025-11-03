// nurseSchedules.js
import express from "express";

const router = express.Router();
let pool;

// 設定資料庫連線池
export const setPool = (pgPool) => {
  pool = pgPool;
};

// 中介軟體：檢查是否為護士
const requireNurse = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "N") {
    return res.status(403).json({
      success: false,
      error: "此功能僅限護士使用",
    });
  }
  next();
};

// 獲取我的排班資訊
router.get("/my-schedule", requireNurse, async (req, res) => {
  try {
    const employeeId = req.session.user.employee_id;

    // 查詢護士排班資訊
    const scheduleQuery = `
      SELECT 
        ns.employee_id,
        ns.scheduling_time,
        ns.surgery_room_type,
        ns.surgery_room_id,
        sr.room_type,
        srt.time_info
      FROM nurse_schedule ns
      LEFT JOIN surgery_room sr ON ns.surgery_room_id = sr.id
      LEFT JOIN surgery_room_type srt ON ns.surgery_room_type = srt.type
      WHERE ns.employee_id = $1
    `;
    const scheduleResult = await pool.query(scheduleQuery, [employeeId]);

    if (scheduleResult.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: "尚未分配排班",
      });
    }

    // 查詢休假日
    const dayOffQuery = `
      SELECT nd.day_off, nw.week
      FROM nurse_dayoff nd
      JOIN nurse_week nw ON nd.day_off = nw.id
      WHERE nd.id = $1
      ORDER BY nd.day_off
    `;
    const dayOffResult = await pool.query(dayOffQuery, [employeeId]);

    // 轉換休假日為陣列 (0=週一, 6=週日)
    const dayOffWeek = dayOffResult.rows.map((row) => {
      const weekMap = {
        週一: 0,
        週二: 1,
        週三: 2,
        週四: 3,
        週五: 4,
        週六: 5,
        週日: 6,
      };
      return weekMap[row.week];
    });

    // 轉換班別代碼
    const shiftMap = {
      早班: "morning",
      晚班: "evening",
      大夜班: "night",
    };

    const schedule = scheduleResult.rows[0];

    res.json({
      success: true,
      data: {
        shift: shiftMap[schedule.scheduling_time] || "morning",
        shiftLabel: schedule.scheduling_time,
        dayOffWeek: dayOffWeek,
        surgeryRoom: schedule.surgery_room_id,
        surgeryRoomType: schedule.room_type || schedule.surgery_room_type,
        timeInfo: schedule.time_info,
      },
    });
  } catch (error) {
    console.error("獲取護士排班失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取排班資訊失敗",
    });
  }
});

// 獲取科別護士排班統計
router.get("/department-overview", requireNurse, async (req, res) => {
  try {
    const departmentCode = req.session.user.department_code;

    // 查詢該科別所有護士的排班資訊
    const query = `
      SELECT 
        e.employee_id,
        e.name,
        ns.scheduling_time,
        ns.surgery_room_id,
        ns.surgery_room_type,
        sr.room_type,
        COALESCE(
          array_agg(nw.week ORDER BY nd.day_off) FILTER (WHERE nw.week IS NOT NULL),
          ARRAY[]::varchar[]
        ) as day_offs
      FROM employees e
      LEFT JOIN nurse_schedule ns ON e.employee_id = ns.employee_id
      LEFT JOIN surgery_room sr ON ns.surgery_room_id = sr.id
      LEFT JOIN nurse_dayoff nd ON e.employee_id = nd.id
      LEFT JOIN nurse_week nw ON nd.day_off = nw.id
      WHERE e.department_code = $1 
        AND e.role = 'N' 
        AND e.status = 'active'
      GROUP BY 
        e.employee_id, 
        e.name, 
        ns.scheduling_time, 
        ns.surgery_room_id,
        ns.surgery_room_type,
        sr.room_type
      ORDER BY ns.surgery_room_id, ns.scheduling_time, e.name
    `;

    const result = await pool.query(query, [departmentCode]);

    // 轉換資料格式
    const nurses = result.rows.map((row) => {
      const shiftMap = {
        早班: "morning",
        晚班: "evening",
        大夜班: "night",
      };

      const weekMap = {
        週一: 0,
        週二: 1,
        週三: 2,
        週四: 3,
        週五: 4,
        週六: 5,
        週日: 6,
      };

      return {
        employeeId: row.employee_id,
        name: row.name,
        shift: shiftMap[row.scheduling_time] || null,
        shiftLabel: row.scheduling_time,
        surgeryRoom: row.surgery_room_id,
        surgeryRoomType: row.room_type || row.surgery_room_type,
        dayOffWeek: row.day_offs ? row.day_offs.map((day) => weekMap[day]) : [],
      };
    });

    res.json({
      success: true,
      data: {
        nurses: nurses,
        totalCount: nurses.length,
      },
    });
  } catch (error) {
    console.error("獲取科別排班統計失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取科別排班統計失敗",
    });
  }
});

// 獲取所有手術室列表
router.get("/surgery-rooms", requireNurse, async (req, res) => {
  try {
    const query = `
      SELECT 
        sr.id,
        sr.room_type,
        sr.is_available,
        sr.nurse_count,
        srt.time_info
      FROM surgery_room sr
      LEFT JOIN surgery_room_type srt ON sr.room_type = srt.type
      WHERE sr.is_available = true
      ORDER BY sr.id
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        roomType: row.room_type,
        isAvailable: row.is_available,
        nurseCount: row.nurse_count,
        timeInfo: row.time_info,
      })),
    });
  } catch (error) {
    console.error("獲取手術室列表失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取手術室列表失敗",
    });
  }
});

// 獲取特定手術室的護士排班
router.get("/surgery-room/:roomId", requireNurse, async (req, res) => {
  try {
    const { roomId } = req.params;
    const departmentCode = req.session.user.department_code;

    const query = `
      SELECT 
        e.employee_id,
        e.name,
        ns.scheduling_time,
        ns.surgery_room_id
      FROM employees e
      JOIN nurse_schedule ns ON e.employee_id = ns.employee_id
      WHERE ns.surgery_room_id = $1 
        AND e.department_code = $2
        AND e.role = 'N'
        AND e.status = 'active'
      ORDER BY ns.scheduling_time, e.name
    `;

    const result = await pool.query(query, [roomId, departmentCode]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("獲取手術室護士排班失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取手術室護士排班失敗",
    });
  }
});

export default router;
