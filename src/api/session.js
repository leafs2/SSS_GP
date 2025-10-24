// routes/session.js
// Session 相關的 API 端點

import express from "express";
import { requireAuth } from "./middleware/checkAuth.js";

const router = express.Router();

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

/**
 * GET /api/session/me
 * 取得當前登入使用者的資訊
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = req.session.user;

    // 從資料庫取得最新的使用者資訊
    const result = await pool.query(
      `SELECT e.*, d.name as department_name 
       FROM employees e 
       LEFT JOIN departments d ON e.department_code = d.code 
       WHERE e.employee_id = $1`,
      [user.employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "使用者不存在",
      });
    }

    const employeeData = result.rows[0];

    res.json({
      success: true,
      user: {
        employee_id: employeeData.employee_id,
        name: employeeData.name,
        email: employeeData.email,
        department_code: employeeData.department_code,
        department_name: employeeData.department_name,
        role: employeeData.role,
        role_display: employeeData.role === "D" ? "醫師" : "護理師",
        permission: employeeData.permission,
        permission_display:
          employeeData.permission === "1" ? "可修改" : "僅查看",
        status: employeeData.status,
      },
      sessionId: req.sessionID,
      loginTime: req.session.loginTime,
    });
  } catch (error) {
    console.error("取得使用者資訊失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/session/check
 * 檢查 Session 是否有效
 */
router.get("/check", (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      success: true,
      isLoggedIn: true,
      user: req.session.user,
    });
  } else {
    res.json({
      success: true,
      isLoggedIn: false,
    });
  }
});

/**
 * POST /api/session/logout
 * 登出（銷毀 Session）
 */
router.post("/logout", requireAuth, async (req, res) => {
  const sessionId = req.sessionID;
  const user = req.session.user;

  try {
    // 銷毀 Session
    req.session.destroy(async (err) => {
      if (err) {
        console.error("銷毀 Session 失敗:", err);
        return res.status(500).json({
          success: false,
          error: "登出失敗",
        });
      }

      // 從資料庫刪除 Session
      try {
        await pool.query("DELETE FROM sessions WHERE sid = $1", [sessionId]);
      } catch (dbError) {
        console.error("從資料庫刪除 Session 失敗:", dbError);
      }

      // 清除 Cookie
      res.clearCookie("connect.sid");

      console.log(`✅ 使用者 ${user.name} (${user.employee_id}) 已登出`);

      res.json({
        success: true,
        message: "登出成功",
      });
    });
  } catch (error) {
    console.error("登出失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/session/active
 * 取得目前活躍的 Session 列表（管理員功能）
 */
router.get("/active", requireAuth, async (req, res) => {
  try {
    // 只有管理員可以查看
    if (req.session.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "權限不足",
      });
    }

    const result = await pool.query(
      `SELECT 
        s.sid,
        s.employee_id,
        e.name,
        e.role,
        s.created_at,
        s.last_active,
        s.expire
       FROM sessions s
       LEFT JOIN employees e ON s.employee_id = e.employee_id
       WHERE s.expire > NOW()
       ORDER BY s.last_active DESC`
    );

    res.json({
      success: true,
      activeSessions: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("取得活躍 Session 失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/session/refresh
 * 重新整理 Session（延長有效期）
 */
router.post("/refresh", requireAuth, (req, res) => {
  req.session.touch(); // 更新 Session 過期時間

  res.json({
    success: true,
    message: "Session 已更新",
    newExpireTime: req.session.cookie.expires,
  });
});

export default router;
