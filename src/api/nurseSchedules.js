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
        srt.type_info
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
        timeInfo: schedule.type_info,
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
        
        -- 【關鍵修正 1】這裡原本漏掉了，現在補上查詢歷史紀錄
        COALESCE(nrh.total_fixed_count, 0) as total_fixed_count,
        COALESCE(nrh.total_float_count, 0) as total_float_count,
        
        -- 【關鍵修正 2】這裡加入本週工作量計算 (示範邏輯：計算他在排班表的出現次數)
        (
            SELECT COUNT(*) 
            FROM nurse_schedule ns_count 
            WHERE ns_count.employee_id = e.employee_id
        )::integer as workload_this_week,

        COALESCE(
          array_agg(nd.day_off ORDER BY nd.day_off) FILTER (WHERE nd.day_off IS NOT NULL),
          ARRAY[]::bigint[]
        ) as day_off_ids
      FROM employees e
      JOIN nurse_schedule ns ON e.employee_id = ns.employee_id
      LEFT JOIN nurse_dayoff nd ON e.employee_id = nd.id
      -- 【關鍵修正 3】一定要 JOIN 歷史紀錄表，不然查不到數據
      LEFT JOIN nurse_role_history nrh ON e.employee_id = nrh.employee_id
      WHERE e.department_code = $1 
        AND e.role = 'N'
        AND e.status = 'active'
        AND ns.scheduling_time = $2
      GROUP BY 
        e.employee_id, 
        e.name, 
        ns.scheduling_time,
        ns.surgery_room_type,
        ns.surgery_room_id,
        nrh.total_fixed_count,  -- GROUP BY 必須包含新加入的欄位
        nrh.total_float_count
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
        total_fixed_count: row.total_fixed_count,
        total_float_count: row.total_float_count,
        workload_this_week: row.workload_this_week,
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
        srt.type_info,
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
      GROUP BY srt.type, srt.type_info
      ORDER BY srt.type
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        roomType: row.room_type,
        timeInfo: row.type_info,
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

// 獲取科別所有護士列表（用於新增護士功能，排除已在其他時段排班的護士）
router.get("/department-nurses", requireNurse, async (req, res) => {
  try {
    const departmentCode = req.session.user.department_code;
    const { shift } = req.query; // 當前選擇的時段

    // 轉換班別為中文
    const shiftMap = {
      morning: "早班",
      evening: "晚班",
      night: "大夜班",
    };
    const currentSchedulingTime = shiftMap[shift];

    let query;
    let params;

    if (currentSchedulingTime) {
      query = `
        SELECT 
          e.employee_id,
          e.name,
          e.department_code,
          d.name as department_name,
          
          -- 1. 歷史角色計數 (對齊 Python 模型名稱)
          COALESCE(nrh.total_fixed_count, 0) as total_fixed_count,
          COALESCE(nrh.total_float_count, 0) as total_float_count,

          -- 2. 上次分配的手術室 (Last Assigned Room)
          -- 如果是固定護理師(有值)，回傳該 ID
          -- 如果是流動護理師(NULL)，回傳 NULL (演算法會依此判斷非原位續任)
          ns.surgery_room_id as last_assigned_room,
          
          -- 3. 真實本週工作量計算 (Workload Calculation)
          CASE 
            -- 情境 A: 固定護理師 (有分配手術室) -> 視為 5 天 (或您的業務邏輯定義)
            WHEN ns.surgery_room_id IS NOT NULL THEN 5
            
            -- 情境 B: 流動護理師 (無分配手術室) -> 計算 nurse_float 表中的排班天數
            ELSE (
              SELECT 
                (CASE WHEN nf.mon IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN nf.tues IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN nf.wed IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN nf.thu IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN nf.fri IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN nf.sat IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN nf.sun IS NOT NULL THEN 1 ELSE 0 END)
              FROM nurse_float nf 
              WHERE nf.employee_id = e.employee_id
            )
          END as workload_this_week

        FROM employees e
        LEFT JOIN departments d ON e.department_code = d.code
        LEFT JOIN nurse_role_history nrh ON e.employee_id = nrh.employee_id
        -- 加入排班表以取得當前狀態
        LEFT JOIN nurse_schedule ns ON e.employee_id = ns.employee_id AND ns.scheduling_time = $2
        
        WHERE e.department_code = $1 
          AND e.role = 'N'
          AND e.status = 'active'
          AND (
            -- 篩選邏輯：
            -- 1. 完全沒排班的人 (ns.employee_id IS NULL) -> 視為可排班的新人
            ns.employee_id IS NULL
            OR 
            -- 2. 已經在"當前時段"排班的人 (我們要重新排班他們)
            ns.scheduling_time = $2
          )
          -- 排除：已經在"其他時段"排班的人
          AND NOT EXISTS (
            SELECT 1 
            FROM nurse_schedule ns_check
            WHERE ns_check.employee_id = e.employee_id 
              AND ns_check.scheduling_time != $2
          )
        ORDER BY e.name
      `;
      params = [departmentCode, currentSchedulingTime];
    } else {
      // 沒有指定時段，返回所有護士
      query = `
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
      params = [departmentCode];
    }

    const result = await pool.query(query, params);

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
        sr.nurse_count::integer as nurse_count,
        srt.type_info
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
        nurseCount: parseInt(row.nurse_count),
        timeInfo: row.type_info,
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

          // 檢查該護士是否已在其他時段排班
          const checkQuery = `
            SELECT scheduling_time 
            FROM nurse_schedule 
            WHERE employee_id = $1 AND scheduling_time != $2
          `;
          const checkResult = await client.query(checkQuery, [
            employeeId,
            schedulingTime,
          ]);

          if (checkResult.rows.length > 0) {
            errorCount++;
            errors.push({
              employeeId: employeeId,
              nurseName: nurse.name,
              error: `該護士已在 ${checkResult.rows[0].scheduling_time} 排班，不能重複排班`,
            });
            continue;
          }

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
      message: `成功儲存 ${successCount} 位護士的排班${
        errorCount > 0 ? `，${errorCount} 位失敗` : ""
      }`,
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

/**
 * POST /api/nurse-schedules/apply-algorithm-results
 * 應用演算法分配結果到資料庫
 */
router.post("/apply-algorithm-results", requireNurse, async (req, res) => {
  const client = await pool.connect();

  try {
    const { shift, assignments } = req.body;

    // 驗證輸入
    if (!shift || !assignments) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數",
      });
    }

    console.log("📥 收到演算法結果:", {
      shift,
      assignmentKeys: Object.keys(assignments),
    });

    await client.query("BEGIN");

    let totalUpdated = 0;
    const updateDetails = [];

    // 處理每個手術室類型的分配結果
    for (const [roomType, nurseAssignments] of Object.entries(assignments)) {
      console.log(`\n處理 ${roomType}...`);

      for (const assignment of nurseAssignments) {
        // 更新資料庫
        const result = await client.query(
          `
          UPDATE nurse_schedule 
          SET surgery_room_id = $1
          WHERE employee_id = $2 
            AND scheduling_time = $3
            AND surgery_room_type = $4
          RETURNING *
        `,
          [
            assignment.assigned_room, // 分配的手術室 ID
            assignment.employee_id, // 護士員工編號
            shift, // 時段
            roomType, // 手術室類型
          ]
        );

        if (result.rowCount > 0) {
          totalUpdated++;
          updateDetails.push({
            employeeId: assignment.employee_id,
            nurseName: assignment.nurse_name,
            assignedRoom: assignment.assigned_room,
            position: assignment.position,
            cost: assignment.cost,
          });

          console.log(
            `  ✅ ${assignment.nurse_name} → ${assignment.assigned_room} (位置 ${assignment.position})`
          );
        } else {
          console.warn(`  ⚠️ 找不到記錄: ${assignment.employee_id}`);
        }
      }
    }

    // 收集所有被排班的員工 ID
    const scheduledEmployeeIds = [];
    for (const [roomType, assignments] of Object.entries(
      req.body.assignments
    )) {
      assignments.forEach((a) => scheduledEmployeeIds.push(a.employee_id));
    }

    // 清除護士的流動紀錄
    // 如果他們之前是流動，現在被指派為固定了，必須把 nurse_float 刪掉
    if (scheduledEmployeeIds.length > 0) {
      console.log(
        `🗑️ 清除 ${scheduledEmployeeIds.length} 位新任固定護士的流動紀錄...`
      );
      await client.query(
        `DELETE FROM nurse_float WHERE employee_id = ANY($1)`,
        [scheduledEmployeeIds]
      );
    }

    if (scheduledEmployeeIds.length > 0) {
      // 使用 Postgres 的 UPSERT (ON CONFLICT) 語法
      const updateHistoryQuery = `
            INSERT INTO nurse_role_history (employee_id, total_fixed_count, total_float_count)
            SELECT unnest($1::text[]), 1, 0
            ON CONFLICT (employee_id) 
            DO UPDATE SET 
                total_fixed_count = nurse_role_history.total_fixed_count + 1,
                last_updated_at = CURRENT_TIMESTAMP
        `;
      await client.query(updateHistoryQuery, [scheduledEmployeeIds]);
      console.log(
        `✅ 已更新 ${scheduledEmployeeIds.length} 位護士的固定角色歷史計數`
      );
    }

    await client.query("COMMIT");

    console.log(`\n✅ 成功更新 ${totalUpdated} 筆記錄`);

    res.json({
      success: true,
      message: `成功更新 ${totalUpdated} 位護士的手術室分配`,
      data: {
        totalUpdated,
        details: updateDetails,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("應用演算法結果失敗:", error);
    res.status(500).json({
      success: false,
      error: "更新資料庫失敗",
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/nurse-schedules/apply-float-schedule
 * 應用流動護士排班結果到資料庫
 */
router.post("/apply-float-schedule", requireNurse, async (req, res) => {
  const client = await pool.connect();

  try {
    const { shift, floatSchedules } = req.body;

    if (!shift || !floatSchedules) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數：shift, floatSchedules",
      });
    }

    console.log("📝 開始應用流動護士排班:", { shift });

    await client.query("BEGIN");

    // 1. 整理所有要寫入的資料，並收集所有涉及的 Employee IDs
    const floatRecords = [];
    const employeeIdsToUpdate = new Set(); // 使用 Set 避免 ID 重複

    for (const roomType in floatSchedules) {
      const scheduleData = floatSchedules[roomType];

      if (scheduleData.schedule && scheduleData.schedule.length > 0) {
        scheduleData.schedule.forEach((record) => {
          // 加入要寫入的紀錄
          floatRecords.push({
            employee_id: record.employee_id,
            mon: record.mon || null,
            tues: record.tues || null,
            wed: record.wed || null,
            thu: record.thu || null,
            fri: record.fri || null,
            sat: record.sat || null,
            sun: record.sun || null,
          });

          // 收集 ID 用於刪除舊資料
          employeeIdsToUpdate.add(record.employee_id);
        });
      }
    }

    const employeeIdsArray = Array.from(employeeIdsToUpdate);

    // 2. 先刪除這些護士的舊流動紀錄
    if (employeeIdsArray.length > 0) {
      console.log(
        `🗑️ 正在清除 ${employeeIdsArray.length} 位護士的舊流動紀錄...`
      );
      await client.query(
        `DELETE FROM nurse_float WHERE employee_id = ANY($1)`,
        [employeeIdsArray]
      );

      // 如果他們之前是固定護士，現在變成流動了，必須把 surgery_room_id 清空
      console.log(
        `🧹 清除 ${employeeIdsArray.length} 位護士的固定分配 (轉為流動)...`
      );

      // 轉換班別 (為了安全起見，確保只清當前時段)
      const shiftMap = {
        morning: "早班",
        evening: "晚班",
        night: "大夜班",
      };
      let schedulingTime = shift;
      if (Object.keys(shiftMap).includes(shift)) {
        schedulingTime = shiftMap[shift];
      }

      // 雙重確認：確保 schedulingTime 是有效的中文班別
      const validShifts = ["早班", "晚班", "大夜班"];
      if (!validShifts.includes(schedulingTime)) {
        console.warn(
          `⚠️ 警告: 班別名稱可能錯誤: ${shift} -> ${schedulingTime}`
        );
        // 可以在這裡做錯誤處理，或預設為 shift 原值
      }

      await client.query(
        `
        UPDATE nurse_schedule 
        SET surgery_room_id = NULL
        WHERE employee_id = ANY($1) AND scheduling_time = $2
        `,
        [employeeIdsArray, schedulingTime]
      );
    }

    if (floatRecords.length === 0) {
      await client.query("COMMIT");
      return res.json({
        success: true,
        message: "沒有流動護士需要更新",
        data: { insertedCount: 0 },
      });
    }

    // 3. 執行插入新資料
    let insertedCount = 0;
    for (const record of floatRecords) {
      const result = await client.query(
        `
        INSERT INTO nurse_float (employee_id, mon, tues, wed, thu, fri, sat, sun)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
        [
          record.employee_id,
          record.mon,
          record.tues,
          record.wed,
          record.thu,
          record.fri,
          record.sat,
          record.sun,
        ]
      );

      if (result.rowCount > 0) {
        insertedCount++;
      }
    }

    // 更新 nurse_role_history (讓 total_float_count + 1)
    if (employeeIdsArray.length > 0) {
      console.log(`📊 更新 ${employeeIdsArray.length} 位流動護士的歷史計數...`);
      const updateHistoryQuery = `
        INSERT INTO nurse_role_history (employee_id, total_fixed_count, total_float_count)
        SELECT unnest($1::text[]), 0, 1
        ON CONFLICT (employee_id) 
        DO UPDATE SET 
            total_float_count = nurse_role_history.total_float_count + 1,
            last_updated_at = CURRENT_TIMESTAMP
      `;
      await client.query(updateHistoryQuery, [employeeIdsArray]);
    }
    await client.query("COMMIT");

    console.log(`✅ 成功插入 ${insertedCount} 筆流動護士記錄`);

    res.json({
      success: true,
      message: `成功更新 ${insertedCount} 位流動護士的排班`,
      data: {
        insertedCount,
        records: floatRecords,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("應用流動護士排班失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message || "應用流動護士排班失敗",
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/nurse-schedules/float-schedule/:shift
 * 獲取指定時段的流動護士排班
 */
router.get("/float-schedule/:shift", requireNurse, async (req, res) => {
  try {
    const { shift } = req.params;

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

    // 先獲取該時段的所有護士
    const { rows: shiftNurses } = await pool.query(
      `
      SELECT e.employee_id, e.name
      FROM nurse_schedule ns
      JOIN employees e ON ns.employee_id = e.employee_id
      WHERE ns.scheduling_time = $1
    `,
      [schedulingTime]
    );

    if (!shiftNurses || shiftNurses.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const employeeIds = shiftNurses.map((n) => n.employee_id);

    // 獲取流動護士排班
    const { rows: floatSchedules } = await pool.query(
      `
      SELECT * FROM nurse_float
      WHERE employee_id = ANY($1)
    `,
      [employeeIds]
    );

    // 合併護士姓名
    const enrichedSchedules = floatSchedules.map((schedule) => {
      const nurse = shiftNurses.find(
        (n) => n.employee_id === schedule.employee_id
      );
      return {
        ...schedule,
        name: nurse?.name || "",
      };
    });

    res.json({
      success: true,
      data: enrichedSchedules,
    });
  } catch (error) {
    console.error("獲取流動護士排班失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message || "獲取流動護士排班失敗",
    });
  }
});

/**
 * DELETE /api/nurse-schedules/clear-shift/:shift
 * 強制重置：清除指定時段的排班，並將相關護士的歷史計數歸零
 */
router.delete("/clear-shift/:shift", requireNurse, async (req, res) => {
  const client = await pool.connect();

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

    await client.query("BEGIN");

    // 步驟 1: 找出該科別該時段的所有護士 ID
    // 我們必須在刪除資料前先鎖定是哪些人
    const { rows: nurses } = await client.query(
      `
      SELECT ns.employee_id
      FROM nurse_schedule ns
      JOIN employees e ON ns.employee_id = e.employee_id
      WHERE ns.scheduling_time = $1 
        AND e.department_code = $2
    `,
      [schedulingTime, departmentCode]
    );

    if (nurses.length === 0) {
      await client.query("COMMIT");
      return res.json({
        success: true,
        message: "該時段沒有排班資料",
        data: { clearedCount: 0 },
      });
    }

    const employeeIds = nurses.map((n) => n.employee_id);

    console.log(`🧹 準備重置 ${employeeIds.length} 位護士的資料...`);

    // 步驟 2: 刪除流動護士記錄 (nurse_float)
    const floatResult = await client.query(
      `DELETE FROM nurse_float WHERE employee_id = ANY($1)`,
      [employeeIds]
    );

    // 步驟 3: 清空固定排班分配 (nurse_schedule)
    // 將 surgery_room_id 設為 NULL，但保留排班時段紀錄
    const scheduleResult = await client.query(
      `
      UPDATE nurse_schedule 
      SET surgery_room_id = NULL
      WHERE employee_id = ANY($1) 
        AND scheduling_time = $2
    `,
      [employeeIds, schedulingTime]
    );

    // 【🔥 新增步驟 4: 重置歷史紀錄 (nurse_role_history)】
    // 將 total_fixed_count 和 total_float_count 歸零
    // 或者您也可以選擇直接刪除：DELETE FROM nurse_role_history WHERE ...
    const historyResult = await client.query(
      `
      UPDATE nurse_role_history 
      SET total_fixed_count = 0, 
          total_float_count = 0,
          last_updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = ANY($1)
      `,
      [employeeIds]
    );

    // 若希望更徹底，連資料都刪除（下次排班會自動重建），可以使用：
    // await client.query(`DELETE FROM nurse_role_history WHERE employee_id = ANY($1)`, [employeeIds]);

    await client.query("COMMIT");

    console.log(
      `✅ 重置完成: 
       - 清除流動紀錄: ${floatResult.rowCount} 筆
       - 重置固定分配: ${scheduleResult.rowCount} 筆
       - 歷史計數歸零: ${historyResult.rowCount} 筆`
    );

    res.json({
      success: true,
      message: `成功重置 ${shift} 時段排班與歷史紀錄`,
      data: {
        clearedFloatCount: floatResult.rowCount,
        clearedScheduleCount: scheduleResult.rowCount,
        resetHistoryCount: historyResult.rowCount,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("清除時段排班失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message || "清除排班失敗",
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/nurse-schedules/nurse/:employeeId/complete
 * 獲取單一護士的完整排班資訊（包含固定手術室和流動軌跡）
 */
router.get("/nurse/:employeeId/complete", requireNurse, async (req, res) => {
  try {
    const { employeeId } = req.params;

    // 查詢固定排班
    const { rows: schedules } = await pool.query(
      `
      SELECT 
        ns.scheduling_time,
        ns.surgery_room_type,
        ns.surgery_room_id,
        COALESCE(
          array_agg(nd.day_off ORDER BY nd.day_off) FILTER (WHERE nd.day_off IS NOT NULL),
          ARRAY[]::bigint[]
        ) as day_off_ids
      FROM nurse_schedule ns
      LEFT JOIN nurse_dayoff nd ON ns.employee_id = nd.id
      WHERE ns.employee_id = $1
      GROUP BY ns.scheduling_time, ns.surgery_room_type, ns.surgery_room_id
    `,
      [employeeId]
    );

    // 查詢流動排班
    const { rows: floatSchedules } = await pool.query(
      `SELECT * FROM nurse_float WHERE employee_id = $1`,
      [employeeId]
    );

    // 查詢護士基本資訊
    const { rows: nurses } = await pool.query(
      `SELECT employee_id, name FROM employees WHERE employee_id = $1`,
      [employeeId]
    );

    if (nurses.length === 0) {
      return res.status(404).json({
        success: false,
        error: "找不到該護士",
      });
    }

    res.json({
      success: true,
      data: {
        employeeId: nurses[0].employee_id,
        name: nurses[0].name,
        schedules: schedules.map((s) => ({
          shift: s.scheduling_time,
          roomType: s.surgery_room_type,
          fixedRoom: s.surgery_room_id,
          dayOff: s.day_off_ids.map((id) => id - 1), // 轉換為 0-6
        })),
        floatSchedules: floatSchedules,
      },
    });
  } catch (error) {
    console.error("獲取護士完整排班失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message || "獲取護士排班失敗",
    });
  }
});

/**
 * GET /api/nurse-schedules/shift-vacancy/:shift
 * 獲取指定時段每間手術室的空缺情況
 */
router.get("/shift-vacancy/:shift", requireNurse, async (req, res) => {
  try {
    const { shift } = req.params;

    // 轉換班別
    const shiftMap = {
      morning: "早班",
      evening: "晚班",
      night: "大夜班",
    };
    const schedulingTime = shiftMap[shift];

    // 查詢每間手術室的需求和實際分配人數
    const { rows: vacancies } = await pool.query(
      `
      WITH room_requirements AS (
        SELECT 
          sr.id as room_id,
          sr.room_type,
          sr.nurse_count as required_count
        FROM surgery_room sr
        WHERE sr.is_available = true
      ),
      assigned_nurses AS (
        SELECT 
          ns.surgery_room_id as room_id,
          COUNT(DISTINCT ns.employee_id) as assigned_count
        FROM nurse_schedule ns
        WHERE ns.scheduling_time = $1
          AND ns.surgery_room_id IS NOT NULL
        GROUP BY ns.surgery_room_id
      )
      SELECT 
        rr.room_id,
        rr.room_type,
        rr.required_count,
        COALESCE(an.assigned_count, 0) as assigned_count,
        (rr.required_count - COALESCE(an.assigned_count, 0)) as vacancy_count
      FROM room_requirements rr
      LEFT JOIN assigned_nurses an ON rr.room_id = an.room_id
      ORDER BY rr.room_id
    `,
      [schedulingTime]
    );

    res.json({
      success: true,
      data: vacancies,
    });
  } catch (error) {
    console.error("獲取時段空缺統計失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message || "獲取空缺統計失敗",
    });
  }
});

export default router;
