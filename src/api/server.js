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
