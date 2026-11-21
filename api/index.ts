import type { VercelRequest, VercelResponse } from "@vercel/node"
import { initDb } from "../server/db.js"
import { sendJson } from "../server/auth.js"
import { handleAuth } from "../server/routes/auth.js"
import { handleUsers } from "../server/routes/users.js"
import { handleCategories } from "../server/routes/categories.js"
import { handleSuppliers } from "../server/routes/suppliers.js"
import { handleProducts } from "../server/routes/products.js"
import { handlePurchases } from "../server/routes/purchases.js"
import { handleSales } from "../server/routes/sales.js"
import { handleCustomers } from "../server/routes/customers.js"
import { handleAnalytics } from "../server/routes/analytics.js"
import { handleReports } from "../server/routes/reports.js"
import { handlePublic } from "../server/routes/public.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers — restrict to the configured origin in production
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*"
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin)
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.setHeader("Vary", "Origin")

  if (req.method === "OPTIONS") {
    res.status(204).end()
    return
  }

  // Ensure DB tables exist (idempotent, single-flight protected)
  try {
    await initDb()
  } catch (err: any) {
    console.error("DB init error:", err)
    return sendJson(res, 500, { message: "Database initialization failed." })
  }

  try {
    // Parse the path:
    // On Vercel: rewrite forwards the sub-path via ?path=:path* while preserving query parameters
    // On local dev: req.url directly contains /api/v1/... or /api/...
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)

    const queryPath = url.searchParams.get("path") || (req.query?.path as string)
    let pathname = ""

    if (typeof queryPath === "string" && queryPath.trim().length > 0) {
      pathname = queryPath
        .trim()
        .replace(/^\/api\/v1\//, "/")
        .replace(/^\/api\//, "/")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
    } else {
      pathname = url.pathname
        .replace(/^\/api\/v1\//, "/")
        .replace(/^\/api\//, "/")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")

      if (pathname === "index.ts" || pathname === "index") {
        pathname = ""
      }
    }

    const parts = pathname.split("/").filter(Boolean)
    const resource = parts[0] || ""
    const segments = parts.slice(1)

    let handled = false

    switch (resource) {
      case "auth":
        handled = await handleAuth(req, res, segments)
        break
      case "users":
        handled = await handleUsers(req, res, segments)
        break
      case "categories":
        handled = await handleCategories(req, res, segments)
        break
      case "suppliers":
        handled = await handleSuppliers(req, res, segments)
        break
      case "products":
        handled = await handleProducts(req, res, segments)
        break
      case "purchases":
        handled = await handlePurchases(req, res, segments)
        break
      case "sales":
        handled = await handleSales(req, res, segments)
        break
      case "customers":
        handled = await handleCustomers(req, res, segments)
        break
      case "analytics":
        handled = await handleAnalytics(req, res, segments)
        break
      case "reports":
        handled = await handleReports(req, res, segments)
        break
      case "public":
        handled = await handlePublic(req, res, segments)
        break
      default:
        break
    }

    if (!handled) {
      sendJson(res, 404, { message: `Route not found: ${req.method} ${pathname}` })
    }
  } catch (err: any) {
    console.error("API Error:", err)
    sendJson(res, 500, { message: err.message || "Internal Server Error" })
  }
}
