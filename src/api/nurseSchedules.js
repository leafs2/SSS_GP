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

    // 查詢休假日（直接使用 day_off 數值，不依賴 nurse_week 表）
    const dayOffQuery = `
      SELECT 
        day_off,
        CASE day_off
          WHEN 1 THEN '週一'
          WHEN 2 THEN '週二'
          WHEN 3 THEN '週三'
          WHEN 4 THEN '週四'
          WHEN 5 THEN '週五'
          WHEN 6 THEN '週六'
          WHEN 7 THEN '週日'
          ELSE NULL
        END as week
      FROM nurse_dayoff
      WHERE id = $1
      ORDER BY day_off
    `;
    const dayOffResult = await pool.query(dayOffQuery, [employeeId]);

    // 轉換休假日為陣列 (0=週一, 6=週日)
    const dayOffWeek = dayOffResult.rows
      .map((row) => {
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
      })
      .filter((day) => day !== undefined); // 過濾掉 undefined 值

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

// 獲取當前時段的護士排班資料（用於管理頁面）
router.get("/shift-assignments/:shift", requireNurse, async (req, res) => {
  try {
    const { shift } = req.params;
    const departmentCode = req.session.user.department_code;

    // 轉換班別為中文
    const shiftMap = {
      morning: "早班",
      evening: "晚班",
      night: "大夜班",
    };
    const schedulingTime = shiftMap[shift];

    if (!schedulingTime) {
      return res.status(400).json({
        success: false,
        error: "無效的班別",
      });
    }

    // 查詢該科別該時段的所有護士排班
    const query = `
      SELECT 
        e.employee_id,
        e.name,
        ns.scheduling_time,
        ns.surgery_room_type,
        ns.surgery_room_id,
        COALESCE(
          array_agg(nd.day_off ORDER BY nd.day_off) FILTER (WHERE nd.day_off IS NOT NULL),
          ARRAY[]::bigint[]
        ) as day_off_ids
      FROM employees e
      JOIN nurse_schedule ns ON e.employee_id = ns.employee_id
      LEFT JOIN nurse_dayoff nd ON e.employee_id = nd.id
      WHERE e.department_code = $1 
        AND e.role = 'N'
        AND e.status = 'active'
        AND ns.scheduling_time = $2
      GROUP BY 
        e.employee_id, 
        e.name, 
        ns.scheduling_time,
        ns.surgery_room_type,
        ns.surgery_room_id
      ORDER BY ns.surgery_room_type, e.name
    `;

    const result = await pool.query(query, [departmentCode, schedulingTime]);

    // 按手術室類型分組
    const assignments = {};
    result.rows.forEach((row) => {
      const roomType = row.surgery_room_type;

      if (!assignments[roomType]) {
        assignments[roomType] = [];
      }

      // 轉換 day_off_ids (1-7) 為前端格式 (0-6)
      const dayOff = row.day_off_ids ? row.day_off_ids.map((id) => id - 1) : [];

      assignments[roomType].push({
        id: row.employee_id,
        name: row.name,
        dayOff: dayOff,
        surgeryRoomId: row.surgery_room_id,
      });
    });

    res.json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    console.error("獲取時段排班資料失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取排班資料失敗",
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
          array_agg(
            CASE nd.day_off
              WHEN 1 THEN '週一'
              WHEN 2 THEN '週二'
              WHEN 3 THEN '週三'
              WHEN 4 THEN '週四'
              WHEN 5 THEN '週五'
              WHEN 6 THEN '週六'
              WHEN 7 THEN '週日'
              ELSE NULL
            END
            ORDER BY nd.day_off
          ) FILTER (WHERE nd.day_off IS NOT NULL),
          ARRAY[]::varchar[]
        ) as day_offs
      FROM employees e
      LEFT JOIN nurse_schedule ns ON e.employee_id = ns.employee_id
      LEFT JOIN surgery_room sr ON ns.surgery_room_id = sr.id
      LEFT JOIN nurse_dayoff nd ON e.employee_id = nd.id
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
      ORDER BY ns.surgery_room_type, ns.scheduling_time, e.name
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
        dayOffWeek: row.day_offs
          ? row.day_offs
              .map((day) => weekMap[day])
              .filter((d) => d !== undefined)
          : [],
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

// 獲取手術室類型及每個類型的手術室列表
router.get("/surgery-room-types", requireNurse, async (req, res) => {
  try {
    const query = `
      SELECT 
        srt.type as room_type,
        srt.time_info,
        COUNT(sr.id) as room_count,
        array_agg(
          json_build_object(
            'id', sr.id,
            'type', sr.room_type,
            'isAvailable', sr.is_available,
            'nurseCount', sr.nurse_count
          ) ORDER BY sr.id
        ) as rooms
      FROM surgery_room_type srt
      LEFT JOIN surgery_room sr ON srt.type = sr.room_type AND sr.is_available = true
      GROUP BY srt.type, srt.time_info
      ORDER BY srt.type
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        roomType: row.room_type,
        timeInfo: row.time_info,
        roomCount: parseInt(row.room_count),
        rooms: row.rooms.filter((room) => room.id !== null), // 過濾掉沒有實際手術室的類型
      })),
    });
  } catch (error) {
    console.error("獲取手術室類型列表失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取手術室類型列表失敗",
    });
  }
});

// 獲取科別所有護士列表（用於新增護士功能）
router.get("/department-nurses", requireNurse, async (req, res) => {
  try {
    const departmentCode = req.session.user.department_code;

    const query = `
      SELECT 
        e.employee_id,
        e.name,
        e.department_code,
        d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_code = d.code
      WHERE e.department_code = $1 
        AND e.role = 'N'
        AND e.status = 'active'
      ORDER BY e.name
    `;

    const result = await pool.query(query, [departmentCode]);

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.employee_id,
        name: row.name,
        departmentCode: row.department_code,
        departmentName: row.department_name,
      })),
    });
  } catch (error) {
    console.error("獲取科別護士列表失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取護士列表失敗",
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

// 批次儲存護士排班設定
router.post("/batch-save", requireNurse, async (req, res) => {
  const client = await pool.connect();

  try {
    const { shift, assignments } = req.body;

    // shift: 'morning' | 'evening' | 'night'
    // assignments: { roomType: [{ id, name, dayOff: [0,1,2...] }] }

    if (!shift || !assignments) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數",
      });
    }

    // 轉換班別為中文
    const shiftMap = {
      morning: "早班",
      evening: "晚班",
      night: "大夜班",
    };
    const schedulingTime = shiftMap[shift];

    if (!schedulingTime) {
      return res.status(400).json({
        success: false,
        error: "無效的班別",
      });
    }

    await client.query("BEGIN");

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // 遍歷每個手術室類型
    for (const [roomType, nurses] of Object.entries(assignments)) {
      if (!Array.isArray(nurses) || nurses.length === 0) {
        continue;
      }

      // 處理每位護士
      for (const nurse of nurses) {
        try {
          const { id: employeeId, dayOff } = nurse;

          // 1. 儲存或更新 nurse_schedule
          const upsertScheduleQuery = `
            INSERT INTO nurse_schedule (employee_id, scheduling_time, surgery_room_type, surgery_room_id)
            VALUES ($1, $2, $3, NULL)
            ON CONFLICT (employee_id) 
            DO UPDATE SET 
              scheduling_time = EXCLUDED.scheduling_time,
              surgery_room_type = EXCLUDED.surgery_room_type,
              surgery_room_id = NULL
          `;
          await client.query(upsertScheduleQuery, [
            employeeId,
            schedulingTime,
            roomType,
          ]);

          // 2. 處理休假日
          if (dayOff && Array.isArray(dayOff) && dayOff.length > 0) {
            // 先刪除該護士的舊休假記錄
            await client.query("DELETE FROM nurse_dayoff WHERE id = $1", [
              employeeId,
            ]);

            // 插入新的休假記錄
            // dayOff 陣列中的數字對應 nurse_week 表的 id (1-7代表週一到週日)
            for (const dayIndex of dayOff) {
              // dayIndex: 0=週一, 1=週二, ..., 6=週日
              // nurse_week.id: 需要根據實際資料庫中的對應關係
              // 假設 nurse_week 中 id=1 是週一, id=7 是週日
              const nurseWeekId = dayIndex + 1;

              const insertDayOffQuery = `
                INSERT INTO nurse_dayoff (id, day_off)
                VALUES ($1, $2)
                ON CONFLICT (id, day_off) DO NOTHING
              `;
              await client.query(insertDayOffQuery, [employeeId, nurseWeekId]);
            }
          }

          successCount++;
        } catch (error) {
          errorCount++;
          errors.push({
            employeeId: nurse.id,
            nurseName: nurse.name,
            error: error.message,
          });
          console.error(`儲存護士 ${nurse.id} 排班失敗:`, error);
        }
      }
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `成功儲存 ${successCount} 位護士的排班`,
      data: {
        successCount,
        errorCount,
        errors: errorCount > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("批次儲存護士排班失敗:", error);
    res.status(500).json({
      success: false,
      error: "儲存排班失敗",
      details: error.message,
    });
  } finally {
    client.release();
  }
});

export default router;
