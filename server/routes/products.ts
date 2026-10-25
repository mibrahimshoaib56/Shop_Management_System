import type { IncomingMessage, ServerResponse } from "http"
import { getDb, query } from "../db"
import { extractAuth, paginate, readBody, requireAdmin, requireAuth, sendJson } from "../auth"

async function getProduct(id: number) {
  const { rows } = await query(
    `SELECT p.*, c.name AS category_name, s.name AS supplier_name, s.contact_info AS supplier_contact_info
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.id = $1`,
    [id]
  )
  if (!rows[0]) return null
  const p = rows[0]
  return {
    ...p,
    category: p.category_id ? { id: p.category_id, name: p.category_name } : null,
    supplier: p.supplier_id
      ? { id: p.supplier_id, name: p.supplier_name, contact_info: p.supplier_contact_info }
      : null,
  }
}

export async function handleProducts(
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase()
  const auth = extractAuth(req)
  if (!auth) return sendJson(res, 401, { message: "Auth required." }), true

  // GET /products/adjustments/history
  if (method === "GET" && segments[0] === "adjustments" && segments[1] === "history") {
    const url = new URL(req.url!, "http://localhost")
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
    const pageSize = Math.min(100, parseInt(url.searchParams.get("page_size") || "10"))
    const offset = (page - 1) * pageSize

    const { rows: countRows } = await query("SELECT COUNT(*) as cnt FROM stock_adjustments")
    const total = parseInt(countRows[0].cnt)
    const { rows } = await query(
      "SELECT * FROM stock_adjustments ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [pageSize, offset]
    )
    sendJson(res, 200, { items: rows, ...paginate(total, page, pageSize) })
    return true
  }

  const id = segments[0] && segments[0] !== "adjustments" ? parseInt(segments[0]) : null

  // POST /products/:id/adjust-stock
  if (method === "POST" && id && segments[1] === "adjust-stock") {
    const body = await readBody(req)
    const { quantity, reason, notes } = body
    const qtyNum = Math.max(1, parseInt(quantity) || 1)

    const db = getDb()
    const client = await db.connect()
    try {
      await client.query("BEGIN")
      const { rows: pRows } = await client.query(
        "SELECT * FROM products WHERE id=$1 FOR UPDATE",
        [id]
      )
      const product = pRows[0]
      if (!product) {
        await client.query("ROLLBACK")
        return sendJson(res, 404, { message: "Product not found." }), true
      }
      if (product.current_stock < qtyNum) {
        await client.query("ROLLBACK")
        return sendJson(res, 400, { message: `Only ${product.current_stock} units available.` }), true
      }
      await client.query("UPDATE products SET current_stock = current_stock - $1 WHERE id = $2", [qtyNum, id])
      const totalLoss = qtyNum * Number(product.buying_price)
      await client.query(
        `INSERT INTO stock_adjustments
          (product_id, product_name, product_sku, quantity, reason, notes, total_loss, cashier_id, cashier_username)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          product.id, product.name, product.sku_code, qtyNum, reason || "Other",
          notes || null, totalLoss, auth.id, auth.username
        ]
      )
      await client.query("COMMIT")
      sendJson(res, 200, { message: "Stock adjusted.", quantity_removed: qtyNum })
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
    return true
  }

  // GET /products or /products/:id
  if (method === "GET") {
    if (id) {
      const product = await getProduct(id)
      if (!product) return sendJson(res, 404, { message: "Not found." }), true
      sendJson(res, 200, product)
      return true
    }

    const url = new URL(req.url!, "http://localhost")
    const q = url.searchParams.get("q")?.trim() || ""
    const categoryId = url.searchParams.get("category_id")
    const lowStock = url.searchParams.get("low_stock") === "true"
    const includeArchived = url.searchParams.get("include_archived") === "true"
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
    const pageSize = Math.min(200, parseInt(url.searchParams.get("page_size") || "10"))
    const offset = (page - 1) * pageSize

    const conditions: string[] = []
    const params: any[] = []
    let pi = 1

    if (!includeArchived) { conditions.push(`p.is_archived = FALSE`); }
    if (q) { conditions.push(`(p.name ILIKE $${pi} OR p.sku_code ILIKE $${pi})`); params.push(`%${q}%`); pi++ }
    if (categoryId) { conditions.push(`p.category_id = $${pi}`); params.push(parseInt(categoryId)); pi++ }
    if (lowStock) { conditions.push(`p.current_stock <= p.min_stock_alert`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

    const { rows: countRows } = await query(
      `SELECT COUNT(*) as cnt FROM products p ${where}`,
      params
    )
    const total = parseInt(countRows[0].cnt)
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, s.name AS supplier_name, s.contact_info AS supplier_contact_info
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ${where}
       ORDER BY p.name ASC LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, pageSize, offset]
    )
    const items = rows.map((p: any) => ({
      ...p,
      category: p.category_id ? { id: p.category_id, name: p.category_name } : null,
      supplier: p.supplier_id
        ? { id: p.supplier_id, name: p.supplier_name, contact_info: p.supplier_contact_info }
        : null,
    }))
    sendJson(res, 200, { items, ...paginate(total, page, pageSize) })
    return true
  }

  // POST /products
  if (method === "POST" && !id) {
    if (auth.role !== "admin") return sendJson(res, 403, { message: "Admin required." }), true
    const body = await readBody(req)
    const { sku_code, name, category_id, supplier_id, description, image_url,
            buying_price, selling_price, current_stock, min_stock_alert } = body

    // Check SKU uniqueness
    const { rows: existing } = await query("SELECT id FROM products WHERE sku_code=$1", [sku_code?.trim()])
    if (existing.length) return sendJson(res, 409, { message: "SKU code already exists." }), true

    const { rows } = await query(
      `INSERT INTO products (sku_code, name, description, image_url, category_id, supplier_id,
        buying_price, selling_price, current_stock, min_stock_alert)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        sku_code?.trim(), name?.trim(), description?.trim() || null, image_url?.trim() || null,
        category_id || null, supplier_id || null,
        Number(buying_price) || 0, Number(selling_price) || 0,
        Number(current_stock) || 0, Number(min_stock_alert) || 5
      ]
    )
    const product = await getProduct(rows[0].id)
    sendJson(res, 201, product)
    return true
  }

  // PUT /products/:id
  if (method === "PUT" && id) {
    if (auth.role !== "admin") return sendJson(res, 403, { message: "Admin required." }), true
    const body = await readBody(req)
    const { name, description, image_url, category_id, supplier_id,
            buying_price, selling_price, current_stock, min_stock_alert, is_archived } = body

    await query(
      `UPDATE products SET
        name=COALESCE($1,name), description=$2, image_url=$3,
        category_id=COALESCE($4,category_id), supplier_id=$5,
        buying_price=COALESCE($6,buying_price), selling_price=COALESCE($7,selling_price),
        current_stock=COALESCE($8,current_stock), min_stock_alert=COALESCE($9,min_stock_alert),
        is_archived=COALESCE($10,is_archived)
       WHERE id=$11`,
      [
        name?.trim() || null, description?.trim() || null, image_url?.trim() || null,
        category_id || null, supplier_id || null,
        buying_price !== undefined ? Number(buying_price) : null,
        selling_price !== undefined ? Number(selling_price) : null,
        current_stock !== undefined ? Number(current_stock) : null,
        min_stock_alert !== undefined ? Number(min_stock_alert) : null,
        is_archived !== undefined ? is_archived : null,
        id
      ]
    )
    const product = await getProduct(id)
    if (!product) return sendJson(res, 404, { message: "Not found." }), true
    sendJson(res, 200, product)
    return true
  }

  // DELETE /products/:id
  if (method === "DELETE" && id) {
    if (auth.role !== "admin") return sendJson(res, 403, { message: "Admin required." }), true
    try {
      await query("DELETE FROM products WHERE id=$1", [id])
      sendJson(res, 200, { message: "Deleted." })
    } catch {
      sendJson(res, 409, { code: "PRODUCT_IN_USE", message: "Product has sales history. Archive it instead." })
    }
    return true
  }

  return false
}
