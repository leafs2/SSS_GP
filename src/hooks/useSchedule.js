// hooks/useSchedule.js
// 排班管理相關的 React Hooks

import { useState, useEffect, useCallback } from "react";
import scheduleService from "../services/scheduleService";
import {
  transformBackendToFrontend,
  transformFrontendToBackend,
} from "../utils/scheduleDataTransformer";

/**
 * 使用我的排班資料
 * @returns {Object} { schedule, isLoading, error, refetch, updateSchedule }
 */
export const useMySchedule = () => {
  const [schedule, setSchedule] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await scheduleService.fetchMySchedule();

      if (data) {
        // 轉換為前端格式
        const frontendSchedule = transformBackendToFrontend(data);
        setSchedule(frontendSchedule);
      } else {
        // 尚未建立排班
        setSchedule(null);
      }
    } catch (err) {
      console.error("取得排班資料失敗:", err);
      setError(err);

      // 如果是未登入錯誤，可以觸發重新導向
      if (err.needLogin) {
        // 這裡可以加入重新導向邏輯
        console.log("需要重新登入");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const updateSchedule = useCallback(
    async (frontendScheduleData) => {
      try {
        setError(null);

        // 轉換為後端格式
        const backendScheduleData =
          transformFrontendToBackend(frontendScheduleData);

        // 呼叫 API
        const result = await scheduleService.updateSchedule(
          backendScheduleData
        );

        // 更新成功後重新取得資料
        await fetchSchedule();

        return { success: true, data: result };
      } catch (err) {
        console.error("更新排班失敗:", err);
        setError(err);
        return { success: false, error: err };
      }
    },
    [fetchSchedule]
  );

  return {
    schedule,
    isLoading,
    error,
    refetch: fetchSchedule,
    updateSchedule,
  };
};

/**
 * 使用排班類型資料
 * @returns {Object} { types, isLoading, error, refetch }
 */
export const useScheduleTypes = () => {
  const [types, setTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await scheduleService.fetchScheduleTypes();
      setTypes(data);
    } catch (err) {
      console.error("取得排班類型失敗:", err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  return {
    types,
    isLoading,
    error,
    refetch: fetchTypes,
  };
};

/**
 * 使用指定醫師的排班資料
 * @param {string} employeeId - 員工編號
 * @returns {Object} { schedule, isLoading, error, refetch }
 */
export const useEmployeeSchedule = (employeeId) => {
  const [schedule, setSchedule] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedule = useCallback(async () => {
    if (!employeeId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await scheduleService.fetchScheduleByEmployeeId(employeeId);

      if (data) {
        const frontendSchedule = transformBackendToFrontend(data);
        setSchedule(frontendSchedule);
      } else {
        setSchedule(null);
      }
    } catch (err) {
      console.error(`取得員工 ${employeeId} 排班失敗:`, err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return {
    schedule,
    isLoading,
    error,
    refetch: fetchSchedule,
  };
};

/**
 * 使用科別排班資料
 * @param {string} departmentCode - 科別代碼
 * @returns {Object} { department, schedules, isLoading, error, refetch }
 */
export const useDepartmentSchedules = (departmentCode) => {
  const [department, setDepartment] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedules = useCallback(async () => {
    if (!departmentCode) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await scheduleService.fetchDepartmentSchedules(
        departmentCode
      );

      setDepartment(data.department);

      // 轉換每位醫師的排班資料
      const transformedSchedules = data.schedules.map((doctorSchedule) => ({
        employeeId: doctorSchedule.employee_id,
        doctorName: doctorSchedule.doctor_name,
        departmentCode: doctorSchedule.department_code,
        departmentName: doctorSchedule.department_name,
        schedule: transformBackendToFrontend(doctorSchedule),
      }));

      setSchedules(transformedSchedules);
    } catch (err) {
      console.error(`取得科別 ${departmentCode} 排班失敗:`, err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [departmentCode]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return {
    department,
    schedules,
    isLoading,
    error,
    refetch: fetchSchedules,
  };
};

/**
 * 使用排班編輯器
 * @param {Object} initialSchedule - 初始排班資料
 * @returns {Object} { editedSchedule, setEditedSchedule, isDirty, reset, save }
 */
export const useScheduleEditor = (initialSchedule) => {
  const [editedSchedule, setEditedSchedule] = useState(initialSchedule || {});
  const [isDirty, setIsDirty] = useState(false);

  // 當初始資料改變時，重置編輯資料
  useEffect(() => {
    if (initialSchedule) {
      setEditedSchedule(initialSchedule);
      setIsDirty(false);
    }
  }, [initialSchedule]);

  // 更新編輯資料
  const updateEditedSchedule = useCallback((key, value) => {
    setEditedSchedule((prev) => ({
      ...prev,
      [key]: value,
    }));
    setIsDirty(true);
  }, []);

  // 重置編輯資料
  const reset = useCallback(() => {
    setEditedSchedule(initialSchedule || {});
    setIsDirty(false);
  }, [initialSchedule]);

  // 儲存編輯資料
  const save = useCallback(async () => {
    try {
      const backendData = transformFrontendToBackend(editedSchedule);
      const result = await scheduleService.updateSchedule(backendData);
      setIsDirty(false);
      return { success: true, data: result };
    } catch (err) {
      console.error("儲存排班失敗:", err);
      return { success: false, error: err };
    }
  }, [editedSchedule]);

  return {
    editedSchedule,
    setEditedSchedule: updateEditedSchedule,
    isDirty,
    reset,
    save,
  };
};

export default {
  useMySchedule,
  useScheduleTypes,
  useEmployeeSchedule,
  useDepartmentSchedules,
  useScheduleEditor,
};
