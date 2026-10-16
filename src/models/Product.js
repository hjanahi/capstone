const db = require("../config/database");

function buildFilters({ category, activeOnly = true } = {}) {
  const params = [];
  const conditions = [];

  if (activeOnly) {
    conditions.push("is_active = true");
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  const where =
    conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
  return { where, params };
}

async function findAll({ category, activeOnly = true, limit, offset = 0 } = {}) {
  const { where, params } = buildFilters({ category, activeOnly });
  let sql = "SELECT * FROM products" + where + " ORDER BY name, id";

  if (limit !== undefined) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;
  }

  const { rows } = await db.query(sql, params);
  return rows;
}

async function countAll({ category, activeOnly = true } = {}) {
  const { where, params } = buildFilters({ category, activeOnly });
  const { rows } = await db.query(
    "SELECT COUNT(*) AS count FROM products" + where,
    params
  );
  return parseInt(rows[0].count, 10);
}

async function findById(id) {
  const { rows } = await db.query("SELECT * FROM products WHERE id = $1", [id]);
  return rows[0] || null;
}

async function findBySku(sku) {
  const { rows } = await db.query("SELECT * FROM products WHERE sku = $1", [
    sku,
  ]);
  return rows[0] || null;
}

async function updateStock(productId, quantityDelta) {
  const { rows } = await db.query(
    `UPDATE products
     SET stock = stock + $1, updated_at = NOW()
     WHERE id = $2 AND stock + $1 >= 0
     RETURNING *`,
    [quantityDelta, productId]
  );
  return rows[0] || null;
}

module.exports = { findAll, countAll, findById, findBySku, updateStock };
