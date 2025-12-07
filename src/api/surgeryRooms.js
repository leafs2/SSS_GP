// surgeryRooms.js
import express from "express";

const router = express.Router();
let pool;

// 設定資料庫連線池
export const setPool = (pgPool) => {
  pool = pgPool;
};

// 中介軟體：檢查是否已登入
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: "請先登入",
    });
  }
  next();
};

/**
 * GET /api/surgery-rooms/types
 * 取得所有手術室類型
 */
router.get("/types", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT type, type_code, type_info 
       FROM surgery_room_type 
       ORDER BY type_code`
    );

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("取得手術室類型失敗:", error);
    res.status(500).json({
      success: false,
      error: "取得手術室類型失敗",
      message: error.message,
    });
  }
});

// 獲取所有手術室類型和數量（可依時段篩選）
router.get("/types-with-count", requireAuth, async (req, res) => {
  try {
    const { shift } = req.query; // 接收時段參數：morning, evening, night

    let query;

    if (shift) {
      // 根據時段決定要檢查的欄位
      let shiftColumn;
      if (shift === "morning") {
        shiftColumn = "morning_shift";
      } else if (shift === "evening") {
        shiftColumn = "night_shift";
      } else if (shift === "night") {
        shiftColumn = "graveyard_shift";
      }

      // 使用子查詢來正確計算每個類型在特定時段的手術室數量
      query = `
        SELECT 
          srt.type,
          srt.type_info,
          COALESCE(room_data.room_count, 0) as room_count,
          COALESCE(room_data.room_ids, ARRAY[]::character varying[]) as room_ids
        FROM surgery_room_type srt
        LEFT JOIN (
          SELECT 
            room_type,
            COUNT(id) as room_count,
            array_agg(id ORDER BY id) as room_ids
          FROM surgery_room
          WHERE ${shiftColumn} = true
          GROUP BY room_type
        ) room_data ON srt.type = room_data.room_type
        WHERE COALESCE(room_data.room_count, 0) > 0
        ORDER BY room_count DESC, srt.type
      `;
    } else {
      // 沒有指定時段，返回所有手術室
      query = `
        SELECT 
          srt.type,
          srt.type_info,
          COUNT(sr.id) as room_count,
          array_agg(sr.id ORDER BY sr.id) FILTER (WHERE sr.id IS NOT NULL) as room_ids
        FROM surgery_room_type srt
        LEFT JOIN surgery_room sr ON srt.type = sr.room_type
        GROUP BY srt.type, srt.type_info
        HAVING COUNT(sr.id) > 0
        ORDER BY COUNT(sr.id) DESC, srt.type
      `;
    }

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        type: row.type,
        displayName: row.type_info, // 中文名稱
        typeInfo: row.type_info,
        roomCount: parseInt(row.room_count) || 0,
        roomIds: row.room_ids || [],
      })),
    });
  } catch (error) {
    console.error("獲取手術室類型失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取手術室類型失敗",
    });
  }
});

// 獲取所有可用的手術室列表
router.get("/available", requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT 
        sr.id,
        sr.room_type,
        sr.nurse_count,
        sr.morning_shift,
        sr.night_shift,
        sr.graveyard_shift,
        srt.type_info
      FROM surgery_room sr
      LEFT JOIN surgery_room_type srt ON sr.room_type = srt.type
      ORDER BY sr.room_type, sr.id
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        roomType: row.room_type,
        nurseCount: row.nurse_count,
        morningShift: row.morning_shift,
        nightShift: row.night_shift,
        graveyardShift: row.graveyard_shift,
        typeInfo: row.type_info,
      })),
    });
  } catch (error) {
    console.error("獲取手術室列表失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取手術室列表失敗",
    });
  }
});

// 獲取特定類型的手術室
router.get("/type/:roomType", requireAuth, async (req, res) => {
  try {
    const { roomType } = req.params;
    const { shift } = req.query;

    // 根據時段決定要檢查的欄位
    let shiftCondition = "";
    if (shift === "morning") {
      shiftCondition = "AND sr.morning_shift = true";
    } else if (shift === "evening") {
      shiftCondition = "AND sr.night_shift = true";
    } else if (shift === "night") {
      shiftCondition = "AND sr.graveyard_shift = true";
    }

    const query = `
      SELECT 
        sr.id,
        sr.room_type,
        sr.nurse_count,
        sr.morning_shift,
        sr.night_shift,
        sr.graveyard_shift,
        srt.type_info
      FROM surgery_room sr
      LEFT JOIN surgery_room_type srt ON sr.room_type = srt.type
      WHERE sr.room_type = $1 ${shiftCondition}
      ORDER BY sr.id
    `;

    const result = await pool.query(query, [roomType]);

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        roomType: row.room_type,
        nurseCount: row.nurse_count,
        morningShift: row.morning_shift,
        nightShift: row.night_shift,
        graveyardShift: row.graveyard_shift,
        typeInfo: row.type_info,
      })),
    });
  } catch (error) {
    console.error("獲取特定類型手術室失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取手術室失敗",
    });
  }
});

// 獲取手術室詳細資訊
router.get("/:roomId", requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;

    const query = `
      SELECT 
        sr.id,
        sr.room_type,
        sr.nurse_count,
        sr.morning_shift,
        sr.night_shift,
        sr.graveyard_shift,
        srt.type_info
      FROM surgery_room sr
      LEFT JOIN surgery_room_type srt ON sr.room_type = srt.type
      WHERE sr.id = $1
    `;

    const result = await pool.query(query, [roomId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "找不到該手術室",
      });
    }

    const room = result.rows[0];

    res.json({
      success: true,
      data: {
        id: room.id,
        roomType: room.room_type,
        nurseCount: room.nurse_count,
        morningShift: room.morning_shift,
        nightShift: room.night_shift,
        graveyardShift: room.graveyard_shift,
        typeInfo: room.type_info,
      },
    });
  } catch (error) {
    console.error("獲取手術室詳細資訊失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取手術室資訊失敗",
    });
  }
});

export default router;
