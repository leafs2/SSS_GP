import express from "express";

const router = express.Router();

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

// 1. 取得部門列表
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM departments ORDER BY code");
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("取得部門列表失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. 新增部門
router.post("/", async (req, res) => {
  const { code, name } = req.body;

  try {
    if (!code || !name) {
      return res.status(400).json({
        success: false,
        error: "請填寫科別代碼和名稱",
      });
    }

    // 檢查代碼是否已存在
    const existing = await pool.query(
      "SELECT code FROM departments WHERE code = $1",
      [code]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "此科別代碼已存在",
      });
    }

    await pool.query("INSERT INTO departments (code, name) VALUES ($1, $2)", [
      code,
      name,
    ]);

    res.json({
      success: true,
      message: "科別新增成功",
    });
  } catch (error) {
    console.error("新增科別失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. 修改部門
router.put("/:code", async (req, res) => {
  const { code } = req.params;
  const { name } = req.body;

  try {
    if (!name) {
      return res.status(400).json({
        success: false,
        error: "請提供科別名稱",
      });
    }

    const existing = await pool.query(
      "SELECT code FROM departments WHERE code = $1",
      [code]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "科別不存在",
      });
    }

    await pool.query("UPDATE departments SET name = $1 WHERE code = $2", [
      name,
      code,
    ]);

    res.json({
      success: true,
      message: "科別更新成功",
    });
  } catch (error) {
    console.error("更新科別失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. 刪除部門
router.delete("/:code", async (req, res) => {
  const { code } = req.params;

  try {
    // 檢查是否有員工屬於此科別
    const employees = await pool.query(
      "SELECT COUNT(*) as count FROM employees WHERE department_code = $1",
      [code]
    );

    if (employees.rows[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: "此科別尚有員工，無法刪除",
      });
    }

    await pool.query("DELETE FROM departments WHERE code = $1", [code]);

    res.json({
      success: true,
      message: "科別刪除成功",
    });
  } catch (error) {
    console.error("刪除科別失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
