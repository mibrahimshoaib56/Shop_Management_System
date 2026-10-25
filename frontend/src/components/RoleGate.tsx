import type { ReactNode } from "react"
import { ShieldAlert, ShoppingCart } from "lucide-react"
import { Link } from "react-router-dom"

import { useAuthStore } from "@/stores/authStore"

interface RoleGateProps {
  children: ReactNode
}

export function RoleGate({ children }: RoleGateProps) {
  const user = useAuthStore((state) => state.user)

  if (user?.role !== "admin") {
    return (
      <div className="card mx-auto max-w-lg flex flex-col items-center gap-3 p-10 text-center my-8">
        <div className="rounded-full bg-amber-50 p-3 text-amber-500 ring-8 ring-amber-50/50">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Admin Privileges Required</h3>
        <p className="text-sm text-slate-500">
          This area is restricted to Store Owners and Administrators. Cashiers can continue using the Point of Sale terminal.
        </p>
        <Link to="/pos" className="btn-primary mt-2">
          <ShoppingCart className="h-4 w-4" />
          <span>Go to POS Terminal</span>
        </Link>
      </div>
    )
  }
  return <>{children}</>
}
