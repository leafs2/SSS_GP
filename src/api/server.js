import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cron from "node-cron";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// 導入路由模組
import employeesRouter, { setPool as setEmployeesPool } from "./employees.js";
import departmentsRouter, {
  setPool as setDepartmentsPool,
} from "./departments.js";
import authRouter, { setPool as setAuthPool } from "./auth.js";
import sessionRouter, { setPool as setSessionPool } from "./session.js";
import devLoginRouter, { setPool as setDevLoginPool } from "./devLogin.js";
import schedulesRouter, { setPool as setSchedulesPool } from "./schedules.js";
import surgeryTypesRouter, {
  setPool as setSurgeryTypesPool,
} from "./surgeryTypes.js";
import patientRouter, { setPool as setPatientPool } from "./patient.js";

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
setSessionPool(pool);
setDevLoginPool(pool);
setSchedulesPool(pool);
setSurgeryTypesPool(pool);
setPatientPool(pool);

const app = express();

// Session 存儲設定
const PgSession = connectPgSimple(session);

// Session 中介軟體（必須在 cors 和 express.json() 之前）
app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "sessions",
      createTableIfMissing: false, // 我們已經手動建立表了
    }),
    secret: process.env.SESSION_SECRET || "your-secret-key-change-this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 8 * 60 * 60 * 1000, // 8 小時
      httpOnly: true, // 防止 XSS 攻擊
      secure: process.env.NODE_ENV === "production", // 生產環境使用 HTTPS
      sameSite: "lax", // 防止 CSRF 攻擊
    },
    name: "sessionId", // 自訂 Cookie 名稱
  })
);

// CORS 設定（必須在 session 之後）
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://localhost:3000",
      "https://localhost:5173",
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true, // 允許帶 Cookie
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// 定期清理過期 Session（每小時執行一次）
cron.schedule("0 * * * *", async () => {
  try {
    const result = await pool.query(
      "DELETE FROM sessions WHERE expire < NOW()"
    );
    console.log(`🧹 清理了 ${result.rowCount} 個過期 Session`);
  } catch (error) {
    console.error("❌ 清理過期 Session 失敗:", error);
  }
});

// API 路由
app.use("/api/employees", employeesRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/fido", authRouter);
app.use("/api/session", sessionRouter);
app.use("/api/schedules", schedulesRouter);
app.use("/api/surgery-types", surgeryTypesRouter);
app.use("/api/patients", patientRouter);

// 開發環境專用路由
if (process.env.NODE_ENV === "development") {
  app.use("/api/dev", devLoginRouter);
  console.log("🚀 開發模式：快速登入功能已啟用 (/api/dev/*)");
}

// 健康檢查端點
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API 服務運行正常",
    database: "PostgreSQL (Supabase)",
    environment: process.env.NODE_ENV || "production",
    session: {
      enabled: true,
      store: "PostgreSQL",
      maxAge: "8 hours",
    },
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
  console.log(`🔐 Session: PostgreSQL (8小時有效)`);
  console.log(`📅 排班管理: /api/schedules/*`);
  console.log(`🌍 環境: ${process.env.NODE_ENV || "production"}`);
});
