// src/services/algorithmService.js
// 演算法服務 - 與 Python 演算法服務通訊

const ALGORITHM_API_URL =
  import.meta.env.VITE_ALGORITHM_API_URL || "http://localhost:8000";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * 執行指定時段的完整自動排班流程
 * 邏輯：從資料庫讀取已分類的護士名單 -> 針對每類分別執行演算法
 * @param {string} shift - 時段 ('morning', 'evening', 'night')
 */
export const runAutoScheduleForShift = async (shift) => {
  const shiftMap = { morning: "早班", evening: "晚班", night: "大夜班" };
  const shiftName = shiftMap[shift];

  console.log(`🚀 [Service] 開始計算時段: ${shiftName} (${shift})`);

  try {
    const fetchOptions = {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    };

    // 1. 平行抓取
    const [roomTypesRes, assignmentsRes] = await Promise.all([
      fetch(
        `${API_BASE_URL}/api/surgery-rooms/types-with-count?shift=${shift}`,
        fetchOptions
      ),
      fetch(
        `${API_BASE_URL}/api/nurse-schedules/shift-assignments/${shift}`,
        fetchOptions
      ),
    ]);

    if (!roomTypesRes.ok) throw new Error("無法取得手術室類型");
    if (!assignmentsRes.ok) throw new Error("無法取得現有排班資料");

    const roomTypesData = await roomTypesRes.json();
    const assignmentsData = await assignmentsRes.json();

    const roomTypes = roomTypesData.data || [];
    const assignmentsByRoomType = assignmentsData.data || {};

    const shiftResults = [];
    const shiftAssignments = {};
    const shiftFloatSchedules = {};

    // ★ 新增：建立 ID 對應名字的映射表
    const nurseNameMap = {};

    // 2. 針對每個手術室類型執行排班
    for (const roomTypeData of roomTypes) {
      const roomType = roomTypeData.type;

      if (shift === "night" && roomType !== "RE") continue;

      const categorizedNurses = assignmentsByRoomType[roomType] || [];

      // ★ 收集名字
      categorizedNurses.forEach((n) => {
        const id = n.id || n.employee_id;
        if (id && n.name) {
          nurseNameMap[id] = n.name;
        }
      });

      if (categorizedNurses.length === 0) {
        console.log(`[Service] ${roomType} 資料庫中無已分配護士，跳過`);
        continue;
      }

      console.log(
        `[Service] 處理 ${roomType}: ${categorizedNurses.length} 位護士`
      );

      // 3. 獲取手術室
      const dbShiftName = {
        morning: "morning_shift",
        evening: "night_shift",
        night: "graveyard_shift",
      }[shift];

      const roomsResponse = await fetch(
        `${API_BASE_URL}/api/surgery-rooms/type/${encodeURIComponent(
          roomType
        )}?shift=${dbShiftName}`,
        fetchOptions
      );

      if (!roomsResponse.ok) continue;
      const roomsData = await roomsResponse.json();
      const allRooms = roomsData.data || [];

      const shiftField = {
        morning: "morningShift",
        evening: "nightShift",
        night: "graveyardShift",
      }[shift];
      const rooms = allRooms.filter(
        (room) => room[shiftField] === true || room[shiftField] === 1
      );

      if (rooms.length === 0) continue;

      // 4. 匈牙利演算法
      const formattedNurses = formatNursesForAlgorithm(
        categorizedNurses.map((n) => ({
          ...n,
          roomType,
          schedulingTime: shiftName,
          id: n.id || n.employee_id,
          total_fixed_count: n.total_fixed_count || n.historyFixedCount || 0,
          total_float_count: n.total_float_count || n.historyFloatCount || 0,
          workload_this_week: n.workload_this_week || n.workloadThisWeek || 0,
          last_assigned_room: null,
        }))
      );

      const formattedRooms = formatRoomsForAlgorithm(rooms, roomType, shift);

      const hungarianResult = await assignNursesWithHungarian({
        shift: shiftName,
        roomType,
        nurses: formattedNurses,
        rooms: formattedRooms,
      });

      if (!hungarianResult.success) continue;

      const fixedAssignments = hungarianResult.data.assignments;
      shiftResults.push({ roomType, result: hungarianResult.data });
      shiftAssignments[roomType] = fixedAssignments;

      // 5. 流動護士排班
      const assignedIds = new Set(fixedAssignments.map((a) => a.employee_id));
      const floatNurses = categorizedNurses
        .filter((n) => !assignedIds.has(n.id || n.employee_id))
        .map((n) => ({
          employee_id: n.id || n.employee_id,
          name: n.name,
          day_off:
            n.dayOff ||
            (n.day_off_ids ? n.day_off_ids.map((d) => d - 1) : []) ||
            [],
        }));

      if (floatNurses.length > 0) {
        const fixedAssignmentsByRoom = {};
        fixedAssignments.forEach((a) => {
          if (!fixedAssignmentsByRoom[a.assigned_room])
            fixedAssignmentsByRoom[a.assigned_room] = [];
          const original = categorizedNurses.find(
            (n) => (n.id || n.employee_id) === a.employee_id
          );
          fixedAssignmentsByRoom[a.assigned_room].push({
            employee_id: a.employee_id,
            day_off: original?.dayOff || [],
          });
        });

        const roomRequirements = {};
        rooms.forEach((room) => {
          roomRequirements[room.id] = getNurseCountByShift(room, shift);
        });

        const floatResponse = await fetch(
          `${ALGORITHM_API_URL}/api/assignment/float-nurse-schedule`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shift: shiftName,
              room_type: roomType,
              float_nurses: floatNurses,
              fixed_assignments: fixedAssignmentsByRoom,
              room_requirements: roomRequirements,
              config: { strategy: "balanced" },
            }),
          }
        );

        if (floatResponse.ok) {
          shiftFloatSchedules[roomType] = await floatResponse.json();
        }
      }
    }

    return {
      success: true,
      data: {
        results: shiftResults,
        assignments: shiftAssignments,
        floatSchedules: shiftFloatSchedules,
        nurseNameMap, // ★ 回傳名字對照表
      },
    };
  } catch (error) {
    console.error("[Service] 排班運算錯誤:", error);
    throw error;
  }
};

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
  return nurses.map((nurse) => {
    return {
      employee_id: nurse.employee_id || nurse.id, // 確保有吃到 ID
      name: nurse.name,
      room_type: nurse.room_type || nurse.roomType, // 兼容兩種命名
      scheduling_time: nurse.scheduling_time || nurse.schedulingTime,

      // 【修正 1】熟悉度：確保讀取 snake_case 欄位
      last_assigned_room: nurse.last_assigned_room || null,

      // 【修正 2】工作量：增加 snake_case 的檢查
      workload_this_week:
        nurse.workload_this_week || nurse.workloadThisWeek || 0,

      // 【修正 3】公平性：確保傳遞 total_fixed_count
      // 這裡非常重要！我们要傳給 Python 正確的 key
      total_fixed_count:
        nurse.total_fixed_count || nurse.historyFixedCount || 0,
      total_float_count:
        nurse.total_float_count || nurse.historyFloatCount || 0,

      // 為了保險，保留舊欄位名稱以免 Python 端沒改到
      history_fixed_count:
        nurse.total_fixed_count || nurse.historyFixedCount || 0,
      history_float_count:
        nurse.total_float_count || nurse.historyFloatCount || 0,
    };
  });
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
