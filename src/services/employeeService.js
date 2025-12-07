// services/employeeService.js
// 員工/醫師相關 API 服務

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

const employeeService = {
  /**
   * 根據科別和角色取得員工列表
   * @param {string} departmentCode - 科別代碼
   * @param {string} role - 角色 ('D': 醫師, 'N': 護理師, 'A': 助理醫師)
   * @returns {Promise<Array>} 員工列表
   */
  getEmployeesByDepartmentAndRole: async (departmentCode, role) => {
    try {
      if (!departmentCode || !role) {
        throw new Error("缺少必要參數：departmentCode 或 role");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/employees/by-department-role?department_code=${departmentCode}&role=${role}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await handleResponse(response);
      return data.data || [];
    } catch (error) {
      console.error("❌ 取得員工列表失敗:", error);
      throw error;
    }
  },

  /**
   * 取得所有員工
   * @returns {Promise<Array>} 員工列表
   */
  getAllEmployees: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees`, {
        method: "GET",
        credentials: "include",
      });

      const data = await handleResponse(response);
      return data.data || [];
    } catch (error) {
      console.error("❌ 取得所有員工失敗:", error);
      throw error;
    }
  },

  /**
   * 根據員工 ID 取得員工資訊
   * @param {string} employeeId - 員工編號
   * @returns {Promise<Object>} 員工資訊
   */
  getEmployeeById: async (employeeId) => {
    try {
      if (!employeeId) {
        throw new Error("缺少員工編號");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/employees/${employeeId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await handleResponse(response);
      return data.data;
    } catch (error) {
      console.error(`❌ 取得員工 ${employeeId} 資訊失敗:`, error);
      throw error;
    }
  },

  /**
   * 取得助手醫師列表（快捷方法）
   * @param {string} departmentCode - 科別代碼
   * @returns {Promise<Array>} 助手醫師列表
   */
  getAssistantDoctors: async (departmentCode) => {
    return employeeService.getEmployeesByDepartmentAndRole(departmentCode, "A");
  },

  /**
   * 取得主治醫師列表（快捷方法）
   * @param {string} departmentCode - 科別代碼
   * @returns {Promise<Array>} 主治醫師列表
   */
  getDoctors: async (departmentCode) => {
    return employeeService.getEmployeesByDepartmentAndRole(departmentCode, "D");
  },

  /**
   * 取得護理師列表（快捷方法）
   * @param {string} departmentCode - 科別代碼
   * @returns {Promise<Array>} 護理師列表
   */
  getNurses: async (departmentCode) => {
    return employeeService.getEmployeesByDepartmentAndRole(departmentCode, "N");
  },
};

export default employeeService;
