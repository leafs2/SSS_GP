import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// 導入路由模組
import employeesRouter, { setPool as setEmployeesPool } from "./employees.js";
import departmentsRouter, {
  setPool as setDepartmentsPool,
} from "./departments.js";
import authRouter, { setPool as setAuthPool } from "./auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "../../.env");
dotenv.config({ path: envPath });

// PostgreSQL 連線池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase 需要 SSL
});

// 測試資料庫連線
pool
  .query("SELECT NOW()")
  .then(() => console.log("✅ PostgreSQL 連線成功"))
  .catch((err) => console.error("❌ PostgreSQL 連線失敗:", err));

// 將 pool 傳遞給各個路由模組
setEmployeesPool(pool);
setDepartmentsPool(pool);
setAuthPool(pool);

const app = express();

// 中介軟體
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://localhost:3000",
      "https://localhost:5173",
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// API 路由
app.use("/api/employees", employeesRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/fido", authRouter);

// 健康檢查端點
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API 服務運行正常",
    database: "PostgreSQL (Supabase)",
    timestamp: new Date().toISOString(),
  });
});

// 錯誤處理中介軟體
app.use((err, req, res, next) => {
  console.error("未處理的錯誤:", err);
  res.status(500).json({
    success: false,
    error: "伺服器內部錯誤",
  });
});

// 404 處理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "API 端點不存在",
  });
});

// 啟動服務器
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 API 伺服器運行在 http://localhost:${PORT}`);
  console.log(`🏥 健康檢查: http://localhost:${PORT}/api/health`);
  console.log(`💾 資料庫: PostgreSQL (Supabase)`);
});
