import type { IncomingMessage, ServerResponse } from "http"
import bcrypt from "bcryptjs"
import { query } from "../db"
import { extractAuth, readBody, requireAuth, sendJson, signToken } from "../auth"

export async function handleAuth(
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase()
  const action = segments[0] // "login" | "logout" | "me"

  // POST /auth/login
  if (method === "POST" && action === "login") {
    const body = await readBody(req)
    const { username, password } = body
    if (!username || !password) {
      return sendJson(res, 400, { message: "Username and password required." }), true
    }
    const { rows } = await query(
      "SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE LOWER(username) = LOWER($1)",
      [username.trim()]
    )
    const user = rows[0]
    if (!user || !user.is_active) {
      return sendJson(res, 401, { message: "Invalid credentials or account disabled." }), true
    }
    const hasher: any = (bcrypt as any)?.default || bcrypt
    const valid = typeof hasher?.compare === "function"
      ? await hasher.compare(password, user.password_hash)
      : hasher.compareSync(password, user.password_hash)
    if (!valid) {
      return sendJson(res, 401, { message: "Invalid credentials." }), true
    }
    const token = signToken({
      sub: user.id,
      username: user.username,
      role: user.role,
    })
    sendJson(res, 200, {
      access_token: token,
      token_type: "bearer",
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
      },
    })
    return true
  }

  // POST /auth/logout
  if (method === "POST" && action === "logout") {
    const auth = extractAuth(req)
    if (auth?.jti) {
      await query(
        "INSERT INTO token_blocklist (jti, created_at) VALUES ($1, NOW()) ON CONFLICT DO NOTHING",
        [auth.jti]
      )
    }
    sendJson(res, 200, { message: "Logged out." })
    return true
  }

  // GET /auth/me
  if (method === "GET" && action === "me") {
    const auth = requireAuth(req, res)
    if (!auth) return true
    const { rows } = await query(
      "SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = $1",
      [auth.id]
    )
    if (!rows[0]) return sendJson(res, 404, { message: "User not found." }), true
    sendJson(res, 200, rows[0])
    return true
  }

  return false
}
