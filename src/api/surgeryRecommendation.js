/**
 * 手術日期推薦演算法
 *
 * 功能：根據醫師排班、助手值班、手術房使用率等條件，
 *      推薦最適合的手術日期（未來 30 天內）
 *
 * 演算法流程：
 * 1. 建立候選日期池（今天+4 到 今天+33，共30天）
 * 2. 檢查主刀醫師可用性
 * 3. 檢查助手醫師可用性（如有指定）
 * 4. 檢查手術房資源
 * 5. 綜合評分與排序
 * 6. 返回前 3-5 個推薦日期
 */

// ==================== 常數定義 ====================

const CONSTANTS = {
  // 日期範圍
  PREPARATION_DAYS: 3, // 準備期天數（前3天不可排）
  RECOMMENDATION_DAYS: 30, // 推薦範圍天數（完整一個月）

  // 時段定義（小時）
  MORNING_SHIFT_HOURS: 8, // 早班 08:00-16:00
  ASSISTANT_MAX_HOURS: 8, // 助手每日最大工作時數

  // 評分權重
  TIME_SCORE_WEIGHT: 0.45, // 時間分數權重 45%
  UTILIZATION_SCORE_WEIGHT: 0.4, // 使用率分數權重 40%
  AVAILABILITY_SCORE_WEIGHT: 0.15, // 可用時數分數權重 15%

  // 返回數量
  MAX_RETURN_LIMIT: 5, // 最多返回 5 個推薦
  DEFAULT_RETURN_LIMIT: 5, // 預設返回 5 個

  // 排班類型
  SCHEDULE_TYPES: {
    SURGERY: "A", // 手術日（全天可手術）
    MORNING_CLINIC: "B", // 上午看診（下午可手術）
    AFTERNOON_CLINIC: "C", // 下午看診（上午可手術）
    FULL_CLINIC: "D", // 全天看診（不可手術）
    OFF: "E", // 休假（不可手術）
  },

  // 星期對應
  WEEKDAY_MAP: {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  },

  WEEKDAY_DISPLAY: {
    monday: "週一",
    tuesday: "週二",
    wednesday: "週三",
    thursday: "週四",
    friday: "週五",
    saturday: "週六",
    sunday: "週日",
  },
};

// ==================== 輔助函數 ====================

/**
 * 格式化日期為 YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 取得日期對應的星期
 * @param {Date} date
 * @returns {string} 'monday', 'tuesday', etc.
 */
function getWeekday(date) {
  const dayIndex = date.getDay();
  return CONSTANTS.WEEKDAY_MAP[dayIndex];
}

/**
 * 取得星期的中文顯示
 * @param {string} weekday - 'monday', 'tuesday', etc.
 * @returns {string} '週一', '週二', etc.
 */
function getWeekdayDisplay(weekday) {
  return CONSTANTS.WEEKDAY_DISPLAY[weekday] || weekday;
}

/**
 * 建立候選日期池
 * @returns {Array} 候選日期陣列
 */
function buildCandidateDates() {
  const candidates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 重置時間為 00:00:00

  // 從今天+4 到 今天+33（共30天）
  const startDay = CONSTANTS.PREPARATION_DAYS + 1; // 4
  const endDay = CONSTANTS.PREPARATION_DAYS + CONSTANTS.RECOMMENDATION_DAYS; // 33

  for (let i = startDay; i <= endDay; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    const weekday = getWeekday(date);

    candidates.push({
      date: formatDate(date),
      dateObj: date,
      weekday: weekday,
      weekdayDisplay: getWeekdayDisplay(weekday),
    });
  }

  return candidates;
}

/**
 * 計算兩個日期之間的天數差
 * @param {Date} date1
 * @param {Date} date2
 * @returns {number}
 */
function getDaysDifference(date1, date2) {
  const diffTime = Math.abs(date2 - date1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// ==================== 主刀醫師檢查 ====================

/**
 * 檢查主刀醫師在候選日期的可用性
 * @param {Object} pool - 資料庫連線池
 * @param {string} doctorId - 醫師 ID
 * @param {Array} candidateDates - 候選日期陣列
 * @param {number} surgeryDuration - 手術時長（小時）
 * @returns {Promise<Array>} 可用的日期資訊
 */
async function checkDoctorAvailability(
  pool,
  doctorId,
  candidateDates,
  surgeryDuration
) {
  try {
    // 1. 查詢醫師週排班
    const scheduleResult = await pool.query(
      `SELECT monday, tuesday, wednesday, thursday, friday, saturday, sunday 
       FROM doctor_schedule 
       WHERE employee_id = $1`,
      [doctorId]
    );

    if (scheduleResult.rows.length === 0) {
      throw new Error(`找不到醫師 ${doctorId} 的排班資料`);
    }

    const weekSchedule = scheduleResult.rows[0];

    // 2. 查詢排班類型對應的可用時數
    const typeResult = await pool.query(
      `SELECT type, category, time_info, duration as available_hours 
       FROM doctor_scheduling_type`
    );

    const scheduleTypes = {};
    typeResult.rows.forEach((row) => {
      scheduleTypes[row.type] = {
        category: row.category,
        timeInfo: row.time_info,
        availableHours: parseFloat(row.available_hours) || 0,
      };
    });

    // 3. 查詢醫師每日已排手術時數
    const dateList = candidateDates.map((d) => d.date);
    const workloadResult = await pool.query(
      `SELECT date, total_scheduled_hours, surgery_count 
       FROM doctor_daily_workload 
       WHERE employee_id = $1 AND date = ANY($2)`,
      [doctorId, dateList]
    );

    const workloadMap = {};
    workloadResult.rows.forEach((row) => {
      workloadMap[row.date] = {
        scheduledHours: parseFloat(row.total_scheduled_hours) || 0,
        surgeryCount: parseInt(row.surgery_count) || 0,
      };
    });

    // 4. 過濾並計算每個候選日期的可用性
    const availableDates = [];

    for (const candidate of candidateDates) {
      const { date, weekday, weekdayDisplay, dateObj } = candidate;

      // 取得當日排班類型
      const scheduleType = weekSchedule[weekday];
      const typeInfo = scheduleTypes[scheduleType];

      if (!typeInfo) {
        console.warn(`未知的排班類型: ${scheduleType}`);
        continue;
      }

      const availableHours = typeInfo.availableHours;

      // 過濾不可手術的日期（全天看診或休假）
      if (availableHours === 0) {
        continue;
      }

      // 取得已排手術時數
      const workload = workloadMap[date] || {
        scheduledHours: 0,
        surgeryCount: 0,
      };
      const scheduledHours = workload.scheduledHours;
      const remainingHours = availableHours - scheduledHours;

      // 檢查剩餘時數是否足夠
      if (remainingHours < surgeryDuration) {
        continue;
      }

      // 計算可排時段
      let availablePeriod = "full_day";
      if (scheduleType === CONSTANTS.SCHEDULE_TYPES.MORNING_CLINIC) {
        availablePeriod = "afternoon";
      } else if (scheduleType === CONSTANTS.SCHEDULE_TYPES.AFTERNOON_CLINIC) {
        availablePeriod = "morning";
      }

      availableDates.push({
        date,
        dateObj,
        weekday,
        weekdayDisplay,
        doctorInfo: {
          scheduleType,
          scheduleCategory: typeInfo.category,
          availableHours,
          scheduledHours,
          remainingHours,
          surgeryCount: workload.surgeryCount,
          availablePeriod,
        },
      });
    }

    return availableDates;
  } catch (error) {
    console.error("檢查主刀醫師可用性錯誤:", error);
    throw error;
  }
}

// ==================== 助手醫師檢查 ====================

/**
 * 檢查助手醫師在候選日期的可用性
 * @param {Object} pool - 資料庫連線池
 * @param {string} assistantId - 助手醫師 ID
 * @param {Array} candidateDates - 候選日期陣列
 * @param {number} surgeryDuration - 手術時長（小時）
 * @returns {Promise<Array>} 可用的日期資訊
 */
async function checkAssistantAvailability(
  pool,
  assistantId,
  candidateDates,
  surgeryDuration
) {
  try {
    // 1. 查詢助手值班日期
    const onDutyResult = await pool.query(
      `SELECT date FROM assistant_doctor_scheduling 
       WHERE employee_id = $1`,
      [assistantId]
    );

    // 建立值班日期 Set（加速查詢）
    const onDutyDates = new Set(
      onDutyResult.rows.map((row) => formatDate(new Date(row.date)))
    );

    // 2. 查詢助手每日已排手術時數
    const dateList = candidateDates.map((d) => d.date);
    const surgeryResult = await pool.query(
      `SELECT surgery_date, SUM(CAST(duration AS DECIMAL)) as total_hours, COUNT(*) as count
       FROM surgery 
       WHERE assistant_doctor_id = $1 AND surgery_date = ANY($2)
       GROUP BY surgery_date`,
      [assistantId, dateList]
    );

    const assistantWorkload = {};
    surgeryResult.rows.forEach((row) => {
      assistantWorkload[formatDate(new Date(row.surgery_date))] = {
        totalHours: parseFloat(row.total_hours) || 0,
        surgeryCount: parseInt(row.count) || 0,
      };
    });

    // 3. 過濾可用日期
    const availableDates = [];

    for (const candidate of candidateDates) {
      const { date, dateObj } = candidate;

      // 檢查是否為值班隔天（值班隔天必休）
      const yesterday = new Date(dateObj);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday);

      if (onDutyDates.has(yesterdayStr)) {
        // 值班隔天，跳過
        continue;
      }

      // 檢查助手當日已排手術時數（區塊制：總時數 <= 8 小時）
      const workload = assistantWorkload[date] || {
        totalHours: 0,
        surgeryCount: 0,
      };
      const totalHours = workload.totalHours;
      const remainingHours = CONSTANTS.ASSISTANT_MAX_HOURS - totalHours;

      if (remainingHours < surgeryDuration) {
        // 助手時間不足，跳過
        continue;
      }

      availableDates.push({
        ...candidate,
        assistantInfo: {
          totalHours,
          remainingHours,
          surgeryCount: workload.surgeryCount,
          isOnDutyYesterday: false,
        },
      });
    }

    return availableDates;
  } catch (error) {
    console.error("檢查助手醫師可用性錯誤:", error);
    throw error;
  }
}

// ==================== 手術房資源檢查 ====================

/**
 * 檢查手術房在候選日期的可用性
 * @param {Object} pool - 資料庫連線池
 * @param {string} surgeryRoomType - 手術房類型
 * @param {Array} candidateDates - 候選日期陣列
 * @param {number} surgeryDuration - 手術時長（小時）
 * @returns {Promise<Array>} 可用的日期資訊
 */
async function checkOperatingRoomAvailability(
  pool,
  surgeryRoomType,
  candidateDates,
  surgeryDuration
) {
  try {
    // 1. 查詢手術房類型的容量資訊
    const roomTypeResult = await pool.query(
      `SELECT type, type_info, type_code, morning as morning_capacity, 
              night as night_capacity, graveyard as graveyard_capacity
       FROM surgery_room_type 
       WHERE type = $1`,
      [surgeryRoomType]
    );

    if (roomTypeResult.rows.length === 0) {
      throw new Error(`找不到手術房類型: ${surgeryRoomType}`);
    }

    const roomType = roomTypeResult.rows[0];
    const morningCapacity = parseFloat(roomType.morning_capacity) || 0;

    if (morningCapacity === 0) {
      throw new Error(`手術房類型 ${surgeryRoomType} 沒有早班容量`);
    }

    // 2. 查詢每日使用統計（優先從快取表查詢）
    const dateList = candidateDates.map((d) => d.date);
    const statsResult = await pool.query(
      `SELECT date, total_surgeries, morning_duration_hours, 
              morning_utilization_rate, morning_available_hours
       FROM surgery_daily_statistics 
       WHERE date = ANY($1) AND surgery_room_type = $2`,
      [dateList, surgeryRoomType]
    );

    const statsMap = {};
    statsResult.rows.forEach((row) => {
      statsMap[formatDate(new Date(row.date))] = {
        totalSurgeries: parseInt(row.total_surgeries) || 0,
        morningUsedHours: parseFloat(row.morning_duration_hours) || 0,
        morningUtilizationRate: parseFloat(row.morning_utilization_rate) || 0,
        morningAvailableHours:
          parseFloat(row.morning_available_hours) || morningCapacity,
      };
    });

    // 3. 對於沒有快取的日期，即時計算
    const missingDates = candidateDates.filter((c) => !statsMap[c.date]);

    if (missingDates.length > 0) {
      const missingDateList = missingDates.map((d) => d.date);
      const surgeryResult = await pool.query(
        `SELECT surgery_date, COUNT(*) as count, SUM(CAST(duration AS DECIMAL)) as total_hours
         FROM surgery 
         WHERE surgery_date = ANY($1) AND surgery_room_type = $2
         GROUP BY surgery_date`,
        [missingDateList, surgeryRoomType]
      );

      surgeryResult.rows.forEach((row) => {
        const date = formatDate(new Date(row.surgery_date));
        const usedHours = parseFloat(row.total_hours) || 0;
        const utilizationRate = (usedHours / morningCapacity) * 100;
        const availableHours = morningCapacity - usedHours;

        statsMap[date] = {
          totalSurgeries: parseInt(row.count) || 0,
          morningUsedHours: usedHours,
          morningUtilizationRate: utilizationRate,
          morningAvailableHours: availableHours,
        };
      });

      // 沒有任何手術的日期
      for (const candidate of missingDates) {
        if (!statsMap[candidate.date]) {
          statsMap[candidate.date] = {
            totalSurgeries: 0,
            morningUsedHours: 0,
            morningUtilizationRate: 0,
            morningAvailableHours: morningCapacity,
          };
        }
      }
    }

    // 4. 過濾可用日期
    const availableDates = [];

    for (const candidate of candidateDates) {
      const { date } = candidate;
      const stats = statsMap[date];

      if (!stats) {
        continue;
      }

      const availableHours = stats.morningAvailableHours;

      // 檢查手術房容量是否足夠
      if (availableHours < surgeryDuration) {
        continue;
      }

      availableDates.push({
        ...candidate,
        roomInfo: {
          roomType: roomType.type_info,
          totalCapacity: morningCapacity,
          usedHours: stats.morningUsedHours,
          availableHours: availableHours,
          utilizationRate: stats.morningUtilizationRate,
          totalSurgeries: stats.totalSurgeries,
        },
      });
    }

    return availableDates;
  } catch (error) {
    console.error("檢查手術房可用性錯誤:", error);
    throw error;
  }
}

// ==================== 綜合評分 ====================

/**
 * 計算時間分數（距離今天越近分數越高）
 * @param {Date} candidateDate - 候選日期
 * @param {Date} today - 今天日期
 * @returns {number} 0-100 分
 */
function calculateTimeScore(candidateDate, today) {
  const daysDistance = getDaysDifference(candidateDate, today);

  let score;
  if (daysDistance <= 10) {
    score = 100 - daysDistance * 4;
  } else if (daysDistance <= 20) {
    score = 60 - (daysDistance - 10) * 3;
  } else {
    score = 30 - (daysDistance - 20) * 2;
  }

  return Math.max(score, 0);
}

/**
 * 計算使用率分數（使用率越低分數越高）
 * @param {number} utilizationRate - 使用率百分比
 * @returns {number} 0-100 分
 */
function calculateUtilizationScore(utilizationRate) {
  return Math.max(100 - utilizationRate, 0);
}

/**
 * 計算可用時數分數（剩餘時數比例越高分數越高）
 * @param {number} remainingHours - 剩餘時數
 * @param {number} availableHours - 可用時數
 * @returns {number} 0-100 分
 */
function calculateAvailabilityScore(remainingHours, availableHours) {
  if (availableHours === 0) return 0;
  return (remainingHours / availableHours) * 100;
}

/**
 * 計算綜合評分
 * @param {Object} candidate - 候選日期物件
 * @param {Date} today - 今天日期
 * @returns {Object} 包含各項分數和總分的物件
 */
function calculateTotalScore(candidate, today) {
  const { dateObj, doctorInfo, roomInfo } = candidate;

  // 計算各項分數
  const timeScore = calculateTimeScore(dateObj, today);
  const utilizationScore = calculateUtilizationScore(roomInfo.utilizationRate);
  const availabilityScore = calculateAvailabilityScore(
    doctorInfo.remainingHours,
    doctorInfo.availableHours
  );

  // 加權總分
  const totalScore =
    timeScore * CONSTANTS.TIME_SCORE_WEIGHT +
    utilizationScore * CONSTANTS.UTILIZATION_SCORE_WEIGHT +
    availabilityScore * CONSTANTS.AVAILABILITY_SCORE_WEIGHT;

  return {
    timeScore: Math.round(timeScore * 10) / 10,
    utilizationScore: Math.round(utilizationScore * 10) / 10,
    availabilityScore: Math.round(availabilityScore * 10) / 10,
    totalScore: Math.round(totalScore * 10) / 10,
  };
}

// ==================== 主要演算法函數 ====================

/**
 * 推薦手術日期
 * @param {Object} pool - 資料庫連線池
 * @param {Object} params - 推薦參數
 * @param {string} params.doctorId - 主刀醫師 ID
 * @param {string} params.surgeryTypeCode - 手術類型代碼
 * @param {number} params.surgeryDuration - 手術時長（小時）
 * @param {string} params.surgeryRoomType - 手術房類型
 * @param {string} [params.assistantId] - 助手醫師 ID（選填）
 * @param {number} [params.returnLimit=5] - 返回數量（1-5）
 * @returns {Promise<Object>} 推薦結果
 */
async function recommendSurgeryDates(pool, params) {
  try {
    const {
      doctorId,
      surgeryTypeCode,
      surgeryDuration,
      surgeryRoomType,
      assistantId = null,
      returnLimit = CONSTANTS.DEFAULT_RETURN_LIMIT,
    } = params;

    // 參數驗證
    if (!doctorId || !surgeryTypeCode || !surgeryDuration || !surgeryRoomType) {
      throw new Error("缺少必要參數");
    }

    if (surgeryDuration <= 0) {
      throw new Error("手術時長必須大於 0");
    }

    const limit = Math.min(
      Math.max(returnLimit, 1),
      CONSTANTS.MAX_RETURN_LIMIT
    );

    console.log("📅 開始推薦手術日期...");
    console.log("參數:", {
      doctorId,
      surgeryTypeCode,
      surgeryDuration,
      surgeryRoomType,
      assistantId,
    });

    // 步驟 1: 建立候選日期池
    console.log("步驟 1/5: 建立候選日期池...");
    let candidateDates = buildCandidateDates();
    console.log(`✓ 建立了 ${candidateDates.length} 個候選日期`);

    // 步驟 2: 檢查主刀醫師可用性
    console.log("步驟 2/5: 檢查主刀醫師可用性...");
    candidateDates = await checkDoctorAvailability(
      pool,
      doctorId,
      candidateDates,
      surgeryDuration
    );
    console.log(`✓ 主刀醫師可用日期: ${candidateDates.length} 個`);

    if (candidateDates.length === 0) {
      return {
        success: false,
        count: 0,
        recommendations: [],
        message: "未來一個月內，主刀醫師沒有可用的時段",
      };
    }

    // 步驟 3: 檢查助手醫師可用性（如有指定）
    if (assistantId) {
      console.log("步驟 3/5: 檢查助手醫師可用性...");
      candidateDates = await checkAssistantAvailability(
        pool,
        assistantId,
        candidateDates,
        surgeryDuration
      );
      console.log(`✓ 助手醫師可用日期: ${candidateDates.length} 個`);

      if (candidateDates.length === 0) {
        return {
          success: false,
          count: 0,
          recommendations: [],
          message: "未來一個月內，助手醫師沒有可用的時段",
        };
      }
    } else {
      console.log("步驟 3/5: 跳過（未指定助手醫師）");
    }

    // 步驟 4: 檢查手術房資源
    console.log("步驟 4/5: 檢查手術房資源...");
    candidateDates = await checkOperatingRoomAvailability(
      pool,
      surgeryRoomType,
      candidateDates,
      surgeryDuration
    );
    console.log(`✓ 手術房可用日期: ${candidateDates.length} 個`);

    if (candidateDates.length === 0) {
      return {
        success: false,
        count: 0,
        recommendations: [],
        message: "未來一個月內，手術房容量不足",
      };
    }

    // 步驟 5: 綜合評分與排序
    console.log("步驟 5/5: 綜合評分與排序...");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scoredDates = candidateDates.map((candidate) => {
      const scores = calculateTotalScore(candidate, today);
      return {
        ...candidate,
        scores,
      };
    });

    // 排序：總分由高到低，相同分數時較早的日期優先
    scoredDates.sort((a, b) => {
      if (b.scores.totalScore !== a.scores.totalScore) {
        return b.scores.totalScore - a.scores.totalScore;
      }
      return a.dateObj - b.dateObj;
    });

    // 取前 N 個推薦
    const topRecommendations = scoredDates.slice(0, limit);

    // 格式化輸出
    const recommendations = topRecommendations.map((item, index) => {
      const result = {
        date: item.date,
        weekday: item.weekdayDisplay,
        totalScore: item.scores.totalScore,
        rank: index + 1,
        doctorInfo: {
          scheduleType: item.doctorInfo.scheduleType,
          scheduleCategory: item.doctorInfo.scheduleCategory,
          availableHours: item.doctorInfo.availableHours,
          scheduledHours: item.doctorInfo.scheduledHours,
          remainingHours: item.doctorInfo.remainingHours,
          surgeryCount: item.doctorInfo.surgeryCount,
          availablePeriod: item.doctorInfo.availablePeriod,
        },
        roomInfo: {
          roomType: item.roomInfo.roomType,
          totalCapacity: item.roomInfo.totalCapacity,
          usedHours: item.roomInfo.usedHours,
          availableHours: item.roomInfo.availableHours,
          utilizationRate: item.roomInfo.utilizationRate,
          totalSurgeries: item.roomInfo.totalSurgeries,
        },
        scores: {
          timeScore: item.scores.timeScore,
          utilizationScore: item.scores.utilizationScore,
          availabilityScore: item.scores.availabilityScore,
        },
      };

      // 如果有助手資訊，加入結果
      if (item.assistantInfo) {
        result.assistantInfo = {
          totalHours: item.assistantInfo.totalHours,
          remainingHours: item.assistantInfo.remainingHours,
          surgeryCount: item.assistantInfo.surgeryCount,
        };
      }

      return result;
    });

    console.log(`✓ 推薦完成，返回 ${recommendations.length} 個日期`);

    return {
      success: true,
      count: recommendations.length,
      recommendations,
      message: `找到 ${recommendations.length} 個推薦日期`,
    };
  } catch (error) {
    console.error("❌ 推薦手術日期錯誤:", error);
    return {
      success: false,
      count: 0,
      recommendations: [],
      message: error.message || "推薦失敗",
      error: error.message,
    };
  }
}

// ==================== 導出 ====================

export { recommendSurgeryDates };
