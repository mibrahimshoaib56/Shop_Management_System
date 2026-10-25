import { useMutation } from "@tanstack/react-query"
import { ArrowLeft, Building2, ShieldCheck, ShoppingCart, Store } from "lucide-react"
import { useState } from "react"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

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

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<AuthResponse>("/auth/login", { username, password })
      return response.data
    },
    onSuccess: (data) => {
      setSession(data.access_token, data.user)
      toast.success(`Welcome back, ${data.user.full_name ?? data.user.username}!`)

      const nextParam = searchParams.get("next")
      if (data.user.role === "admin") {
        navigate(nextParam ?? "/dashboard", { replace: true })
      } else {
        navigate(nextParam && nextParam !== "/dashboard" ? nextParam : "/pos", { replace: true })
      }
    },
  })

  if (token) {
    return <Navigate to={currentUser?.role === "admin" ? "/dashboard" : "/pos"} replace />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 text-slate-100">
      {/* Top back navigation */}
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
          Customer Storefront →
        </Link>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-800/40 p-6 sm:p-7 shadow-lg">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
            {selectedRole === "admin" ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <ShoppingCart className="h-5 w-5" />
            )}
          </div>
          <h1 className="text-lg font-bold text-white">
            {selectedRole === "admin" ? "Store Admin Login" : "Cashier Station Login"}
          </h1>
          <p className="text-xs text-slate-400">
            Enter your credentials to access the system
          </p>
        </div>

        {/* Role Toggle Tabs */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-900/80 p-1 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setSelectedRole("admin")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${
              selectedRole === "admin"
                ? "bg-slate-800 text-white shadow-xs border border-slate-700"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Store Admin</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("cashier")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${
              selectedRole === "cashier"
                ? "bg-slate-800 text-white shadow-xs border border-slate-700"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Cashier</span>
          </button>
        </div>

        {/* Login Form */}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            loginMutation.mutate()
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Username
            </label>
            <input
              className="input-field border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:border-sky-500"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="Username"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Password
            </label>
            <input
              type="password"
              className="input-field border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:border-sky-500"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Signing In…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  )
}
