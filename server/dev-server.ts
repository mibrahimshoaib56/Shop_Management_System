/**
 * Local development server for the API.
 * This wraps the Vercel serverless handler in a plain Node HTTP server
 * so you can run `npm run dev:api` to serve /api/* on port 3001.
 *
 * Usage: npx tsx server/dev-server.ts
 */
import "dotenv/config"
import http from "http"
import handler from "../api/index"
import { initDb } from "./db"

const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001

const server = http.createServer(async (req, res) => {
  // Simulate Vercel's VercelRequest/VercelResponse shape minimally
  // The handler will work because it only uses req.method, req.url, req.headers, req body events
  try {
    await (handler as any)(req, res)
  } catch (err) {
    console.error("Unhandled error:", err)
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ message: "Internal server error" }))
    }
  }
})

server.listen(PORT, async () => {
  console.log(`\n  🚀 API dev server running at http://localhost:${PORT}`)
  console.log(`  Proxy all /api/* requests here from Vite on port 5173\n`)
  try {
    await initDb()
    console.log("  ✅ Database schema verified & ready\n")
  } catch (err) {
    console.error("  ❌ Database initialization failed:", err)
  }
})
