// services/surgeryRoomService.js
// 手術室相關 API 服務

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * 處理 API 回應
 */
const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    throw {
      status: response.status,
      error: data.error || data.message || "操作失敗",
      message: data.message || "",
    };
  }

  return data;
};

const surgeryRoomService = {
  /**
   * 取得所有手術室類型
   * @returns {Promise<Array>} 手術室類型列表
   */
  getRoomTypes: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/surgery-rooms/types`, {
        method: "GET",
        credentials: "include",
      });

      const data = await handleResponse(response);
      return data.data || [];
    } catch (error) {
      console.error("❌ 取得手術室類型失敗:", error);
      throw error;
    }
  },

  /**
   * 取得所有手術室
   * @returns {Promise<Array>} 手術室列表
   */
  getAllRooms: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/surgery-rooms`, {
        method: "GET",
        credentials: "include",
      });

      const data = await handleResponse(response);
      return data.data || [];
    } catch (error) {
      console.error("❌ 取得手術室列表失敗:", error);
      throw error;
    }
  },

  /**
   * 根據類型取得手術室
   * @param {string} roomType - 手術室類型
   * @returns {Promise<Array>} 該類型的手術室列表
   */
  getRoomsByType: async (roomType) => {
    try {
      if (!roomType) {
        throw new Error("缺少手術室類型");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/surgery-rooms/type/${roomType}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await handleResponse(response);
      return data.data || [];
    } catch (error) {
      console.error(`❌ 取得 ${roomType} 類型手術室失敗:`, error);
      throw error;
    }
  },

  /**
   * 取得手術室詳細資訊
   * @param {string} roomId - 手術室 ID
   * @returns {Promise<Object>} 手術室詳細資訊
   */
  getRoomById: async (roomId) => {
    try {
      if (!roomId) {
        throw new Error("缺少手術室 ID");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/surgery-rooms/${roomId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await handleResponse(response);
      return data.data;
    } catch (error) {
      console.error(`❌ 取得手術室 ${roomId} 資訊失敗:`, error);
      throw error;
    }
  },

  /**
   * 取得手術室當日使用狀況
   * @param {string} date - 日期 (YYYY-MM-DD)
   * @returns {Promise<Array>} 當日手術室使用狀況
   */
  getRoomStatusByDate: async (date) => {
    try {
      if (!date) {
        throw new Error("缺少日期");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/surgery-rooms/status?date=${date}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await handleResponse(response);
      return data.data || [];
    } catch (error) {
      console.error(`❌ 取得 ${date} 手術室狀況失敗:`, error);
      throw error;
    }
  },
};

export default surgeryRoomService;
