// hooks/useSurgeryType.js
// 手術類型相關的 React Hooks

import { useState, useEffect, useCallback } from "react";
import surgeryTypeService from "../services/surgeryTypeService";

/**
 * 使用當前登入醫師科別的手術類型
 * @returns {Object} { surgeryTypes, department, isLoading, error, refetch }
 */
export const useMySurgeryTypes = () => {
  const [surgeryTypes, setSurgeryTypes] = useState([]);
  const [department, setDepartment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSurgeryTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await surgeryTypeService.fetchMyDepartmentSurgeryTypes();

      setSurgeryTypes(data.surgeryTypes);
      setDepartment(data.department);

      console.log("✅ 載入手術類型成功:", data.surgeryTypes.length, "項");
    } catch (err) {
      console.error("取得手術類型失敗:", err);
      setError(err);
      setSurgeryTypes([]);
      setDepartment(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSurgeryTypes();
  }, [fetchSurgeryTypes]);

  return {
    surgeryTypes,
    department,
    isLoading,
    error,
    refetch: fetchSurgeryTypes,
  };
};

/**
 * 使用手術類型詳細資訊
 * @param {string} surgeryCode - 手術代碼
 * @returns {Object} { surgeryDetail, isLoading, error, refetch }
 */
export const useSurgeryTypeDetail = (surgeryCode) => {
  const [surgeryDetail, setSurgeryDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDetail = useCallback(async () => {
    if (!surgeryCode) {
      setSurgeryDetail(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await surgeryTypeService.fetchSurgeryTypeDetail(surgeryCode);
      setSurgeryDetail(data);

      console.log("✅ 取得手術類型詳細資訊:", data.surgery_name);
    } catch (err) {
      console.error("取得手術類型詳細資訊失敗:", err);
      setError(err);
      setSurgeryDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [surgeryCode]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    surgeryDetail,
    isLoading,
    error,
    refetch: fetchDetail,
  };
};

/**
 * 使用所有科別列表
 * @returns {Object} { departments, isLoading, error, refetch }
 */
export const useDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDepartments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await surgeryTypeService.fetchAllDepartments();
      setDepartments(data);
    } catch (err) {
      console.error("取得科別列表失敗:", err);
      setError(err);
      setDepartments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  return {
    departments,
    isLoading,
    error,
    refetch: fetchDepartments,
  };
};

/**
 * 使用科別的手術類型列表
 * @param {string} departmentCode - 科別代碼
 * @returns {Object} { surgeryTypes, isLoading, error, refetch }
 */
export const useSurgeryTypesByDepartment = (departmentCode) => {
  const [surgeryTypes, setSurgeryTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSurgeryTypes = useCallback(async () => {
    if (!departmentCode) {
      setSurgeryTypes([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await surgeryTypeService.fetchSurgeryTypesByDepartment(
        departmentCode
      );
      setSurgeryTypes(data);
    } catch (err) {
      console.error(`取得科別 ${departmentCode} 手術類型失敗:`, err);
      setError(err);
      setSurgeryTypes([]);
    } finally {
      setIsLoading(false);
    }
  }, [departmentCode]);

  useEffect(() => {
    fetchSurgeryTypes();
  }, [fetchSurgeryTypes]);

  return {
    surgeryTypes,
    isLoading,
    error,
    refetch: fetchSurgeryTypes,
  };
};

/**
 * 使用手術類型搜尋
 * @returns {Object} { surgeryTypes, isLoading, error, search }
 */
export const useSurgeryTypeSearch = () => {
  const [surgeryTypes, setSurgeryTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback(async (filters = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await surgeryTypeService.searchSurgeryTypes(filters);
      setSurgeryTypes(data);

      return data;
    } catch (err) {
      console.error("搜尋手術類型失敗:", err);
      setError(err);
      setSurgeryTypes([]);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    surgeryTypes,
    isLoading,
    error,
    search,
  };
};

export default {
  useMySurgeryTypes,
  useSurgeryTypeDetail,
  useDepartments,
  useSurgeryTypesByDepartment,
  useSurgeryTypeSearch,
};
