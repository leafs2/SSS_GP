/**
 * 手術日期推薦演算法
 *
 * 功能：根據醫師排班、助手值班、手術房使用率等條件，
 * 推薦最適合的手術日期（未來 30 天內）
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

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekday(date) {
  const dayIndex = date.getDay();
  return CONSTANTS.WEEKDAY_MAP[dayIndex];
}

function getWeekdayDisplay(weekday) {
  return CONSTANTS.WEEKDAY_DISPLAY[weekday] || weekday;
}

function buildCandidateDates() {
  const candidates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDay = CONSTANTS.PREPARATION_DAYS + 1;
  const endDay = CONSTANTS.PREPARATION_DAYS + CONSTANTS.RECOMMENDATION_DAYS;

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

function getDaysDifference(date1, date2) {
  const diffTime = Math.abs(date2 - date1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// ==================== 主刀醫師檢查 ====================

async function checkDoctorAvailability(
  pool,
  doctorId,
  candidateDates,
  surgeryDuration
) {
  try {
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
        surgeryCount: parseInt(row.count) || 0,
      };
    });

    const availableDates = [];
    const fullDates = [];

    for (const candidate of candidateDates) {
      const { date, weekday, weekdayDisplay, dateObj } = candidate;

      const scheduleType = weekSchedule[weekday];
      const typeInfo = scheduleTypes[scheduleType];

      if (!typeInfo) continue;

      const availableHours = typeInfo.availableHours;

      if (availableHours === 0) {
        continue;
      }

      const workload = workloadMap[date] || {
        scheduledHours: 0,
        surgeryCount: 0,
      };
      const scheduledHours = workload.scheduledHours;
      const remainingHours = availableHours - scheduledHours;

      if (remainingHours < surgeryDuration) {
        fullDates.push({
          date,
          weekdayDisplay,
          remainingHours,
          reason: "doctor_full",
        });
        continue;
      }

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

    if (fullDates.length > 0) {
      console.log(
        "⛔ 主刀醫師額滿日期:",
        fullDates.map((d) => `${d.date} (${d.remainingHours}hr)`)
      );
    }

    return { availableDates, fullDates };
  } catch (error) {
    console.error("檢查主刀醫師可用性錯誤:", error);
    throw error;
  }
}

// ==================== 助手醫師檢查 ====================

async function checkAssistantAvailability(
  pool,
  assistantId,
  candidateDates,
  surgeryDuration
) {
  try {
    const onDutyResult = await pool.query(
      `SELECT date FROM assistant_doctor_scheduling 
       WHERE employee_id = $1`,
      [assistantId]
    );

    const onDutyDates = new Set(
      onDutyResult.rows.map((row) => formatDate(new Date(row.date)))
    );

    // [修正] 改為查詢 doctor_daily_workload
    const dateList = candidateDates.map((d) => d.date);
    const workloadResult = await pool.query(
      `SELECT date, total_scheduled_hours, surgery_count 
       FROM doctor_daily_workload 
       WHERE employee_id = $1 AND date = ANY($2)`,
      [assistantId, dateList]
    );

    const assistantWorkload = {};
    workloadResult.rows.forEach((row) => {
      assistantWorkload[row.date] = {
        totalHours: parseFloat(row.total_scheduled_hours) || 0,
        surgeryCount: parseInt(row.surgery_count) || 0,
      };
    });

    const availableDates = [];
    const fullDates = [];

    for (const candidate of candidateDates) {
      const { date, dateObj, weekdayDisplay } = candidate;

      const yesterday = new Date(dateObj);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday);

      if (onDutyDates.has(yesterdayStr)) {
        continue;
      }

      const workload = assistantWorkload[date] || {
        totalHours: 0,
        surgeryCount: 0,
      };
      const totalHours = workload.totalHours;
      const remainingHours = CONSTANTS.ASSISTANT_MAX_HOURS - totalHours;

      if (remainingHours < surgeryDuration) {
        fullDates.push({
          date,
          weekdayDisplay,
          remainingHours,
          reason: "assistant_full",
        });
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

    if (fullDates.length > 0) {
      console.log(
        "⛔ 助手醫師額滿日期:",
        fullDates.map((d) => `${d.date} (${d.remainingHours}hr)`)
      );
    }

    return { availableDates, fullDates };
  } catch (error) {
    console.error("檢查助手醫師可用性錯誤:", error);
    throw error;
  }
}

// ==================== 手術房資源檢查 ====================

async function checkOperatingRoomAvailability(
  pool,
  surgeryRoomType,
  candidateDates,
  surgeryDuration
) {
  try {
    const roomTypeResult = await pool.query(
      `SELECT morning as morning_capacity FROM surgery_room_type WHERE type = $1`,
      [surgeryRoomType]
    );

    if (roomTypeResult.rows.length === 0)
      throw new Error(`找不到手術房類型: ${surgeryRoomType}`);
    const morningCapacity =
      parseFloat(roomTypeResult.rows[0].morning_capacity) || 0;

    const dateList = candidateDates.map((d) => d.date);
    const statsResult = await pool.query(
      `SELECT date, total_surgeries, morning_duration_hours, morning_available_hours
       FROM surgery_daily_statistics 
       WHERE date = ANY($1) AND surgery_room_type = $2`,
      [dateList, surgeryRoomType]
    );

    const statsMap = {};
    statsResult.rows.forEach((row) => {
      statsMap[formatDate(new Date(row.date))] = {
        totalSurgeries: parseInt(row.total_surgeries) || 0,
        morningUsedHours: parseFloat(row.morning_duration_hours) || 0,
        morningAvailableHours:
          parseFloat(row.morning_available_hours) || morningCapacity,
      };
    });

    const availableDates = [];
    const fullDates = [];

    for (const candidate of candidateDates) {
      const { date, weekdayDisplay } = candidate;

      const stats = statsMap[date] || {
        morningAvailableHours: morningCapacity,
        morningUsedHours: 0,
        totalSurgeries: 0,
      };

      if (stats.morningAvailableHours < surgeryDuration) {
        fullDates.push({
          date,
          weekdayDisplay,
          remainingHours: stats.morningAvailableHours,
          reason: "room_full",
        });
        continue;
      }

      availableDates.push({
        ...candidate,
        roomInfo: {
          roomType: surgeryRoomType,
          totalCapacity: morningCapacity,
          usedHours: stats.morningUsedHours,
          availableHours: stats.morningAvailableHours,
          utilizationRate: (stats.morningUsedHours / morningCapacity) * 100,
          totalSurgeries: stats.totalSurgeries,
        },
      });
    }

    if (fullDates.length > 0) {
      console.log(
        "⛔ 手術房額滿日期:",
        fullDates.map((d) => `${d.date}`)
      );
    }

    return availableDates;
  } catch (error) {
    console.error("檢查手術房可用性錯誤:", error);
    throw error;
  }
}

// ==================== 綜合評分 (已修復) ====================

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

    const limit = Math.min(
      Math.max(returnLimit, 1),
      CONSTANTS.MAX_RETURN_LIMIT
    );

    console.log("📅 開始推薦手術日期...");
    console.log("參數:", {
      doctorId,
      surgeryDuration,
      surgeryRoomType,
      assistantId,
    });

    console.log("步驟 1/5: 建立候選日期池...");
    let candidateDates = buildCandidateDates();
    console.log(`✓ 建立了 ${candidateDates.length} 個候選日期`);

    console.log("步驟 2/5: 檢查主刀醫師可用性...");
    const doctorCheckResult = await checkDoctorAvailability(
      pool,
      doctorId,
      candidateDates,
      surgeryDuration
    );

    candidateDates = doctorCheckResult.availableDates;
    let fullDates = doctorCheckResult.fullDates || [];

    console.log(`✓ 主刀醫師可用日期: ${candidateDates.length} 個`);

    if (candidateDates.length === 0) {
      return {
        success: false,
        count: 0,
        recommendations: [],
        fullDates: fullDates,
        message: "未來一個月內，主刀醫師沒有可用的時段",
      };
    }

    if (assistantId) {
      console.log("步驟 3/5: 檢查助手醫師可用性...");
      const assistantCheckResult = await checkAssistantAvailability(
        pool,
        assistantId,
        candidateDates,
        surgeryDuration
      );

      candidateDates = assistantCheckResult.availableDates;
      if (assistantCheckResult.fullDates) {
        fullDates = [...fullDates, ...assistantCheckResult.fullDates];
      }

      console.log(`✓ 助手醫師可用日期: ${candidateDates.length} 個`);

      if (candidateDates.length === 0) {
        return {
          success: false,
          count: 0,
          recommendations: [],
          fullDates: fullDates,
          message: "未來一個月內，助手醫師沒有可用的時段",
        };
      }
    }

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
        fullDates: fullDates,
        message: "未來一個月內，手術房容量不足",
      };
    }

    console.log("步驟 5/5: 綜合評分與排序...");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scoredDates = candidateDates.map((candidate) => {
      const scores = calculateTotalScore(candidate, today);
      return { ...candidate, scores };
    });

    scoredDates.sort((a, b) => {
      if (b.scores.totalScore !== a.scores.totalScore) {
        return b.scores.totalScore - a.scores.totalScore;
      }
      return a.dateObj - b.dateObj;
    });

    const topRecommendations = scoredDates.slice(0, limit);

    const recommendations = topRecommendations.map((item, index) => {
      const result = {
        date: item.date,
        weekday: item.weekdayDisplay,
        totalScore: item.scores.totalScore,
        rank: index + 1,
        doctorInfo: item.doctorInfo,
        roomInfo: item.roomInfo,
        scores: item.scores,
      };
      if (item.assistantInfo) result.assistantInfo = item.assistantInfo;
      return result;
    });

    console.log(`✓ 推薦完成，返回 ${recommendations.length} 個日期`);

    if (fullDates.length > 0) {
      console.log(
        "⚠️ 總計排除的額滿日期:",
        fullDates.map((d) => d.date)
      );
    }

    return {
      success: true,
      count: recommendations.length,
      recommendations,
      fullDates: fullDates,
      message: `找到 ${recommendations.length} 個推薦日期`,
    };
  } catch (error) {
    console.error("❌ 推薦手術日期錯誤:", error);
    return {
      success: false,
      count: 0,
      recommendations: [],
      fullDates: [],
      message: error.message || "推薦失敗",
      error: error.message,
    };
  }
}

export { recommendSurgeryDates };
