// assistantShifts.js
// 助理醫師（住院醫師）排班相關的 API 端點
// ✅ 完全修正時區問題版本

import express from "express";
import { requireAuth } from "./middleware/checkAuth.js";

const router = express.Router();

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

/**
 * GET /api/assistant-shifts/statistics
 * 獲取住院醫師統計資料
 * Query params: department_code, year, month
 */
router.get("/statistics", requireAuth, async (req, res) => {
  try {
    const { department_code, year, month } = req.query;

    if (!department_code || !year || !month) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數",
      });
    }

    // 計算月份的第一天和最後一天
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(
      lastDay.getDate()
    ).padStart(2, "0")}`;

    // 先獲取該科別的所有住院醫師
    const doctorsResult = await pool.query(
      `SELECT 
        e.employee_id,
        e.name,
        e.department_code
      FROM employees e
      WHERE e.department_code = $1 
        AND e.role = 'A'
        AND e.status = 'active'
      ORDER BY e.name`,
      [department_code]
    );
    const doctors = doctorsResult.rows;

    if (doctors.length === 0) {
      return res.json({
        success: true,
        doctors: [],
        summary: {
          total_doctors: 0,
          average_shifts: 0,
          max_shifts: 0,
          min_shifts: 0,
        },
      });
    }

    // ✅ 使用 TO_CHAR 避免時區問題
    const employeeIds = doctors.map((d) => d.employee_id);
    const shiftsResult = await pool.query(
      `SELECT 
        employee_id,
        TO_CHAR(date, 'YYYY-MM-DD') as date
      FROM assistant_doctor_scheduling
      WHERE date >= $1 AND date <= $2
        AND employee_id = ANY($3)
      ORDER BY date`,
      [firstDay, lastDayStr, employeeIds]
    );
    const shifts = shiftsResult.rows;

    // 計算當前週的起始和結束日期
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // 計算每位醫師的統計資料
    const doctorStats = doctors.map((doctor) => {
      const doctorShifts = shifts.filter(
        (s) => s.employee_id === doctor.employee_id
      );

      const totalShiftsThisMonth = doctorShifts.length;

      // ✅ 使用字串比較，避免時區問題
      const shiftsThisWeek = doctorShifts.filter((s) => {
        return s.date >= weekStartStr && s.date <= weekEndStr;
      }).length;

      const lastShiftDate =
        doctorShifts.length > 0
          ? doctorShifts[doctorShifts.length - 1].date
          : null;

      // ✅ 使用字串操作計算下次可排日期
      let nextAvailableDate = null;
      if (lastShiftDate) {
        const [y, m, d] = lastShiftDate.split("-").map(Number);
        const lastDate = new Date(y, m - 1, d);
        lastDate.setDate(lastDate.getDate() + 2);
        const nextYear = lastDate.getFullYear();
        const nextMonth = String(lastDate.getMonth() + 1).padStart(2, "0");
        const nextDay = String(lastDate.getDate()).padStart(2, "0");
        nextAvailableDate = `${nextYear}-${nextMonth}-${nextDay}`;
      }

      const maxPossibleShifts = 15;
      const shiftPercentage = Math.round(
        (totalShiftsThisMonth / maxPossibleShifts) * 100
      );

      let status = "available";
      if (shiftsThisWeek >= 3) {
        status = "unavailable";
      } else if (shiftsThisWeek === 2) {
        status = "warning";
      }

      return {
        employee_id: doctor.employee_id,
        name: doctor.name,
        total_shifts_this_month: totalShiftsThisMonth,
        shifts_this_week: shiftsThisWeek,
        last_shift_date: lastShiftDate,
        next_available_date: nextAvailableDate,
        shift_percentage: shiftPercentage,
        status,
      };
    });

    // 計算統計摘要
    const totalDoctors = doctors.length;
    const totalShifts = doctorStats.reduce(
      (sum, d) => sum + d.total_shifts_this_month,
      0
    );
    const averageShifts = totalDoctors > 0 ? totalShifts / totalDoctors : 0;
    const maxShifts = Math.max(
      ...doctorStats.map((d) => d.total_shifts_this_month),
      0
    );
    const minShifts =
      totalDoctors > 0
        ? Math.min(...doctorStats.map((d) => d.total_shifts_this_month))
        : 0;

    res.json({
      success: true,
      doctors: doctorStats,
      summary: {
        total_doctors: totalDoctors,
        average_shifts: averageShifts,
        max_shifts: maxShifts,
        min_shifts: minShifts,
      },
    });
  } catch (error) {
    console.error("獲取醫師統計失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取統計資料失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/assistant-shifts/calendar
 * 獲取月份排班日曆資料
 * Query params: department_code, year, month
 */
router.get("/calendar", requireAuth, async (req, res) => {
  try {
    const { department_code, year, month } = req.query;

    if (!department_code || !year || !month) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數",
      });
    }

    // 計算月份資訊
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();

    // 調整為週一開始
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    // 獲取該月所有排班
    const firstDayStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(
      totalDays
    ).padStart(2, "0")}`;

    // ✅ 使用 TO_CHAR 避免時區問題
    const shiftsResult = await pool.query(
      `SELECT 
        TO_CHAR(ads.date, 'YYYY-MM-DD') as date,
        ads.employee_id,
        e.name
      FROM assistant_doctor_scheduling ads
      JOIN employees e ON ads.employee_id = e.employee_id
      WHERE ads.date >= $1 AND ads.date <= $2
        AND e.department_code = $3
      ORDER BY ads.date, e.name`,
      [firstDayStr, lastDayStr, department_code]
    );

    // 組織排班資料
    const shifts = {};
    shiftsResult.rows.forEach((row) => {
      const dateStr = row.date;
      if (!shifts[dateStr]) {
        shifts[dateStr] = {
          doctors: [],
          status: "empty",
          violations: [],
        };
      }
      shifts[dateStr].doctors.push({
        employee_id: row.employee_id,
        name: row.name,
      });
    });

    // 更新狀態
    Object.keys(shifts).forEach((dateStr) => {
      const doctorCount = shifts[dateStr].doctors.length;
      if (doctorCount === 0) {
        shifts[dateStr].status = "empty";
      } else if (doctorCount === 1) {
        shifts[dateStr].status = "incomplete";
      } else if (doctorCount === 2) {
        shifts[dateStr].status = "complete";
      } else {
        shifts[dateStr].status = "violation";
        shifts[dateStr].violations.push({
          type: "too_many_doctors",
          message: `該日有 ${doctorCount} 位值班醫師（應為2位）`,
        });
      }
    });

    res.json({
      success: true,
      month_info: {
        year: parseInt(year),
        month: parseInt(month),
        total_days: totalDays,
        first_day_of_week: adjustedFirstDay,
      },
      shifts,
    });
  } catch (error) {
    console.error("獲取排班日曆失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取排班日曆失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/assistant-shifts/available-for-date
 * 獲取特定日期可選醫師
 * Query params: date, department_code
 */
router.get("/available-for-date", requireAuth, async (req, res) => {
  try {
    const { date, department_code } = req.query;

    if (!date || !department_code) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數",
      });
    }

    // ✅ 使用字串操作避免時區問題
    const [targetYear, targetMonth, targetDay] = date.split("-").map(Number);
    const targetDate = new Date(targetYear, targetMonth - 1, targetDay);

    const year = targetYear;
    const month = targetMonth;

    // 計算該週的起始和結束日期
    const dayOfWeek = targetDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(targetDate);
    weekStart.setDate(targetDate.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // 計算月份範圍
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(
      lastDay.getDate()
    ).padStart(2, "0")}`;

    // 獲取所有住院醫師
    const doctorsResult = await pool.query(
      `SELECT 
        e.employee_id,
        e.name
      FROM employees e
      WHERE e.department_code = $1 
        AND e.role = 'A'
        AND e.status = 'active'
      ORDER BY e.name`,
      [department_code]
    );
    const doctors = doctorsResult.rows;

    // ✅ 使用 TO_CHAR 避免時區問題
    const employeeIds = doctors.map((d) => d.employee_id);
    const shiftsResult = await pool.query(
      `SELECT 
        employee_id,
        TO_CHAR(date, 'YYYY-MM-DD') as date
      FROM assistant_doctor_scheduling
      WHERE employee_id = ANY($1)
        AND (
          (date >= $2 AND date <= $3) OR
          (date >= $4 AND date <= $5)
        )
      ORDER BY date`,
      [employeeIds, firstDay, lastDayStr, weekStartStr, weekEndStr]
    );
    const shifts = shiftsResult.rows;

    // ✅ 前一天的日期（避免時區問題）
    const [y, m, d] = date.split("-").map(Number);
    const yesterdayDate = new Date(y, m - 1, d);
    yesterdayDate.setDate(d - 1);
    const yy = yesterdayDate.getFullYear();
    const mm = String(yesterdayDate.getMonth() + 1).padStart(2, "0");
    const dd = String(yesterdayDate.getDate()).padStart(2, "0");
    const yesterdayStr = `${yy}-${mm}-${dd}`;

    // 計算每位醫師的可用性
    const doctorAvailability = doctors.map((doctor) => {
      const doctorShifts = shifts.filter(
        (s) => s.employee_id === doctor.employee_id
      );

      // ✅ 使用字串比較
      const monthShifts = doctorShifts.filter((s) => {
        return s.date >= firstDay && s.date <= lastDayStr;
      });
      const totalShifts = monthShifts.length;

      const weekShifts = doctorShifts.filter((s) => {
        return s.date >= weekStartStr && s.date <= weekEndStr;
      });
      const weeklyShifts = weekShifts.length;

      // ✅ 檢查前一天是否值班
      const workedYesterday = doctorShifts.some((s) => {
        return s.date === yesterdayStr;
      });

      const lastShiftDate =
        doctorShifts.length > 0
          ? doctorShifts[doctorShifts.length - 1].date
          : null;

      const maxPossibleShifts = 15;
      const shiftPercentage = Math.round(
        (totalShifts / maxPossibleShifts) * 100
      );

      let available = true;
      let priority = "normal";
      let unavailableReason = null;

      if (workedYesterday) {
        available = false;
        unavailableReason = "must_rest";
      } else if (weeklyShifts >= 3) {
        available = false;
        unavailableReason = "weekly_limit";
      } else if (weeklyShifts === 0) {
        priority = "recommended";
      } else if (weeklyShifts === 2) {
        priority = "warning";
      }

      return {
        employee_id: doctor.employee_id,
        name: doctor.name,
        available,
        priority: available ? priority : null,
        total_shifts: totalShifts,
        weekly_shifts: weeklyShifts,
        last_shift_date: lastShiftDate,
        shift_percentage: shiftPercentage,
        unavailable_reason: unavailableReason,
      };
    });

    doctorAvailability.sort((a, b) => {
      const priorityOrder = { recommended: 0, normal: 1, warning: 2, null: 3 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      return a.total_shifts - b.total_shifts;
    });

    res.json({
      success: true,
      date,
      week_range: {
        start: weekStartStr,
        end: weekEndStr,
      },
      doctors: doctorAvailability,
    });
  } catch (error) {
    console.error("獲取可選醫師失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取可選醫師失敗",
      message: error.message,
    });
  }
});

/**
 * POST /api/assistant-shifts/save
 * 儲存排班資料
 */
router.post("/save", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { department_code, year, month, shifts } = req.body;
    const user = req.session.user;

    // 檢查權限 (假設 '1' 是總醫師權限)
    if (user.permission !== "1") {
      return res.status(403).json({
        success: false,
        error: "權限不足",
      });
    }

    if (!department_code || !year || !month || !shifts) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數",
      });
    }

    await client.query("BEGIN");

    // 1. 提取本次請求中涉及的所有日期
    // 前端傳來的格式是 [{ date: '2023-10-01', doctor_ids: [...] }, ...]
    const datesToUpdate = shifts.map((s) => s.date);

    if (datesToUpdate.length > 0) {
      // 2. ⭐ 關鍵修正：只刪除「本次要更新的日期」的舊資料，而不是刪除整個月
      await client.query(
        `DELETE FROM assistant_doctor_scheduling
         WHERE date = ANY($1::date[]) 
           AND employee_id IN (
             SELECT employee_id FROM employees WHERE department_code = $2
           )`,
        [datesToUpdate, department_code]
      );
    }

    const violations = [];
    const warnings = [];
    let savedCount = 0;

    // 3. 寫入新資料
    for (const shift of shifts) {
      const { date, doctor_ids } = shift;

      // 如果 doctor_ids 是空陣列，代表該日清空，上面 DELETE 已經處理過了，這裡直接跳過 insert
      if (!doctor_ids || doctor_ids.length === 0) continue;

      if (doctor_ids.length !== 2) {
        warnings.push({
          date,
          message: `該日只有${doctor_ids.length}位值班醫師`,
        });
      }

      for (const doctorId of doctor_ids) {
        await client.query(
          `INSERT INTO assistant_doctor_scheduling (employee_id, date)
           VALUES ($1, $2)`,
          [doctorId, date]
        );
        savedCount++;
      }
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      saved_count: savedCount,
      violations,
      warnings,
      message: "排班儲存成功",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("儲存排班失敗:", error);
    res.status(500).json({
      success: false,
      error: "儲存排班失敗",
      message: error.message,
    });
  } finally {
    client.release();
  }
});

export default router;
