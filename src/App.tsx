import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"

import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { queryClient } from "@/lib/queryClient"
import { CategoriesPage } from "@/pages/CategoriesPage"
import { CustomerCatalogPage } from "@/pages/CustomerCatalogPage"
import { CustomersPage } from "@/pages/CustomersPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { LandingPage } from "@/pages/LandingPage"
import { LoginPage } from "@/pages/LoginPage"
import { NotFoundPage } from "@/pages/NotFoundPage"
import { PosPage } from "@/pages/PosPage"
import { ProductsPage } from "@/pages/ProductsPage"
import { PurchasesPage } from "@/pages/PurchasesPage"
import { ReportsPage } from "@/pages/ReportsPage"
import { SalesPage } from "@/pages/SalesPage"
import { SuppliersPage } from "@/pages/SuppliersPage"
import { UsersPage } from "@/pages/UsersPage"

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* 3-Portal Welcome / Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Customer Storefront & Public Invoices */}
          <Route path="/catalog" element={<CustomerCatalogPage />} />

          {/* Authentication */}
          <Route path="/login" element={<LoginPage />} />

          {/* Staff Backoffice (Protected) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/purchases" element={<PurchasesPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings/users" element={<UsersPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
