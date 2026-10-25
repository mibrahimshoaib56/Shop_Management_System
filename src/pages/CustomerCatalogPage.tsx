import { useQuery } from "@tanstack/react-query"
import {
  ArrowUpDown,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Layers,
  LogIn,
  MessageCircle,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  X,
  XCircle,
} from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import type { Paginated, PublicCategory, PublicProduct, PublicSale } from "@/types/api"

import { EmptyState } from "@/components/EmptyState"
import { Spinner } from "@/components/Spinner"
import { api } from "@/lib/api"
import { downloadBlobResponse } from "@/lib/file"
import { money } from "@/lib/format"
import { useAuthStore } from "@/stores/authStore"

export function CustomerCatalogPage() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  // Filters state
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sort, setSort] = useState("name")
  const [page, setPage] = useState(1)

  // Invoice lookup state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [phoneInput, setPhoneInput] = useState("")
  const [searchedPhone, setSearchedPhone] = useState<string | null>(null)
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  // Fetch public catalog
  const catalogQuery = useQuery({
    queryKey: ["public-catalog", search, selectedCategory, inStockOnly, sort, page],
    queryFn: async () => {
      const response = await api.get<Paginated<PublicProduct>>("/public/catalog", {
        params: {
          q: search.trim() || undefined,
          category_id: selectedCategory ?? undefined,
          in_stock_only: inStockOnly ? true : undefined,
          sort,
          page,
          page_size: 16,
        },
      })
      return response.data
    },
    staleTime: 30_000,
  })

  // Fetch categories
  const categoriesQuery = useQuery({
    queryKey: ["public-categories"],
    queryFn: async () => {
      const response = await api.get<PublicCategory[]>("/public/categories")
      return response.data
    },
    staleTime: 60_000,
  })

  // Fetch customer invoices by phone
  const invoicesQuery = useQuery({
    queryKey: ["public-invoices", searchedPhone],
    queryFn: async () => {
      if (!searchedPhone) return []
      const response = await api.get<PublicSale[]>("/public/invoices", {
        params: { phone: searchedPhone },
      })
      return response.data
    },
    enabled: Boolean(searchedPhone && searchedPhone.length >= 7),
  })

  const handleSearchPhone = (event?: React.FormEvent) => {
    if (event) event.preventDefault()
    const clean = phoneInput.replace(/\D/g, "")
    if (clean.length < 7) {
      toast.error("Please enter a valid phone number with at least 7 digits.")
      return
    }
    setSearchedPhone(clean)
  }

  const handleDownloadPdf = async (sale: PublicSale) => {
    if (!searchedPhone) return
    try {
      setDownloadingId(sale.id)
      const res = await api.get<Blob>(`/public/invoices/${sale.id}/pdf`, {
        params: { phone: searchedPhone },
        responseType: "blob",
      })
      downloadBlobResponse(res, `Receipt_${sale.transaction_code}.pdf`)
      toast.success(`Receipt for ${sale.transaction_code} downloaded.`)
    } catch {
      toast.error("Could not download receipt. Please check your connection.")
    } finally {
      setDownloadingId(null)
    }
  }

  const createWhatsAppInquiryLink = (product: PublicProduct) => {
    const text = `Hello! I would like to inquire about "${product.name}" (SKU: ${product.sku_code}) listed at ${money(product.selling_price)}. Is it available?`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  const createWhatsAppSupportLink = () => {
    const text = `Hello! I am browsing your store catalog and have a general question.`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3 transition hover:opacity-90">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 sm:text-lg">
                Shop &amp; Retail Store
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Digital Catalog &amp; Customer Portal
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Find My Bills Button */}
            <button
              type="button"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 sm:px-3.5 sm:py-2 sm:text-sm"
            >
              <FileText className="h-4 w-4" />
              <span>Find My Invoices</span>
            </button>

            {/* Quick WhatsApp Support */}
            <a
              href={createWhatsAppSupportLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 md:inline-flex sm:text-sm"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <span>WhatsApp Store</span>
            </a>

            {/* Staff / Admin Login or Dashboard */}
            {token ? (
              <Link
                to={user?.role === "admin" ? "/dashboard" : "/pos"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 sm:px-3.5 sm:py-2 sm:text-sm"
              >
                <Building2 className="h-4 w-4" />
                <span>Go to Work</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 sm:px-3.5 sm:py-2 sm:text-sm"
              >
                <LogIn className="h-4 w-4" />
                <span>Staff Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Welcome Banner */}
      <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-8 text-white sm:px-6 lg:py-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-medium text-sky-300 ring-1 ring-sky-500/30">
                <Sparkles className="h-3.5 w-3.5" /> Live Store Inventory
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                Browse Products &amp; Prices
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-300 sm:text-base">
                Check item availability in real-time, view up-to-date retail prices, or look up your past purchase receipts anytime.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-3 font-medium text-white shadow-lg shadow-sky-500/20 transition hover:opacity-95"
            >
              <FileText className="h-5 w-5" />
              <span>Lookup Your Bill / Receipt</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Search & Filter Bar */}
        <div className="card mb-6 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                className="input-field pl-9 pr-8"
                placeholder="Search products by title or SKU code…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Quick Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* In Stock Only Checkbox */}
              <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 sm:text-sm">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => {
                    setInStockOnly(e.target.checked)
                    setPage(1)
                  }}
                  className="h-4 w-4 rounded-sm border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>In-Stock Only</span>
              </label>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 sm:text-sm">
                <ArrowUpDown className="h-4 w-4 text-slate-400" />
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value)
                    setPage(1)
                  }}
                  className="bg-transparent font-medium text-slate-700 focus:outline-none"
                >
                  <option value="name">Name (A → Z)</option>
                  <option value="-name">Name (Z → A)</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="-created_at">Newest Arrivals</option>
                </select>
              </div>
            </div>
          </div>

          {/* Category Chips */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
              <Filter className="h-3 w-3" /> Categories:
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null)
                setPage(1)
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedCategory === null
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Items
            </button>
            {categoriesQuery.data?.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id === selectedCategory ? null : cat.id)
                  setPage(1)
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  selectedCategory === cat.id
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    selectedCategory === cat.id
                      ? "bg-sky-800 text-sky-100"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {cat.product_count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Catalog Query Loading */}
        {catalogQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : catalogQuery.isError ? (
          <div className="card p-8 text-center">
            <p className="text-red-500">Failed to load the product catalog.</p>
            <button
              type="button"
              onClick={() => catalogQuery.refetch()}
              className="btn-secondary mt-3"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </button>
          </div>
        ) : catalogQuery.data?.items.length === 0 ? (
          <EmptyState
            title="No matching products found"
            subtitle="Try clearing your search keyword or switching the category filter."
          />
        ) : (
          <>
            {/* Products Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {catalogQuery.data?.items.map((product) => {
                const inStock = product.is_in_stock
                return (
                  <div
                    key={product.id}
                    className="card group flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                  >
                    {/* Product Image Area */}
                    <div className="relative aspect-4/3 w-full bg-slate-100">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            // Fallback to placeholder if broken image
                            ;(e.target as HTMLElement).style.display = "none"
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <Package className="h-14 w-14" />
                        </div>
                      )}

                      {/* Stock Badge */}
                      <div className="absolute left-3 top-3">
                        {inStock ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600/90 px-2 py-0.5 text-xs font-semibold text-white shadow-xs backdrop-blur-xs">
                            <CheckCircle2 className="h-3 w-3" /> In Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-600/90 px-2 py-0.5 text-xs font-semibold text-white shadow-xs backdrop-blur-xs">
                            <XCircle className="h-3 w-3" /> Out of Stock
                          </span>
                        )}
                      </div>

                      {/* Category Label */}
                      {product.category_name ? (
                        <div className="absolute bottom-2 right-2">
                          <span className="rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-xs backdrop-blur-xs">
                            {product.category_name}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col p-4">
                      <span className="text-[11px] font-mono text-slate-400">
                        SKU: {product.sku_code}
                      </span>
                      <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-sky-600">
                        {product.name}
                      </h3>

                      {product.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {product.description}
                        </p>
                      ) : null}

                      {/* Price & Action */}
                      <div className="mt-auto pt-3">
                        <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400">
                              Retail Price
                            </span>
                            <p className="text-lg font-extrabold text-slate-900">
                              {money(product.selling_price)}
                            </p>
                          </div>

                          <a
                            href={createWhatsAppInquiryLink(product)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                            title="Inquire about this product on WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Inquire</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {catalogQuery.data && catalogQuery.data.pages > 1 ? (
              <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
                <span className="text-xs text-slate-500">
                  Showing Page {catalogQuery.data.page} of {catalogQuery.data.pages} (
                  {catalogQuery.data.total} total products)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-secondary text-xs"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= catalogQuery.data.pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-secondary text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>

      {/* INVOICE LOOKUP MODAL */}
      {isInvoiceModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="card relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Find My Invoices &amp; Receipts
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enter the mobile number provided at the counter
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Phone search input */}
              <form onSubmit={handleSearchPhone} className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    className="input-field pl-9 font-medium"
                    placeholder="Enter mobile # (e.g. 03001234567)"
                    value={phoneInput}
                    autoFocus
                    onChange={(e) => setPhoneInput(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={phoneInput.trim().length < 7 || invoicesQuery.isFetching}
                  className="btn-primary"
                >
                  {invoicesQuery.isFetching ? <Spinner /> : "Search Bills"}
                </button>
              </form>

              {/* Invoices Result list */}
              <div className="mt-5">
                {invoicesQuery.isFetching ? (
                  <div className="flex h-36 items-center justify-center">
                    <Spinner />
                  </div>
                ) : searchedPhone && invoicesQuery.data?.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                    <FileText className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      No invoices found for this number
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Check that the cashier recorded your number at checkout, or try searching without country code.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoicesQuery.data?.map((invoice) => {
                      const isExpanded = expandedInvoiceId === invoice.id
                      const isDownloading = downloadingId === invoice.id

                      return (
                        <div
                          key={invoice.id}
                          className="rounded-xl border border-slate-200 bg-white shadow-xs transition hover:border-slate-300"
                        >
                          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-slate-900">
                                   {invoice.transaction_code}
                                </span>
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                  {new Date(invoice.sale_date).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {invoice.customer_name || "Customer"} · {invoice.items.length} items
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-base font-extrabold text-slate-900">
                                {money(invoice.total_revenue)}
                              </span>

                              {/* Download Receipt PDF */}
                              <button
                                type="button"
                                onClick={() => handleDownloadPdf(invoice)}
                                disabled={isDownloading}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                title="Download PDF Receipt"
                              >
                                {isDownloading ? (
                                  <Spinner />
                                ) : (
                                  <>
                                    <Download className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Receipt PDF</span>
                                  </>
                                )}
                              </button>

                              {/* Toggle Items */}
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedInvoiceId(isExpanded ? null : invoice.id)
                                }
                                className="text-xs font-medium text-sky-600 hover:underline"
                              >
                                {isExpanded ? "Hide Items" : "View Items"}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Items Drawer */}
                          {isExpanded ? (
                            <div className="border-t border-slate-100 bg-slate-50 p-4">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-400">
                                    <th className="pb-2 text-left font-semibold">Item</th>
                                    <th className="pb-2 text-right font-semibold">Qty</th>
                                    <th className="pb-2 text-right font-semibold">Unit Price</th>
                                    <th className="pb-2 text-right font-semibold">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/50">
                                  {invoice.items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="py-1.5 font-medium text-slate-800">
                                        {item.product_name || "Product"}
                                      </td>
                                      <td className="py-1.5 text-right text-slate-600">
                                        {item.quantity}
                                      </td>
                                      <td className="py-1.5 text-right text-slate-600">
                                        {money(item.unit_selling_price)}
                                      </td>
                                      <td className="py-1.5 text-right font-semibold text-slate-900">
                                        {money(item.line_revenue)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-500">
              <span>Receipts are generated directly from store transactions.</span>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="btn-secondary py-1 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
