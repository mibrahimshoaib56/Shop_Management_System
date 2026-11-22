import { ArrowRight, Building2, ShoppingBag, Store, Zap, Shield, BarChart3 } from "lucide-react"
import { Link } from "react-router-dom"

import { useAuthStore } from "@/stores/authStore"

export function LandingPage() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-100">

      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-lg">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              InventoryXYZ
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link
              to="/catalog"
              className="hidden sm:inline-flex rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              Customer Catalog
            </Link>

            {token ? (
              <Link
                to={user?.role === "admin" ? "/dashboard" : "/pos"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                <span>Staff Sign In</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-4xl text-center">

          {/* Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950/60 px-4 py-1.5 text-xs font-medium text-emerald-400">
            <Zap className="h-3.5 w-3.5" />
            Smart Shop & Inventory Management
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Welcome to{" "}
            <span className="text-emerald-400">InventoryXYZ</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-slate-400 sm:text-base">
            Everything your shop needs — billing, stock, Khata ledger, supplier orders, and financial analytics — in one place.
          </p>

          {/* Feature pills */}
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
            {["POS Billing", "Khata / Udhaar", "Inventory Tracking", "Supplier Orders", "Sales Reports", "WhatsApp Receipts"].map((f) => (
              <span key={f} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1">
                {f}
              </span>
            ))}
          </div>

          {/* ── Customer Storefront Card ── */}
          <div className="mx-auto mt-12 max-w-sm">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-8 text-center shadow-xl transition hover:border-emerald-700 hover:bg-slate-800">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-700">
                <Store className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold text-white">Customer Storefront</h2>
              <p className="mt-2 text-sm text-slate-400">
                Browse our product catalog, check availability, and look up your receipts by phone number.
              </p>
              <Link
                to="/catalog"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-500 active:scale-95"
              >
                <Store className="h-4 w-4" />
                <span>Browse Storefront</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Staff note */}
          <p className="mt-6 text-xs text-slate-600">
            Are you staff?{" "}
            <Link to="/login" className="text-emerald-500 hover:text-emerald-400 hover:underline">
              Sign in here
            </Link>
          </p>
        </div>

        {/* ── Feature Cards ── */}
        <div className="mx-auto mt-20 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: Zap,       title: "Fast POS Billing",    desc: "Barcode-ready checkout with split payments and instant receipts." },
            { icon: Shield,    title: "Khata Ledger",        desc: "Track udhaar, record payments, and monitor outstanding balances." },
            { icon: BarChart3, title: "Financial Analytics", desc: "Real-time revenue, profit, and inventory value at a glance." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-800 bg-slate-800/30 p-5">
              <f.icon className="mb-3 h-5 w-5 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} InventoryXYZ — All rights reserved
      </footer>
    </div>
  )
}
