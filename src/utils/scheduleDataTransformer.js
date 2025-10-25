// utils/scheduleDataTransformer.js
// 排班資料格式轉換工具 - 彈性時段自動推算

/**
 * 排班類型對應表（後端 type -> 前端顯示）
 * 注意：彈性不是資料庫的值，而是空白時段
 */
export const SCHEDULE_TYPE_MAP = {
  A: {
    type: "surgery",
    label: "手術",
    icon: "Scissors",
    color: "orange",
    fullDay: true,
  },
  B: {
    type: "clinic",
    label: "看診",
    icon: "Stethoscope",
    color: "green",
    fullDay: false,
    period: "morning",
  },
  C: {
    type: "clinic",
    label: "看診",
    icon: "Stethoscope",
    color: "green",
    fullDay: false,
    period: "afternoon",
  },
  D: {
    type: "clinic",
    label: "看診",
    icon: "Stethoscope",
    color: "green",
    fullDay: true,
  },
  E: {
    type: "off",
    label: "休假",
    icon: "Coffee",
    color: "gray",
    fullDay: true,
  },
};

/**
 * 前端 type -> 後端 type 的反向對應
 * 彈性不需要映射，因為不存入資料庫
 */
export const REVERSE_TYPE_MAP = {
  surgery: "A",
  clinic_morning: "B",
  clinic_afternoon: "C",
  clinic_fullday: "D",
  off: "E",
  // flexible 不需要映射，因為是空白時段
};

/**
 * 星期對應（中文 -> 英文）
 */
export const DAY_MAP = {
  週一: "monday",
  週二: "tuesday",
  週三: "wednesday",
  週四: "thursday",
  週五: "friday",
  週六: "saturday",
  週日: "sunday",
};

/**
 * 星期對應（英文 -> 中文）
 */
export const DAY_MAP_REVERSE = {
  monday: "週一",
  tuesday: "週二",
  wednesday: "週三",
  thursday: "週四",
  friday: "週五",
  saturday: "週六",
  sunday: "週日",
};

/**
 * 將後端排班資料轉換為前端格式
 * @param {Object} backendSchedule - 後端排班資料
 * @returns {Object} 前端格式的排班資料
 */
export const transformBackendToFrontend = (backendSchedule) => {
  if (!backendSchedule || !backendSchedule.schedule) {
    return null;
  }

  const { schedule } = backendSchedule;
  const frontendSchedule = {};

  // 處理每一天的排班
  Object.keys(schedule).forEach((day) => {
    const dayData = schedule[day];
    const type = dayData.type;
    const mapping = SCHEDULE_TYPE_MAP[type];

    if (!mapping) {
      console.warn(`未知的排班類型: ${type}`);
      return;
    }

    const chineseDay = DAY_MAP_REVERSE[day];

    if (mapping.fullDay) {
      // 全天排班（手術、全天門診、休假）
      frontendSchedule[chineseDay] = {
        type: mapping.type,
        label: mapping.label,
        category: dayData.category,
        timeInfo: dayData.time_info,
        fullDay: true,
        backendType: type,
      };
    } else {
      // 分時段排班（上午/下午門診）
      const period = mapping.period === "morning" ? "上午" : "下午";
      frontendSchedule[`${chineseDay}${period}`] = {
        type: mapping.type,
        label: mapping.label,
        category: dayData.category,
        timeInfo: dayData.time_info,
        fullDay: false,
        period: mapping.period,
        backendType: type,
      };

      // 自動填充另一個時段為「彈性」
      const otherPeriod = period === "上午" ? "下午" : "上午";
      const otherKey = `${chineseDay}${otherPeriod}`;

      // 只有當另一個時段不存在時才設為彈性
      if (!frontendSchedule[otherKey] && !frontendSchedule[chineseDay]) {
        frontendSchedule[otherKey] = {
          type: "flexible",
          label: "彈性",
          fullDay: false,
          period: otherPeriod === "上午" ? "morning" : "afternoon",
          backendType: null, // 彈性不存入資料庫
        };
      }
    }
  });

  return frontendSchedule;
};

/**
 * 將前端排班資料轉換為後端格式
 * 彈性時段不會被存入資料庫
 * @param {Object} frontendSchedule - 前端排班資料
 * @returns {Object} 後端格式的排班資料
 */
export const transformFrontendToBackend = (frontendSchedule) => {
  const backendSchedule = {};

  // 遍歷前端資料
  Object.keys(frontendSchedule).forEach((key) => {
    const scheduleItem = frontendSchedule[key];

    // 彈性不存入資料庫，直接跳過
    if (scheduleItem.type === "flexible") {
      return;
    }

    // 如果已經有 backendType，直接使用
    if (scheduleItem.backendType) {
      const day = key.replace(/上午|下午/g, "");
      const englishDay = DAY_MAP[day];
      if (englishDay) {
        backendSchedule[englishDay] = scheduleItem.backendType;
      }
      return;
    }

    // 根據 type 和 fullDay 判斷後端類型
    let backendType;

    if (scheduleItem.type === "surgery") {
      backendType = "A";
    } else if (scheduleItem.type === "off") {
      backendType = "E";
    } else if (scheduleItem.type === "clinic") {
      if (scheduleItem.fullDay) {
        backendType = "D"; // 全天門診
      } else if (key.includes("上午")) {
        backendType = "B"; // 上午門診
      } else if (key.includes("下午")) {
        backendType = "C"; // 下午門診
      }
    }

    // 提取星期
    const day = key.replace(/上午|下午/g, "");
    const englishDay = DAY_MAP[day];

    if (englishDay && backendType) {
      backendSchedule[englishDay] = backendType;
    }
  });

  return backendSchedule;
};

/**
 * 驗證排班資料是否完整（包含所有七天）
 * @param {Object} schedule - 排班資料
 * @returns {Object} { isValid: boolean, missingDays: string[] }
 */
export const validateFullSchedule = (schedule) => {
  const requiredDays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const missingDays = requiredDays.filter((day) => !schedule[day]);

  return {
    isValid: missingDays.length === 0,
    missingDays: missingDays.map((day) => DAY_MAP_REVERSE[day]),
  };
};

/**
 * 根據排班類型取得顯示樣式
 * @param {string} type - 排班類型 (A/B/C/D/E)
 * @returns {Object} 樣式物件 { color, bgColor, icon }
 */
export const getScheduleStyle = (type) => {
  const mapping = SCHEDULE_TYPE_MAP[type];

  if (!mapping) {
    return {
      color: "text-gray-500",
      bgColor: "bg-gray-100",
      icon: "CircleDashed",
    };
  }

  const colorMap = {
    orange: {
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      borderColor: "border-orange-300",
    },
    green: {
      color: "text-green-600",
      bgColor: "bg-green-100",
      borderColor: "border-green-300",
    },
    purple: {
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      borderColor: "border-purple-300",
    },
    gray: {
      color: "text-gray-600",
      bgColor: "bg-gray-100",
      borderColor: "border-gray-300",
    },
  };

  return {
    ...colorMap[mapping.color],
    icon: mapping.icon,
    label: mapping.label,
  };
};

/**
 * 格式化時間資訊顯示
 * @param {string} timeInfo - 時間資訊 (例: "8:00 - 13:00")
 * @returns {string} 格式化後的時間
 */
export const formatTimeInfo = (timeInfo) => {
  if (!timeInfo) return "";
  return timeInfo.replace(/\s/g, ""); // 移除空格
};

/**
 * 檢查某天是否為全天排班
 * @param {string} type - 排班類型
 * @returns {boolean}
 */
export const isFullDaySchedule = (type) => {
  const mapping = SCHEDULE_TYPE_MAP[type];
  return mapping ? mapping.fullDay : false;
};

/**
 * 取得排班類型的完整資訊
 * @param {string} type - 排班類型 (A/B/C/D/E)
 * @param {Array} scheduleTypes - 從 API 取得的排班類型陣列
 * @returns {Object} 完整的排班類型資訊
 */
export const getScheduleTypeInfo = (type, scheduleTypes) => {
  const apiType = scheduleTypes?.find((t) => t.type === type);
  const frontendMapping = SCHEDULE_TYPE_MAP[type];

  return {
    type,
    category: apiType?.category || "",
    timeInfo: apiType?.time_info || null,
    label: frontendMapping?.label || "",
    icon: frontendMapping?.icon || "CircleDashed",
    color: frontendMapping?.color || "gray",
    fullDay: frontendMapping?.fullDay || false,
  };
};

/**
 * 填充彈性時段
 * 根據已有排班自動填充空白時段為彈性
 * @param {Object} schedule - 排班資料
 * @returns {Object} 填充後的排班資料
 */
export const fillFlexibleSlots = (schedule) => {
  const weekDays = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];
  const periods = ["上午", "下午"];
  const result = { ...schedule };

  weekDays.forEach((day) => {
    // 如果該天是全天排班，不需要填充
    if (result[day]?.fullDay) {
      return;
    }

    // 檢查每個時段
    periods.forEach((period) => {
      const key = `${day}${period}`;

      // 如果該時段沒有排班，設為彈性
      if (!result[key]) {
        result[key] = {
          type: "flexible",
          label: "彈性",
          fullDay: false,
          period: period === "上午" ? "morning" : "afternoon",
          backendType: null, // 不存入資料庫
        };
      }
    });
  });

  return result;
};

export default {
  SCHEDULE_TYPE_MAP,
  REVERSE_TYPE_MAP,
  DAY_MAP,
  DAY_MAP_REVERSE,
  transformBackendToFrontend,
  transformFrontendToBackend,
  validateFullSchedule,
  getScheduleStyle,
  formatTimeInfo,
  isFullDaySchedule,
  getScheduleTypeInfo,
  fillFlexibleSlots,
};
