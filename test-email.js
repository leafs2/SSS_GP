// test-email.js - 獨立測試腳本
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function testEmailConnection() {
  console.log("🔧 開始測試 SMTP 連線...\n");

  // 1. 檢查環境變數
  console.log("📋 環境變數檢查:");
  console.log("SMTP_HOST:", process.env.SMTP_HOST || "❌ 未設定");
  console.log("SMTP_PORT:", process.env.SMTP_PORT || "❌ 未設定");
  console.log("SMTP_USER:", process.env.SMTP_USER || "❌ 未設定");
  console.log(
    "SMTP_PASSWORD:",
    process.env.SMTP_PASSWORD ? "✅ 已設定" : "❌ 未設定"
  );
  console.log("FRONTEND_URL:", process.env.FRONTEND_URL || "❌ 未設定");
  console.log("");

  // 2. 建立測試用傳輸器
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    debug: true, // 開啟除錯模式
  });

  try {
    // 3. 驗證 SMTP 連線
    console.log("🔗 測試 SMTP 連線...");
    await transporter.verify();
    console.log("✅ SMTP 連線成功！\n");

    // 4. 發送測試郵件
    console.log("📧 發送測試郵件...");
    const testEmail = {
      from: `"醫院資訊室測試" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // 發送給自己測試
      subject: "【測試】手術排程系統郵件功能測試",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">📧 郵件功能測試成功！</h2>
          <p>如果您收到這封郵件，代表手術排程系統的郵件發送功能已正常運作。</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>測試資訊：</h3>
            <p><strong>測試時間：</strong>${new Date().toLocaleString(
              "zh-TW"
            )}</p>
            <p><strong>SMTP 主機：</strong>${process.env.SMTP_HOST}</p>
            <p><strong>發送帳號：</strong>${process.env.SMTP_USER}</p>
          </div>
          
          <p style="color: #059669; font-weight: bold;">✅ 系統準備就緒，可以開始發送註冊郵件！</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(testEmail);
    console.log("✅ 測試郵件發送成功！");
    console.log("📬 Message ID:", info.messageId);
    console.log("📧 請檢查信箱:", process.env.SMTP_USER);
  } catch (error) {
    console.error("❌ 測試失敗:", error.message);

    // 常見錯誤診斷
    if (error.code === "EAUTH") {
      console.log("\n🔧 可能的解決方案:");
      console.log("1. 檢查帳號密碼是否正確");
      console.log("2. Gmail 需要使用「應用程式密碼」而非一般密碼");
      console.log("3. 確認已開啟兩步驟驗證");
    }

    if (error.code === "ECONNECTION") {
      console.log("\n🔧 可能的解決方案:");
      console.log("1. 檢查網路連線");
      console.log("2. 確認 SMTP 主機和埠號設定正確");
      console.log("3. 檢查防火牆設定");
    }
  }
}

// 執行測試
testEmailConnection();
