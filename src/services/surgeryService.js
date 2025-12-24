// services/surgeryService.js
// 手術排程相關的 API 服務

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * 處理 API 回應
 */
const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    // 處理特殊錯誤
    if (response.status === 401 && data.needLogin) {
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

const surgeryService = {
  /**
   * 新增手術排程
   * @param {Object} surgeryData - 手術資料
   * @param {number} surgeryData.patientId - 病患ID
   * @param {string} surgeryData.assistantDoctorId - 助理醫師ID (可選)
   * @param {string} surgeryData.surgeryTypeCode - 手術類型代碼
   * @param {string} surgeryData.surgeryRoomType - 手術室類型
   * @param {string} surgeryData.surgeryDate - 手術日期 (YYYY-MM-DD)
   * @param {number} surgeryData.duration - 手術時長(小時)
   * @param {number} surgeryData.nurseCount - 護理師數量
   * @returns {Promise<Object>} 新增結果
   */
  createSurgery: async (surgeryData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/surgery`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(surgeryData),
      });

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error("❌ 新增手術排程失敗:", error);
      throw error;
    }
  },

  /**
   * 查詢手術排程
   * @param {string} surgeryId - 手術編號
   * @returns {Promise<Object>} 手術詳細資料
   */
  getSurgery: async (surgeryId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/surgery/${surgeryId}`, {
        method: "GET",
        credentials: "include",
      });

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error("❌ 查詢手術排程失敗:", error);
      throw error;
    }
  },

  /**
   * 獲取待排程手術清單
   * @param {string} startDate - 開始日期 (YYYY-MM-DD) (可選)
   * @param {string} endDate - 結束日期 (YYYY-MM-DD) (可選)
   * @returns {Promise<Object>} 待排程手術清單
   */
  getPendingSurgeries: async (startDate, endDate) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const queryString = params.toString();
      const url = `${API_BASE_URL}/api/surgery/pending/list${
        queryString ? `?${queryString}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error("❌ 獲取待排程清單失敗:", error);
      throw error;
    }
  },

  /**
   * 獲取待排程手術數量（按週分組）
   * @returns {Promise<Object>} 待排程數量統計
   */
  getPendingCount: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/surgery/pending/count`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error("❌ 獲取待排程數量失敗:", error);
      throw error;
    }
  },

  /**
   * 獲取指定日期範圍的手術列表
   * @param {string} startDate - 開始日期 (YYYY-MM-DD)
   * @param {string} endDate - 結束日期 (YYYY-MM-DD)
   * @param {string} roomType - 手術室類型 (可選)
   * @returns {Promise<Object>} 手術列表
   */
  getSurgeriesByDateRange: async (startDate, endDate, roomType) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (roomType) params.append("roomType", roomType);

      const queryString = params.toString();
      const url = `${API_BASE_URL}/api/surgery/list${
        queryString ? `?${queryString}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error("❌ 獲取手術列表失敗:", error);
      throw error;
    }
  },

  /**
   * 更新手術排程
   * @param {string} surgeryId - 手術編號
   * @param {Object} updateData - 要更新的資料
   * @returns {Promise<Object>} 更新結果
   */
  updateSurgery: async (surgeryId, updateData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/surgery/${surgeryId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error("❌ 更新手術排程失敗:", error);
      throw error;
    }
  },

  /**
   * 刪除手術排程
   * @param {string} surgeryId - 手術編號
   * @returns {Promise<Object>} 刪除結果
   */
  deleteSurgery: async (surgeryId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/surgery/${surgeryId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error("❌ 刪除手術排程失敗:", error);
      throw error;
    }
  },

  /**
   * 分配手術到手術室
   * @param {string} surgeryId - 手術編號
   * @param {string} roomId - 手術室ID
   * @param {string} correctTime - 確切時間 (HH:mm:ss)
   * @returns {Promise<Object>} 分配結果
   */
  assignSurgeryRoom: async (surgeryId, roomId, correctTime) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/surgery/${surgeryId}/assign`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId,
            correctTime,
          }),
        }
      );

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error("❌ 分配手術室失敗:", error);
      throw error;
    }
  },

  /**
   * 獲取今日手術列表
   * @returns {Promise<Array>} 手術列表
   */
  getTodaySurgeries: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/surgery/today/list`, {
        method: "GET",
        credentials: "include",
      });
      const data = await handleResponse(response);
      return data.data; // 注意後端回傳格式是 { success: true, data: [...] }
    } catch (error) {
      console.error("❌ 獲取今日手術失敗:", error);
      throw error;
    }
  },

  /**
   * 啟動手術
   * @param {string} surgeryId
   */
  startSurgery: async (surgeryId) => {
    const response = await fetch(
      `${API_BASE_URL}/api/surgery/${surgeryId}/start`,
      {
        method: "POST",
        credentials: "include",
      }
    );
    return handleResponse(response);
  },

  /**
   * 延長手術
   * @param {string} surgeryId
   * @param {number} minutes 延長分鐘數
   */
  extendSurgery: async (surgeryId, minutes = 30) => {
    const response = await fetch(
      `${API_BASE_URL}/api/surgery/${surgeryId}/extend`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
        credentials: "include",
      }
    );
    return handleResponse(response);
  },

  /**
   * 結束手術
   * @param {string} surgeryId
   */
  finishSurgery: async (surgeryId) => {
    const response = await fetch(
      `${API_BASE_URL}/api/surgery/${surgeryId}/finish`,
      {
        method: "POST",
        credentials: "include",
      }
    );
    return handleResponse(response);
  },

  /**
   * 獲取月排程資料
   * @param {number} year
   * @param {number} month (1-12)
   */
  getMonthlySchedule: async (year, month) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/surgery/monthly?year=${year}&month=${month}`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      const data = await handleResponse(response);
      return data.data;
    } catch (error) {
      console.error("❌ 獲取月排程失敗:", error);
      throw error;
    }
  },
};

export default surgeryService;
