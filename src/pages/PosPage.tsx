import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Banknote,
  BookOpen,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  Minus,
  Plus,
  Printer,
  ScanBarcode,
  ShoppingCart,
  Smartphone,
  Split,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { CheckoutResponse, Customer, Paginated, Product } from "@/types/api"

import { EmptyState } from "@/components/EmptyState"
import { Spinner } from "@/components/Spinner"
import { StockBadge } from "@/components/StockBadge"
import { api } from "@/lib/api"
import { downloadBlobResponse } from "@/lib/file"
import { money } from "@/lib/format"
import { buildReceiptWhatsAppMessage, openWhatsAppLink } from "@/lib/whatsapp"
import { cartSubtotal, cartTotalItems, useCartStore } from "@/stores/cartStore"

const PAYMENT_METHODS = [
  { id: "Cash", label: "Cash", icon: Banknote },
  { id: "Card", label: "Card", icon: CreditCard },
  { id: "EasyPaisa", label: "EasyPaisa", icon: Smartphone },
  { id: "JazzCash", label: "JazzCash", icon: Wallet },
  { id: "Khata", label: "Khata (Udhaar)", icon: BookOpen },
  { id: "Split", label: "Split Tender", icon: Split },
]

export function PosPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [completedSale, setCompletedSale] = useState<CheckoutResponse | null>(null)
  const [completedPhone, setCompletedPhone] = useState("")

  const customersQuery = useQuery({
    queryKey: ["customers-pos"],
    queryFn: async () => (await api.get<Customer[]>("/customers", { params: { active_only: true } })).data,
    staleTime: 30_000,
  })

  const [paymentMethod, setPaymentMethod] = useState<string>("Cash")
  const [cashReceived, setCashReceived] = useState<string>("")
  const [splitMethod1, setSplitMethod1] = useState<string>("Cash")
  const [splitAmount1, setSplitAmount1] = useState<string>("")
  const [splitMethod2, setSplitMethod2] = useState<string>("EasyPaisa")
  const [splitAmount2, setSplitAmount2] = useState<string>("")

  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat")
  const [discountInput, setDiscountInput] = useState<string>("")

  const items = useCartStore((state) => state.items)
  const addItem = useCartStore((state) => state.addItem)
  const increment = useCartStore((state) => state.increment)
  const decrement = useCartStore((state) => state.decrement)
  const setQuantity = useCartStore((state) => state.setQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const clearCart = useCartStore((state) => state.clear)

  const subtotal = cartSubtotal(items)
  const rawDiscount = parseFloat(discountInput) || 0
  const discountAmount =
    discountType === "percent"
      ? Math.min(subtotal, (subtotal * Math.min(100, Math.max(0, rawDiscount))) / 100)
      : Math.min(subtotal, Math.max(0, rawDiscount))
  const finalTotal = Math.max(0, subtotal - discountAmount)

  const sAmt1 = parseFloat(splitAmount1) || 0
  const sAmt2 = parseFloat(splitAmount2) || 0
  const splitTotal = sAmt1 + sAmt2
  const splitDiff = finalTotal - splitTotal
  const numCash = parseFloat(cashReceived) || 0
  const changeDue = Math.max(0, numCash - finalTotal)

  const resultsQuery = useQuery({
    queryKey: ["pos-search", search],
    queryFn: async () =>
      (
        await api.get<Paginated<Product>>("/products", {
          params: { q: search.trim(), include_archived: false, page_size: 20, sort: "name" },
        })
      ).data,
    enabled: search.trim().length >= 1,
    staleTime: 15_000,
  })

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (paymentMethod === "Khata") {
        if (!selectedCustomerId) {
          throw new Error("Please select a registered Customer from the list above for Khata (Udhaar) sales.")
        }
      }

      if (paymentMethod === "Split") {
        if (Math.abs(splitDiff) > 0.01) {
          throw new Error(
            `Split amounts total Rs. ${splitTotal.toLocaleString()}, which does not match bill total Rs. ${finalTotal.toLocaleString()}.`
          )
        }
      }

      const parts = []
      if (customerName.trim()) parts.push(customerName.trim())
      if (customerPhone.trim()) parts.push(customerPhone.trim())
      const combined = parts.join(" - ")

      const splitSummary =
        paymentMethod === "Split"
          ? `${splitMethod1}: Rs. ${sAmt1.toLocaleString()} | ${splitMethod2}: Rs. ${sAmt2.toLocaleString()}`
          : null

      const payload = {
        customer_name: combined || null,
        customer_id: selectedCustomerId || null,
        items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
        payment_method: paymentMethod,
        payment_split: splitSummary,
        discount_amount: discountAmount,
      }
      const response = await api.post<CheckoutResponse>("/sales/checkout", payload)
      return response.data
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || "Checkout could not be completed."
      toast.error(msg)
    },
    onSuccess: async (sale) => {
      setCompletedSale(sale)
      setCompletedPhone(customerPhone.trim())
      clearCart()
      setSelectedCustomerId(null)
      setCustomerName("")
      setCustomerPhone("")
      setCashReceived("")
      setDiscountInput("")
      setSplitAmount1("")
      setSplitAmount2("")
      toast.success(`Sale ${sale.transaction_code} completed — ${money(sale.total_revenue)}`)
      void api.get("/analytics/dashboard")
      void queryClient.invalidateQueries({ queryKey: ["customers-pos"] })
      void queryClient.invalidateQueries({ queryKey: ["customers"] })
      void queryClient.invalidateQueries({ queryKey: ["customers-summary"] })
    },
  })

  const handlePrintPdf = async (sale: CheckoutResponse) => {
    try {
      const pdf = await api.get<Blob>(`/sales/${sale.id}/pdf`, { responseType: "blob" })
      downloadBlobResponse(
        pdf,
        `Invoice_${(sale.customer_name ?? "Walkin").replace(/\s+/g, "")}_${sale.transaction_code}.pdf`
      )
    } catch {
      toast.error("Could not download receipt PDF.")
    }
  }

  const handleSendWhatsApp = (sale: CheckoutResponse, phone: string) => {
    if (!phone.trim()) {
      toast.error("Please enter a phone number to send via WhatsApp.")
      return
    }
    const message = buildReceiptWhatsAppMessage(sale)
    openWhatsAppLink(phone.trim(), message)
    toast.success("Opening WhatsApp with formatted receipt…")
  }

  const handleSearchKeyDown = (key: string) => {
    if (key !== "Enter") return
    const term = search.trim().toLowerCase()
    if (!term) return
    const exact = resultsQuery.data?.items.find((p) => p.sku_code.toLowerCase() === term)
    if (exact) {
      if (exact.current_stock > 0) {
        addItem(exact)
        setSearch("")
      } else {
        toast.error(`"${exact.name}" is out of stock.`)
      }
    } else {
      toast.info("No exact SKU match for scanner input.")
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <section className="card flex flex-col p-4 lg:col-span-3">
        <div className="relative mb-4">
          <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Search by name or SKU — or scan a barcode…"
            value={search}
            autoFocus
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => handleSearchKeyDown(event.key)}
          />
        </div>

        <div className="max-h-[62vh] overflow-y-auto rounded-lg border border-slate-200">
          {search.trim().length < 1 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Start typing to search products. Barcode scanners are supported.
            </p>
          ) : resultsQuery.isLoading ? (
            <Spinner />
          ) : !resultsQuery.data || resultsQuery.data.items.length === 0 ? (
            <EmptyState title="No products found" subtitle={`No matches for "${search}".`} />
          ) : (
            <ul className="divide-y divide-slate-200">
              {resultsQuery.data.items.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    disabled={product.current_stock === 0}
                    onClick={() => addItem(product)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-500">
                        {product.sku_code} · {product.category?.name ?? "Uncategorized"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">
                        {money(product.selling_price)}
                      </span>
                      <StockBadge stock={product.current_stock} minAlert={product.min_stock_alert} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card flex h-fit flex-col p-4 lg:col-span-2">
        <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-3">
          <ShoppingCart className="h-5 w-5 text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-900">Current Bill</h2>
          {items.length > 0 ? (
            <button
              type="button"
              className="ml-auto text-xs font-medium text-red-600 hover:text-red-700"
              onClick={clearCart}
            >
              Clear all
            </button>
          ) : null}
        </div>

        <div className="space-y-2 pb-3">
          <div className="flex items-center gap-2">
            <select
              className={`input-field text-xs py-1.5 ${
                paymentMethod === "Khata" && !selectedCustomerId
                  ? "border-rose-400 bg-rose-50/50 text-rose-900 font-medium"
                  : "bg-white"
              }`}
              value={selectedCustomerId ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null
                setSelectedCustomerId(val)
                if (val) {
                  const cust = customersQuery.data?.find((c) => c.id === val)
                  if (cust) {
                    setCustomerName(cust.name)
                    setCustomerPhone(cust.phone || "")
                  }
                }
              }}
            >
              <option value="">
                {paymentMethod === "Khata"
                  ? "— Select Khata Customer (Required for Udhaar) —"
                  : "— Select Registered Customer (Optional) —"}
              </option>
              {customersQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ""} · Bal: Rs. {Number(c.outstanding_balance).toLocaleString()}
                </option>
              ))}
            </select>
            {selectedCustomerId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerId(null)
                  setCustomerName("")
                  setCustomerPhone("")
                }}
                className="text-xs text-slate-400 hover:text-slate-600 px-1"
                title="Clear selected customer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              className="input-field text-xs"
              placeholder="Customer name (or walk-in)"
              value={customerName}
              onChange={(event) => {
                setCustomerName(event.target.value)
                if (selectedCustomerId) setSelectedCustomerId(null)
              }}
            />
            <input
              className="input-field text-xs font-mono"
              placeholder="Customer mobile / WhatsApp #"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState title="Cart is empty" subtitle="Add products from the search panel." />
        ) : (
          <>
            <div className="max-h-[46vh] overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="th">Item</th>
                    <th className="th text-right">Qty</th>
                    <th className="th text-right">Total</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.product.id}>
                      <td className="td">
                        <p className="font-medium text-slate-900">{item.product.name}</p>
                        <p className="text-xs text-slate-500">{money(item.product.selling_price)} each</p>
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 p-1 hover:bg-slate-100"
                            onClick={() => decrement(item.product.id)}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            className="w-12 rounded-md border border-slate-300 px-1 py-1 text-center text-sm"
                            value={item.quantity}
                            onChange={(event) =>
                              setQuantity(item.product.id, Number(event.target.value.replace(/\D/g, "")) || 0)
                            }
                          />
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 p-1 hover:bg-slate-100"
                            onClick={() => increment(item.product.id)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="td text-right font-semibold text-slate-900">
                        {money(Number(item.product.selling_price) * item.quantity)}
                      </td>
                      <td className="td">
                        <button
                          type="button"
                          className="rounded-md p-1 text-red-500 hover:bg-red-50"
                          onClick={() => removeItem(item.product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total Items</span>
                <span>{cartTotalItems(items)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-700">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Tag className="h-3.5 w-3.5 text-amber-600" />
                  <span className="font-medium">Discount</span>
                  <div className="flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDiscountType("flat")}
                      className={`rounded px-1.5 py-0.5 font-semibold transition ${
                        discountType === "flat" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                      }`}
                    >
                      Rs.
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("percent")}
                      className={`rounded px-1.5 py-0.5 font-semibold transition ${
                        discountType === "percent" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    className="w-18 rounded border border-slate-300 px-2 py-0.5 text-right font-mono text-xs focus:border-amber-500 focus:outline-hidden"
                    placeholder={discountType === "flat" ? "0" : "0%"}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                  />
                  {discountAmount > 0 ? (
                    <span className="font-mono text-xs font-semibold text-rose-600">
                      -{money(discountAmount)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex justify-between text-base font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Grand Total</span>
                <span className="text-emerald-700">{money(finalTotal)}</span>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-3">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map((pm) => {
                  const Icon = pm.icon
                  const isSelected = paymentMethod === pm.id
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 px-1 text-xs font-medium transition ${
                        isSelected
                          ? "border-slate-800 bg-slate-900 text-white shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{pm.label}</span>
                    </button>
                  )
                })}
              </div>

              {paymentMethod === "Cash" && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-slate-600">Cash Received:</label>
                    <div className="relative w-36">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">Rs.</span>
                      <input
                        className="input-field py-1 pl-8 text-right text-xs bg-white font-mono"
                        placeholder={finalTotal.toString()}
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  </div>
                  {numCash > 0 && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="font-semibold text-slate-700">Change Due:</span>
                      <span className={`font-mono font-bold ${numCash >= finalTotal ? "text-emerald-600" : "text-amber-600"}`}>
                        {numCash >= finalTotal ? money(changeDue) : `Short Rs. ${(finalTotal - numCash).toLocaleString()}`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === "Split" && (
                <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-900">Split Multi-Tender</span>
                    <button
                      type="button"
                      onClick={() => {
                        const half = Math.floor(finalTotal / 2)
                        setSplitAmount1(half.toString())
                        setSplitAmount2((finalTotal - half).toString())
                      }}
                      className="text-[11px] font-medium text-indigo-700 hover:underline"
                    >
                      50/50 Split
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="input-field text-xs py-1 w-28 bg-white"
                      value={splitMethod1}
                      onChange={(e) => setSplitMethod1(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="EasyPaisa">EasyPaisa</option>
                      <option value="JazzCash">JazzCash</option>
                      <option value="Bank">Bank</option>
                    </select>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">Rs.</span>
                      <input
                        className="input-field py-1 pl-8 text-right text-xs bg-white font-mono"
                        placeholder="0"
                        value={splitAmount1}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "")
                          setSplitAmount1(val)
                          const num = parseFloat(val) || 0
                          setSplitAmount2(Math.max(0, subtotal - num).toString())
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="input-field text-xs py-1 w-28 bg-white"
                      value={splitMethod2}
                      onChange={(e) => setSplitMethod2(e.target.value)}
                    >
                      <option value="EasyPaisa">EasyPaisa</option>
                      <option value="JazzCash">JazzCash</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Bank">Bank</option>
                    </select>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">Rs.</span>
                      <input
                        className="input-field py-1 pl-8 text-right text-xs bg-white font-mono"
                        placeholder="0"
                        value={splitAmount2}
                        onChange={(e) => setSplitAmount2(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-indigo-200">
                    <span className="text-slate-600">Total Tendered:</span>
                    <span className={`font-mono font-bold ${Math.abs(splitDiff) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}>
                      Rs. {splitTotal.toLocaleString()} {Math.abs(splitDiff) < 0.01 ? "✓" : `(Diff: Rs. ${splitDiff.toLocaleString()})`}
                    </span>
                  </div>
                </div>
              )}

              {paymentMethod === "Khata" && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                    <BookOpen className="h-4 w-4 text-amber-600" />
                    <span>Khata (Udhaar / Credit) Sale</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    This bill will be added to the customer's ledger as outstanding balance. You can record payments later in{" "}
                    <strong>Customers &amp; Khata</strong>.
                  </p>
                  {selectedCustomerId ? (
                    <div className="rounded-md bg-white border border-amber-200 p-2 text-slate-800">
                      <span className="font-semibold">Selected:</span>{" "}
                      {customersQuery.data?.find((c) => c.id === selectedCustomerId)?.name}{" "}
                      <span className="text-slate-500">
                        (Current Udhaar:{" "}
                        <strong className="text-rose-600">
                          {money(
                            customersQuery.data?.find((c) => c.id === selectedCustomerId)
                              ?.outstanding_balance ?? 0
                          )}
                        </strong>
                        )
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-md bg-rose-50 border border-rose-200 p-2 text-rose-700 font-semibold">
                      ⚠ Please select a registered Khata Customer in the dropdown above.
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          className="btn-primary mt-4 w-full py-3 text-base"
          disabled={items.length === 0 || checkoutMutation.isPending}
          onClick={() => checkoutMutation.mutate()}
        >
          {checkoutMutation.isPending ? "Processing…" : "Complete Sale & Print Bill"}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          Stock is verified server-side at checkout.
        </p>
      </section>

      {completedSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="card relative flex w-full max-w-md flex-col overflow-hidden p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Sale Completed!</h3>
              <p className="font-mono text-sm font-semibold text-slate-600 mt-0.5">
                {completedSale.transaction_code}
              </p>
              <p className="text-2xl font-extrabold text-slate-900 mt-2">
                {money(completedSale.total_revenue)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {completedSale.items.length} items · {completedSale.customer_name || "Walk-in Customer"}
              </p>
            </div>

            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5">
              <span className="block text-xs font-semibold text-emerald-800 mb-2">
                Customer WhatsApp Receipt
              </span>
              <div className="flex gap-2">
                <input
                  className="input-field text-xs bg-white"
                  placeholder="Mobile # (e.g. 03001234567)"
                  value={completedPhone}
                  onChange={(e) => setCompletedPhone(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(completedSale, completedPhone)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Send</span>
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-emerald-700/80">
                Opens WhatsApp with pre-filled items summary and receipt link.
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => handlePrintPdf(completedSale)}
                className="btn-secondary flex-1 py-2.5 text-xs"
              >
                <Printer className="h-4 w-4" />
                <span>Print PDF Bill</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompletedSale(null)
                  setCompletedPhone("")
                }}
                className="btn-primary flex-1 py-2.5 text-xs"
                autoFocus
              >
                <span>New Sale (Ready)</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
