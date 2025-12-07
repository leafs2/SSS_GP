/**
 * 手術日期推薦 API 路由
 */

import express from "express";
import { recommendSurgeryDates } from "./surgeryRecommendation.js";

const router = express.Router();

// 使用傳入的 pool
let pool;

export const setPool = (dbPool) => {
  pool = dbPool;
};

/**
 * POST /api/surgery-recommendation/recommend
 * 推薦手術日期
 *
 * Request Body:
 * {
 *   "doctorId": "D001",
 *   "surgeryTypeCode": "SUR123",
 *   "surgeryDuration": 2.5,
 *   "surgeryRoomType": "RSU",
 *   "assistantId": "A001",  // 選填
 *   "returnLimit": 5         // 選填，預設 5
 * }
 */
router.post("/recommend", async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: "資料庫連線未初始化",
      });
    }

    const {
      doctorId,
      surgeryTypeCode,
      surgeryDuration,
      surgeryRoomType,
      assistantId,
      returnLimit,
    } = req.body;

    // 參數驗證
    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "缺少必要參數: doctorId",
      });
    }

    if (!surgeryTypeCode) {
      return res.status(400).json({
        success: false,
        message: "缺少必要參數: surgeryTypeCode",
      });
    }

    if (!surgeryDuration || surgeryDuration <= 0) {
      return res.status(400).json({
        success: false,
        message: "手術時長必須大於 0",
      });
    }

    if (!surgeryRoomType) {
      return res.status(400).json({
        success: false,
        message: "缺少必要參數: surgeryRoomType",
      });
    }

    // 調用演算法
    const result = await recommendSurgeryDates(pool, {
      doctorId,
      surgeryTypeCode,
      surgeryDuration,
      surgeryRoomType,
      assistantId,
      returnLimit,
    });

    // 根據結果返回適當的狀態碼
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("❌ 推薦手術日期 API 錯誤:", error);
    res.status(500).json({
      success: false,
      message: "伺服器內部錯誤",
      error: error.message,
    });
  }
});

/**
 * GET /api/surgery-recommendation/health
 * 健康檢查端點
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "手術日期推薦服務運行正常",
    timestamp: new Date().toISOString(),
  });
});

export default router;
