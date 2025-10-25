// schedules.js
// 醫師排班相關的 API 端點

import express from "express";
import { requireAuth } from "./middleware/checkAuth.js";

const router = express.Router();

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

/**
 * GET /api/schedules/types
 * 取得所有排班類型（A, B, C, D, E）的定義
 * 不需要登入即可查詢
 */
router.get("/types", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT type, category, time_info 
       FROM doctor_scheduling_type 
       ORDER BY type`
    );

    res.json({
      success: true,
      types: result.rows,
    });
  } catch (error) {
    console.error("取得排班類型失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得排班類型失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/schedules/me
 * 取得當前登入醫師的排班資料（含詳細類型資訊）
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const employeeId = req.session.user.employee_id;
    const userRole = req.session.user.role;

    // 檢查是否為醫師
    if (userRole !== "D") {
      return res.status(403).json({
        success: false,
        error: "權限不足",
        message: "只有醫師可以查看排班",
      });
    }

    // 查詢排班資料
    const scheduleResult = await pool.query(
      `SELECT 
        ds.employee_id,
        ds.monday,
        ds.tuesday,
        ds.wednesday,
        ds.thursday,
        ds.friday,
        ds.saturday,
        ds.sunday,
        e.name as doctor_name,
        e.department_code,
        d.name as department_name
       FROM doctor_schedule ds
       INNER JOIN employees e ON ds.employee_id = e.employee_id
       LEFT JOIN departments d ON e.department_code = d.code
       WHERE ds.employee_id = $1`,
      [employeeId]
    );

    // 如果該醫師還沒有排班記錄，回傳空排班
    if (scheduleResult.rows.length === 0) {
      return res.json({
        success: true,
        schedule: null,
        message: "尚未建立排班",
      });
    }

    const schedule = scheduleResult.rows[0];

    // 查詢所有類型的詳細資訊
    const typesResult = await pool.query(
      `SELECT type, category, time_info 
       FROM doctor_scheduling_type`
    );

    // 建立 type 對應表
    const typeMap = {};
    typesResult.rows.forEach((type) => {
      typeMap[type.type] = {
        category: type.category,
        time_info: type.time_info,
      };
    });

    // 組合完整的排班資料（包含每天的詳細資訊）
    const fullSchedule = {
      employee_id: schedule.employee_id,
      doctor_name: schedule.doctor_name,
      department_code: schedule.department_code,
      department_name: schedule.department_name,
      schedule: {
        monday: {
          type: schedule.monday,
          category: typeMap[schedule.monday]?.category || null,
          time_info: typeMap[schedule.monday]?.time_info || null,
        },
        tuesday: {
          type: schedule.tuesday,
          category: typeMap[schedule.tuesday]?.category || null,
          time_info: typeMap[schedule.tuesday]?.time_info || null,
        },
        wednesday: {
          type: schedule.wednesday,
          category: typeMap[schedule.wednesday]?.category || null,
          time_info: typeMap[schedule.wednesday]?.time_info || null,
        },
        thursday: {
          type: schedule.thursday,
          category: typeMap[schedule.thursday]?.category || null,
          time_info: typeMap[schedule.thursday]?.time_info || null,
        },
        friday: {
          type: schedule.friday,
          category: typeMap[schedule.friday]?.category || null,
          time_info: typeMap[schedule.friday]?.time_info || null,
        },
        saturday: {
          type: schedule.saturday,
          category: typeMap[schedule.saturday]?.category || null,
          time_info: typeMap[schedule.saturday]?.time_info || null,
        },
        sunday: {
          type: schedule.sunday,
          category: typeMap[schedule.sunday]?.category || null,
          time_info: typeMap[schedule.sunday]?.time_info || null,
        },
      },
    };

    res.json({
      success: true,
      schedule: fullSchedule,
    });
  } catch (error) {
    console.error("取得排班資料失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得排班資料失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/schedules/:employeeId
 * 取得指定醫師的排班資料
 * 任何登入的使用者都可以查看（用於查看其他醫師的排班）
 */
router.get("/:employeeId", requireAuth, async (req, res) => {
  try {
    const { employeeId } = req.params;

    // 檢查目標醫師是否存在且為醫師角色
    const employeeCheck = await pool.query(
      `SELECT employee_id, name, role, department_code 
       FROM employees 
       WHERE employee_id = $1`,
      [employeeId]
    );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在",
      });
    }

    if (employeeCheck.rows[0].role !== "D") {
      return res.status(400).json({
        success: false,
        error: "該員工不是醫師",
      });
    }

    // 查詢排班資料
    const scheduleResult = await pool.query(
      `SELECT 
        ds.employee_id,
        ds.monday,
        ds.tuesday,
        ds.wednesday,
        ds.thursday,
        ds.friday,
        ds.saturday,
        ds.sunday,
        e.name as doctor_name,
        e.department_code,
        d.name as department_name
       FROM doctor_schedule ds
       INNER JOIN employees e ON ds.employee_id = e.employee_id
       LEFT JOIN departments d ON e.department_code = d.code
       WHERE ds.employee_id = $1`,
      [employeeId]
    );

    if (scheduleResult.rows.length === 0) {
      return res.json({
        success: true,
        schedule: null,
        message: "該醫師尚未建立排班",
      });
    }

    const schedule = scheduleResult.rows[0];

    // 查詢所有類型的詳細資訊
    const typesResult = await pool.query(
      `SELECT type, category, time_info 
       FROM doctor_scheduling_type`
    );

    const typeMap = {};
    typesResult.rows.forEach((type) => {
      typeMap[type.type] = {
        category: type.category,
        time_info: type.time_info,
      };
    });

    // 組合完整資料
    const fullSchedule = {
      employee_id: schedule.employee_id,
      doctor_name: schedule.doctor_name,
      department_code: schedule.department_code,
      department_name: schedule.department_name,
      schedule: {
        monday: {
          type: schedule.monday,
          category: typeMap[schedule.monday]?.category || null,
          time_info: typeMap[schedule.monday]?.time_info || null,
        },
        tuesday: {
          type: schedule.tuesday,
          category: typeMap[schedule.tuesday]?.category || null,
          time_info: typeMap[schedule.tuesday]?.time_info || null,
        },
        wednesday: {
          type: schedule.wednesday,
          category: typeMap[schedule.wednesday]?.category || null,
          time_info: typeMap[schedule.wednesday]?.time_info || null,
        },
        thursday: {
          type: schedule.thursday,
          category: typeMap[schedule.thursday]?.category || null,
          time_info: typeMap[schedule.thursday]?.time_info || null,
        },
        friday: {
          type: schedule.friday,
          category: typeMap[schedule.friday]?.category || null,
          time_info: typeMap[schedule.friday]?.time_info || null,
        },
        saturday: {
          type: schedule.saturday,
          category: typeMap[schedule.saturday]?.category || null,
          time_info: typeMap[schedule.saturday]?.time_info || null,
        },
        sunday: {
          type: schedule.sunday,
          category: typeMap[schedule.sunday]?.category || null,
          time_info: typeMap[schedule.sunday]?.time_info || null,
        },
      },
    };

    res.json({
      success: true,
      schedule: fullSchedule,
    });
  } catch (error) {
    console.error("取得排班資料失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得排班資料失敗",
      message: error.message,
    });
  }
});

/**
 * POST /api/schedules/update
 * 更新當前登入醫師的排班
 * 只有醫師本人可以修改自己的排班
 */
router.post("/update", requireAuth, async (req, res) => {
  try {
    const employeeId = req.session.user.employee_id;
    const userRole = req.session.user.role;

    // 檢查是否為醫師
    if (userRole !== "D") {
      return res.status(403).json({
        success: false,
        error: "權限不足",
        message: "只有醫師可以修改排班",
      });
    }

    const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } =
      req.body;

    // 驗證：至少要提供一個欄位
    if (
      !monday &&
      !tuesday &&
      !wednesday &&
      !thursday &&
      !friday &&
      !saturday &&
      !sunday
    ) {
      return res.status(400).json({
        success: false,
        error: "請至少提供一個排班資料",
      });
    }

    // 驗證：所有提供的 type 必須存在於 doctor_scheduling_type
    const typesToValidate = [
      monday,
      tuesday,
      wednesday,
      thursday,
      friday,
      saturday,
      sunday,
    ].filter(Boolean);

    const validTypesResult = await pool.query(
      `SELECT type FROM doctor_scheduling_type WHERE type = ANY($1)`,
      [typesToValidate]
    );

    const validTypes = validTypesResult.rows.map((row) => row.type);
    const invalidTypes = typesToValidate.filter(
      (type) => !validTypes.includes(type)
    );

    if (invalidTypes.length > 0) {
      return res.status(400).json({
        success: false,
        error: "無效的排班類型",
        message: `以下類型不存在: ${invalidTypes.join(", ")}`,
      });
    }

    // 檢查是否已有排班記錄
    const existingSchedule = await pool.query(
      `SELECT employee_id FROM doctor_schedule WHERE employee_id = $1`,
      [employeeId]
    );

    if (existingSchedule.rows.length === 0) {
      // 新增排班記錄（所有欄位都必須提供）
      if (
        !monday ||
        !tuesday ||
        !wednesday ||
        !thursday ||
        !friday ||
        !saturday ||
        !sunday
      ) {
        return res.status(400).json({
          success: false,
          error: "首次建立排班需提供所有七天的資料",
        });
      }

      await pool.query(
        `INSERT INTO doctor_schedule 
         (employee_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          employeeId,
          monday,
          tuesday,
          wednesday,
          thursday,
          friday,
          saturday,
          sunday,
        ]
      );

      console.log(`✅ 醫師 ${employeeId} 建立新排班`);
    } else {
      // 更新現有排班（只更新有提供的欄位）
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (monday) {
        updates.push(`monday = $${paramIndex++}`);
        values.push(monday);
      }
      if (tuesday) {
        updates.push(`tuesday = $${paramIndex++}`);
        values.push(tuesday);
      }
      if (wednesday) {
        updates.push(`wednesday = $${paramIndex++}`);
        values.push(wednesday);
      }
      if (thursday) {
        updates.push(`thursday = $${paramIndex++}`);
        values.push(thursday);
      }
      if (friday) {
        updates.push(`friday = $${paramIndex++}`);
        values.push(friday);
      }
      if (saturday) {
        updates.push(`saturday = $${paramIndex++}`);
        values.push(saturday);
      }
      if (sunday) {
        updates.push(`sunday = $${paramIndex++}`);
        values.push(sunday);
      }

      values.push(employeeId);

      await pool.query(
        `UPDATE doctor_schedule 
         SET ${updates.join(", ")} 
         WHERE employee_id = $${paramIndex}`,
        values
      );

      console.log(`✅ 醫師 ${employeeId} 更新排班`);
    }

    // 回傳更新後的完整排班資料
    const updatedSchedule = await pool.query(
      `SELECT 
        ds.employee_id,
        ds.monday,
        ds.tuesday,
        ds.wednesday,
        ds.thursday,
        ds.friday,
        ds.saturday,
        ds.sunday,
        e.name as doctor_name
       FROM doctor_schedule ds
       INNER JOIN employees e ON ds.employee_id = e.employee_id
       WHERE ds.employee_id = $1`,
      [employeeId]
    );

    res.json({
      success: true,
      message: "排班更新成功",
      schedule: updatedSchedule.rows[0],
    });
  } catch (error) {
    console.error("更新排班失敗:", error);
    res.status(500).json({
      success: false,
      error: "更新排班失敗",
      message: error.message,
    });
  }
});

/**
 * DELETE /api/schedules/me
 * 刪除當前醫師的排班記錄
 * 只有醫師本人可以刪除自己的排班
 */
router.delete("/me", requireAuth, async (req, res) => {
  try {
    const employeeId = req.session.user.employee_id;
    const userRole = req.session.user.role;

    // 檢查是否為醫師
    if (userRole !== "D") {
      return res.status(403).json({
        success: false,
        error: "權限不足",
        message: "只有醫師可以刪除排班",
      });
    }

    // 檢查是否有排班記錄
    const existingSchedule = await pool.query(
      `SELECT employee_id FROM doctor_schedule WHERE employee_id = $1`,
      [employeeId]
    );

    if (existingSchedule.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "找不到排班記錄",
      });
    }

    // 刪除排班
    await pool.query(`DELETE FROM doctor_schedule WHERE employee_id = $1`, [
      employeeId,
    ]);

    console.log(`✅ 醫師 ${employeeId} 刪除排班`);

    res.json({
      success: true,
      message: "排班已刪除",
    });
  } catch (error) {
    console.error("刪除排班失敗:", error);
    res.status(500).json({
      success: false,
      error: "刪除排班失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/schedules/department/:departmentCode
 * 取得指定科別的所有醫師排班
 * 任何登入使用者都可以查詢（用於查看科別排班總覽）
 */
router.get("/department/:departmentCode", requireAuth, async (req, res) => {
  try {
    const { departmentCode } = req.params;

    // 檢查科別是否存在
    const deptCheck = await pool.query(
      `SELECT code, name FROM departments WHERE code = $1`,
      [departmentCode]
    );

    if (deptCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "科別不存在",
      });
    }

    // 查詢該科別所有醫師的排班
    const schedulesResult = await pool.query(
      `SELECT 
        ds.employee_id,
        ds.monday,
        ds.tuesday,
        ds.wednesday,
        ds.thursday,
        ds.friday,
        ds.saturday,
        ds.sunday,
        e.name as doctor_name,
        e.department_code,
        d.name as department_name
       FROM doctor_schedule ds
       INNER JOIN employees e ON ds.employee_id = e.employee_id
       LEFT JOIN departments d ON e.department_code = d.code
       WHERE e.department_code = $1 AND e.role = 'D'
       ORDER BY e.name`,
      [departmentCode]
    );

    // 查詢所有類型的詳細資訊
    const typesResult = await pool.query(
      `SELECT type, category, time_info 
       FROM doctor_scheduling_type`
    );

    const typeMap = {};
    typesResult.rows.forEach((type) => {
      typeMap[type.type] = {
        category: type.category,
        time_info: type.time_info,
      };
    });

    // 組合每位醫師的完整排班資料
    const schedules = schedulesResult.rows.map((schedule) => ({
      employee_id: schedule.employee_id,
      doctor_name: schedule.doctor_name,
      department_code: schedule.department_code,
      department_name: schedule.department_name,
      schedule: {
        monday: {
          type: schedule.monday,
          category: typeMap[schedule.monday]?.category || null,
          time_info: typeMap[schedule.monday]?.time_info || null,
        },
        tuesday: {
          type: schedule.tuesday,
          category: typeMap[schedule.tuesday]?.category || null,
          time_info: typeMap[schedule.tuesday]?.time_info || null,
        },
        wednesday: {
          type: schedule.wednesday,
          category: typeMap[schedule.wednesday]?.category || null,
          time_info: typeMap[schedule.wednesday]?.time_info || null,
        },
        thursday: {
          type: schedule.thursday,
          category: typeMap[schedule.thursday]?.category || null,
          time_info: typeMap[schedule.thursday]?.time_info || null,
        },
        friday: {
          type: schedule.friday,
          category: typeMap[schedule.friday]?.category || null,
          time_info: typeMap[schedule.friday]?.time_info || null,
        },
        saturday: {
          type: schedule.saturday,
          category: typeMap[schedule.saturday]?.category || null,
          time_info: typeMap[schedule.saturday]?.time_info || null,
        },
        sunday: {
          type: schedule.sunday,
          category: typeMap[schedule.sunday]?.category || null,
          time_info: typeMap[schedule.sunday]?.time_info || null,
        },
      },
    }));

    res.json({
      success: true,
      department: {
        code: deptCheck.rows[0].code,
        name: deptCheck.rows[0].name,
      },
      schedules: schedules,
      total: schedules.length,
    });
  } catch (error) {
    console.error("取得科別排班失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得科別排班失敗",
      message: error.message,
    });
  }
});

export default router;
