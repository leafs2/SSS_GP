// src/utils/api.js
// 統一的 API 請求工具

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * 統一的 API 請求函數
 * 自動帶 Cookie (credentials: 'include')
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    credentials: "include", // 重要：自動帶 Cookie
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || "API 請求失敗");
    }

    return data;
  } catch (error) {
    console.error("API 請求錯誤:", error);
    throw error;
  }
}

// ==================== Session API ====================

/**
 * 取得當前登入使用者資訊
 */
export async function getCurrentUser() {
  return apiRequest("/api/session/me");
}

/**
 * 檢查登入狀態
 */
export async function checkLoginStatus() {
  return apiRequest("/api/session/check");
}

/**
 * 登出
 */
export async function logout() {
  return apiRequest("/api/session/logout", {
    method: "POST",
  });
}

// ==================== FIDO 認證 API ====================

/**
 * 開始 FIDO 登入
 */
export async function fidoLoginBegin() {
  return apiRequest("/api/fido/authentication/begin", {
    method: "POST",
  });
}

/**
 * 驗證 FIDO 登入
 */
export async function fidoLoginVerify(sessionId, attResp) {
  return apiRequest("/api/fido/authentication/verify", {
    method: "POST",
    body: JSON.stringify({ sessionId, attResp }),
  });
}

// ==================== 開發模式 API ====================

/**
 * 取得所有測試帳號（開發模式）
 */
export async function getDevEmployees() {
  return apiRequest("/api/dev/employees");
}

/**
 * 快速登入（開發模式）
 */
export async function quickLogin(employeeId) {
  return apiRequest("/api/dev/quick-login", {
    method: "POST",
    body: JSON.stringify({ employee_id: employeeId }),
  });
}

/**
 * 檢查開發模式狀態
 */
export async function getDevStatus() {
  return apiRequest("/api/dev/status");
}

// ==================== 其他 API ====================

/**
 * 取得員工列表（管理員）
 */
export async function getEmployees() {
  return apiRequest("/api/employees");
}

/**
 * 取得科別列表
 */
export async function getDepartments() {
  return apiRequest("/api/departments");
}

/**
 * 通用 GET 請求
 */
export async function get(endpoint) {
  return apiRequest(endpoint, { method: "GET" });
}

/**
 * 通用 POST 請求
 */
export async function post(endpoint, data) {
  return apiRequest(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 通用 PUT 請求
 */
export async function put(endpoint, data) {
  return apiRequest(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * 通用 DELETE 請求
 */
export async function del(endpoint) {
  return apiRequest(endpoint, {
    method: "DELETE",
  });
}

export default {
  getCurrentUser,
  checkLoginStatus,
  logout,
  fidoLoginBegin,
  fidoLoginVerify,
  getDevEmployees,
  quickLogin,
  getDevStatus,
  getEmployees,
  getDepartments,
  get,
  post,
  put,
  del,
};
