import type { IncomingMessage, ServerResponse } from "http"
import { getDb, query } from "../db"
import { extractAuth, paginate, readBody, sendJson } from "../auth"

function generateTxCode(): string {
  const d = new Date()
  const datePart = d.toISOString().slice(2, 10).replace(/-/g, "")
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `TXN-${datePart}-${rand}`
}

async function getSaleDetail(id: number) {
  const { rows: saleRows } = await query(
    `SELECT s.*, u.username AS cashier_username FROM sales s
     LEFT JOIN users u ON s.cashier_id = u.id
     WHERE s.id = $1`,
    [id]
  )
  if (!saleRows[0]) return null
  const sale = saleRows[0]
  const { rows: itemRows } = await query(
    `SELECT si.*, p.name AS product_name, p.sku_code AS product_sku
     FROM sale_items si LEFT JOIN products p ON si.product_id = p.id
     WHERE si.sale_id = $1 ORDER BY si.id`,
    [id]
  )
  return { ...sale, items: itemRows }
}

export async function handleSales(
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase()
  const auth = extractAuth(req)
  if (!auth) return sendJson(res, 401, { message: "Auth required." }), true

  // POST /sales/checkout
  if (method === "POST" && segments[0] === "checkout") {
    const body = await readBody(req)
    const { customer_name, customer_id, items, payment_method, payment_split, discount_amount } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return sendJson(res, 400, { message: "Cart is empty." }), true
    }

    const db = getDb()
    const client = await db.connect()
    try {
      await client.query("BEGIN")

      let totalRevenue = 0
      let totalProfit = 0
      const lineItems: any[] = []

      for (const item of items) {
        const { rows: pRows } = await client.query(
          "SELECT id, name, sku_code, selling_price, buying_price, current_stock FROM products WHERE id = $1 FOR UPDATE",
          [item.product_id]
        )
        const product = pRows[0]
        if (!product) {
          await client.query("ROLLBACK")
          return sendJson(res, 400, { message: `Product #${item.product_id} not found.` }), true
        }
        if (product.current_stock < item.quantity) {
          await client.query("ROLLBACK")
          return sendJson(res, 400, {
            message: `Insufficient stock for "${product.name}". Available: ${product.current_stock}, requested: ${item.quantity}.`
          }), true
        }

        const lineRevenue = Number(product.selling_price) * item.quantity
        const lineProfit = (Number(product.selling_price) - Number(product.buying_price)) * item.quantity
        totalRevenue += lineRevenue
        totalProfit += lineProfit

        await client.query(
          "UPDATE products SET current_stock = current_stock - $1 WHERE id = $2",
          [item.quantity, product.id]
        )

        lineItems.push({
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku_code,
          quantity: item.quantity,
          unit_selling_price: product.selling_price,
          unit_buying_price: product.buying_price,
        })
      }

      const disc = Math.min(totalRevenue, Math.max(0, Number(discount_amount) || 0))
      totalRevenue -= disc
      totalProfit -= disc

      const txCode = generateTxCode()
      const { rows: saleRows } = await client.query(
        `INSERT INTO sales (transaction_code, customer_id, customer_name, cashier_id, payment_method, payment_split,
          total_revenue, total_profit, discount_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          txCode, customer_id || null, customer_name || null, auth.id,
          payment_method || "Cash", payment_split || null,
          totalRevenue, totalProfit, disc
        ]
      )
      const saleId = saleRows[0].id

      for (const li of lineItems) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, product_name, product_sku, quantity, unit_selling_price, unit_buying_price)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [saleId, li.product_id, li.product_name, li.product_sku, li.quantity, li.unit_selling_price, li.unit_buying_price]
        )
      }

      // Khata integration
      if (payment_method === "Khata" && customer_id) {
        await client.query(
          "UPDATE customers SET outstanding_balance = outstanding_balance + $1 WHERE id = $2",
          [totalRevenue, customer_id]
        )
        await client.query(
          `INSERT INTO khata_entries (customer_id, sale_id, entry_type, amount, notes)
           VALUES ($1,$2,'sale',$3,$4)`,
          [customer_id, saleId, totalRevenue, `Sale ${txCode}`]
        )
      }

      await client.query("COMMIT")

      const sale = await getSaleDetail(saleId)
      sendJson(res, 201, sale)
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
    return true
  }

  // POST /sales/:id/refund
  if (method === "POST" && segments[1] === "refund") {
    const saleId = parseInt(segments[0])
    const body = await readBody(req)
    const { reason, items: refundItems } = body

    if (!reason?.trim()) {
      return sendJson(res, 400, { message: "Refund reason required." }), true
    }

    const db = getDb()
    const client = await db.connect()
    try {
      await client.query("BEGIN")

      const { rows: saleRows } = await client.query(
        "SELECT * FROM sales WHERE id = $1 FOR UPDATE",
        [saleId]
      )
      const sale = saleRows[0]
      if (!sale) {
        await client.query("ROLLBACK")
        return sendJson(res, 404, { message: "Sale not found." }), true
      }
      if (sale.status === "refunded") {
        await client.query("ROLLBACK")
        return sendJson(res, 400, { message: "This sale is already fully refunded." }), true
      }

      const { rows: saleItemRows } = await client.query(
        "SELECT * FROM sale_items WHERE sale_id = $1 FOR UPDATE",
        [saleId]
      )

      let totalRefund = 0

      if (refundItems && Array.isArray(refundItems) && refundItems.length > 0) {
        // Partial refund
        for (const ri of refundItems) {
          const saleItem = saleItemRows.find((si: any) => si.product_id === ri.product_id)
          if (!saleItem) continue
          const eligible = saleItem.quantity - (saleItem.returned_quantity || 0)
          const returnQty = Math.min(ri.quantity, eligible)
          if (returnQty <= 0) continue

          totalRefund += returnQty * Number(saleItem.unit_selling_price)
          await client.query(
            "UPDATE sale_items SET returned_quantity = returned_quantity + $1 WHERE id = $2",
            [returnQty, saleItem.id]
          )
          await client.query(
            "UPDATE products SET current_stock = current_stock + $1 WHERE id = $2",
            [returnQty, saleItem.product_id]
          )
        }
      } else {
        // Full refund
        for (const si of saleItemRows) {
          const eligible = si.quantity - (si.returned_quantity || 0)
          if (eligible <= 0) continue
          totalRefund += eligible * Number(si.unit_selling_price)
          await client.query(
            "UPDATE sale_items SET returned_quantity = returned_quantity + $1 WHERE id = $2",
            [eligible, si.id]
          )
          await client.query(
            "UPDATE products SET current_stock = current_stock + $1 WHERE id = $2",
            [eligible, si.product_id]
          )
        }
      }

      // Check if all items are now fully returned
      const { rows: updatedItems } = await client.query(
        "SELECT quantity, returned_quantity FROM sale_items WHERE sale_id = $1",
        [saleId]
      )
      const fullyReturned = updatedItems.every(
        (i: any) => (i.returned_quantity || 0) >= i.quantity
      )

      const newRefundTotal = Number(sale.refund_amount || 0) + totalRefund
      const newStatus = fullyReturned ? "refunded" : "partially_refunded"

      await client.query(
        `UPDATE sales SET status=$1, refund_amount=$2, refund_reason=$3, refunded_at=NOW() WHERE id=$4`,
        [newStatus, newRefundTotal, reason.trim(), saleId]
      )

      // If Khata sale, reduce customer balance
      if (sale.customer_id && totalRefund > 0) {
        await client.query(
          "UPDATE customers SET outstanding_balance = outstanding_balance - $1 WHERE id = $2",
          [totalRefund, sale.customer_id]
        )
        await client.query(
          `INSERT INTO khata_entries (customer_id, sale_id, entry_type, amount, notes)
           VALUES ($1,$2,'refund',$3,$4)`,
          [sale.customer_id, saleId, totalRefund, `Refund: ${reason.trim()}`]
        )
      }

      await client.query("COMMIT")

      const updatedSale = await getSaleDetail(saleId)
      sendJson(res, 200, updatedSale)
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
    return true
  }

  // GET /sales/:id/pdf
  if (method === "GET" && segments[1] === "pdf") {
    const saleId = parseInt(segments[0])
    const sale = await getSaleDetail(saleId)
    if (!sale) return sendJson(res, 404, { message: "Sale not found." }), true

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
  Cashier: ${sale.cashier_username || '-'}<br>
  Payment: ${sale.payment_method}</p>
  <table>
    <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
    <tbody>
      ${(sale.items || []).map((i: any) => `<tr><td>${i.product_name} (${i.product_sku || '-'})</td><td class="right">${i.quantity}</td><td class="right">${Number(i.unit_selling_price).toFixed(2)}</td><td class="right">${Number(i.line_revenue).toFixed(2)}</td></tr>`).join("")}
    </tbody>
    <tfoot>
      <tr class="total"><td colspan="3">Grand Total</td><td class="right">${Number(sale.total_revenue).toFixed(2)}</td></tr>
    </tfoot>
  </table>
</body>
</html>`
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Content-Disposition": `inline; filename="receipt_${sale.transaction_code}.html"`,
    })
    res.end(receiptHtml)
    return true
  }

  // GET /sales/:id
  if (method === "GET" && segments[0] && !isNaN(parseInt(segments[0]))) {
    const saleId = parseInt(segments[0])
    const sale = await getSaleDetail(saleId)
    if (!sale) return sendJson(res, 404, { message: "Sale not found." }), true
    sendJson(res, 200, sale)
    return true
  }

  // GET /sales
  if (method === "GET" && !segments[0]) {
    const url = new URL(req.url!, "http://localhost")
    const q = url.searchParams.get("q")?.trim() || ""
    const startDate = url.searchParams.get("start_date") || null
    const endDate = url.searchParams.get("end_date") || null
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
    const pageSize = Math.min(100, parseInt(url.searchParams.get("page_size") || "10"))
    const offset = (page - 1) * pageSize

    const conditions: string[] = []
    const params: any[] = []
    let pi = 1
    if (q) {
      conditions.push(`(s.transaction_code ILIKE $${pi} OR s.customer_name ILIKE $${pi})`)
      params.push(`%${q}%`); pi++
    }
    if (startDate) { conditions.push(`s.sale_date >= $${pi}::date`); params.push(startDate); pi++ }
    if (endDate) { conditions.push(`s.sale_date < ($${pi}::date + interval '1 day')`); params.push(endDate); pi++ }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

    const { rows: countRows } = await query(`SELECT COUNT(*) as cnt FROM sales s ${where}`, params)
    const total = parseInt(countRows[0].cnt)

    const { rows } = await query(
      `SELECT s.* FROM sales s ${where} ORDER BY s.sale_date DESC LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, pageSize, offset]
    )
    sendJson(res, 200, { items: rows, ...paginate(total, page, pageSize) })
    return true
  }

  return false
}
