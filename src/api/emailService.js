import nodemailer from "nodemailer";

// 發送註冊邀請信件
export async function sendRegistrationEmail(
  email,
  name,
  employeeData,
  registrationUrl
) {
  console.log("🚀 開始發送郵件流程...");
  console.log("📧 收件者:", email);
  console.log("👤 收件人:", name);
  console.log("🔗 註冊連結:", registrationUrl);

  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error(
      "SMTP 認證資訊缺失：請檢查 SMTP_USER 和 SMTP_PASSWORD 環境變數"
    );
  }

  try {
    console.log("🔧 建立 SMTP 傳輸器...");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      debug: true,
      logger: true,
    });

    console.log("🔗 測試 SMTP 連線...");
    await transporter.verify();
    console.log("✅ SMTP 連線驗證成功");

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
               ${name} ${
        employeeData.role === "D"
          ? "醫師"
          : employeeData.role === "A"
          ? "助理醫師"
          : "護理師"
      }，您好：
            </div>
            
            <p style="color: #374151; margin-bottom: 25px;">
              請於收到此信件後，儘速完成帳號啟用程序。
            </p>
            
            <div class="info-box">
              <div class="info-title">您的帳號資訊</div>
              <div class="info-row">
                <span class="info-label">員工編號</span>
                <span class="info-value">${employeeData.employee_id}</span>
              </div>
              <div class="info-row">
                <span class="info-label">登記信箱</span>
                <span class="info-value">${email}</span>
              </div>
              <div class="info-row">
                <span class="info-label">職別</span>
                <span class="info-value">${
                  employeeData.role === "D"
                    ? "醫師"
                    : employeeData.role === "A"
                    ? "助理醫師"
                    : "護理人員"
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

    console.log("📤 開始發送郵件...");
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ 郵件發送成功:", info.messageId);
    console.log("📬 接受的收件者:", info.accepted);
    console.log("❌ 拒絕的收件者:", info.rejected);

    return info;
  } catch (error) {
    console.error("❌ 郵件發送過程中發生錯誤:");
    console.error("錯誤類型:", error.name);
    console.error("錯誤訊息:", error.message);
    console.error("錯誤代碼:", error.code);
    console.error("完整錯誤:", error);
    throw error;
  }
}
