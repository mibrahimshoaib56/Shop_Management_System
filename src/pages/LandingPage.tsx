import { ArrowRight, Moon, ShoppingBag, Store, Sun, Zap } from "lucide-react"
import { Link } from "react-router-dom"

import { useAuthStore } from "@/stores/authStore"
import { useUiStore } from "@/stores/uiStore"

export function LandingPage() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const darkMode = useUiStore((state) => state.darkMode)
  const toggleDarkMode = useUiStore((state) => state.toggleDarkMode)

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
            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

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
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} InventoryXYZ — All rights reserved
      </footer>
    </div>
  )
}
