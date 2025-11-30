// services/assistantShiftService.js
// 助理醫師排班相關 API 服務

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const assistantShiftService = {
  /**
   * 獲取住院醫師統計資料
   * @param {string} departmentCode - 科別代碼
   * @param {number} year - 年份
   * @param {number} month - 月份
   * @returns {Promise} 統計資料
   */
  getAssistantDoctorStatistics: async (departmentCode, year, month) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/assistant-shifts/statistics?department_code=${departmentCode}&year=${year}&month=${month}`,
        {
          credentials: "include",
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "獲取住院醫師統計失敗");
      }

      return data;
    } catch (error) {
      console.error("獲取住院醫師統計失敗:", error);
      throw error;
    }
  },

  /**
   * 獲取月份排班日曆資料
   * @param {string} departmentCode - 科別代碼
   * @param {number} year - 年份
   * @param {number} month - 月份
   * @returns {Promise} 日曆資料
   */
  getAssistantShiftCalendar: async (departmentCode, year, month) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/assistant-shifts/calendar?department_code=${departmentCode}&year=${year}&month=${month}`,
        {
          credentials: "include",
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "獲取排班日曆失敗");
      }

      return data;
    } catch (error) {
      console.error("獲取排班日曆失敗:", error);
      throw error;
    }
  },

  /**
   * 獲取特定日期可選醫師
   * @param {string} date - 日期 (YYYY-MM-DD)
   * @param {string} departmentCode - 科別代碼
   * @returns {Promise} 可選醫師列表
   */
  getAvailableDoctorsForDate: async (date, departmentCode) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/assistant-shifts/available-for-date?date=${date}&department_code=${departmentCode}`,
        {
          credentials: "include",
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "獲取可選醫師失敗");
      }

      return data.doctors || [];
    } catch (error) {
      console.error("獲取可選醫師失敗:", error);
      throw error;
    }
  },

  /**
   * 儲存助理醫師排班
   * @param {string} departmentCode - 科別代碼
   * @param {number} year - 年份
   * @param {number} month - 月份
   * @param {Array} shifts - 排班資料 [{ date: 'YYYY-MM-DD', doctor_ids: ['A001', 'A002'] }]
   * @returns {Promise} 儲存結果
   */
  saveAssistantShifts: async (departmentCode, year, month, shifts) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/assistant-shifts/save`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            department_code: departmentCode,
            year,
            month,
            shifts,
          }),
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "儲存排班失敗");
      }

      return data;
    } catch (error) {
      console.error("儲存排班失敗:", error);
      throw error;
    }
  },

  /**
   * 自動排班建議（可選功能）
   * @param {string} departmentCode - 科別代碼
   * @param {number} year - 年份
   * @param {number} month - 月份
   * @param {Object} existingShifts - 已存在的排班
   * @returns {Promise} 建議排班
   */
  getAutoScheduleSuggestion: async (
    departmentCode,
    year,
    month,
    existingShifts = {}
  ) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/assistant-shifts/auto-schedule`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            department_code: departmentCode,
            year,
            month,
            existing_shifts: existingShifts,
          }),
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "獲取自動排班建議失敗");
      }

      return data;
    } catch (error) {
      console.error("獲取自動排班建議失敗:", error);
      throw error;
    }
  },
};

export default assistantShiftService;
