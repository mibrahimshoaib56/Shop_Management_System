import type { IncomingMessage, ServerResponse } from "http"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production-secret"
const JWT_EXPIRES = "8h"

export const VALID_ROLES = ["admin", "manager", "cashier"] as const
export type Role = (typeof VALID_ROLES)[number]

export interface JWTPayload {
  sub: number
  username: string
  role: Role | string
  jti: string
}

export function isValidRole(role: unknown): role is Role {
  return (
    typeof role === "string" &&
    (VALID_ROLES as readonly string[]).includes(role.trim().toLowerCase())
  )
}

export function isJWTPayload(payload: unknown): payload is JWTPayload {
  if (typeof payload !== "object" || payload === null) {
    return false
  }
  if (
    !("sub" in payload) ||
    !("username" in payload) ||
    !("role" in payload) ||
    !("jti" in payload)
  ) {
    return false
  }

  const sub = payload.sub
  const isValidSub =
    typeof sub === "number"
      ? !isNaN(sub) && sub > 0
      : typeof sub === "string"
        ? !isNaN(parseInt(sub, 10)) && parseInt(sub, 10) > 0
        : false

  const isValidUsername =
    typeof payload.username === "string" && payload.username.trim().length > 0
  const isRoleValid = isValidRole(payload.role)
  const isValidJti =
    typeof payload.jti === "string" && payload.jti.trim().length > 0

  return isValidSub && isValidUsername && isRoleValid && isValidJti
}

export function signToken(payload: Omit<JWTPayload, "jti">): string {
  const jti = Math.random().toString(36).slice(2) + Date.now().toString(36)
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

export function verifyToken(token: string): JWTPayload {
  const decoded = jwt.verify(token, JWT_SECRET)

  // 1. Reject string payload, null, or non-object types
  if (typeof decoded === "string" || !decoded || typeof decoded !== "object") {
    throw new Error("Invalid token payload: expected an object payload")
  }

  // 2. Validate sub claim (numeric user id)
  const rawSub = decoded.sub
  const sub =
    typeof rawSub === "number"
      ? rawSub
      : typeof rawSub === "string"
        ? parseInt(rawSub, 10)
        : NaN

  if (isNaN(sub) || sub <= 0) {
    throw new Error("Invalid token payload: missing or invalid sub claim")
  }

  // 3. Validate username claim
  const username = typeof decoded.username === "string" ? decoded.username.trim() : ""
  if (!username) {
    throw new Error("Invalid token payload: missing or invalid username claim")
  }

  // 4. Validate role claim against project role definitions
  const role = typeof decoded.role === "string" ? decoded.role.trim().toLowerCase() : ""
  if (!role || !isValidRole(role)) {
    throw new Error("Invalid token payload: missing or invalid role claim")
  }

  // 5. Validate jti claim
  const jti = typeof decoded.jti === "string" ? decoded.jti.trim() : ""
  if (!jti) {
    throw new Error("Invalid token payload: missing or invalid jti claim")
  }

  return {
    sub,
    username,
    role,
    jti,
  }
}

export interface AuthUser {
  id: number
  username: string
  role: string
  jti: string
}

export function extractAuth(req: IncomingMessage): AuthUser | null {
  const header = req.headers["authorization"] ?? ""
  if (!header.startsWith("Bearer ")) return null
  try {
    const payload = verifyToken(header.slice(7))
    return { id: payload.sub, username: payload.username, role: payload.role, jti: payload.jti }
  } catch {
    return null
  }
}

export function requireAuth(
  req: IncomingMessage,
  res: ServerResponse
): AuthUser | null {
  const user = extractAuth(req)
  if (!user) {
    sendJson(res, 401, { message: "Authentication required." })
    return null
  }
  return user
}

export function requireAdmin(
  req: IncomingMessage,
  res: ServerResponse
): AuthUser | null {
  const user = requireAuth(req, res)
  if (!user) return null
  if (user.role !== "admin") {
    sendJson(res, 403, { message: "Admin access required." })
    return null
  }
  return user
}

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  let responseData = data
  if (status >= 400 && data && typeof data === "object") {
    const obj = data as Record<string, any>
    if (!obj.error) {
      const codeByStatus: Record<number, string> = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        500: "INTERNAL_SERVER_ERROR",
      }
      const code = obj.code || codeByStatus[status] || "ERROR"
      const message = obj.message || "An error occurred."
      responseData = {
        ...obj,
        error: {
          code,
          message,
          details: obj.details || [],
        },
      }
    }
  }
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(responseData))
}

export async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        resolve({})
      }
    })
    req.on("error", reject)
  })
}

export function paginate(total: number, page: number, pageSize: number) {
  return {
    total,
    page,
    page_size: pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  }
}
