import { useMutation } from "@tanstack/react-query"
import { ArrowLeft, ShieldCheck, ShoppingCart, ShoppingBag } from "lucide-react"
import { useState } from "react"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"

import type { AuthResponse } from "@/types/api"

import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((state) => state.token)
  const currentUser = useAuthStore((state) => state.user)
  const setSession = useAuthStore((state) => state.setSession)

  const initialRole = searchParams.get("role") === "cashier" ? "cashier" : "admin"
  const [selectedRole, setSelectedRole] = useState<"admin" | "cashier">(initialRole)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [inlineError, setInlineError] = useState<string | null>(null)

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<AuthResponse>("/auth/login", { username, password })
      return response.data
    },
    onSuccess: (data) => {
      // Portal role gate — check if the logged-in role matches selected portal
      if (selectedRole === "admin" && data.user.role !== "admin") {
        setInlineError("You don\'t have admin access. Please use the Cashier portal.")
        return
      }
      if (selectedRole === "cashier" && data.user.role === "admin") {
        setInlineError("Admins must sign in through the Admin portal.")
        return
      }

      setSession(data.access_token, data.user)

      const nextParam = searchParams.get("next")
      if (data.user.role === "admin") {
        navigate(nextParam ?? "/dashboard", { replace: true })
      } else {
        navigate(nextParam && nextParam !== "/dashboard" ? nextParam : "/pos", { replace: true })
      }
    },
    onError: (err: any) => {
      const status = err?.response?.status
      const msg = err?.response?.data?.message || err?.message || ""

      if (status === 429) {
        setInlineError("Too many failed attempts. Please wait 15 minutes and try again.")
      } else if (status === 401) {
        if (msg.toLowerCase().includes("disabled")) {
          setInlineError("Your account has been disabled. Contact your administrator.")
        } else {
          setInlineError("Invalid username or password. Please try again.")
        }
      } else {
        setInlineError("Something went wrong. Please try again.")
      }
    },
  })

  if (token) {
    return <Navigate to={currentUser?.role === "admin" ? "/dashboard" : "/pos"} replace />
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setInlineError(null)
    if (!username.trim() || !password) {
      setInlineError("Please enter both username and password.")
      return
    }
    loginMutation.mutate()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 text-slate-100">

      {/* Top navigation */}
      <div className="mb-6 flex w-full max-w-sm items-center justify-between text-xs">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Portals</span>
        </Link>
        <Link
          to="/catalog"
          className="text-slate-400 transition hover:text-slate-200"
        >
          Customer Storefront
        </Link>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800/50 p-6 shadow-xl sm:p-7">

        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold tracking-tight text-emerald-400">InventoryXYZ</span>
          <h1 className="text-lg font-bold text-white">
            {selectedRole === "admin" ? "Store Admin Login" : "Cashier Station Login"}
          </h1>
          <p className="text-xs text-slate-400">
            Enter your credentials to access the system
          </p>
        </div>

        {/* Role Toggle */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-900/80 p-1 border border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => { setSelectedRole("admin"); setInlineError(null) }}
            className={`flex items-center justify-center gap-1.5 rounded-md py-2 font-medium transition ${
              selectedRole === "admin"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Store Admin</span>
          </button>
          <button
            type="button"
            onClick={() => { setSelectedRole("cashier"); setInlineError(null) }}
            className={`flex items-center justify-center gap-1.5 rounded-md py-2 font-medium transition ${
              selectedRole === "cashier"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Cashier</span>
          </button>
        </div>

        {/* Login Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Username
            </label>
            <input
              className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder-slate-500 bg-slate-800 focus:outline-none focus:ring-2 transition ${
                inlineError
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20"
              }`}
              value={username}
              onChange={(e) => { setUsername(e.target.value); setInlineError(null) }}
              autoComplete="username"
              placeholder="Enter your username"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Password
            </label>
            <input
              type="password"
              className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder-slate-500 bg-slate-800 focus:outline-none focus:ring-2 transition ${
                inlineError
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20"
              }`}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setInlineError(null) }}
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          </div>

          {/* Inline error message */}
          {inlineError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-800 bg-red-950/60 px-3 py-2.5 text-xs text-red-400">
              <span className="mt-0.5 shrink-0">Warning</span>
              <span>{inlineError}</span>
            </div>
          )}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  )
}
