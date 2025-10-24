// middleware/checkAuth.js
// 檢查使用者是否已登入的中介軟體

/**
 * 檢查使用者是否已登入
 * 如果未登入，回傳 401 錯誤
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: "未登入",
      message: "請先登入後再進行操作",
      needLogin: true,
    });
  }

  // 已登入，繼續處理
  next();
}

/**
 * 檢查使用者權限
 * @param {string} requiredPermission - 需要的權限等級 ('1' 可修改, '0' 僅查看)
 */
export function requirePermission(requiredPermission) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: "未登入",
        needLogin: true,
      });
    }

    const userPermission = req.session.user.permission;

    // 如果需要權限 1，但使用者只有權限 0
    if (requiredPermission === "1" && userPermission !== "1") {
      return res.status(403).json({
        success: false,
        error: "權限不足",
        message: "您沒有權限執行此操作",
      });
    }

    next();
  };
}

/**
 * 檢查使用者角色
 * @param {string[]} allowedRoles - 允許的角色列表 ['D', 'N', 'admin']
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: "未登入",
        needLogin: true,
      });
    }

    const userRole = req.session.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: "權限不足",
        message: `此功能僅限 ${allowedRoles.join("、")} 使用`,
      });
    }

    next();
  };
}

/**
 * 更新 Session 的最後活動時間
 */
export async function updateSessionActivity(pool, sessionId) {
  try {
    await pool.query("UPDATE sessions SET last_active = NOW() WHERE sid = $1", [
      sessionId,
    ]);
  } catch (error) {
    console.error("更新 Session 活動時間失敗:", error);
  }
}
