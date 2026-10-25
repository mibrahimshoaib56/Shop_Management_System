import { ArrowRight, Building2, ShieldCheck, ShoppingCart, Store } from "lucide-react"
import { Link } from "react-router-dom"

import { useAuthStore } from "@/stores/authStore"

export function LandingPage() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-100">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-white">
                Shop &amp; Inventory Management
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/catalog"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              Customer Catalog
            </Link>

            {token ? (
              <Link
                to={user?.role === "admin" ? "/dashboard" : "/pos"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-white"
              >
                <span>Backoffice</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
              >
                <span>Staff Sign In</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-5xl">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Select Your Portal
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Please choose a portal to proceed.
            </p>
          </div>

          {/* 3 Clean, Professional Portal Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* 1. Admin */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-6 transition duration-200 hover:border-slate-700 hover:bg-slate-800/70">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700 mb-4">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-white">Store Admin</h2>
                <p className="mt-1 text-xs text-slate-400">Management &amp; Analytics</p>
              </div>

              <div className="mt-8">
                <Link
                  to="/login?role=admin"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-slate-700"
                >
                  <span>Enter Admin Portal</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* 2. Cashier */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-6 transition duration-200 hover:border-slate-700 hover:bg-slate-800/70">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700 mb-4">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-white">Cashier Station</h2>
                <p className="mt-1 text-xs text-slate-400">Point of Sale &amp; Billing</p>
              </div>

              <div className="mt-8">
                <Link
                  to="/login?role=cashier"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-slate-700"
                >
                  <span>Open POS Terminal</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* 3. Customer */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-6 transition duration-200 hover:border-slate-700 hover:bg-slate-800/70">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700 mb-4">
                  <Store className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-white">Customer Storefront</h2>
                <p className="mt-1 text-xs text-slate-400">Catalog &amp; Receipts</p>
              </div>

              <div className="mt-8">
                <Link
                  to="/catalog"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-sky-500"
                >
                  <span>Browse Storefront</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
