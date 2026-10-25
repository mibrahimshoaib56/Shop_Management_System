import type { IncomingMessage, ServerResponse } from "http"
import { query } from "../db"
import { extractAuth, paginate, readBody, requireAuth, sendJson } from "../auth"

export async function handlePurchases(
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase()
  const auth = extractAuth(req)
  if (!auth) return sendJson(res, 401, { message: "Auth required." }), true

  // GET /purchases
  if (method === "GET") {
    const url = new URL(req.url!, "http://localhost")
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
    const pageSize = Math.min(100, parseInt(url.searchParams.get("page_size") || "10"))
    const startDate = url.searchParams.get("start_date") || null
    const endDate = url.searchParams.get("end_date") || null
    const offset = (page - 1) * pageSize

    const conditions: string[] = []
    const params: any[] = []
    let pi = 1
    if (startDate) { conditions.push(`pu.purchase_date >= $${pi}::date`); params.push(startDate); pi++ }
    if (endDate) { conditions.push(`pu.purchase_date < ($${pi}::date + interval '1 day')`); params.push(endDate); pi++ }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

    const { rows: countRows } = await query(`SELECT COUNT(*) as cnt FROM purchases pu ${where}`, params)
    const total = parseInt(countRows[0].cnt)

    const { rows } = await query(
      `SELECT pu.*, p.name AS product_name, p.sku_code AS product_sku, s.name AS supplier_name
       FROM purchases pu
       LEFT JOIN products p ON pu.product_id = p.id
       LEFT JOIN suppliers s ON pu.supplier_id = s.id
       ${where}
       ORDER BY pu.purchase_date DESC LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, pageSize, offset]
    )
    const items = rows.map((r: any) => ({
      ...r,
      product: r.product_id ? { id: r.product_id, name: r.product_name, sku_code: r.product_sku } : null,
      supplier: r.supplier_id ? { id: r.supplier_id, name: r.supplier_name } : null,
    }))
    sendJson(res, 200, { items, ...paginate(total, page, pageSize) })
    return true
  }

  // POST /purchases
  if (method === "POST") {
    if (auth.role !== "admin") return sendJson(res, 403, { message: "Admin required." }), true
    const body = await readBody(req)
    const { product_id, supplier_id, quantity, unit_buying_price, invoice_number } = body

    if (!product_id || !supplier_id || !quantity || !invoice_number) {
      return sendJson(res, 400, { message: "product_id, supplier_id, quantity, and invoice_number are required." }), true
    }

    const { rows } = await query(
      `INSERT INTO purchases (product_id, supplier_id, quantity, unit_buying_price, invoice_number)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [product_id, supplier_id, Number(quantity), Number(unit_buying_price) || 0, invoice_number.trim()]
    )

    // Update product stock and buying price
    await query(
      `UPDATE products SET current_stock = current_stock + $1, buying_price = $2 WHERE id = $3`,
      [Number(quantity), Number(unit_buying_price) || 0, product_id]
    )

    sendJson(res, 201, rows[0])
    return true
  }

  return false
}
