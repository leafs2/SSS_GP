// surgeryTypes.js
// 手術類型相關的 API 端點

import express from "express";
import { requireAuth } from "./middleware/checkAuth.js";

const router = express.Router();

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

/**
 * GET /api/surgery-types/departments
 * 取得所有可用科別列表
 * 不需要登入即可查詢
 */
router.get("/departments", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT main_subjects 
       FROM surgery_type_code 
       WHERE is_active = true 
       ORDER BY main_subjects`
    );

    const departments = result.rows.map((row) => row.main_subjects);

    res.json({
      success: true,
      data: departments,
      total: departments.length,
    });
  } catch (error) {
    console.error("取得科別列表失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得科別列表失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/surgery-types/by-department
 * 根據科別取得手術類型列表
 * 需要登入才能查詢
 */
router.get("/by-department", requireAuth, async (req, res) => {
  try {
    const { department } = req.query;

    if (!department) {
      return res.status(400).json({
        success: false,
        error: "請提供科別參數",
        message: "department 參數為必填",
      });
    }

    // 查詢該科別的所有手術類型
    const result = await pool.query(
      `SELECT 
        surgery_code,
        main_subjects,
        internal_code,
        surgery_name,
        default_nurse_count,
        default_duration,
        is_active
       FROM surgery_type_code
       WHERE main_subjects = $1 AND is_active = true
       ORDER BY surgery_name`,
      [department]
    );

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      department: department,
    });
  } catch (error) {
    console.error("取得手術類型失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得手術類型失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/surgery-types/my-department
 * 根據當前登入醫師的科別取得手術類型列表
 * 需要登入，且只有醫師可以查詢
 */
router.get("/my-department", requireAuth, async (req, res) => {
  try {
    const employeeId = req.session.user.employee_id;
    const userRole = req.session.user.role;

    // 檢查是否為醫師
    if (userRole !== "D") {
      return res.status(403).json({
        success: false,
        error: "權限不足",
        message: "只有醫師可以查詢手術類型",
      });
    }

    // 先取得醫師的科別
    const doctorResult = await pool.query(
      `SELECT e.department_code, d.name as department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_code = d.code
       WHERE e.employee_id = $1`,
      [employeeId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "找不到醫師資料",
      });
    }

    const departmentCode = doctorResult.rows[0].department_code;
    const departmentName = doctorResult.rows[0].department_name;

    if (!departmentCode) {
      return res.status(400).json({
        success: false,
        error: "醫師尚未設定科別",
      });
    }

    // 查詢該科別的所有手術類型
    const result = await pool.query(
      `SELECT 
        surgery_code,
        main_subjects,
        internal_code,
        surgery_name,
        default_nurse_count,
        default_duration,
        is_active
       FROM surgery_type_code
       WHERE main_subjects = $1 AND is_active = true
       ORDER BY surgery_name`,
      [departmentCode]
    );

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      department: {
        code: departmentCode,
        name: departmentName,
      },
    });
  } catch (error) {
    console.error("取得手術類型失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得手術類型失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/surgery-types/:surgeryCode
 * 根據手術代碼取得手術類型詳細資訊
 * 需要登入才能查詢
 */
router.get("/:surgeryCode", requireAuth, async (req, res) => {
  try {
    const { surgeryCode } = req.params;

    const result = await pool.query(
      `SELECT 
        surgery_code,
        main_subjects,
        internal_code,
        surgery_name,
        default_nurse_count,
        default_duration,
        is_active
       FROM surgery_type_code
       WHERE surgery_code = $1 AND is_active = true`,
      [surgeryCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "找不到該手術類型",
        message: `手術代碼 ${surgeryCode} 不存在或已停用`,
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("取得手術類型詳細資訊失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得手術類型詳細資訊失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/surgery-types
 * 取得所有手術類型（支援篩選）
 * 需要登入才能查詢
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { department, keyword, active } = req.query;

    let queryText = `
      SELECT 
        surgery_code,
        main_subjects,
        internal_code,
        surgery_name,
        default_nurse_count,
        default_duration,
        is_active
      FROM surgery_type_code
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // 科別篩選
    if (department) {
      queryText += ` AND main_subjects = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    // 關鍵字搜尋
    if (keyword) {
      queryText += ` AND (surgery_name LIKE $${paramIndex} OR surgery_code LIKE $${paramIndex})`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    // 啟用狀態篩選
    if (active !== undefined) {
      queryText += ` AND is_active = $${paramIndex}`;
      params.push(active === "true");
      paramIndex++;
    } else {
      // 預設只顯示啟用的
      queryText += ` AND is_active = true`;
    }

    queryText += ` ORDER BY main_subjects, surgery_name`;

    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      filters: {
        department: department || null,
        keyword: keyword || null,
        active: active !== undefined ? active === "true" : true,
      },
    });
  } catch (error) {
    console.error("取得手術類型列表失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得手術類型列表失敗",
      message: error.message,
    });
  }
});

export default router;
