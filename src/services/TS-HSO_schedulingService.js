// src/services/TS-HSO_schedulingService.js
// TS-HSO 手術排程相關的 API 服務

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const tshsoSchedulingService = {
  /**
   * 手動觸發排程
   * @param {Object} options - 可選參數
   * @param {Object} options.date_range - 日期範圍 {start, end}
   */
  triggerScheduling: async (options = {}) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tshso-scheduling/trigger`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(options),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "觸發排程失敗");
      }

      return data;
    } catch (error) {
      console.error("觸發排程失敗:", error);
      throw error;
    }
  },

  /**
   * 取得待排程清單
   * @param {string} startDate - 開始日期 (YYYY-MM-DD)
   * @param {string} endDate - 結束日期 (YYYY-MM-DD)
   */
  fetchPendingSurgeries: async (startDate, endDate) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tshso-scheduling/pending?start_date=${startDate}&end_date=${endDate}`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "取得待排程清單失敗");
      }

      return {
        surgeries: data.data,
        total: data.total,
      };
    } catch (error) {
      console.error("取得待排程清單失敗:", error);
      throw error;
    }
  },

  /**
   * 取得待排程數量
   */
  fetchPendingCount: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tshso-scheduling/pending/count`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "取得待排程數量失敗");
      }

      return data.count;
    } catch (error) {
      console.error("取得待排程數量失敗:", error);
      throw error;
    }
  },

  /**
   * 取得指定日期的排程結果
   * @param {string} date - 日期 (YYYY-MM-DD)
   */
  fetchScheduleByDate: async (date) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tshso-scheduling/results/${date}`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "取得排程結果失敗");
      }

      return data.data;
    } catch (error) {
      console.error("取得排程結果失敗:", error);
      throw error;
    }
  },

  /**
   * 取得日期範圍的排程結果
   * @param {string} startDate - 開始日期
   * @param {string} endDate - 結束日期
   */
  fetchScheduleByRange: async (startDate, endDate) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tshso-scheduling/results/range?start_date=${startDate}&end_date=${endDate}`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "取得排程結果失敗");
      }

      return {
        schedules: data.data,
        total: data.total,
      };
    } catch (error) {
      console.error("取得排程結果失敗:", error);
      throw error;
    }
  },

  /**
   * 刪除排程記錄
   * @param {string} surgeryId - 手術ID
   */
  deleteSchedule: async (surgeryId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tshso-scheduling/schedule/${surgeryId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "刪除排程失敗");
      }

      return data;
    } catch (error) {
      console.error("刪除排程失敗:", error);
      throw error;
    }
  },

  /**
   * 取得所有已排程資料 (前端快取用)
   */
  fetchAllScheduledSurgeries: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tshso-scheduling/results/all_scheduled`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "取得所有排程失敗");
      }

      return {
        schedules: data.data,
        total: data.total,
      };
    } catch (error) {
      console.error("取得所有排程失敗:", error);
      throw error;
    }
  },
};

export default tshsoSchedulingService;
