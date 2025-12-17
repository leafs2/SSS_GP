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
              familiarity: 0.2,
              workload: 0.3,
              role_fairness: 0.5,
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
    history_fixed_count:
      nurse.historyFixedCount || nurse.history_fixed_count || 0,
    history_float_count:
      nurse.historyFloatCount || nurse.history_float_count || 0,
    workload_this_week: nurse.workloadThisWeek || 0,
  }));
};

/**
 * 格式化手術室資料為演算法服務需要的格式
 * @param {Array} rooms - 前端手術室資料（應該已經被過濾為該時段開放的手術室）
 * @param {string} roomType - 手術室類型
 * @param {string} shift - 時段（用於取得正確的護士需求數量）
 * @returns {Array} 格式化後的手術室資料
 */
export const formatRoomsForAlgorithm = (rooms, roomType, shift) => {
  // 時段開放狀態欄位對應
  const shiftOpenFieldMapping = {
    morning: "morningShift",
    evening: "nightShift",
    night: "graveyardShift",
  };
  const openField = shiftOpenFieldMapping[shift];

  return rooms
    .filter((room) => {
      // 雙重檢查：確保手術室在該時段開放
      const isOpen = room[openField] === true || room[openField] === 1;
      if (!isOpen) {
        console.warn(`⚠️ 手術室 ${room.id} 在 ${shift} 時段未開放，已過濾`);
      }
      return isOpen;
    })
    .map((room) => {
      // 🔥 關鍵修改：根據時段取得正確的護士需求數量
      const requireNurses = getNurseCountByShift(room, shift);

      console.log(
        `🏥 手術室 ${room.id} (${shift}): 需要 ${requireNurses} 位護士`,
        {
          room_data: room,
          shift: shift,
          is_open: room[openField],
          calculated_count: requireNurses,
        }
      );

      return {
        room_id: room.id,
        room_type: roomType,
        require_nurses: requireNurses,
        complexity: determineComplexity(requireNurses),
        recent_activity: 0.5,
      };
    });
};

/**
 * 根據時段取得手術室需要的護士數量
 * @param {Object} room - 手術室資料
 * @param {string} shift - 時段（morning/evening/night）
 * @returns {number} 護士需求數量
 */
const getNurseCountByShift = (room, shift) => {
  // 時段欄位對應表
  const shiftFieldMapping = {
    morning: "morning_shift_nurses",
    evening: "night_shift_nurses",
    night: "graveyard_shift_nurses",
  };

  const fieldName = shiftFieldMapping[shift];

  // 1. 優先使用時段專屬欄位
  if (fieldName && room[fieldName] !== undefined && room[fieldName] !== null) {
    return parseInt(room[fieldName]);
  }

  // 2. 備用：使用通用欄位（可能來自後端）
  if (room.nurseCount !== undefined && room.nurseCount !== null) {
    return parseInt(room.nurseCount);
  }
  if (room.nurse_count !== undefined && room.nurse_count !== null) {
    return parseInt(room.nurse_count);
  }

  // 3. 最終預設值（根據時段）
  const defaultCounts = {
    morning: 3,
    evening: 2,
    night: 1,
  };

  console.warn(
    `⚠️ 手術室 ${room.id} 沒有 ${shift} 時段的護士數量資料，使用預設值 ${defaultCounts[shift]}`
  );
  return defaultCounts[shift];
};

/**
 * 判斷手術室複雜度（根據護士需求數量）
 * @param {number} nurseCount - 護士需求數量
 * @returns {string} 複雜度 (low/medium/high)
 */
const determineComplexity = (nurseCount) => {
  if (nurseCount >= 3) {
    return "high";
  } else if (nurseCount === 2) {
    return "medium";
  } else {
    return "low";
  }
};
