import type { IncomingMessage, ServerResponse } from "http"
import { query } from "../db"
import { paginate, sendJson } from "../auth"

function cleanPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("92") && digits.length >= 11) {
    digits = "0" + digits.slice(2)
  }
  return digits
}

export async function handlePublic(
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase()
  if (method !== "GET") return false

  // GET /public/catalog
  if (segments[0] === "catalog") {
    const url = new URL(req.url!, "http://localhost")
    const q = url.searchParams.get("q")?.trim() || ""
    const categoryId = url.searchParams.get("category_id")
    const inStockOnly = url.searchParams.get("in_stock_only") === "true"
    const sort = url.searchParams.get("sort") || "name"
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
    const pageSize = Math.min(100, parseInt(url.searchParams.get("page_size") || "24"))
    const offset = (page - 1) * pageSize

    let orderBy = "p.name ASC"
    if (sort === "-name") orderBy = "p.name DESC"
    else if (sort === "price_asc") orderBy = "p.selling_price ASC"
    else if (sort === "price_desc") orderBy = "p.selling_price DESC"
    else if (sort === "-created_at") orderBy = "p.created_at DESC"

    const conditions: string[] = ["p.is_archived = FALSE"]
    const params: any[] = []
    let pi = 1

    if (inStockOnly) {
      conditions.push("p.current_stock > 0")
    }
    if (q) {
      conditions.push(`(p.name ILIKE $${pi} OR p.sku_code ILIKE $${pi})`)
      params.push(`%${q}%`)
      pi++
    }
    if (categoryId) {
      conditions.push(`p.category_id = $${pi}`)
      params.push(parseInt(categoryId))
      pi++
    }

    const where = `WHERE ${conditions.join(" AND ")}`

    const { rows: countRows } = await query(`SELECT COUNT(*) as cnt FROM products p ${where}`, params)
    const total = parseInt(countRows[0].cnt)

    const { rows } = await query(
      `SELECT p.id, p.sku_code, p.name, p.description, p.image_url, p.selling_price,
              p.current_stock, (p.current_stock > 0) AS is_in_stock,
              p.category_id, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${where}
       ORDER BY ${orderBy} LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, pageSize, offset]
    )

    sendJson(res, 200, { items: rows, ...paginate(total, page, pageSize) })
    return true
  }

  // GET /public/categories
  if (segments[0] === "categories") {
    const { rows } = await query(`
      SELECT c.id, c.name, c.description,
             COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_archived = FALSE
      GROUP BY c.id, c.name, c.description
      ORDER BY c.name ASC
    `)
    sendJson(res, 200, rows)
    return true
  }

  // GET /public/invoices or /public/invoices/:id/pdf
  if (segments[0] === "invoices" || segments[0] === "invoice") {
    const url = new URL(req.url!, "http://localhost")
    const phoneParam = url.searchParams.get("phone")?.trim() || ""

    // Sub-route: /public/invoices/:id/pdf
    if (segments[1] && segments[2] === "pdf") {
      const saleId = parseInt(segments[1])
      const { rows: saleRows } = await query(
        `SELECT s.*, u.username AS cashier_username FROM sales s
         LEFT JOIN users u ON s.cashier_id = u.id
         WHERE s.id = $1`,
        [saleId]
      )
      if (!saleRows[0]) return sendJson(res, 404, { message: "Invoice not found." }), true
      const sale = saleRows[0]
      const { rows: items } = await query(
        `SELECT si.*, p.name AS product_name, p.sku_code AS product_sku
         FROM sale_items si LEFT JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = $1 ORDER BY si.id`,
        [sale.id]
      )
      // Return printable HTML receipt for serverless
      const receiptHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${sale.transaction_code}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; max-width: 600px; margin: auto; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 8px 4px; border-bottom: 1px solid #ddd; }
    .right { text-align: right; }
    .total { font-weight: bold; font-size: 16px; border-top: 2px solid #000; }
  </style>
</head>
<body onload="window.print()">
  <h1>Store Receipt</h1>
  <p>Transaction: <strong>${sale.transaction_code}</strong><br>
  Date: ${new Date(sale.sale_date).toLocaleString()}<br>
  Customer: ${sale.customer_name || 'Walk-in'}<br>
  Payment: ${sale.payment_method}</p>
  <table>
    <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
    <tbody>
      ${items.map((i: any) => `<tr><td>${i.product_name} (${i.product_sku})</td><td class="right">${i.quantity}</td><td class="right">${Number(i.unit_selling_price).toFixed(2)}</td><td class="right">${Number(i.line_revenue).toFixed(2)}</td></tr>`).join("")}
    </tbody>
    <tfoot>
      <tr class="total"><td colspan="3">Grand Total</td><td class="right">${Number(sale.total_revenue).toFixed(2)}</td></tr>
    </tfoot>
  </table>
</body>
</html>`
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(receiptHtml)
      return true
    }

    // Single invoice by code: /public/invoice/:code
    if (segments[1] && isNaN(parseInt(segments[1]))) {
      const code = segments[1]
      const { rows: saleRows } = await query(
        `SELECT s.*, u.username as cashier_username FROM sales s
         LEFT JOIN users u ON s.cashier_id = u.id
         WHERE s.transaction_code = $1`,
        [code.toUpperCase()]
      )
      if (!saleRows[0]) return sendJson(res, 404, { message: "Invoice not found." }), true
      const sale = saleRows[0]
      const { rows: itemRows } = await query(
        `SELECT si.*, p.name as product_name, p.sku_code as product_sku
         FROM sale_items si LEFT JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = $1 ORDER BY si.id`,
        [sale.id]
      )
      sendJson(res, 200, { ...sale, items: itemRows })
      return true
    }

    // Invoices list by phone: /public/invoices?phone=...
    const clean = cleanPhone(phoneParam)
    if (clean.length < 7) {
      return sendJson(res, 400, { message: "Please provide a valid phone number with at least 7 digits." }), true
    }

    const { rows: sales } = await query(
      `SELECT s.id, s.transaction_code, s.customer_name, s.total_revenue, s.sale_date, s.status, s.payment_method
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE (s.customer_name ILIKE $1 OR c.phone ILIKE $1 OR s.customer_name ILIKE $2)
       ORDER BY s.sale_date DESC
       LIMIT 50`,
      [`%${clean}%`, `%${clean.replace(/^0/, "")}%`]
    )

    const resultSales = []
    for (const s of sales) {
      const { rows: itemRows } = await query(
        `SELECT si.id, si.product_id, si.product_name, si.product_sku, si.quantity, si.unit_selling_price, si.line_revenue
         FROM sale_items si
         WHERE si.sale_id = $1
         ORDER BY si.id`,
        [s.id]
      )
      resultSales.push({ ...s, items: itemRows })
    }

    sendJson(res, 200, resultSales)
    return true
  }

  return false
}
