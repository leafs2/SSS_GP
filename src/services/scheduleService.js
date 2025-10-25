// services/scheduleService.js
// 排班管理 API 服務層

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * 處理 API 回應
 */
const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    // 處理特殊錯誤
    if (response.status === 401 && data.needLogin) {
      // 未登入，可以觸發重新導向到登入頁
      throw {
        status: 401,
        error: "未登入",
        needLogin: true,
        message: data.message || "請先登入後再進行操作",
      };
    }

    throw {
      status: response.status,
      error: data.error || "操作失敗",
      message: data.message || "",
    };
  }

  return data;
};

/**
 * 取得所有排班類型定義
 * @returns {Promise<Array>} 排班類型陣列
 */
export const fetchScheduleTypes = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schedules/types`, {
      method: "GET",
      credentials: "include", // 重要：帶上 Cookie
    });

    const data = await handleResponse(response);
    return data.types || [];
  } catch (error) {
    console.error("取得排班類型失敗:", error);
    throw error;
  }
};

/**
 * 取得當前登入醫師的排班資料
 * @returns {Promise<Object|null>} 排班資料物件，若無排班則為 null
 */
export const fetchMySchedule = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schedules/me`, {
      method: "GET",
      credentials: "include",
    });

    const data = await handleResponse(response);
    return data.schedule; // 可能是 null（尚未建立排班）
  } catch (error) {
    console.error("取得我的排班失敗:", error);
    throw error;
  }
};

/**
 * 取得指定醫師的排班資料
 * @param {string} employeeId - 員工編號
 * @returns {Promise<Object|null>} 排班資料物件，若無排班則為 null
 */
export const fetchScheduleByEmployeeId = async (employeeId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/schedules/${employeeId}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const data = await handleResponse(response);
    return data.schedule;
  } catch (error) {
    console.error(`取得醫師 ${employeeId} 的排班失敗:`, error);
    throw error;
  }
};

/**
 * 更新當前醫師的排班
 * @param {Object} scheduleData - 排班資料
 * @param {string} [scheduleData.monday] - 週一排班類型 (A/B/C/D/E)
 * @param {string} [scheduleData.tuesday] - 週二排班類型
 * @param {string} [scheduleData.wednesday] - 週三排班類型
 * @param {string} [scheduleData.thursday] - 週四排班類型
 * @param {string} [scheduleData.friday] - 週五排班類型
 * @param {string} [scheduleData.saturday] - 週六排班類型
 * @param {string} [scheduleData.sunday] - 週日排班類型
 * @returns {Promise<Object>} 更新後的排班資料
 */
export const updateSchedule = async (scheduleData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schedules/update`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(scheduleData),
    });

    const data = await handleResponse(response);
    return data;
  } catch (error) {
    console.error("更新排班失敗:", error);
    throw error;
  }
};

/**
 * 刪除當前醫師的排班
 * @returns {Promise<Object>} 刪除結果
 */
export const deleteSchedule = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schedules/me`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await handleResponse(response);
    return data;
  } catch (error) {
    console.error("刪除排班失敗:", error);
    throw error;
  }
};

/**
 * 取得指定科別的所有醫師排班
 * @param {string} departmentCode - 科別代碼
 * @returns {Promise<Object>} 科別排班資料，包含 department 和 schedules 陣列
 */
export const fetchDepartmentSchedules = async (departmentCode) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/schedules/department/${departmentCode}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const data = await handleResponse(response);
    return {
      department: data.department,
      schedules: data.schedules || [],
      total: data.total || 0,
    };
  } catch (error) {
    console.error(`取得科別 ${departmentCode} 排班失敗:`, error);
    throw error;
  }
};

/**
 * 批次更新排班（完整七天）
 * @param {Object} fullSchedule - 完整七天的排班資料
 * @returns {Promise<Object>} 更新結果
 */
export const updateFullSchedule = async (fullSchedule) => {
  // 驗證是否包含所有七天
  const requiredDays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const missingDays = requiredDays.filter((day) => !fullSchedule[day]);

  if (missingDays.length > 0) {
    throw new Error(`缺少以下天數的排班資料: ${missingDays.join(", ")}`);
  }

  return updateSchedule(fullSchedule);
};

/**
 * 部分更新排班（只更新特定天數）
 * @param {Object} partialSchedule - 部分排班資料
 * @returns {Promise<Object>} 更新結果
 */
export const updatePartialSchedule = async (partialSchedule) => {
  // 驗證至少提供一天的資料
  const validDays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const providedDays = Object.keys(partialSchedule).filter((key) =>
    validDays.includes(key)
  );

  if (providedDays.length === 0) {
    throw new Error("請至少提供一天的排班資料");
  }

  return updateSchedule(partialSchedule);
};

export default {
  fetchScheduleTypes,
  fetchMySchedule,
  fetchScheduleByEmployeeId,
  updateSchedule,
  deleteSchedule,
  fetchDepartmentSchedules,
  updateFullSchedule,
  updatePartialSchedule,
};
