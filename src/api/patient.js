import express from "express";

const router = express.Router();

let pool;
export const setPool = (dbPool) => {
  pool = dbPool;
};

/**
 * 自動生成病歷號（patient_id）
 * 格式：性別(1或2) + 流水號(6位數)
 * 例如：1000001（男性第1位）、2000001（女性第1位）
 */
const generatePatientId = async (gender, client = pool) => {
  try {
    // 查詢該性別目前的病患數量
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM patient 
      WHERE patient_id::text LIKE $1
    `;
    // 使用 LIKE 查詢以該性別開頭的病歷號
    const genderPrefix = `${gender}%`;
    const result = await client.query(countQuery, [genderPrefix]);
    const count = parseInt(result.rows[0].count);

    // 生成新的流水號（當前數量 + 1）
    const sequenceNumber = (count + 1).toString().padStart(6, "0");

    // 組合病歷號：性別 + 流水號
    const patientId = parseInt(`${gender}${sequenceNumber}`);

    return patientId;
  } catch (error) {
    console.error("生成病歷號失敗:", error);
    throw error;
  }
};

/**
 * GET /api/patients/options/all
 * 取得所有選項（性別、血型、藥物過敏、病史、生活習慣）
 * 注意：必須放在 /:id 之前，否則會被誤判為 id = "options"
 */
router.get("/options/all", async (req, res) => {
  try {
    // 性別選項
    const genderResult = await pool.query(
      "SELECT * FROM patient_gender ORDER BY id"
    );

    // 血型選項
    const bloodTypeResult = await pool.query(
      "SELECT * FROM patient_blood_type ORDER BY id"
    );

    // 藥物過敏選項
    const allergyResult = await pool.query(
      "SELECT * FROM patient_drug_allergy_option ORDER BY id"
    );

    // 病史選項
    const historyResult = await pool.query(
      "SELECT * FROM patient_history_option ORDER BY id"
    );

    // 生活習慣選項
    const lifestyleResult = await pool.query(
      "SELECT * FROM patient_lifestyle_option ORDER BY id"
    );

    res.json({
      success: true,
      data: {
        genders: genderResult.rows,
        bloodTypes: bloodTypeResult.rows,
        allergies: allergyResult.rows,
        histories: historyResult.rows,
        lifestyles: lifestyleResult.rows,
      },
    });
  } catch (error) {
    console.error("取得選項失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/patients/preview
 * 預覽病患資料（生成病歷號但不儲存）
 */
router.post("/preview", async (req, res) => {
  try {
    const { gender, name, idNumber, birthDate, bloodType } = req.body;

    // 驗證必填欄位
    if (!gender || !name || !idNumber || !birthDate || !bloodType) {
      return res.status(400).json({
        success: false,
        error: "請填寫所有必填欄位",
      });
    }

    // 檢查身分證是否重複
    const checkIdQuery = "SELECT patient_id FROM patient WHERE id_number = $1";
    const checkResult = await pool.query(checkIdQuery, [idNumber]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "該身分證號碼已存在",
      });
    }

    // 🔥 生成病歷號（patient_id）
    const patientId = await generatePatientId(gender);

    // 計算年齡
    const birthDateObj = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDateObj.getDate())
    ) {
      age--;
    }

    // 取得性別和血型名稱
    const genderQuery = "SELECT gender FROM patient_gender WHERE id = $1";
    const bloodTypeQuery =
      "SELECT blood_type FROM patient_blood_type WHERE id = $1";

    const genderResult = await pool.query(genderQuery, [gender]);
    const bloodTypeResult = await pool.query(bloodTypeQuery, [bloodType]);

    res.json({
      success: true,
      data: {
        patientId: patientId.toString(), // 病歷號
        name,
        gender: genderResult.rows[0]?.gender || "",
        bloodType: bloodTypeResult.rows[0]?.blood_type || "",
        birthDate,
        age,
        idNumber,
      },
    });
  } catch (error) {
    console.error("預覽病患資料失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/patients
 * 取得所有病患列表（含搜尋、篩選、分頁）
 */
router.get("/", async (req, res) => {
  try {
    const {
      search = "",
      gender = "",
      bloodType = "",
      page = 1,
      limit = 20,
    } = req.query;

    // 建立查詢條件
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // 搜尋條件（姓名、身分證、病歷號）
    if (search) {
      whereConditions.push(
        `(p.name ILIKE $${paramIndex} OR p.id_number ILIKE $${paramIndex} OR p.patient_id::text ILIKE $${paramIndex})`
      );
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // 性別篩選
    if (gender) {
      whereConditions.push(`p.gender = $${paramIndex}`);
      queryParams.push(gender);
      paramIndex++;
    }

    // 血型篩選
    if (bloodType) {
      whereConditions.push(`p.blood_type = $${paramIndex}`);
      queryParams.push(bloodType);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0
        ? "WHERE " + whereConditions.join(" AND ")
        : "";

    // 計算總數
    const countQuery = `
      SELECT COUNT(*) as total
      FROM patient p
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // 分頁查詢
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT 
        p.patient_id,
        p.name,
        pg.gender as gender_name,
        p.gender as gender_id,
        pbt.blood_type as blood_type_name,
        p.blood_type as blood_type_id,
        p.birth_date,
        p.id_number,
        p.created_at,
        EXTRACT(YEAR FROM AGE(p.birth_date)) as age
      FROM patient p
      LEFT JOIN patient_gender pg ON p.gender = pg.id
      LEFT JOIN patient_blood_type pbt ON p.blood_type = pbt.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);
    const dataResult = await pool.query(dataQuery, queryParams);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("取得病患列表失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/patients
 * 新增病患
 */
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      name,
      gender,
      bloodType,
      birthDate,
      idNumber,
      allergies = [],
      personalHistory = [],
      familyHistory = [],
      lifestyle = [],
    } = req.body;

    // 驗證必填欄位
    if (!name || !gender || !bloodType || !birthDate || !idNumber) {
      return res.status(400).json({
        success: false,
        error: "請填寫所有必填欄位",
      });
    }

    // 檢查身分證是否重複
    const checkIdQuery = "SELECT patient_id FROM patient WHERE id_number = $1";
    const checkResult = await client.query(checkIdQuery, [idNumber]);

    if (checkResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: "該身分證號碼已存在",
      });
    }

    // 🔥 生成病歷號（patient_id）
    const patientId = await generatePatientId(gender, client);

    // 新增病患基本資料
    const insertPatientQuery = `
      INSERT INTO patient (patient_id, name, gender, blood_type, birth_date, id_number)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING patient_id
    `;
    const patientResult = await client.query(insertPatientQuery, [
      patientId, // 使用生成的病歷號作為 patient_id
      name,
      gender,
      bloodType,
      birthDate,
      idNumber,
    ]);

    const insertedPatientId = patientResult.rows[0].patient_id;

    // 新增藥物過敏
    if (allergies.length > 0) {
      const allergyValues = allergies
        .map((allergyId) => `(${insertedPatientId}, ${allergyId})`)
        .join(",");
      await client.query(`
        INSERT INTO patient_drug_allergy (patient_id, allergy_id)
        VALUES ${allergyValues}
      `);
    }

    // 新增個人病史
    if (personalHistory.length > 0) {
      const historyValues = personalHistory
        .map((historyId) => `(${insertedPatientId}, ${historyId})`)
        .join(",");
      await client.query(`
        INSERT INTO patient_history_personal (patient_id, history_id)
        VALUES ${historyValues}
      `);
    }

    // 新增家族病史
    if (familyHistory.length > 0) {
      const familyValues = familyHistory
        .map(
          (item) =>
            `(${insertedPatientId}, ${item.historyId}, '${item.kinship}')`
        )
        .join(",");
      await client.query(`
        INSERT INTO patient_history_family (patient_id, history_id, kinship)
        VALUES ${familyValues}
      `);
    }

    // 新增生活習慣
    if (lifestyle.length > 0) {
      const lifestyleValues = lifestyle
        .map((lifestyleId) => `(${insertedPatientId}, ${lifestyleId})`)
        .join(",");
      await client.query(`
        INSERT INTO patient_lifestyle (patient_id, lifestyle_id)
        VALUES ${lifestyleValues}
      `);
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "病患資料新增成功",
      data: {
        patient_id: insertedPatientId.toString(), // 回傳病歷號
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("新增病患失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/patients/:id
 * 取得單一病患詳細資料
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 基本資料
    const patientQuery = `
      SELECT 
        p.*,
        pg.gender as gender_name,
        pbt.blood_type as blood_type_name
      FROM patient p
      LEFT JOIN patient_gender pg ON p.gender = pg.id
      LEFT JOIN patient_blood_type pbt ON p.blood_type = pbt.id
      WHERE p.patient_id = $1
    `;
    const patientResult = await pool.query(patientQuery, [id]);

    if (patientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "找不到該病患",
      });
    }

    const patient = patientResult.rows[0];

    // 藥物過敏
    const allergyQuery = `
      SELECT pda.allergy_id, pdao.drug_allergy
      FROM patient_drug_allergy pda
      JOIN patient_drug_allergy_option pdao ON pda.allergy_id = pdao.id
      WHERE pda.patient_id = $1
    `;
    const allergyResult = await pool.query(allergyQuery, [id]);

    // 個人病史
    const personalHistoryQuery = `
      SELECT php.history_id, pho.history_option
      FROM patient_history_personal php
      JOIN patient_history_option pho ON php.history_id = pho.id
      WHERE php.patient_id = $1
    `;
    const personalHistoryResult = await pool.query(personalHistoryQuery, [id]);

    // 家族病史
    const familyHistoryQuery = `
      SELECT phf.history_id, pho.history_option, phf.kinship
      FROM patient_history_family phf
      JOIN patient_history_option pho ON phf.history_id = pho.id
      WHERE phf.patient_id = $1
    `;
    const familyHistoryResult = await pool.query(familyHistoryQuery, [id]);

    // 生活習慣
    const lifestyleQuery = `
      SELECT pl.lifestyle_id, plo.lifestyle
      FROM patient_lifestyle pl
      JOIN patient_lifestyle_option plo ON pl.lifestyle_id = plo.id
      WHERE pl.patient_id = $1
    `;
    const lifestyleResult = await pool.query(lifestyleQuery, [id]);

    res.json({
      success: true,
      data: {
        ...patient,
        allergies: allergyResult.rows,
        personalHistory: personalHistoryResult.rows,
        familyHistory: familyHistoryResult.rows,
        lifestyle: lifestyleResult.rows,
      },
    });
  } catch (error) {
    console.error("取得病患詳細資料失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/patients/:id
 * 更新病患資料
 */
router.put("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const {
      name,
      gender,
      bloodType,
      birthDate,
      idNumber,
      allergies = [],
      personalHistory = [],
      familyHistory = [],
      lifestyle = [],
    } = req.body;

    // 驗證必填欄位
    if (!name || !gender || !bloodType || !birthDate || !idNumber) {
      return res.status(400).json({
        success: false,
        error: "請填寫所有必填欄位",
      });
    }

    // 檢查病患是否存在
    const checkPatientQuery =
      "SELECT patient_id FROM patient WHERE patient_id = $1";
    const checkPatientResult = await client.query(checkPatientQuery, [id]);

    if (checkPatientResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        error: "找不到該病患",
      });
    }

    // 檢查身分證是否與其他病患重複
    const checkIdQuery =
      "SELECT patient_id FROM patient WHERE id_number = $1 AND patient_id != $2";
    const checkIdResult = await client.query(checkIdQuery, [idNumber, id]);

    if (checkIdResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: "該身分證號碼已被其他病患使用",
      });
    }

    // 更新病患基本資料
    const updatePatientQuery = `
      UPDATE patient 
      SET name = $1, gender = $2, blood_type = $3, birth_date = $4, id_number = $5, updated_at = CURRENT_TIMESTAMP
      WHERE patient_id = $6
    `;
    await client.query(updatePatientQuery, [
      name,
      gender,
      bloodType,
      birthDate,
      idNumber,
      id,
    ]);

    // 刪除舊的藥物過敏記錄
    await client.query(
      "DELETE FROM patient_drug_allergy WHERE patient_id = $1",
      [id]
    );

    // 新增新的藥物過敏記錄
    if (allergies.length > 0) {
      const allergyValues = allergies
        .map((allergyId) => `(${id}, ${allergyId})`)
        .join(",");
      await client.query(`
        INSERT INTO patient_drug_allergy (patient_id, allergy_id)
        VALUES ${allergyValues}
      `);
    }

    // 刪除舊的個人病史記錄
    await client.query(
      "DELETE FROM patient_history_personal WHERE patient_id = $1",
      [id]
    );

    // 新增新的個人病史記錄
    if (personalHistory.length > 0) {
      const historyValues = personalHistory
        .map((historyId) => `(${id}, ${historyId})`)
        .join(",");
      await client.query(`
        INSERT INTO patient_history_personal (patient_id, history_id)
        VALUES ${historyValues}
      `);
    }

    // 刪除舊的家族病史記錄
    await client.query(
      "DELETE FROM patient_history_family WHERE patient_id = $1",
      [id]
    );

    // 新增新的家族病史記錄
    if (familyHistory.length > 0) {
      const familyValues = familyHistory
        .map((item) => `(${id}, ${item.historyId}, '${item.kinship}')`)
        .join(",");
      await client.query(`
        INSERT INTO patient_history_family (patient_id, history_id, kinship)
        VALUES ${familyValues}
      `);
    }

    // 刪除舊的生活習慣記錄
    await client.query("DELETE FROM patient_lifestyle WHERE patient_id = $1", [
      id,
    ]);

    // 新增新的生活習慣記錄
    if (lifestyle.length > 0) {
      const lifestyleValues = lifestyle
        .map((lifestyleId) => `(${id}, ${lifestyleId})`)
        .join(",");
      await client.query(`
        INSERT INTO patient_lifestyle (patient_id, lifestyle_id)
        VALUES ${lifestyleValues}
      `);
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "病患資料更新成功",
      data: {
        patient_id: id,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("更新病患失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/patients/:id
 * 刪除病患
 */
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    // 檢查病患是否存在
    const checkPatientQuery =
      "SELECT patient_id FROM patient WHERE patient_id = $1";
    const checkPatientResult = await client.query(checkPatientQuery, [id]);

    if (checkPatientResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        error: "找不到該病患",
      });
    }

    // 檢查是否有關聯的手術記錄
    const checkSurgeryQuery =
      "SELECT COUNT(*) as count FROM surgery WHERE patient_id = $1";
    const checkSurgeryResult = await client.query(checkSurgeryQuery, [id]);

    if (parseInt(checkSurgeryResult.rows[0].count) > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: "該病患已有手術記錄，無法刪除",
      });
    }

    // 刪除相關記錄（按照外鍵依賴順序）
    await client.query(
      "DELETE FROM patient_drug_allergy WHERE patient_id = $1",
      [id]
    );
    await client.query(
      "DELETE FROM patient_history_personal WHERE patient_id = $1",
      [id]
    );
    await client.query(
      "DELETE FROM patient_history_family WHERE patient_id = $1",
      [id]
    );
    await client.query("DELETE FROM patient_lifestyle WHERE patient_id = $1", [
      id,
    ]);

    // 刪除病患基本資料
    await client.query("DELETE FROM patient WHERE patient_id = $1", [id]);

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "病患資料刪除成功",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("刪除病患失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

export default router;
