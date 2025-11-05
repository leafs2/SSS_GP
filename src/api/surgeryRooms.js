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

// 獲取所有手術室類型和數量
router.get("/types-with-count", requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT 
        srt.type,
        srt.time_info,
        COUNT(sr.id) as room_count,
        array_agg(sr.id ORDER BY sr.id) FILTER (WHERE sr.id IS NOT NULL) as room_ids
      FROM surgery_room_type srt
      LEFT JOIN surgery_room sr ON srt.type = sr.room_type AND sr.is_available = true
      GROUP BY srt.type, srt.time_info
      ORDER BY COUNT(sr.id) DESC, srt.type
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        type: row.type,
        displayName: row.time_info, // 中文名稱
        timeInfo: row.time_info,
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
        sr.is_available,
        sr.nurse_count,
        srt.time_info
      FROM surgery_room sr
      LEFT JOIN surgery_room_type srt ON sr.room_type = srt.type
      WHERE sr.is_available = true
      ORDER BY sr.room_type, sr.id
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        roomType: row.room_type,
        isAvailable: row.is_available,
        nurseCount: row.nurse_count,
        timeInfo: row.time_info,
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

    const query = `
      SELECT 
        sr.id,
        sr.room_type,
        sr.is_available,
        sr.nurse_count,
        srt.time_info
      FROM surgery_room sr
      LEFT JOIN surgery_room_type srt ON sr.room_type = srt.type
      WHERE sr.room_type = $1 AND sr.is_available = true
      ORDER BY sr.id
    `;

    const result = await pool.query(query, [roomType]);

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        roomType: row.room_type,
        isAvailable: row.is_available,
        nurseCount: row.nurse_count,
        timeInfo: row.time_info,
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
        sr.is_available,
        sr.nurse_count,
        srt.time_info
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
        isAvailable: room.is_available,
        nurseCount: room.nurse_count,
        timeInfo: room.time_info,
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
