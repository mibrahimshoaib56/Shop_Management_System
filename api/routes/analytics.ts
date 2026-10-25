import type { IncomingMessage, ServerResponse } from "http"
import { query } from "../db"
import { extractAuth, sendJson } from "../auth"

export async function handleAnalytics(
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase()
  if (method !== "GET") return false

  const auth = extractAuth(req)
  if (!auth) return sendJson(res, 401, { message: "Auth required." }), true
  const action = segments[0]

  // GET /analytics/dashboard
  if (action === "dashboard") {
    const { rows: todaySales } = await query(
      `SELECT COALESCE(SUM(total_revenue),0) as revenue,
              COALESCE(SUM(total_profit),0) as profit
       FROM sales WHERE sale_date::date = CURRENT_DATE AND status != 'refunded'`
    )
    const { rows: itemsSold } = await query(
      `SELECT COALESCE(SUM(si.quantity), 0) as items_sold
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.sale_date::date = CURRENT_DATE AND s.status != 'refunded'`
    )
    const { rows: prodStats } = await query(
      `SELECT COUNT(*) as total_products,
              COUNT(CASE WHEN current_stock <= min_stock_alert THEN 1 END) as low_stock_count,
              COALESCE(SUM(current_stock * buying_price), 0) as inventory_value
       FROM products
       WHERE is_archived = FALSE`
    )

    sendJson(res, 200, {
      today_sales: Number(todaySales[0]?.revenue || 0),
      today_profit: Number(todaySales[0]?.profit || 0),
      items_sold_today: parseInt(itemsSold[0]?.items_sold || 0),
      total_products: parseInt(prodStats[0]?.total_products || 0),
      low_stock_count: parseInt(prodStats[0]?.low_stock_count || 0),
      inventory_value: Number(prodStats[0]?.inventory_value || 0),
    })
    return true
  }

  // GET /analytics/trends?group_by=day|week|month
  if (action === "trends") {
    const url = new URL(req.url!, "http://localhost")
    const group = url.searchParams.get("group_by") || url.searchParams.get("period") || "day"

    let groupExpr: string, dateFormat: string, days: number
    if (group === "week") {
      groupExpr = "DATE_TRUNC('week', sale_date)"
      dateFormat = "YYYY-MM-DD"
      days = 90
    } else if (group === "month") {
      groupExpr = "DATE_TRUNC('month', sale_date)"
      dateFormat = "YYYY-MM"
      days = 365
    } else {
      groupExpr = "sale_date::date"
      dateFormat = "YYYY-MM-DD"
      days = 30
    }

    const { rows } = await query(
      `SELECT TO_CHAR(${groupExpr}, '${dateFormat}') as bucket,
              COALESCE(SUM(total_revenue),0) as revenue,
              COALESCE(SUM(total_revenue - total_profit),0) as cost,
              COALESCE(SUM(total_profit),0) as profit,
              COUNT(*) as transactions
       FROM sales
       WHERE sale_date >= NOW() - INTERVAL '${days} days' AND status != 'refunded'
       GROUP BY ${groupExpr}
       ORDER BY ${groupExpr} ASC`
    )
    sendJson(
      res,
      200,
      rows.map((r: any) => ({
        bucket: r.bucket,
        revenue: Number(r.revenue),
        cost: Number(r.cost),
        profit: Number(r.profit),
        transactions: parseInt(r.transactions),
      }))
    )
    return true
  }

  // GET /analytics/top-products?limit=5
  if (action === "top-products") {
    const url = new URL(req.url!, "http://localhost")
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "5")))

    const { rows } = await query(
      `SELECT si.product_id as id,
              si.product_sku as sku_code,
              si.product_name as name,
              SUM(si.quantity) as units_sold,
              SUM(si.quantity * si.unit_selling_price) as revenue,
              SUM(si.quantity * (si.unit_selling_price - si.unit_buying_price)) as profit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.sale_date >= NOW() - INTERVAL '30 days' AND s.status != 'refunded'
       GROUP BY si.product_id, si.product_sku, si.product_name
       ORDER BY units_sold DESC
       LIMIT $1`,
      [limit]
    )
    sendJson(
      res,
      200,
      rows.map((r: any) => ({
        id: r.id,
        sku_code: r.sku_code || "",
        name: r.name || "",
        units_sold: parseInt(r.units_sold),
        revenue: Number(r.revenue),
        profit: Number(r.profit),
      }))
    )
    return true
  }

  // GET /analytics/category-revenue
  if (action === "category-revenue") {
    const { rows } = await query(
      `SELECT COALESCE(c.id, 0) as id,
              COALESCE(c.name, 'Uncategorized') as name,
              COALESCE(SUM(si.quantity * si.unit_selling_price), 0) as revenue
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN products p ON si.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE s.sale_date >= NOW() - INTERVAL '30 days' AND s.status != 'refunded'
       GROUP BY c.id, c.name
       ORDER BY revenue DESC`
    )
    const totalRev = rows.reduce((acc: number, r: any) => acc + Number(r.revenue), 0)
    sendJson(
      res,
      200,
      rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        revenue: Number(r.revenue),
        share_pct: totalRev > 0 ? Number(((Number(r.revenue) / totalRev) * 100).toFixed(1)) : 0,
      }))
    )
    return true
  }

  return false
}
