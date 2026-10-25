import type { IncomingMessage, ServerResponse } from "http"
import bcrypt from "bcryptjs"
import { query } from "../db"
import { paginate, readBody, requireAdmin, requireAuth, sendJson } from "../auth"

export async function handleUsers(
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase()
  const id = segments[0] ? parseInt(segments[0]) : null

  // GET /users
  if (method === "GET" && !id) {
    const admin = requireAdmin(req, res)
    if (!admin) return true
    const url = new URL(req.url!, `http://localhost`)
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
    const pageSize = Math.min(100, parseInt(url.searchParams.get("page_size") || "10"))
    const offset = (page - 1) * pageSize

    const { rows: countRows } = await query("SELECT COUNT(*) as cnt FROM users")
    const total = parseInt(countRows[0].cnt)

    const { rows } = await query(
      "SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id DESC LIMIT $1 OFFSET $2",
      [pageSize, offset]
    )
    sendJson(res, 200, { items: rows, ...paginate(total, page, pageSize) })
    return true
  }

  // POST /users
  if (method === "POST" && !id) {
    const admin = requireAdmin(req, res)
    if (!admin) return true
    const body = await readBody(req)
    const { username, password, full_name, role } = body
    if (!username || !password) {
      return sendJson(res, 400, { message: "Username and password required." }), true
    }
    const hasher: any = (bcrypt as any)?.default || bcrypt
    const hash = typeof hasher?.hash === "function"
      ? await hasher.hash(password, 12)
      : hasher.hashSync(password, 12)
    const { rows } = await query(
      "INSERT INTO users (username, password_hash, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id, username, full_name, role, is_active, created_at",
      [username.trim(), hash, full_name?.trim() || null, role || "cashier"]
    )
    sendJson(res, 201, rows[0])
    return true
  }

  // PUT /users/:id
  if (method === "PUT" && id) {
    const admin = requireAdmin(req, res)
    if (!admin) return true
    const body = await readBody(req)
    const { full_name, role, password } = body
    if (password) {
      const hasher: any = (bcrypt as any)?.default || bcrypt
      const hash = typeof hasher?.hash === "function"
        ? await hasher.hash(password, 12)
        : hasher.hashSync(password, 12)
      await query(
        "UPDATE users SET full_name=$1, role=$2, password_hash=$3 WHERE id=$4",
        [full_name?.trim() || null, role, hash, id]
      )
    } else {
      await query(
        "UPDATE users SET full_name=$1, role=$2 WHERE id=$3",
        [full_name?.trim() || null, role, id]
      )
    }
    const { rows } = await query(
      "SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id=$1",
      [id]
    )
    sendJson(res, 200, rows[0])
    return true
  }

  // DELETE /users/:id (disable)
  if (method === "DELETE" && id) {
    const admin = requireAdmin(req, res)
    if (!admin) return true
    await query("UPDATE users SET is_active = FALSE WHERE id = $1", [id])
    sendJson(res, 200, { message: "User disabled." })
    return true
  }

  return false
}
