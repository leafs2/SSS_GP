// 生成員工編號
export async function generateEmployeeId(
  pool,
  departmentCode,
  role,
  permission
) {
  try {
    const result = await pool.query(
      `SELECT employee_id 
       FROM employees 
       WHERE department_code = $1 AND role = $2 AND permission = $3
       ORDER BY employee_id DESC 
       LIMIT 1`,
      [departmentCode, role, permission]
    );

    let nextNumber = 1;

    if (result.rows.length > 0) {
      const lastId = result.rows[0].employee_id;
      const numberPart = lastId.slice(-3);
      nextNumber = parseInt(numberPart) + 1;
    }

    const newId = `${role}${departmentCode}${permission}${nextNumber
      .toString()
      .padStart(3, "0")}`;

    return newId;
  } catch (error) {
    console.error("生成員工編號時發生錯誤:", error);
    throw error;
  }
}

// 更新部門計數器
export async function updateDepartmentCount(pool, departmentCode, role) {
  try {
    const countField = role === "D" ? "doctor_count" : "nurse_count";

    await pool.query(
      `UPDATE departments 
       SET ${countField} = ${countField} + 1 
       WHERE code = $1`,
      [departmentCode]
    );
  } catch (error) {
    console.error("更新部門計數器時發生錯誤:", error);
  }
}
