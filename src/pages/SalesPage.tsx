import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Printer, RotateCcw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { Paginated, RefundPayload, Sale, SaleDetail } from "@/types/api"

import { EmptyState } from "@/components/EmptyState"
import { ErrorPanel } from "@/components/ErrorPanel"
import { Modal } from "@/components/Modal"
import { Pagination } from "@/components/Pagination"
import { SearchInput } from "@/components/SearchInput"
import { Spinner } from "@/components/Spinner"
import { api } from "@/lib/api"
import { downloadBlobResponse } from "@/lib/file"
import { formatDate, money } from "@/lib/format"
import { useAuthStore } from "@/stores/authStore"

const QUICK_REASONS = [
  "Defective / Damaged Item",
  "Wrong Item / Variant",
  "Customer Return / Mind Change",
  "Expired Product",
  "Billing / Scanning Error",
]

function StatusBadge({ status }: { status?: string; refundAmount?: number | string }) {
  if (status === "refunded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
        <RotateCcw className="h-3 w-3" />
        Refunded
      </span>
    )
  }
  if (status === "partially_refunded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
        <RotateCcw className="h-3 w-3" />
        Part. Refunded
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      Completed
    </span>
  )
}

function RefundModal({
  sale,
  onClose,
  onSuccess,
}: {
  sale: SaleDetail
  onClose: () => void
  onSuccess: () => void
}) {
  const [mode, setMode] = useState<"full" | "partial">("full")
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>({})
  const [reason, setReason] = useState("")

  const queryClient = useQueryClient()

  const eligibleItems = (sale.items || []).filter((item) => {
    const rem = item.quantity - (item.returned_quantity || 0)
    return rem > 0
  })

  let totalRefundCalculated = 0
  if (mode === "full") {
    totalRefundCalculated = eligibleItems.reduce((acc, it) => {
      const rem = it.quantity - (it.returned_quantity || 0)
      return acc + rem * Number(it.unit_selling_price)
    }, 0)
  } else {
    totalRefundCalculated = eligibleItems.reduce((acc, it) => {
      const qty = returnQtys[it.product_id] || 0
      return acc + qty * Number(it.unit_selling_price)
    }, 0)
  }

  const refundMutation = useMutation({
    mutationFn: async () => {
      const chosenReason = reason.trim()
      if (!chosenReason) {
        throw new Error("Please specify or select a reason for the return.")
      }

      let payload: RefundPayload
      if (mode === "full") {
        payload = { reason: chosenReason }
      } else {
        const itemsToReturn = eligibleItems
          .map((it) => ({
            product_id: it.product_id,
            quantity: returnQtys[it.product_id] || 0,
          }))
          .filter((it) => it.quantity > 0)

        if (itemsToReturn.length === 0) {
          throw new Error("Please specify at least 1 item and quantity to return.")
        }
        payload = { reason: chosenReason, items: itemsToReturn }
      }

      const res = await api.post<SaleDetail>(`/sales/${sale.id}/refund`, payload)
      return res.data
    },
    onSuccess: () => {
      toast.success(
        `Refund processed successfully! Rs. ${Number(totalRefundCalculated).toLocaleString()} refunded & stock restored.`
      )
      queryClient.invalidateQueries({ queryKey: ["sales"] })
      queryClient.invalidateQueries({ queryKey: ["sale", sale.id] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      onSuccess()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to process refund."
      toast.error(msg)
    },
  })

  return (
    <Modal open title={`Process Return / Refund — ${sale.transaction_code}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-900">{sale.customer_name || "Walk-in Customer"}</span> ·{" "}
              <span>Original Total: {money(sale.total_revenue)}</span>
            </div>
            <span className="font-medium text-slate-500">Method: {sale.payment_method || "Cash"}</span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Return Scope</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("full")}
              className={`rounded-lg border p-2.5 text-left text-xs font-medium transition ${
                mode === "full"
                  ? "border-amber-500 bg-amber-50/50 text-amber-900 ring-1 ring-amber-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="block font-semibold">1-Click Full Return</span>
              <span className="text-[11px] text-slate-500">Return all remaining eligible items in this bill</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("partial")}
              className={`rounded-lg border p-2.5 text-left text-xs font-medium transition ${
                mode === "partial"
                  ? "border-amber-500 bg-amber-50/50 text-amber-900 ring-1 ring-amber-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="block font-semibold">Partial Return</span>
              <span className="text-[11px] text-slate-500">Choose specific products and quantities</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="th py-2">Item</th>
                <th className="th py-2 text-right">Sold Qty</th>
                <th className="th py-2 text-right">Eligible</th>
                <th className="th py-2 text-right">Unit Price</th>
                {mode === "partial" ? <th className="th py-2 text-right">Qty to Return</th> : null}
                <th className="th py-2 text-right">Refund Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eligibleItems.map((it) => {
                const eligible = it.quantity - (it.returned_quantity || 0)
                const currentQty = mode === "full" ? eligible : returnQtys[it.product_id] || 0
                const lineRefund = currentQty * Number(it.unit_selling_price)
                return (
                  <tr key={it.id}>
                    <td className="td py-2">
                      <p className="font-medium text-slate-900">{it.product_name ?? `#${it.product_id}`}</p>
                      <p className="text-[11px] text-slate-400">{it.product_sku ?? "-"}</p>
                    </td>
                    <td className="td py-2 text-right">{it.quantity}</td>
                    <td className="td py-2 text-right font-medium text-emerald-700">{eligible}</td>
                    <td className="td py-2 text-right">{money(it.unit_selling_price)}</td>
                    {mode === "partial" ? (
                      <td className="td py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          max={eligible}
                          className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-right font-mono text-xs focus:border-amber-500 focus:outline-hidden"
                          value={returnQtys[it.product_id] ?? 0}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(eligible, Number(e.target.value) || 0))
                            setReturnQtys((prev) => ({ ...prev, [it.product_id]: val }))
                          }}
                        />
                      </td>
                    ) : null}
                    <td className="td py-2 text-right font-semibold text-slate-900">{money(lineRefund)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Return Reason (Required)</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-md border px-2 py-1 text-[11px] transition ${
                  reason === r
                    ? "border-amber-500 bg-amber-50 font-semibold text-amber-800"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            className="input-field text-xs"
            placeholder="Or type custom return notes/reason…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <div>
            <span className="text-xs text-slate-500">Total Refund to Customer:</span>
            <p className="text-lg font-bold text-rose-600">{money(totalRefundCalculated)}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-500 disabled:opacity-50"
              disabled={totalRefundCalculated <= 0 || refundMutation.isPending || !reason.trim()}
              onClick={() => refundMutation.mutate()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{refundMutation.isPending ? "Processing…" : "Confirm Refund & Restore Stock"}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function usePrintPdf(saleId: number | null) {
  const [pending, setPending] = useState(false)

  const print = async () => {
    if (saleId === null) return
    setPending(true)
    try {
      const response = await api.get<Blob>(`/sales/${saleId}/pdf`, { responseType: "blob" })
      downloadBlobResponse(response, `Invoice_sale_${saleId}.pdf`)
    } finally {
      setPending(false)
    }
  }

  return { mutate: print, isPending: pending }
}

function SaleDetailModal({ saleId, onClose }: { saleId: number; onClose: () => void }) {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === "admin"
  const [showRefundModal, setShowRefundModal] = useState(false)

  const detailQuery = useQuery({
    queryKey: ["sale", saleId],
    queryFn: async () => (await api.get<SaleDetail>(`/sales/${saleId}`)).data,
  })

  const printMutation = usePrintPdf(saleId)

  const isFullyRefunded = detailQuery.data?.status === "refunded"
  const refundAmount = Number(detailQuery.data?.refund_amount || 0)

  return (
    <>
      <Modal
        open
        title={detailQuery.data ? `Sale ${detailQuery.data.transaction_code}` : "Sale details"}
        onClose={onClose}
        wide
      >
        {detailQuery.isLoading ? (
          <Spinner />
        ) : detailQuery.isError || !detailQuery.data ? (
          <ErrorPanel onRetry={() => detailQuery.refetch()} />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 text-sm text-slate-600 sm:grid-cols-4">
              <div>
                <span className="text-slate-400">Customer:</span>
                <p className="font-medium text-slate-900">{detailQuery.data.customer_name ?? "Walk-in Customer"}</p>
              </div>
              <div>
                <span className="text-slate-400">Date:</span>
                <p className="font-medium text-slate-900">{formatDate(detailQuery.data.sale_date)}</p>
              </div>
              <div>
                <span className="text-slate-400">Payment:</span>
                <p className="font-medium text-slate-900">
                  {detailQuery.data.payment_method || "Cash"}
                  {detailQuery.data.payment_split ? ` (${detailQuery.data.payment_split})` : ""}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>
                <div className="mt-0.5">
                  <StatusBadge status={detailQuery.data.status} refundAmount={detailQuery.data.refund_amount} />
                </div>
              </div>
            </div>

            {refundAmount > 0 && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <RotateCcw className="h-4 w-4 text-rose-600" />
                    <span>Refunded Amount: {money(refundAmount)}</span>
                  </div>
                  {detailQuery.data.refunded_at && (
                    <span className="text-rose-700/80">{formatDate(detailQuery.data.refunded_at)}</span>
                  )}
                </div>
                {detailQuery.data.refund_reason && (
                  <p className="mt-1 text-rose-700">Reason: {detailQuery.data.refund_reason}</p>
                )}
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Item</th>
                    <th className="th">SKU</th>
                    <th className="th text-right">Qty</th>
                    <th className="th text-right">Unit Price</th>
                    <th className="th text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailQuery.data.items.map((item) => (
                    <tr key={item.id}>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{item.product_name ?? `#${item.product_id}`}</span>
                          {(item.returned_quantity || 0) > 0 && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                              {item.returned_quantity} returned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td text-slate-500">{item.product_sku ?? "-"}</td>
                      <td className="td text-right">{item.quantity}</td>
                      <td className="td text-right">{money(item.unit_selling_price)}</td>
                      <td className="td text-right font-medium">{money(item.line_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm">
              <div className="flex items-center gap-4">
                {isAdmin ? (
                  <span className="font-medium text-emerald-700">
                    Net Profit: {money(detailQuery.data.total_profit)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Total Items: {detailQuery.data.items.length}</span>
                )}
                <span className="font-bold text-slate-900">Total: {money(detailQuery.data.total_revenue)}</span>
              </div>

              <div className="flex items-center gap-2">
                {!isFullyRefunded && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                    onClick={() => setShowRefundModal(true)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Process Return / Refund
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => printMutation.mutate()}
                  disabled={printMutation.isPending}
                >
                  <Printer className="h-4 w-4" />
                  Print PDF
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>

      {showRefundModal && detailQuery.data ? (
        <RefundModal
          sale={detailQuery.data}
          onClose={() => setShowRefundModal(false)}
          onSuccess={() => {
            setShowRefundModal(false)
            detailQuery.refetch()
          }}
        />
      ) : null}
    </>
  )
}

export function SalesPage() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === "admin"

  const [q, setQ] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [page, setPage] = useState(1)
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null)

  const salesQuery = useQuery({
    queryKey: ["sales", q, startDate, endDate, page],
    queryFn: async () =>
      (
        await api.get<Paginated<Sale>>("/sales", {
          params: {
            q: q.trim() || undefined,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            page,
            page_size: 10,
          },
        })
      ).data,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Sales History</h1>
        <span className="text-xs text-slate-500">
          Click any transaction to view line items, print receipt, or process customer returns.
        </span>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-[220px] flex-1">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v)
              setPage(1)
            }}
            placeholder="Search by transaction code or customer…"
          />
        </div>
        <input
          type="date"
          className="input-field w-auto"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value)
            setPage(1)
          }}
        />
        <span className="text-sm text-slate-400">to</span>
        <input
          type="date"
          className="input-field w-auto"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {salesQuery.isLoading ? (
        <Spinner />
      ) : salesQuery.isError ? (
        <ErrorPanel onRetry={() => salesQuery.refetch()} />
      ) : !salesQuery.data || salesQuery.data.items.length === 0 ? (
        <EmptyState title="No sales found" subtitle="Completed transactions will appear here." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Transaction</th>
                <th className="th">Date</th>
                <th className="th">Customer</th>
                <th className="th">Status</th>
                <th className="th text-right">Revenue</th>
                {isAdmin ? <th className="th text-right">Profit</th> : null}
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesQuery.data.items.map((sale) => (
                <tr
                  key={sale.id}
                  className="cursor-pointer hover:bg-sky-50 transition"
                  onClick={() => setSelectedSaleId(sale.id)}
                >
                  <td className="td font-medium text-slate-900">{sale.transaction_code}</td>
                  <td className="td whitespace-nowrap text-slate-500">{formatDate(sale.sale_date)}</td>
                  <td className="td">{sale.customer_name ?? "Walk-in Customer"}</td>
                  <td className="td">
                    <StatusBadge status={sale.status} refundAmount={sale.refund_amount} />
                  </td>
                  <td className="td text-right font-medium">{money(sale.total_revenue)}</td>
                  {isAdmin ? <td className="td text-right text-emerald-700">{money(sale.total_profit)}</td> : null}
                  <td className="td text-right">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedSaleId(sale.id)
                      }}
                      title="View details & returns"
                    >
                      Details &amp; Returns
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={salesQuery.data.page}
            pages={salesQuery.data.pages}
            total={salesQuery.data.total}
            onChange={setPage}
          />
        </div>
      )}

      {selectedSaleId !== null ? (
        <SaleDetailModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
      ) : null}
    </div>
  )
}
