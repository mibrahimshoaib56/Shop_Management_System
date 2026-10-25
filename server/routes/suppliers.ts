import type { IncomingMessage, ServerResponse } from "http"
import { query } from "../db"
import { extractAuth, paginate, readBody, requireAdmin, requireAuth, sendJson } from "../auth"

export async function handleSuppliers(
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase()
  const id = segments[0] ? parseInt(segments[0]) : null

  // GET /suppliers
  if (method === "GET" && !id) {
    const auth = extractAuth(req)
    if (!auth) return sendJson(res, 401, { message: "Auth required." }), true
    const url = new URL(req.url!, "http://localhost")
    const q = url.searchParams.get("q")?.trim() || ""
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
    const pageSize = Math.min(200, parseInt(url.searchParams.get("page_size") || "20"))
    const offset = (page - 1) * pageSize

    const whereClause = q ? `WHERE name ILIKE $3` : ""
    const params = q ? [pageSize, offset, `%${q}%`] : [pageSize, offset]
    const countParams = q ? [`%${q}%`] : []
    const countWhere = q ? `WHERE name ILIKE $1` : ""

    const { rows: countRows } = await query(`SELECT COUNT(*) as cnt FROM suppliers ${countWhere}`, countParams)
    const total = parseInt(countRows[0].cnt)
    const { rows } = await query(
      `SELECT id, name, contact_info, address, created_at FROM suppliers ${whereClause} ORDER BY name ASC LIMIT $1 OFFSET $2`,
      params
    )
    sendJson(res, 200, { items: rows, ...paginate(total, page, pageSize) })
    return true
  }

  // POST /suppliers
  if (method === "POST" && !id) {
    const admin = requireAdmin(req, res)
    if (!admin) return true
    const body = await readBody(req)
    const { name, contact_info, address } = body
    if (!name?.trim()) return sendJson(res, 400, { message: "Name required." }), true
    const { rows } = await query(
      "INSERT INTO suppliers (name, contact_info, address) VALUES ($1,$2,$3) RETURNING *",
      [name.trim(), contact_info?.trim() || null, address?.trim() || null]
    )
    sendJson(res, 201, rows[0])
    return true
  }

  // PUT /suppliers/:id
  if (method === "PUT" && id) {
    const admin = requireAdmin(req, res)
    if (!admin) return true
    const body = await readBody(req)
    const { name, contact_info, address } = body
    const { rows } = await query(
      "UPDATE suppliers SET name=$1, contact_info=$2, address=$3 WHERE id=$4 RETURNING *",
      [name?.trim(), contact_info?.trim() || null, address?.trim() || null, id]
    )
    if (!rows[0]) return sendJson(res, 404, { message: "Not found." }), true
    sendJson(res, 200, rows[0])
    return true
  }

  // DELETE /suppliers/:id
  if (method === "DELETE" && id) {
    const admin = requireAdmin(req, res)
    if (!admin) return true
    try {
      await query("DELETE FROM suppliers WHERE id=$1", [id])
      sendJson(res, 200, { message: "Deleted." })
    } catch {
      sendJson(res, 409, { message: "Supplier has purchases and cannot be deleted." })
    }
    return true
  }

  return false
}
