// services/IBRSAService.js
// 手術排程推薦日期服務

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * 處理 API 回應
 */
const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    throw {
      status: response.status,
      error: data.error || data.message || "推薦失敗",
      message: data.message || "",
    };
  }

  return data;
};

const IBRSAService = {
  /**
   * 推薦手術日期
   * @param {Object} params - 推薦參數
   * @param {string} params.doctorId - 主刀醫師 ID
   * @param {string} params.surgeryTypeCode - 手術類型代碼
   * @param {number} params.surgeryDuration - 手術時長（小時）
   * @param {string} params.surgeryRoomType - 手術房類型
   * @param {string} [params.assistantId] - 助手醫師 ID（選填）
   * @param {number} [params.returnLimit=5] - 返回數量（1-5）
   * @returns {Promise<Object>} 推薦結果
   */
  recommendSurgeryDates: async (params) => {
    try {
      const {
        doctorId,
        surgeryTypeCode,
        surgeryDuration,
        surgeryRoomType,
        assistantId = null,
        returnLimit = 5,
      } = params;

      // 參數驗證
      if (
        !doctorId ||
        !surgeryTypeCode ||
        !surgeryDuration ||
        !surgeryRoomType
      ) {
        throw new Error("缺少必要參數");
      }

      if (surgeryDuration <= 0) {
        throw new Error("手術時長必須大於 0");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/surgery-recommendation/recommend`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            doctorId,
            surgeryTypeCode,
            surgeryDuration,
            surgeryRoomType,
            assistantId,
            returnLimit,
          }),
        }
      );

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error("❌ 推薦手術日期失敗:", error);
      throw error;
    }
  },

  /**
   * 健康檢查
   * @returns {Promise<Object>} 服務狀態
   */
  healthCheck: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/surgery-recommendation/health`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error("❌ 健康檢查失敗:", error);
      throw error;
    }
  },
};

export default IBRSAService;
