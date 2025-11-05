// hooks/useSurgeryRooms.js
import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// 獲取手術室類型和數量
export const useSurgeryRoomTypes = () => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoomTypes = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/surgery-rooms/types-with-count`,
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
        throw new Error(data.error || "獲取手術室類型失敗");
      }

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
  }, []);

  return {
    roomTypes,
    isLoading,
    error,
    refetch: fetchRoomTypes,
  };
};

// 獲取所有可用的手術室
export const useAvailableSurgeryRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRooms = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/surgery-rooms/available`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

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

// 獲取特定類型的手術室
export const useSurgeryRoomsByType = (roomType) => {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRooms = async () => {
    if (!roomType) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/surgery-rooms/type/${encodeURIComponent(roomType)}`,
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
        throw new Error(data.error || "獲取手術室失敗");
      }

      setRooms(data.data || []);
    } catch (err) {
      setError(err);
      console.error("獲取特定類型手術室失敗:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [roomType]);

  return {
    rooms,
    isLoading,
    error,
    refetch: fetchRooms,
  };
};

// 獲取單個手術室詳細資訊
export const useSurgeryRoom = (roomId) => {
  const [room, setRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoom = async () => {
    if (!roomId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/surgery-rooms/${roomId}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "獲取手術室資訊失敗");
      }

      setRoom(data.data);
    } catch (err) {
      setError(err);
      console.error("獲取手術室詳細資訊失敗:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoom();
  }, [roomId]);

  return {
    room,
    isLoading,
    error,
    refetch: fetchRoom,
  };
};
