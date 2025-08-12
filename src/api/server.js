import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./db.js";

// 載入環境變數
dotenv.config();

const app = express();

// 中介軟體
app.use(cors());
app.use(express.json());

// API 路由

// 1. 取得員工列表
app.get("/api/employees", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT e.*, d.name as department_name 
      FROM employees e 
      LEFT JOIN departments d ON e.department_code = d.code 
      ORDER BY e.created_at DESC
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("取得員工列表失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. 生成員工編號預覽
app.post("/api/generate-employee-id", async (req, res) => {
  const { department_code, role, permission } = req.body;

  try {
    const employeeId = await generateEmployeeId(
      department_code,
      role,
      permission
    );

    res.json({
      success: true,
      employee_id: employeeId,
    });
  } catch (error) {
    console.error("生成員工編號失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. 新增員工
app.post("/api/employees", async (req, res) => {
  const { name, email, department_code, role, permission } = req.body;

  try {
    // 驗證必要欄位
    if (!name || !email || !department_code || !role || !permission) {
      return res.status(400).json({
        success: false,
        error: "請填寫所有必要欄位",
      });
    }

    // 檢查 email 是否已存在
    const [existingEmail] = await db.execute(
      "SELECT id FROM employees WHERE email = ?",
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(400).json({
        success: false,
        error: "此電子信箱已被使用",
      });
    }

    // 檢查科別是否存在
    const [deptCheck] = await db.execute(
      "SELECT code FROM departments WHERE code = ?",
      [department_code]
    );

    if (deptCheck.length === 0) {
      return res.status(400).json({
        success: false,
        error: "科別代碼不存在",
      });
    }

    // 生成員工編號
    const employeeId = await generateEmployeeId(
      department_code,
      role,
      permission
    );

    // 插入員工資料
    const [result] = await db.execute(
      `
      INSERT INTO employees (employee_id, name, email, department_code, role, permission, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `,
      [employeeId, name, email, department_code, role, permission]
    );

    // 更新部門計數器
    await updateDepartmentCount(department_code, role);

    res.json({
      success: true,
      data: {
        id: result.insertId,
        employee_id: employeeId,
        name: name,
        email: email,
        message: "員工新增成功",
      },
    });
  } catch (error) {
    console.error("新增員工失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. 修改員工
app.put("/api/employees/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email, status } = req.body;

  try {
    // 檢查員工是否存在
    const [existing] = await db.execute(
      "SELECT * FROM employees WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在",
      });
    }

    // 檢查 email 是否被其他人使用
    if (email) {
      const [emailCheck] = await db.execute(
        "SELECT id FROM employees WHERE email = ? AND id != ?",
        [email, id]
      );

      if (emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          error: "此電子信箱已被其他員工使用",
        });
      }
    }

    // 動態更新欄位
    const updateFields = [];
    const updateValues = [];

    if (name) {
      updateFields.push("name = ?");
      updateValues.push(name);
    }
    if (email) {
      updateFields.push("email = ?");
      updateValues.push(email);
    }
    if (status) {
      updateFields.push("status = ?");
      updateValues.push(status);
    }

    updateValues.push(id); // WHERE 條件的 id

    // 更新員工資料
    await db.execute(
      `
      UPDATE employees 
      SET ${updateFields.join(", ")}
      WHERE id = ?
    `,
      updateValues
    );

    res.json({
      success: true,
      message: "員工資料更新成功",
    });
  } catch (error) {
    console.error("修改員工失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. 刪除員工
app.delete("/api/employees/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 檢查員工是否存在
    const [existing] = await db.execute(
      "SELECT * FROM employees WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在",
      });
    }

    // 刪除相關的 FIDO 憑證
    await db.execute("DELETE FROM fido_credentials WHERE employee_id = ?", [
      existing[0].employee_id,
    ]);

    // 刪除員工
    await db.execute("DELETE FROM employees WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "員工刪除成功",
    });
  } catch (error) {
    console.error("刪除員工失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. 取得部門列表
app.get("/api/departments", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM departments ORDER BY code");
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("取得部門列表失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. 發送註冊信件
app.post("/api/send-registration-email/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 檢查員工是否存在且狀態為 pending
    const [employee] = await db.execute(
      "SELECT * FROM employees WHERE id = ? AND status = 'pending'",
      [id]
    );

    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在或已註冊",
      });
    }

    const employeeData = employee[0];

    // 生成註冊 token (使用員工編號 + 過期時間)
    const token = Buffer.from(
      `${employeeData.employee_id}:${Date.now() + 24 * 60 * 60 * 1000}`
    ).toString("base64");

    // 建立註冊連結
    const registrationUrl = `${process.env.FRONTEND_URL}/register/${token}`;

    // 發送信件
    await sendRegistrationEmail(
      employeeData.email,
      employeeData.name,
      employeeData.employee_id,
      registrationUrl
    );

    // 更新員工狀態為 email_sent
    await db.execute(
      "UPDATE employees SET status = 'email_sent', updated_at = NOW() WHERE id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "註冊信件已發送",
      email: employeeData.email,
    });
  } catch (error) {
    console.error("發送註冊信件失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. 驗證註冊 token (員工點擊連結後)
app.get("/api/verify-registration-token/:token", async (req, res) => {
  const { token } = req.params;

  try {
    // 解碼 token
    const decoded = Buffer.from(token, "base64").toString();
    const [employeeId, expireTime] = decoded.split(":");

    // 檢查 token 是否過期 (24小時)
    if (Date.now() > parseInt(expireTime)) {
      return res.status(400).json({
        success: false,
        message: "註冊連結已過期，請聯繫管理員重新發送",
      });
    }

    // 查詢員工資料
    const [employee] = await db.execute(
      `
      SELECT e.*, d.name as department_name 
      FROM employees e 
      LEFT JOIN departments d ON e.department_code = d.code 
      WHERE e.employee_id = ? AND e.status IN ('pending', 'email_sent')
    `,
      [employeeId]
    );

    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        message: "員工不存在或已完成註冊",
      });
    }

    // 檢查是否已有 FIDO 憑證
    const [existingCred] = await db.execute(
      "SELECT id FROM fido_credentials WHERE employee_id = ?",
      [employeeId]
    );

    if (existingCred.length > 0) {
      return res.status(400).json({
        success: false,
        message: "此員工已完成註冊",
      });
    }

    res.json({
      success: true,
      employee: employee[0],
    });
  } catch (error) {
    console.error("驗證註冊 token 失敗:", error);
    res.status(400).json({
      success: false,
      message: "無效的註冊連結",
    });
  }
});

// 9. 批量發送註冊信件
app.post("/api/send-bulk-registration-emails", async (req, res) => {
  const { employee_ids } = req.body; // 陣列形式的員工 ID

  if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: "請提供有效的員工 ID 列表",
    });
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const id of employee_ids) {
    try {
      // 檢查員工是否存在且狀態為 pending
      const [employee] = await db.execute(
        "SELECT * FROM employees WHERE id = ? AND status = 'pending'",
        [id]
      );

      if (employee.length === 0) {
        results.push({
          id,
          success: false,
          message: "員工不存在或已註冊",
        });
        failCount++;
        continue;
      }

      const employeeData = employee[0];

      // 生成註冊 token
      const token = Buffer.from(
        `${employeeData.employee_id}:${Date.now() + 24 * 60 * 60 * 1000}`
      ).toString("base64");
      const registrationUrl = `${process.env.FRONTEND_URL}/register/${token}`;

      // 發送信件
      await sendRegistrationEmail(
        employeeData.email,
        employeeData.name,
        employeeData.employee_id,
        registrationUrl
      );

      // 更新狀態
      await db.execute(
        "UPDATE employees SET status = 'email_sent', updated_at = NOW() WHERE id = ?",
        [id]
      );

      results.push({
        id,
        success: true,
        email: employeeData.email,
        employee_id: employeeData.employee_id,
      });
      successCount++;
    } catch (error) {
      console.error(`發送給員工 ${id} 的信件失敗:`, error);
      results.push({
        id,
        success: false,
        message: error.message,
      });
      failCount++;
    }
  }

  res.json({
    success: true,
    summary: {
      total: employee_ids.length,
      success: successCount,
      failed: failCount,
    },
    results,
  });
});

// 郵件發送函數
async function sendRegistrationEmail(email, name, employeeId, registrationUrl) {
  // 建立郵件傳輸器
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // 郵件內容
  const mailOptions = {
    from: `"醫院資訊室" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "【重要通知】手術排程系統帳號啟用",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          .container { max-width: 650px; margin: 0 auto; font-family: 'Microsoft JhengHei', Arial, sans-serif; line-height: 1.6; }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 25px; text-align: center; }
          .logo { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
          .subtitle { font-size: 14px; opacity: 0.9; }
          .content { padding: 35px; background: #ffffff; }
          .greeting { color: #1f2937; font-size: 16px; margin-bottom: 20px; }
          .button { display: inline-block; background: linear-gradient(135deg, #059669, #047857); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 25px 0; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .info-box { background: #f8fafc; padding: 24px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #2563eb; }
          .info-title { color: #1e40af; font-weight: bold; font-size: 16px; margin-bottom: 15px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .info-label { color: #6b7280; font-weight: 500; }
          .info-value { color: #1f2937; font-weight: bold; }
          .notice-box { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0; }
          .notice-title { color: #92400e; font-weight: bold; margin-bottom: 12px; }
          .notice-list { color: #92400e; margin: 0; padding-left: 20px; }
          .url-box { background: #f3f4f6; padding: 15px; border-radius: 6px; word-break: break-all; font-family: monospace; color: #374151; margin: 15px 0; }
          .footer { background: #f9fafb; padding: 25px; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
          .footer-logo { font-weight: bold; color: #374151; margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">醫院手術排程系統</div>
            <div class="subtitle">Surgery Scheduling System</div>
          </div>
          
          <div class="content">
            <div class="greeting">
               ${name} ${employeeData.role === "D" ? "醫師" : "護理師"}，您好：
            </div>
            
            <p style="color: #374151; margin-bottom: 25px;">
              請於收到此信件後，儘速完成帳號啟用程序。
            </p>
            
            <div class="info-box">
              <div class="info-title">📋 您的帳號資訊</div>
              <div class="info-row">
                <span class="info-label">員工編號</span>
                <span class="info-value">${employeeId}</span>
              </div>
              <div class="info-row">
                <span class="info-label">登記信箱</span>
                <span class="info-value">${email}</span>
              </div>
              <div class="info-row">
                <span class="info-label">職別</span>
                <span class="info-value">${
                  employeeData.role === "D" ? "醫師" : "護理人員"
                }</span>
              </div>
              <div class="info-row">
                <span class="info-label">權限等級</span>
                <span class="info-value">${
                  employeeData.permission === "1"
                    ? "可修改手術排程"
                    : "僅限查看排程內容"
                }</span>
              </div>
            </div>
            
            <p style="color: #374151; margin: 25px 0;">
              <strong>系統採用生物識別技術登入</strong><br>
              為確保醫療資訊安全，本系統採用 FIDO 生物識別技術，支援指紋辨識、臉部辨識或硬體安全金鑰等方式。
              請點選下方按鈕開始設定您的安全登入方式。
            </p>
            
            <div style="text-align: center;">
              <a href="${registrationUrl}" class="button">立即啟用帳號</a>
            </div>
            
            <div class="notice-box">
              <div class="notice-title"><重要注意事項></div>
              <ul class="notice-list">
                <li>此啟用連結有效期限為 <strong>24 小時</strong>，請儘速完成設定</li>
                <li>帳號啟用需要支援生物識別功能的裝置（智慧型手機、平板或筆電）</li>
                <li>完成設定後，您可使用生物識別方式快速且安全地登入系統</li>
                <li>如遇技術問題，請聯繫資訊室分機 <strong>2580</strong></li>
              </ul>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              若上方按鈕無法正常使用，請複製下列網址至瀏覽器網址列：
            </p>
            <div class="url-box">${registrationUrl}</div>
          </div>
          
          <div class="footer">
            <div class="footer-logo">醫院資訊室</div>
            <p>本郵件由系統自動發送，請勿直接回覆<br></p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  // 發送郵件
  const info = await transporter.sendMail(mailOptions);
  console.log("郵件發送成功:", info.messageId);

  return info;
}

// 輔助函數：生成員工編號
async function generateEmployeeId(departmentCode, role, permission) {
  try {
    // 查詢該部門該角色的最新編號
    const [rows] = await db.execute(
      `
      SELECT employee_id 
      FROM employees 
      WHERE department_code = ? AND role = ? AND permission = ?
      ORDER BY employee_id DESC 
      LIMIT 1
    `,
      [departmentCode, role, permission]
    );

    let nextNumber = 1;

    if (rows.length > 0) {
      // 從最後一個編號提取數字部分
      const lastId = rows[0].employee_id;
      const numberPart = lastId.slice(-3); // 取最後3位數字
      nextNumber = parseInt(numberPart) + 1;
    }

    // 格式：角色+科別+權限+3位流水號
    const newId = `${role}${departmentCode}${permission}${nextNumber
      .toString()
      .padStart(3, "0")}`;

    return newId;
  } catch (error) {
    console.error("生成員工編號時發生錯誤:", error);
    throw error;
  }
}

// 輔助函數：更新部門計數器
async function updateDepartmentCount(departmentCode, role) {
  try {
    const countField = role === "D" ? "doctor_count" : "nurse_count";

    await db.execute(
      `
      UPDATE departments 
      SET ${countField} = ${countField} + 1 
      WHERE code = ?
    `,
      [departmentCode]
    );
  } catch (error) {
    console.error("更新部門計數器時發生錯誤:", error);
    // 這個錯誤不影響主要功能，所以只記錄不拋出
  }
}

// 健康檢查端點
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API 服務運行正常",
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
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API 端點不存在",
  });
});

// 啟動服務器
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API 伺服器運行在 http://localhost:${PORT}`);
  console.log(`健康檢查: http://localhost:${PORT}/api/health`);
});
