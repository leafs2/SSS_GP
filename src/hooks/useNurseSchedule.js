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
