import { useMutation, useQuery } from "@tanstack/react-query"
import {
  BookOpen,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ShoppingCart,
  ShoppingBag,
  Store,
  Sun,
  Tags,
  Truck,
  Users,
  X,
} from "lucide-react"
import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import type { LucideIcon } from "lucide-react"

import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"
import { useUiStore } from "@/stores/uiStore"

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard",      label: "Dashboard",        icon: LayoutDashboard, adminOnly: true },
  { to: "/pos",            label: "Point of Sale",    icon: ShoppingCart },
  { to: "/sales",          label: "Sales History",    icon: ReceiptText },
  { to: "/customers",      label: "Customers & Khata",icon: BookOpen },
  { to: "/products",       label: "Products",         icon: Package },
  { to: "/categories",     label: "Categories",       icon: Tags },
  { to: "/suppliers",      label: "Suppliers",        icon: Truck,          adminOnly: true },
  { to: "/purchases",      label: "Purchases",        icon: ShoppingBag,    adminOnly: true },
  { to: "/reports",        label: "Reports",          icon: FileBarChart,   adminOnly: true },
  { to: "/settings/users", label: "Users",            icon: Users,          adminOnly: true },
  { to: "/catalog",        label: "Store Catalog",    icon: Store },
]

export function Layout() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clear = useAuthStore((state) => state.clear)
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const darkMode = useUiStore((state) => state.darkMode)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const toggleDarkMode = useUiStore((state) => state.toggleDarkMode)
  const [mobileOpen, setMobileOpen] = useState(false)

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/analytics/dashboard")).data as { low_stock_count: number },
    staleTime: 60_000,
  })
  const lowStockCount = dashboardQuery.data?.low_stock_count ?? 0

  const logoutMutation = useMutation({
    mutationFn: async () => { await api.post("/auth/logout") },
    onSettled: () => {
      clear()
      toast.success("Logged out.")
      navigate("/login", { replace: true })
    },
  })

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin")

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {visibleItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onClick}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-900"
            }`
          }
          title={collapsed ? item.label : undefined}
        >
          <item.icon className="h-5 w-5 shrink-0" />
          {!collapsed ? <span>{item.label}</span> : null}
          {item.to === "/products" && lowStockCount > 0 && !collapsed ? (
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
              {lowStockCount}
            </span>
          ) : null}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-zinc-950">

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`sticky top-0 hidden lg:flex h-screen flex-col border-r border-slate-200 bg-white transition-all dark:border-zinc-800 dark:bg-black ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-zinc-800 bg-black px-4">
          <ShoppingBag className="h-6 w-6 shrink-0 text-emerald-500" />
          {!collapsed ? <span className="truncate text-sm font-bold text-white">MIGOS ENTERPRISE</span> : null}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          <NavLinks />
        </nav>
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex items-center gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 hover:bg-slate-100 dark:border-zinc-800 dark:text-slate-400 dark:hover:bg-zinc-900"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </aside>

      {/* ── Mobile Drawer Overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden dark:bg-black/70"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile Drawer ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:hidden dark:border-zinc-800 dark:bg-black ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-zinc-800 bg-black px-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-emerald-500" />
            <span className="text-sm font-bold text-white">MIGOS ENTERPRISE</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-zinc-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          <NavLinks onClick={() => setMobileOpen(false)} />
        </nav>
        <div className="border-t border-slate-200 p-3 dark:border-zinc-800">
          <div className="mb-2 px-2">
            <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.full_name ?? user?.username}</p>
            <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{user?.role}</p>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* ── Top Header ── */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-800 bg-black px-4">
          {/* Mobile menu button */}
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-zinc-900 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <p className="hidden text-sm font-medium text-slate-400 lg:block">
            Centralized Shop &amp; Inventory Management
          </p>
          <p className="text-sm font-bold text-white lg:hidden">MIGOS ENTERPRISE</p>

          <div className="flex items-center gap-2 lg:gap-3">
            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="rounded-lg p-2 text-slate-400 hover:bg-zinc-900 hover:text-white"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="hidden text-right lg:block">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.full_name ?? user?.username}</p>
              <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{user?.role}</p>
            </div>
            <button
              type="button"
              className="btn-secondary dark:border-slate-600 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-slate-600"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-3 sm:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}






