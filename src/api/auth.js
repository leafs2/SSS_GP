import express from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const router = express.Router();

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

// FIDO 設定常數
const RP_NAME = "醫院手術排程系統";
const RP_ID = "localhost";
// 支援多個前端來源
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "https://localhost:3000",
  "https://localhost:5173",
].filter(Boolean);

// Challenge 儲存
const challenges = new Map();
const loginChallenges = new Map();

// 取得設備名稱輔助函數
function getDeviceName(attResp, req) {
  try {
    const userAgent = req?.headers?.["user-agent"] || "";

    console.log("🔍 User-Agent:", userAgent);

    if (userAgent.includes("iPhone")) return "iPhone";
    if (userAgent.includes("iPad")) return "iPad";
    if (userAgent.includes("Android")) return "Android 手機";
    if (userAgent.includes("Windows")) return "Windows 設備";
    if (userAgent.includes("Mac")) return "Mac 設備";

    if (attResp?.response?.transports) {
      if (attResp.response.transports.includes("hybrid")) {
        return "手機認證器";
      }
    }

    return "手機認證器";
  } catch (error) {
    console.error("❌ 獲取設備名稱失敗:", error);
    return "手機認證器";
  }
}

// 清理過期挑戰值
function cleanupExpiredChallenges() {
  const now = Date.now();
  const expireTime = 10 * 60 * 1000;

  for (const [key, value] of challenges.entries()) {
    if (now - value.timestamp > expireTime) {
      console.log(`🧹 清理過期挑戰值: ${key}`);
      challenges.delete(key);
      loginChallenges.delete(key);
    }
  }
}

setInterval(cleanupExpiredChallenges, 5 * 60 * 1000);

// 1. 驗證註冊 token
router.get("/verify-registration-token/:token", async (req, res) => {
  const { token } = req.params;

  try {
    // 解碼 token
    const decoded = Buffer.from(token, "base64").toString();
    const [employeeId, expireTime] = decoded.split(":");

    // 檢查 token 是否過期
    if (Date.now() > parseInt(expireTime)) {
      return res.status(400).json({
        success: false,
        message: "註冊連結已過期，請聯繫管理員重新發送",
      });
    }

    // 查詢員工資料
    const employee = await pool.query(
      `SELECT e.*, d.name as department_name 
       FROM employees e 
       LEFT JOIN departments d ON e.department_code = d.code 
       WHERE e.employee_id = $1`,
      [employeeId]
    );

    if (employee.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "員工不存在",
      });
    }

    const employeeData = employee.rows[0];

    // 檢查是否已有 FIDO 憑證
    const existingCred = await pool.query(
      "SELECT id, created_at FROM fido_credentials WHERE employee_id = $1",
      [employeeId]
    );

    if (employeeData.status === "active" && existingCred.rows.length > 0) {
      return res.json({
        success: true,
        employee: employeeData,
        status: "completed",
        message: "您已完成 FIDO 註冊",
        completedAt: existingCred.rows[0].created_at,
      });
    } else if (employeeData.status === "pending") {
      return res.json({
        success: true,
        employee: employeeData,
        status: "pending",
        message: "請完成 FIDO 註冊設定",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "帳號狀態異常，請聯繫管理員",
        status: employeeData.status,
      });
    }
  } catch (error) {
    console.error("驗證註冊 token 失敗:", error);
    res.status(400).json({
      success: false,
      message: "無效的註冊連結",
      invalid: true,
    });
  }
});

// 2. 註冊狀態檢查
router.get("/registration-status/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const decoded = Buffer.from(token, "base64").toString();
    const [employeeId, expireTime] = decoded.split(":");

    const employee = await pool.query(
      `SELECT e.*, d.name as department_name 
       FROM employees e 
       LEFT JOIN departments d ON e.department_code = d.code 
       WHERE e.employee_id = $1`,
      [employeeId]
    );

    if (employee.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "員工不存在",
      });
    }

    const employeeData = employee.rows[0];

    const credentials = await pool.query(
      "SELECT created_at, device_name FROM fido_credentials WHERE employee_id = $1",
      [employeeId]
    );

    const hasCredentials = credentials.rows.length > 0;

    res.json({
      success: true,
      employee: employeeData,
      hasCredentials,
      registrationCompleted: employeeData.status === "active" && hasCredentials,
      credentialInfo: hasCredentials
        ? {
            registeredAt: credentials.rows[0].created_at,
            deviceName: credentials.rows[0].device_name,
          }
        : null,
    });
  } catch (error) {
    console.error("檢查註冊狀態失敗:", error);
    res.status(400).json({
      success: false,
      message: "無效的連結",
    });
  }
});

// 3. FIDO 註冊開始
router.post("/registration/begin", async (req, res) => {
  const { employee_id } = req.body;

  try {
    console.log("開始 FIDO 註冊流程，員工編號:", employee_id);

    const employee = await pool.query(
      "SELECT * FROM employees WHERE employee_id = $1 AND status = 'pending'",
      [employee_id]
    );

    if (employee.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在或已完成註冊",
      });
    }

    const employeeData = employee.rows[0];

    const existingCreds = await pool.query(
      "SELECT id, credential_id FROM fido_credentials WHERE employee_id = $1",
      [employee_id]
    );

    const excludeCredentials = existingCreds.rows.map((cred) => ({
      id: Buffer.from(cred.credential_id, "base64"),
      type: "public-key",
      transports: ["hybrid", "usb"],
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(employee_id, "utf8"),
      userName: employeeData.email,
      userDisplayName: employeeData.name,
      timeout: 300000,
      attestationType: "direct",
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: "cross-platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    challenges.set(employee_id, {
      challenge: options.challenge,
      type: "mobile",
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      options,
      method: "mobile_authenticator",
      instructions: {
        title: "使用手機作為安全金鑰",
        steps: [
          "確保手機藍牙已開啟",
          "手機靠近電腦 (約1公尺內)",
          "瀏覽器會引導您配對手機",
          "在手機上完成生物識別驗證",
        ],
      },
    });
  } catch (error) {
    console.error("FIDO 註冊開始失敗:", error);
    res.status(500).json({
      success: false,
      error: `FIDO 註冊開始失敗: ${error.message}`,
    });
  }
});

// 4. FIDO 註冊驗證
router.post("/registration/verify", async (req, res) => {
  const { employee_id, attResp } = req.body;

  try {
    console.log("驗證 FIDO 註冊回應，員工編號:", employee_id);

    const employee = await pool.query(
      "SELECT * FROM employees WHERE employee_id = $1 AND status = 'pending'",
      [employee_id]
    );

    if (employee.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在或已完成註冊",
      });
    }

    const storedChallenge = challenges.get(employee_id);
    if (!storedChallenge) {
      return res.status(400).json({
        success: false,
        error: "找不到對應的挑戰值，請重新開始註冊",
      });
    }

    const verification = await verifyRegistrationResponse({
      response: attResp,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: ALLOWED_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
      expectedType: "webauthn.create",
    });

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        error: "FIDO 註冊驗證失敗",
      });
    }

    const { registrationInfo } = verification;

    if (!registrationInfo) {
      return res.status(400).json({
        success: false,
        error: "驗證回應缺少註冊資訊",
      });
    }

    let credentialID = attResp.id;
    let credentialPublicKey =
      registrationInfo.credential?.publicKey ||
      Buffer.from(attResp.response.publicKey, "base64");

    const credentialIdBase64 = Buffer.from(credentialID, "base64url").toString(
      "base64"
    );
    const publicKeyBase64 = Buffer.from(credentialPublicKey).toString("base64");

    if (!credentialID && attResp.id) {
      credentialID = Buffer.from(attResp.id, "base64url");
    }

    if (!credentialPublicKey && attResp.response?.publicKey) {
      credentialPublicKey = Buffer.from(attResp.response.publicKey, "base64");
    }

    if (!credentialID || !credentialPublicKey) {
      return res.status(400).json({
        success: false,
        error: "無法獲取憑證資料",
      });
    }

    await pool.query(
      `INSERT INTO fido_credentials 
       (employee_id, credential_id, public_key, counter, device_name, transports, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        employee_id,
        credentialIdBase64,
        publicKeyBase64,
        registrationInfo.credential?.counter || 0,
        getDeviceName(attResp, req),
        JSON.stringify(attResp.response?.transports || ["hybrid"]),
      ]
    );

    await pool.query(
      "UPDATE employees SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE employee_id = $1",
      [employee_id]
    );

    challenges.delete(employee_id);

    console.log("FIDO 註冊完成，員工狀態已更新為 active");

    res.json({
      success: true,
      message: "FIDO 註冊成功，帳號已啟用",
      verified: verification.verified,
    });
  } catch (error) {
    console.error("FIDO 註冊驗證失敗:", error);
    res.status(500).json({
      success: false,
      error: `FIDO 註冊驗證失敗: ${error.message}`,
    });
  }
});

// 5. FIDO 註冊完成
router.post("/registration/complete", async (req, res) => {
  const { employee_id } = req.body;

  try {
    const employee = await pool.query(
      "SELECT * FROM employees WHERE employee_id = $1 AND status = 'pending'",
      [employee_id]
    );

    if (employee.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在或已完成註冊",
      });
    }

    await pool.query(
      "UPDATE employees SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE employee_id = $1",
      [employee_id]
    );

    res.json({
      success: true,
      message: "FIDO 註冊完成，帳號已啟用",
    });
  } catch (error) {
    console.error("完成 FIDO 註冊失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. FIDO 註冊狀態檢查
router.get("/registration/status/:employee_id", async (req, res) => {
  const { employee_id } = req.params;

  try {
    const employee = await pool.query(
      "SELECT status FROM employees WHERE employee_id = $1",
      [employee_id]
    );

    if (employee.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在",
      });
    }

    const credentials = await pool.query(
      "SELECT COUNT(*) as count FROM fido_credentials WHERE employee_id = $1",
      [employee_id]
    );

    const hasCredentials = credentials.rows[0].count > 0;
    const employeeStatus = employee.rows[0].status;

    res.json({
      success: true,
      status: employeeStatus,
      has_credentials: hasCredentials,
      can_register: employeeStatus === "pending" && !hasCredentials,
    });
  } catch (error) {
    console.error("檢查 FIDO 註冊狀態失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 7. FIDO 登入開始
router.post("/authentication/begin", async (req, res) => {
  try {
    console.log("🔐 開始 FIDO 登入認證流程");

    const credentials = await pool.query(`
      SELECT fc.credential_id, fc.transports, e.employee_id, e.name, e.email, 
             e.department_code, d.name as department_name, e.role, e.permission
      FROM fido_credentials fc
      JOIN employees e ON fc.employee_id = e.employee_id  
      LEFT JOIN departments d ON e.department_code = d.code
      WHERE e.status = 'active'
    `);

    if (credentials.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "目前沒有已註冊的有效憑證",
      });
    }

    const allowCredentials = credentials.rows.map((cred) => {
      let transports = Array.isArray(cred.transports)
        ? cred.transports
        : ["hybrid"];

      return {
        id: cred.credential_id,
        transports: transports,
      };
    });

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      timeout: 300000,
      userVerification: "required",
    });

    const sessionId = Buffer.from(`${Date.now()}-${Math.random()}`).toString(
      "base64url"
    );

    loginChallenges.set(sessionId, {
      challenge: options.challenge,
      credentials: credentials.rows,
      timestamp: Date.now(),
    });

    console.log(`✅ 生成認證選項成功，會話 ID: ${sessionId}`);
    console.log(`📱 可用憑證數量: ${credentials.rows.length}`);

    res.json({
      success: true,
      options,
      sessionId,
      method: "mobile_authenticator",
      instructions: {
        title: "使用手機完成登入驗證",
        steps: [
          "確保手機藍牙已開啟",
          "手機靠近電腦 (約1公尺內)",
          "瀏覽器會自動偵測您的手機",
          "在手機上完成生物識別驗證",
        ],
      },
    });
  } catch (error) {
    console.error("❌ FIDO 登入認證開始失敗:", error);
    res.status(500).json({
      success: false,
      error: `登入認證開始失敗: ${error.message}`,
    });
  }
});

// 8. FIDO 登入驗證
router.post("/authentication/verify", async (req, res) => {
  const { sessionId, attResp } = req.body;

  try {
    console.log(`🔍 驗證 FIDO 登入回應，會話 ID: ${sessionId}`);

    const storedData = loginChallenges.get(sessionId);
    if (!storedData) {
      return res.status(400).json({
        success: false,
        error: "找不到對應的認證會話，請重新開始登入",
      });
    }

    const credentialId = attResp.id;

    const responseCredentialIdBase64 = Buffer.from(
      credentialId,
      "base64url"
    ).toString("base64");

    const userCredential = storedData.credentials.find(
      (cred) => cred.credential_id === responseCredentialIdBase64
    );

    if (!userCredential) {
      return res.status(400).json({
        success: false,
        error: "找不到對應的使用者憑證",
      });
    }

    const dbCredentials = await pool.query(
      "SELECT * FROM fido_credentials WHERE credential_id = $1 AND employee_id = $2",
      [userCredential.credential_id, userCredential.employee_id]
    );

    if (dbCredentials.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: "憑證資料驗證失敗",
      });
    }

    const dbCredential = dbCredentials.rows[0];

    const verification = await verifyAuthenticationResponse({
      response: attResp,
      expectedChallenge: storedData.challenge,
      expectedOrigin: ALLOWED_ORIGINS,
      expectedRPID: RP_ID,
      credential: {
        id: Buffer.from(dbCredential.credential_id, "base64"),
        publicKey: Buffer.from(dbCredential.public_key, "base64"),
        counter: dbCredential.counter,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        error: "FIDO 認證驗證失敗",
      });
    }

    if (verification.authenticationInfo?.newCounter !== undefined) {
      await pool.query(
        "UPDATE fido_credentials SET counter = $1, last_used_at = CURRENT_TIMESTAMP WHERE credential_id = $2",
        [verification.authenticationInfo.newCounter, dbCredential.credential_id]
      );
    }

    loginChallenges.delete(sessionId);

    const userInfo = {
      employee_id: userCredential.employee_id,
      name: userCredential.name,
      email: userCredential.email,
      department_code: userCredential.department_code,
      department_name: userCredential.department_name,
      role: userCredential.role,
      permission: userCredential.permission,
      role_display:
        userCredential.role === "D"
          ? "醫師"
          : userCredential.role === "A"
          ? "助理醫師"
          : "護理師",
      permission_display:
        userCredential.permission === "1" ? "可修改排程" : "僅限查看",
    };

    console.log(`✅ FIDO 登入成功: ${userInfo.name} (${userInfo.employee_id})`);

    // 1. 設定 Session 資料
    req.session.user = userInfo;
    req.session.loginTime = new Date().toISOString();
    req.session.loginMethod = "fido";

    // 2. 儲存 Session 並更新資料庫關聯
    await new Promise((resolve, reject) => {
      req.session.save(async (err) => {
        if (err) {
          console.error("Session 儲存失敗:", err);
          return reject(err);
        }

        // (選擇性)更新 sessions 資料表的 employee_id，方便管理員查詢
        try {
          await pool.query(
            "UPDATE sessions SET employee_id = $1 WHERE sid = $2",
            [userInfo.employee_id, req.sessionID]
          );
        } catch (dbError) {
          console.error("更新 Session employee_id 失敗:", dbError);
          // 不阻擋登入流程
        }

        resolve();
      });
    });

    res.json({
      success: true,
      message: "登入成功",
      verified: verification.verified,
      user: userInfo,
      loginTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ FIDO 登入驗證失敗:", error);
    res.status(500).json({
      success: false,
      error: `登入驗證失敗: ${error.message}`,
    });
  }
});

export default router;
