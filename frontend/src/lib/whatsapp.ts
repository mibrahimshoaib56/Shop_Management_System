import type { CheckoutResponse } from "@/types/api"

/**
 * Normalizes phone number into international format for wa.me links
 * e.g., 03001234567 -> 923001234567
 */
export function formatWhatsAppPhone(phone: string): string {
  let clean = phone.replace(/\D/g, "")
  if (clean.startsWith("0") && clean.length === 11) {
    clean = "92" + clean.slice(1)
  }
  return clean
}

/**
 * Formats a clean, readable text receipt for WhatsApp
 */
export function buildReceiptWhatsAppMessage(
  sale: CheckoutResponse,
  storeName = "Centralized Shop"
): string {
  const lines = (sale.items || []).map(
    (item) =>
      `• ${item.product_name || "Item"} (x${item.quantity}) - Rs. ${Number(item.line_revenue).toLocaleString()}`
  )

  const portalUrl = `${window.location.origin}/catalog`

  return (
    `*${storeName} - Sales Receipt*\n` +
    `============================\n` +
    `Invoice: *${sale.transaction_code}*\n` +
    `Date: ${new Date(sale.sale_date).toLocaleString()}\n` +
    (sale.customer_name ? `Customer: ${sale.customer_name}\n` : "") +
    (sale.payment_method ? `Payment: *${sale.payment_method}*${sale.payment_split ? ` (${sale.payment_split})` : ""}\n` : "") +
    `============================\n` +
    `*Items Purchased:*\n` +
    (lines.length > 0 ? lines.join("\n") : "• General Items") +
    `\n============================\n` +
    (sale.discount_amount && Number(sale.discount_amount) > 0
      ? `Discount: -Rs. ${Number(sale.discount_amount).toLocaleString()}\n`
      : "") +
    `*Grand Total: Rs. ${Number(sale.total_revenue).toLocaleString()}*\n` +
    `============================\n` +
    `View online or check bills: ${portalUrl}\n\n` +
    `Thank you for your business!`
  )
}

/**
 * Opens WhatsApp Web or WhatsApp app with pre-filled message
 */
export function openWhatsAppLink(phone: string, message: string): void {
  const cleanPhone = formatWhatsAppPhone(phone)
  const encodedText = encodeURIComponent(message)
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`
  window.open(url, "_blank", "noopener,noreferrer")
}

/**
 * Formats a restock inquiry message for a supplier
 */
export function buildSupplierReorderMessage(
  product: {
    name: string
    sku_code: string
    current_stock: number
    min_stock_alert: number
  },
  supplierName?: string,
  storeName = "Centralized Shop"
): string {
  return (
    `Hello ${supplierName || "Supplier"},\n\n` +
    `This is an automated restock order request from *${storeName}*.\n\n` +
    `We are running low on the following product:\n` +
    `• *Product:* ${product.name}\n` +
    `• *SKU:* ${product.sku_code}\n` +
    `• *Current Stock:* ${product.current_stock} units\n` +
    `• *Alert Level:* ${product.min_stock_alert} units\n\n` +
    `Please share availability, unit wholesale price, and expected delivery time.\n\n` +
    `Thank you!`
  )
}

/**
 * Formats a payment reminder message for a customer with an outstanding Khata balance
 */
export function buildKhataReminderMessage(
  customer: {
    name: string
    outstanding_balance: number | string
  },
  storeName = "Centralized Shop"
): string {
  const balance = Number(customer.outstanding_balance).toLocaleString()
  return (
    `Assalam-o-Alaikum ${customer.name},\n\n` +
    `This is a gentle payment reminder from *${storeName}*.\n\n` +
    `Your current pending Khata (Udhaar) balance is: *Rs. ${balance}*\n\n` +
    `Please clear this balance at your earliest convenience via Cash, EasyPaisa, or JazzCash.\n\n` +
    `Thank you for your business and continued trust!`
  )
}
