// services/surgeryService.js
import axios from "axios";

const API_BASE_URL = "http://localhost:3001/api";

const surgeryService = {
  /**
   * 新增手術排程
   * @param {Object} surgeryData - 手術資料
   * @returns {Promise<Object>}
   */
  createSurgery: async (surgeryData) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/surgery`,
        surgeryData,
        { withCredentials: true }
      );

      return response.data;
    } catch (error) {
      console.error("❌ 新增手術排程失敗:", error);
      throw error.response?.data || error;
    }
  },

  /**
   * 查詢手術排程
   * @param {string} surgeryId - 手術編號
   * @returns {Promise<Object>}
   */
  getSurgery: async (surgeryId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/surgery/${surgeryId}`, {
        withCredentials: true,
      });

      return response.data;
    } catch (error) {
      console.error("❌ 查詢手術排程失敗:", error);
      throw error.response?.data || error;
    }
  },
};

export default surgeryService;
