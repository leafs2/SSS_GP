// src/services/algorithmService.js
// 演算法服務 - 與 Python 演算法服務通訊

const ALGORITHM_API_URL =
  import.meta.env.VITE_ALGORITHM_API_URL || "http://localhost:8000";

/**
 * 呼叫匈牙利演算法進行護士分配
 * @param {Object} params - 分配參數
 * @param {string} params.shift - 時段（早班/晚班/大夜班）
 * @param {string} params.roomType - 手術室類型（RSU/RSP/RD/RE）
 * @param {Array} params.nurses - 護士列表
 * @param {Array} params.rooms - 手術室列表
 * @returns {Promise<Object>} 分配結果
 */
export const assignNursesWithHungarian = async (params) => {
  try {
    console.log("📞 呼叫匈牙利演算法:", params);

    const response = await fetch(
      `${ALGORITHM_API_URL}/api/assignment/hungarian`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shift: params.shift,
          room_type: params.roomType,
          nurses: params.nurses,
          rooms: params.rooms,
          config: params.config || {
            cost_weights: {
              familiarity: 0.5,
              workload: 0.3,
              experience: 0.2,
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP ${response.status}: 演算法服務錯誤`
      );
    }

    const data = await response.json();
    console.log("✅ 演算法執行成功:", data);

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error("❌ 呼叫演算法服務失敗:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * 檢查演算法服務健康狀態
 * @returns {Promise<Object>} 健康狀態
 */
export const checkAlgorithmHealth = async () => {
  try {
    const response = await fetch(`${ALGORITHM_API_URL}/api/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      healthy: true,
      data: data,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
    };
  }
};

/**
 * 格式化護士資料為演算法服務需要的格式
 * @param {Array} nurses - 前端護士資料
 * @returns {Array} 格式化後的護士資料
 */
export const formatNursesForAlgorithm = (nurses) => {
  return nurses.map((nurse) => ({
    employee_id: nurse.id,
    name: nurse.name,
    room_type: nurse.roomType || nurse.surgery_room_type,
    scheduling_time: nurse.schedulingTime || nurse.scheduling_time,
    last_assigned_room: nurse.lastAssignedRoom || nurse.surgery_room_id || null,
    workload_this_week: nurse.workloadThisWeek || 0,
    experience_years: nurse.experienceYears || 0,
  }));
};

/**
 * 格式化手術室資料為演算法服務需要的格式
 * @param {Array} rooms - 前端手術室資料
 * @param {string} roomType - 手術室類型
 * @returns {Array} 格式化後的手術室資料
 */
export const formatRoomsForAlgorithm = (rooms, roomType) => {
  return rooms.map((room) => ({
    room_id: room.id,
    room_type: roomType,
    require_nurses: parseInt(room.nurseCount || room.nurse_count || 3),
    complexity: determineComplexity(room),
    recent_activity: 0.5,
  }));
};

/**
 * 判斷手術室複雜度
 * @param {Object} room - 手術室資料
 * @returns {string} 複雜度 (low/medium/high)
 */
const determineComplexity = (room) => {
  const nurseCount = room.nurseCount || room.nurse_count || 3;

  if (nurseCount >= 3) {
    return "high";
  } else if (nurseCount === 2) {
    return "medium";
  } else {
    return "low";
  }
};
