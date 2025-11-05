// hooks/useNurseSchedule.js
import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// 獲取我的排班
export const useMyNurseSchedule = () => {
  const [schedule, setSchedule] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedule = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/nurse-schedules/my-schedule`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "獲取排班失敗");
      }

      setSchedule(data.data);
    } catch (err) {
      setError(err);
      console.error("獲取護士排班失敗:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  return {
    schedule,
    isLoading,
    error,
    refetch: fetchSchedule,
  };
};

// 獲取科別護士排班概況
export const useDepartmentNurseSchedules = () => {
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/nurse-schedules/department-overview`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "獲取科別排班失敗");
      }

      setSchedules(data.data.nurses || []);
    } catch (err) {
      setError(err);
      console.error("獲取科別護士排班失敗:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  return {
    schedules,
    isLoading,
    error,
    refetch: fetchSchedules,
  };
};

// 獲取手術室類型及數量
export const useSurgeryRoomTypes = (shift = null) => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoomTypes = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 如果有時段，加入查詢參數
      const url = shift
        ? `${API_URL}/api/nurse-schedules/surgery-room-types?shift=${shift}`
        : `${API_URL}/api/nurse-schedules/surgery-room-types`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "獲取手術室類型失敗");
      }

      console.log(`📋 載入 ${shift} 時段手術室類型:`, data.data);
      setRoomTypes(data.data || []);
    } catch (err) {
      setError(err);
      console.error("獲取手術室類型失敗:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomTypes();
  }, [shift]); // 依賴 shift

  return {
    roomTypes,
    isLoading,
    error,
    refetch: fetchRoomTypes,
  };
};

// 獲取科別所有護士列表（排除已在其他時段排班的護士）
export const useDepartmentNurses = (shift = null) => {
  const [nurses, setNurses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNurses = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 如果有指定時段，加入查詢參數
      const url = shift
        ? `${API_URL}/api/nurse-schedules/department-nurses?shift=${shift}`
        : `${API_URL}/api/nurse-schedules/department-nurses`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "獲取護士列表失敗");
      }

      setNurses(data.data || []);
    } catch (err) {
      setError(err);
      console.error("獲取科別護士列表失敗:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNurses();
  }, [shift]); // 當 shift 改變時重新獲取

  return {
    nurses,
    isLoading,
    error,
    refetch: fetchNurses,
  };
};

// 獲取所有手術室列表
export const useSurgeryRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRooms = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/nurse-schedules/surgery-rooms`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "獲取手術室列表失敗");
      }

      setRooms(data.data || []);
    } catch (err) {
      setError(err);
      console.error("獲取手術室列表失敗:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  return {
    rooms,
    isLoading,
    error,
    refetch: fetchRooms,
  };
};

// 批次儲存護士排班
export const saveBatchNurseSchedule = async (shift, assignments) => {
  try {
    const response = await fetch(`${API_URL}/api/nurse-schedules/batch-save`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shift,
        assignments,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "儲存排班失敗");
    }

    return {
      success: true,
      data: data.data,
      message: data.message,
    };
  } catch (error) {
    console.error("批次儲存護士排班失敗:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// 獲取時段排班資料
export const useShiftAssignments = (shift) => {
  const [assignments, setAssignments] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAssignments = async () => {
    if (!shift) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 在切換時段時先清空舊資料，避免顯示錯誤資料
      setAssignments({});

      const response = await fetch(
        `${API_URL}/api/nurse-schedules/shift-assignments/${shift}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            // 加入時間戳避免瀏覽器緩存
            "Cache-Control": "no-cache",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "獲取排班資料失敗");
      }

      console.log(`✅ 成功載入 ${shift} 時段排班:`, data.data);
      setAssignments(data.data || {});
    } catch (err) {
      setError(err);
      console.error("獲取時段排班資料失敗:", err);
      setAssignments({}); // 發生錯誤時清空資料
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [shift]); // 依賴 shift，當 shift 改變時重新獲取

  return {
    assignments,
    isLoading,
    error,
    refetch: fetchAssignments,
  };
};
