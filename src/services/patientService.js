// services/patientService.js
// 病患相關 API 服務

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

const patientService = {
  /**
   * 根據病歷號取得病患詳細資訊
   * @param {string|number} patientId - 病歷號
   * @returns {Promise<Object>} 病患詳細資訊
   */
  getPatientById: async (patientId) => {
    try {
      if (!patientId) {
        throw new Error("缺少病歷號");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/patients/${patientId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await handleResponse(response);
      return data.data;
    } catch (error) {
      console.error(`❌ 取得病患 ${patientId} 資訊失敗:`, error);
      throw error;
    }
  },

  /**
   * 搜尋病患
   * @param {Object} filters - 搜尋條件
   * @param {string} [filters.keyword] - 關鍵字（姓名、病歷號、身分證）
   * @param {string} [filters.name] - 姓名
   * @param {string} [filters.idNumber] - 身分證字號
   * @returns {Promise<Array>} 病患列表
   */
  searchPatients: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.keyword) params.append("keyword", filters.keyword);
      if (filters.name) params.append("name", filters.name);
      if (filters.idNumber) params.append("id_number", filters.idNumber);

      const response = await fetch(
        `${API_BASE_URL}/api/patients/search?${params.toString()}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await handleResponse(response);
      return data.data || [];
    } catch (error) {
      console.error("❌ 搜尋病患失敗:", error);
      throw error;
    }
  },

  /**
   * 新增病患
   * @param {Object} patientData - 病患資料
   * @returns {Promise<Object>} 新增結果
   */
  createPatient: async (patientData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/patients`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patientData),
      });

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error("❌ 新增病患失敗:", error);
      throw error;
    }
  },

  /**
   * 更新病患資料
   * @param {string|number} patientId - 病歷號
   * @param {Object} patientData - 更新的病患資料
   * @returns {Promise<Object>} 更新結果
   */
  updatePatient: async (patientId, patientData) => {
    try {
      if (!patientId) {
        throw new Error("缺少病歷號");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/patients/${patientId}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patientData),
        }
      );

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error(`❌ 更新病患 ${patientId} 資料失敗:`, error);
      throw error;
    }
  },

  /**
   * 刪除病患
   * @param {string|number} patientId - 病歷號
   * @returns {Promise<Object>} 刪除結果
   */
  deletePatient: async (patientId) => {
    try {
      if (!patientId) {
        throw new Error("缺少病歷號");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/patients/${patientId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error(`❌ 刪除病患 ${patientId} 失敗:`, error);
      throw error;
    }
  },
};

export default patientService;
