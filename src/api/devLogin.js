// routes/devLogin.js
// 開發環境專用：快速登入 API（跳過 FIDO 驗證）
// ⚠️ 只在 NODE_ENV=development 時啟用

import express from "express";

const router = express.Router();

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

/**
 * GET /api/dev/employees
 * 取得所有已註冊的員工列表（供快速登入選擇）
 */
router.get("/employees", async (req, res) => {
  // 檢查是否為開發環境
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({
      success: false,
      error: "此功能僅在開發環境可用",
    });
  }

  try {
    const result = await pool.query(
      `SELECT 
        e.id,
        e.employee_id,
        e.name,
        e.email,
        e.department_code,
        d.name as department_name,
        e.role,
        e.permission,
        e.status,
        COUNT(fc.id) as credential_count
       FROM employees e
       LEFT JOIN departments d ON e.department_code = d.code
       LEFT JOIN fido_credentials fc ON e.employee_id = fc.employee_id
       WHERE e.status = 'active'
       GROUP BY e.id, e.employee_id, e.name, e.email, 
                e.department_code, d.name, e.role, e.permission, e.status
       ORDER BY e.department_code, e.name`
    );

    const employees = result.rows.map((emp) => ({
      id: emp.id,
      employee_id: emp.employee_id,
      name: emp.name,
      email: emp.email,
      department_code: emp.department_code,
      department_name: emp.department_name,
      role: emp.role,
      role_display:
        emp.role === "D" ? "醫師" : emp.role === "A" ? "助理醫師" : "護理師",
      permission: emp.permission,
      permission_display: emp.permission === "1" ? "可修改" : "僅查看",
      status: emp.status,
      has_fido: emp.credential_count > 0,
    }));

    res.json({
      success: true,
      employees,
      total: employees.length,
      warning: "⚠️ 此為開發環境專用功能",
    });
  } catch (error) {
    console.error("取得員工列表失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/dev/quick-login
 * 快速登入（跳過 FIDO 驗證）
 */
router.post("/quick-login", async (req, res) => {
  // 檢查是否為開發環境
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({
      success: false,
      error: "此功能僅在開發環境可用",
    });
  }

  const { employee_id } = req.body;

  if (!employee_id) {
    return res.status(400).json({
      success: false,
      error: "請提供員工編號",
    });
  }

  try {
    // 查詢員工資料
    const result = await pool.query(
      `SELECT e.*, d.name as department_name 
       FROM employees e 
       LEFT JOIN departments d ON e.department_code = d.code 
       WHERE e.employee_id = $1 AND e.status = 'active'`,
      [employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在或未啟用",
      });
    }

    const employee = result.rows[0];

    // 建立 Session（跳過 FIDO 驗證）
    req.session.user = {
      employee_id: employee.employee_id,
      name: employee.name,
      email: employee.email,
      department_code: employee.department_code,
      department_name: employee.department_name,
      role: employee.role,
      role_display:
        employee.role === "D"
          ? "醫師"
          : employee.role === "A"
          ? "助理醫師"
          : "護理師",
      permission: employee.permission,
      permission_display: employee.permission === "1" ? "可修改" : "僅查看",
    };

    req.session.loginTime = new Date().toISOString();
    req.session.loginMethod = "quick-login"; // 標記為快速登入

    // 儲存 Session
    req.session.save((err) => {
      if (err) {
        console.error("儲存 Session 失敗:", err);
        return res.status(500).json({
          success: false,
          error: "登入失敗",
        });
      }

      // 更新資料庫中的 employee_id（方便查詢）
      pool
        .query("UPDATE sessions SET employee_id = $1 WHERE sid = $2", [
          employee.employee_id,
          req.sessionID,
        ])
        .catch((dbError) => {
          console.error("更新 Session employee_id 失敗:", dbError);
        });

      console.log(
        `🚀 [開發模式] ${employee.name} (${employee.employee_id}) 快速登入成功`
      );

      res.json({
        success: true,
        message: "快速登入成功",
        user: req.session.user,
        sessionId: req.sessionID,
        warning: "⚠️ 這是開發環境的快速登入，生產環境將不可用",
      });
    });
  } catch (error) {
    console.error("快速登入失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/dev/status
 * 檢查開發模式狀態
 */
router.get("/status", (req, res) => {
  res.json({
    isDevelopment: process.env.NODE_ENV === "development",
    quickLoginAvailable: process.env.NODE_ENV === "development",
    environment: process.env.NODE_ENV || "production",
  });
});

export default router;
