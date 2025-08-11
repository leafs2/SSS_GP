import mysql from "mysql2/promise";

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "", // 沒有密碼
      database: "sss",
    });

    console.log("資料庫連接成功！");

    // 測試查詢
    const [rows] = await connection.execute("SELECT 1 as test");
    console.log("測試查詢結果:", rows);

    await connection.end();
  } catch (error) {
    console.error("連接失敗:", error.message);
  }
}

testConnection();
