import type { IncomingMessage, ServerResponse } from "http"
import { createRequire } from "module"
import { query } from "../db.js"
import { extractAuth, readBody, requireAuth, sendJson, signToken } from "../auth.js"

const require = createRequire(import.meta.url)
const bcrypt = require("bcryptjs")

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

    const ip = (req.headers["x-forwarded-for"] as string || "").split(",")[0].trim() || "unknown"
    const normalizedUsername = username.trim().toLowerCase()

    // Rate limit: max 10 failed attempts per username in a 15-minute window
    const { rows: attemptRows } = await query(
      `SELECT COUNT(*) as cnt FROM login_attempts
       WHERE username = $1 AND attempted_at > NOW() - INTERVAL '15 minutes'`,
      [normalizedUsername]
    )
    if (parseInt(attemptRows[0]?.cnt || "0") >= 10) {
      return sendJson(res, 429, { message: "Too many login attempts. Please wait 15 minutes and try again." }), true
    }

    const { rows } = await query(
      "SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE LOWER(username) = $1",
      [normalizedUsername]
    )
    const user = rows[0]
    if (!user || !user.is_active) {
      // Record failed attempt even for unknown usernames (prevents username enumeration via timing)
      await query(
        "INSERT INTO login_attempts (username, ip) VALUES ($1, $2)",
        [normalizedUsername, ip]
      )
      return sendJson(res, 401, { message: "Invalid credentials or account disabled." }), true
    }
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      await query(
        "INSERT INTO login_attempts (username, ip) VALUES ($1, $2)",
        [normalizedUsername, ip]
      )
      return sendJson(res, 401, { message: "Invalid credentials." }), true
    }

    // Successful login — clear attempts for this username
    await query("DELETE FROM login_attempts WHERE username = $1", [normalizedUsername])

    // Prune expired tokens from blocklist (tokens live 8h, so anything older is irrelevant)
    await query(
      "DELETE FROM token_blocklist WHERE created_at < NOW() - INTERVAL '8 hours'"
    )

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
    const auth = await extractAuth(req)
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
    const auth = await requireAuth(req, res)
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
