import type { IncomingMessage, ServerResponse } from "http"
import { query } from "../db"
import { extractAuth, paginate, readBody, requireAdmin, sendJson } from "../auth"

export async function handleCategories(
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase()
  const id = segments[0] ? parseInt(segments[0]) : null

  // GET /categories
  if (method === "GET" && !id) {
    const auth = extractAuth(req)
    if (!auth) { sendJson(res, 401, { message: "Auth required." }); return true }
    const url = new URL(req.url!, "http://localhost")
    const q = url.searchParams.get("q")?.trim() || ""
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
    const pageSize = Math.min(200, parseInt(url.searchParams.get("page_size") || "20"))
    const offset = (page - 1) * pageSize

    const listParams: any[] = []
    const countParams: any[] = []
    let pi = 1

    let whereClause = ""
    if (q) {
      whereClause = `WHERE name ILIKE $${pi}`
      listParams.push(`%${q}%`)
      countParams.push(`%${q}%`)
      pi++
    }

    const { rows: countRows } = await query(`SELECT COUNT(*) as cnt FROM categories ${whereClause}`, countParams)
    const total = parseInt(countRows[0].cnt)

    const { rows } = await query(
      `SELECT id, name, description, created_at FROM categories ${whereClause} ORDER BY name ASC LIMIT $${pi} OFFSET $${pi + 1}`,
      [...listParams, pageSize, offset]
    )
    sendJson(res, 200, { items: rows, ...paginate(total, page, pageSize) })
    return true
  }

  // POST /categories
  if (method === "POST" && !id) {
    const admin = requireAdmin(req, res)
    if (!admin) return true
    const body = await readBody(req)
    const { name, description } = body
    if (!name?.trim()) return sendJson(res, 400, { message: "Name required." }), true
    const { rows } = await query(
      "INSERT INTO categories (name, description) VALUES ($1,$2) RETURNING *",
      [name.trim(), description?.trim() || null]
    )
    sendJson(res, 201, rows[0])
    return true
  }

  // PUT /categories/:id
  if (method === "PUT" && id) {
    const admin = requireAdmin(req, res)
    if (!admin) return true
    const body = await readBody(req)
    const { name, description } = body
    const { rows } = await query(
      "UPDATE categories SET name=$1, description=$2 WHERE id=$3 RETURNING *",
      [name?.trim(), description?.trim() || null, id]
    )
    if (!rows[0]) return sendJson(res, 404, { message: "Not found." }), true
    sendJson(res, 200, rows[0])
    return true
  }

  // DELETE /categories/:id
  if (method === "DELETE" && id) {
    const admin = requireAdmin(req, res)
    if (!admin) return true
    try {
      await query("DELETE FROM categories WHERE id=$1", [id])
      sendJson(res, 200, { message: "Deleted." })
    } catch {
      sendJson(res, 409, { message: "Category in use by products." })
    }
    return true
  }

  return false
}
