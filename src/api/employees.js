import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const router = express.Router();

// 使用傳入的 pool
let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

// 1. 取得員工列表
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, d.name as department_name 
      FROM employees e 
      LEFT JOIN departments d ON e.department_code = d.code 
      ORDER BY e.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("取得員工列表失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1-1. 根據科別和職位查詢員工
router.get("/by-department-role", async (req, res) => {
  const { department_code, role } = req.query;

  try {
    // 驗證必要參數
    if (!department_code || !role) {
      return res.status(400).json({
        success: false,
        error: "請提供 department_code 和 role 參數",
      });
    }

    const result = await pool.query(
      `SELECT 
        e.id,
        e.employee_id,
        e.name,
        e.email,
        e.role,
        e.status,
        d.name as department_name
      FROM employees e 
      LEFT JOIN departments d ON e.department_code = d.code 
      WHERE e.department_code = $1 
        AND e.role = $2 
        AND e.status = 'active'
      ORDER BY e.name ASC`,
      [department_code, role]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("查詢員工失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. 生成員工編號預覽
router.post("/generate-id", async (req, res) => {
  const { department_code, role, permission } = req.body;

  try {
    const { generateEmployeeId } = await import("./utils.js");
    const employeeId = await generateEmployeeId(
      pool,
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
router.post("/", async (req, res) => {
  const { name, email, department_code, role, permission } = req.body;

  try {
    // 驗證必要欄位
    if (!name || !email || !department_code || !role || !permission) {
      return res.status(400).json({
        success: false,
        error: "請填寫所有必要欄位",
      });
    }

    // 檢查 email 是否已存在 (開發測試移除)
    // const existingEmail = await pool.query(
    //   "SELECT id FROM employees WHERE email = $1",
    //   [email]
    // );

    // if (existingEmail.rows.length > 0) {
    //   return res.status(400).json({
    //     success: false,
    //     error: "此電子信箱已被使用",
    //   });
    // }

    // 檢查科別是否存在
    const deptCheck = await pool.query(
      "SELECT code FROM departments WHERE code = $1",
      [department_code]
    );

    if (deptCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: "科別代碼不存在",
      });
    }

    // 生成員工編號
    const { generateEmployeeId, updateDepartmentCount } = await import(
      "./utils.js"
    );
    const employeeId = await generateEmployeeId(
      pool,
      department_code,
      role,
      permission
    );

    // 插入員工資料
    const result = await pool.query(
      `INSERT INTO employees (employee_id, name, email, department_code, role, permission, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id`,
      [employeeId, name, email, department_code, role, permission]
    );

    const insertId = result.rows[0].id;

    // 更新部門計數器
    await updateDepartmentCount(pool, department_code, role);

    // 立即發送註冊邀請信件
    const employeeData = {
      id: insertId,
      employee_id: employeeId,
      name,
      email,
      role,
      permission,
    };

    try {
      // 生成註冊 token
      const token = Buffer.from(
        `${employeeId}:${Date.now() + 24 * 60 * 60 * 1000}`
      ).toString("base64");

      // 建立註冊連結
      const registrationUrl = `${process.env.FRONTEND_URL}/register/${token}`;

      // 發送信件
      const { sendRegistrationEmail } = await import("./emailService.js");
      await sendRegistrationEmail(email, name, employeeData, registrationUrl);

      res.json({
        success: true,
        data: {
          id: insertId,
          employee_id: employeeId,
          name: name,
          email: email,
          message: "員工新增成功且邀請信件已發送",
        },
      });
    } catch (emailError) {
      console.error("發送邀請信件失敗:", emailError);

      res.json({
        success: true,
        data: {
          id: insertId,
          employee_id: employeeId,
          name: name,
          email: email,
          message: "員工新增成功，但邀請信件發送失敗",
          emailError: emailError.message,
        },
      });
    }
  } catch (error) {
    console.error("新增員工失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. 修改員工
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email, status } = req.body;

  try {
    // 檢查員工是否存在
    const existing = await pool.query("SELECT * FROM employees WHERE id = $1", [
      id,
    ]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在",
      });
    }

    // 檢查 email 是否被其他人使用
    if (email) {
      const emailCheck = await pool.query(
        "SELECT id FROM employees WHERE email = $1 AND id != $2",
        [email, id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: "此電子信箱已被其他員工使用",
        });
      }
    }

    // 動態更新欄位
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (name) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(name);
    }
    if (email) {
      updateFields.push(`email = $${paramIndex++}`);
      updateValues.push(email);
    }
    if (status) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }

    updateValues.push(id);

    // 更新員工資料
    await pool.query(
      `UPDATE employees 
       SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}`,
      updateValues
    );

    res.json({
      success: true,
      message: "員工資料更新成功",
    });
  } catch (error) {
    console.error("更新員工資料失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. 刪除員工
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 檢查員工是否存在
    const existing = await pool.query("SELECT * FROM employees WHERE id = $1", [
      id,
    ]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在",
      });
    }

    const employee = existing.rows[0];

    // 刪除員工
    await pool.query("DELETE FROM employees WHERE id = $1", [id]);

    // 更新部門計數器
    const { updateDepartmentCount } = await import("./utils.js");
    const countField = employee.role === "D" ? "doctor_count" : "nurse_count";
    await pool.query(
      `UPDATE departments 
       SET ${countField} = GREATEST(0, ${countField} - 1) 
       WHERE code = $1`,
      [employee.department_code]
    );

    res.json({
      success: true,
      message: "員工刪除成功",
    });
  } catch (error) {
    console.error("刪除員工失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. 重新發送註冊邀請
router.post("/:id/resend-invitation", async (req, res) => {
  const { id } = req.params;

  try {
    // 查詢員工資料
    const result = await pool.query(
      "SELECT * FROM employees WHERE id = $1 AND status = 'pending'",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "員工不存在或已完成註冊",
      });
    }

    const employee = result.rows[0];

    // 生成新的註冊 token
    const token = Buffer.from(
      `${employee.employee_id}:${Date.now() + 24 * 60 * 60 * 1000}`
    ).toString("base64");

    // 建立註冊連結
    const registrationUrl = `${process.env.FRONTEND_URL}/register/${token}`;

    // 發送信件
    const { sendRegistrationEmail } = await import("./emailService.js");
    await sendRegistrationEmail(
      employee.email,
      employee.name,
      {
        id: employee.id,
        employee_id: employee.employee_id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        permission: employee.permission,
      },
      registrationUrl
    );

    res.json({
      success: true,
      message: "邀請信件已重新發送",
    });
  } catch (error) {
    console.error("重新發送邀請信件失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
