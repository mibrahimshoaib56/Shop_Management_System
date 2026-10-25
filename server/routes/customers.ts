import type { IncomingMessage, ServerResponse } from "http"
import { query } from "../db"
import { extractAuth, paginate, readBody, requireAuth, sendJson } from "../auth"

export async function handleCustomers(
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase()
  const auth = extractAuth(req)
  if (!auth) return sendJson(res, 401, { message: "Auth required." }), true

  // GET /customers/summary
  if (method === "GET" && segments[0] === "summary") {
    const { rows } = await query(
      `SELECT COUNT(*)::int as total_customers,
              COALESCE(SUM(outstanding_balance), 0)::numeric as total_outstanding
       FROM customers WHERE is_active = TRUE`
    )
    sendJson(res, 200, {
      total_customers: parseInt(rows[0]?.total_customers || 0),
      total_outstanding: Number(rows[0]?.total_outstanding || 0),
    })
    return true
  }

  const id = segments[0] && !isNaN(parseInt(segments[0])) ? parseInt(segments[0]) : null

  // GET /customers/:id/ledger
  if (method === "GET" && id && segments[1] === "ledger") {
    const { rows: custRows } = await query("SELECT * FROM customers WHERE id = $1", [id])
    if (!custRows[0]) return sendJson(res, 404, { message: "Customer not found." }), true
    const customer = custRows[0]

    const { rows: entries } = await query(
      `SELECT ke.*, s.transaction_code
       FROM khata_entries ke
       LEFT JOIN sales s ON ke.sale_id = s.id
       WHERE ke.customer_id = $1
       ORDER BY ke.created_at DESC`,
      [id]
    )

    let totalCredit = 0
    let totalPaid = 0
    for (const e of entries) {
      const amt = Number(e.amount) || 0
      if (e.entry_type === "sale" || e.entry_type === "credit") {
        totalCredit += amt
      } else if (e.entry_type === "payment" || e.entry_type === "refund") {
        totalPaid += amt
      }
    }

    sendJson(res, 200, {
      customer,
      entries,
      total_credit: totalCredit,
      total_paid: totalPaid,
      outstanding: Number(customer.outstanding_balance),
    })
    return true
  }

  // POST /customers/:id/payment
  if (method === "POST" && id && segments[1] === "payment") {
    const body = await readBody(req)
    const { amount, notes } = body
    const amt = Number(amount)
    if (!amt || amt <= 0) return sendJson(res, 400, { message: "Valid amount required." }), true

    await query(
      "UPDATE customers SET outstanding_balance = GREATEST(0, outstanding_balance - $1) WHERE id = $2",
      [amt, id]
    )
    await query(
      `INSERT INTO khata_entries (customer_id, entry_type, amount, notes) VALUES ($1, 'payment', $2, $3)`,
      [id, amt, notes?.trim() || `Payment received`]
    )
    const { rows } = await query("SELECT * FROM customers WHERE id = $1", [id])
    sendJson(res, 200, rows[0])
    return true
  }

  // GET /customers/:id
  if (method === "GET" && id && !segments[1]) {
    const { rows } = await query("SELECT * FROM customers WHERE id = $1", [id])
    if (!rows[0]) return sendJson(res, 404, { message: "Customer not found." }), true

    // Get summary stats
    const { rows: stats } = await query(
      `SELECT
        COUNT(s.id) as total_sales,
        COALESCE(SUM(s.total_revenue), 0) as total_revenue,
        COALESCE(SUM(s.total_profit), 0) as total_profit
       FROM sales s WHERE s.customer_id = $1`,
      [id]
    )
    sendJson(res, 200, { ...rows[0], ...stats[0] })
    return true
  }

  // GET /customers
  if (method === "GET" && !id) {
    const url = new URL(req.url!, "http://localhost")
    const activeOnly = url.searchParams.get("active_only") === "true"
    const q = url.searchParams.get("search")?.trim() || url.searchParams.get("q")?.trim() || ""
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
    const pageSize = Math.min(200, parseInt(url.searchParams.get("page_size") || "20"))
    const offset = (page - 1) * pageSize

    const conditions: string[] = []
    const params: any[] = []
    let pi = 1

    if (activeOnly) {
      conditions.push("is_active = TRUE")
    }
    if (q) {
      conditions.push(`(name ILIKE $${pi} OR phone ILIKE $${pi})`)
      params.push(`%${q}%`)
      pi++
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

    if (activeOnly) {
      const { rows } = await query(
        `SELECT id, name, phone, address, notes, is_active, outstanding_balance, created_at
         FROM customers ${where} ORDER BY name ASC`,
        params
      )
      sendJson(res, 200, rows)
      return true
    }

    const { rows: countRows } = await query(`SELECT COUNT(*) as cnt FROM customers ${where}`, params)
    const total = parseInt(countRows[0].cnt)
    const { rows } = await query(
      `SELECT * FROM customers ${where} ORDER BY name ASC LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, pageSize, offset]
    )
    sendJson(res, 200, { items: rows, ...paginate(total, page, pageSize) })
    return true
  }

  // POST /customers
  if (method === "POST" && !id) {
    const body = await readBody(req)
    const { name, phone, address, notes, email } = body
    if (!name?.trim()) return sendJson(res, 400, { message: "Name required." }), true
    const { rows } = await query(
      `INSERT INTO customers (name, phone, address, notes, email) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), phone?.trim() || null, address?.trim() || null, notes?.trim() || null, email?.trim() || null]
    )
    sendJson(res, 201, rows[0])
    return true
  }

  // PUT /customers/:id
  if (method === "PUT" && id) {
    const body = await readBody(req)
    const { name, phone, address, notes, email, is_active } = body
    await query(
      `UPDATE customers SET
        name=COALESCE($1,name), phone=$2, address=$3, notes=$4, email=$5,
        is_active=COALESCE($6,is_active)
       WHERE id=$7`,
      [name?.trim() || null, phone?.trim() || null, address?.trim() || null, notes?.trim() || null, email?.trim() || null, is_active, id]
    )
    const { rows } = await query("SELECT * FROM customers WHERE id=$1", [id])
    if (!rows[0]) return sendJson(res, 404, { message: "Not found." }), true
    sendJson(res, 200, rows[0])
    return true
  }

  // DELETE /customers/:id
  if (method === "DELETE" && id) {
    if (auth.role !== "admin") return sendJson(res, 403, { message: "Admin required." }), true
    await query("UPDATE customers SET is_active = FALSE WHERE id=$1", [id])
    sendJson(res, 200, { message: "Customer deactivated." })
    return true
  }

  return false
}
