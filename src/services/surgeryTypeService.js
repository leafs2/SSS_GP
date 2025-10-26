// services/surgeryTypeService.js
// 手術類型相關的 API 服務

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const surgeryTypeService = {
  /**
   * 取得所有科別列表
   */
  fetchAllDepartments: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/surgery-types/departments`,
        {
          credentials: "include",
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "取得科別列表失敗");
      }

      return data.data;
    } catch (error) {
      console.error("取得科別列表失敗:", error);
      throw error;
    }
  },

  /**
   * 根據科別取得手術類型列表
   */
  fetchSurgeryTypesByDepartment: async (department) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/surgery-types/by-department?department=${department}`,
        {
          credentials: "include",
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "取得手術類型失敗");
      }

      return data.data;
    } catch (error) {
      console.error("取得手術類型失敗:", error);
      throw error;
    }
  },

  /**
   * 取得當前登入醫師科別的手術類型列表
   */
  fetchMyDepartmentSurgeryTypes: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/surgery-types/my-department`,
        {
          credentials: "include",
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "取得手術類型失敗");
      }

      return {
        surgeryTypes: data.data,
        department: data.department,
      };
    } catch (error) {
      console.error("取得手術類型失敗:", error);
      throw error;
    }
  },

  /**
   * 根據手術代碼取得詳細資訊
   */
  fetchSurgeryTypeDetail: async (surgeryCode) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/surgery-types/${surgeryCode}`,
        {
          credentials: "include",
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "取得手術類型詳細資訊失敗");
      }

      return data.data;
    } catch (error) {
      console.error("取得手術類型詳細資訊失敗:", error);
      throw error;
    }
  },

  /**
   * 搜尋手術類型
   */
  searchSurgeryTypes: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.department) params.append("department", filters.department);
      if (filters.keyword) params.append("keyword", filters.keyword);
      if (filters.active !== undefined)
        params.append("active", filters.active.toString());

      const response = await fetch(
        `${API_BASE_URL}/surgery-types?${params.toString()}`,
        {
          credentials: "include",
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "搜尋手術類型失敗");
      }

      return data.data;
    } catch (error) {
      console.error("搜尋手術類型失敗:", error);
      throw error;
    }
  },
};

export default surgeryTypeService;
