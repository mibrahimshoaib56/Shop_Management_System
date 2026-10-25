import type { IncomingMessage, ServerResponse } from "http"
import { query } from "../db"
import { extractAuth, sendJson } from "../auth"

export async function handleReports(
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase()
  if (method !== "GET") return false

  const auth = extractAuth(req)
  if (!auth || auth.role !== "admin") {
    return sendJson(res, 403, { message: "Admin access required." }), true
  }

  // GET /reports/export?type=...&format=csv&start_date=...&end_date=...
  if (segments[0] === "export") {
    const url = new URL(req.url!, "http://localhost")
    const type = url.searchParams.get("type") || "sales"
    const format = url.searchParams.get("format") || "csv"
    const startDate = url.searchParams.get("start_date") || ""
    const endDate = url.searchParams.get("end_date") || ""

    // Generate CSV for all format requests (with UTF-8 BOM so Excel opens it seamlessly)

    let csvRows: string[] = []

    if (type === "sales") {
      csvRows.push("Transaction Code,Date,Customer,Payment Method,Revenue,Profit,Status")
      const { rows } = await query(
        `SELECT transaction_code, sale_date, customer_name, payment_method,
                total_revenue, total_profit, status
         FROM sales
         WHERE ($1::date IS NULL OR sale_date >= $1::date)
           AND ($2::date IS NULL OR sale_date < $2::date + interval '1 day')
         ORDER BY sale_date DESC`,
        [startDate || null, endDate || null]
      )
      for (const r of rows) {
        csvRows.push(
          `"${r.transaction_code}","${new Date(r.sale_date).toISOString().slice(0, 10)}","${r.customer_name || 'Walk-in'}","${r.payment_method}",${r.total_revenue},${r.total_profit},"${r.status}"`
        )
      }
    } else if (type === "inventory") {
      csvRows.push("SKU,Name,Category,Buying Price,Selling Price,Stock,Min Alert,Archived")
      const { rows } = await query(
        `SELECT p.sku_code, p.name, c.name as category, p.buying_price, p.selling_price,
                p.current_stock, p.min_stock_alert, p.is_archived
         FROM products p LEFT JOIN categories c ON p.category_id = c.id
         ORDER BY p.name`
      )
      for (const r of rows) {
        csvRows.push(
          `"${r.sku_code}","${r.name}","${r.category || ''}",${r.buying_price},${r.selling_price},${r.current_stock},${r.min_stock_alert},${r.is_archived}`
        )
      }
    } else if (type === "purchases") {
      csvRows.push("Date,Invoice,Product,Supplier,Qty,Unit Cost,Total")
      const { rows } = await query(
        `SELECT pu.purchase_date, pu.invoice_number, p.name as product, s.name as supplier,
                pu.quantity, pu.unit_buying_price, pu.total_cost
         FROM purchases pu
         LEFT JOIN products p ON pu.product_id = p.id
         LEFT JOIN suppliers s ON pu.supplier_id = s.id
         WHERE ($1::date IS NULL OR pu.purchase_date >= $1::date)
           AND ($2::date IS NULL OR pu.purchase_date < $2::date + interval '1 day')
         ORDER BY pu.purchase_date DESC`,
        [startDate || null, endDate || null]
      )
      for (const r of rows) {
        csvRows.push(
          `"${new Date(r.purchase_date).toISOString().slice(0, 10)}","${r.invoice_number}","${r.product}","${r.supplier}",${r.quantity},${r.unit_buying_price},${r.total_cost}`
        )
      }
    } else if (type === "profitability") {
      csvRows.push("Product,SKU,Units Sold,Revenue,Cost,Profit,Margin %")
      const { rows } = await query(
        `SELECT si.product_name, si.product_sku,
                SUM(si.quantity) as units,
                SUM(si.quantity * si.unit_selling_price) as revenue,
                SUM(si.quantity * si.unit_buying_price) as cost,
                SUM(si.quantity * (si.unit_selling_price - si.unit_buying_price)) as profit
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE s.status != 'refunded'
           AND ($1::date IS NULL OR s.sale_date >= $1::date)
           AND ($2::date IS NULL OR s.sale_date < $2::date + interval '1 day')
         GROUP BY si.product_name, si.product_sku
         ORDER BY profit DESC`,
        [startDate || null, endDate || null]
      )
      for (const r of rows) {
        const margin = Number(r.revenue) > 0 ? ((Number(r.profit) / Number(r.revenue)) * 100).toFixed(1) : "0"
        csvRows.push(
          `"${r.product_name}","${r.product_sku}",${r.units},${r.revenue},${r.cost},${r.profit},${margin}`
        )
      }
    } else if (type === "khata") {
      csvRows.push("Customer,Phone,Outstanding Balance,Total Sales,Last Entry")
      const { rows } = await query(
        `SELECT c.name, c.phone, c.outstanding_balance,
                COUNT(ke.id) as entries,
                MAX(ke.created_at) as last_entry
         FROM customers c
         LEFT JOIN khata_entries ke ON c.id = ke.customer_id
         WHERE c.outstanding_balance > 0
         GROUP BY c.id, c.name, c.phone, c.outstanding_balance
         ORDER BY c.outstanding_balance DESC`
      )
      for (const r of rows) {
        csvRows.push(
          `"${r.name}","${r.phone || ''}",${r.outstanding_balance},${r.entries},"${r.last_entry ? new Date(r.last_entry).toISOString().slice(0, 10) : ''}"`
        )
      }
    }

    const csv = "\uFEFF" + csvRows.join("\r\n")
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}_report.${format === "xlsx" ? "csv" : format}"`,
    })
    res.end(csv)
    return true
  }

  return false
}
