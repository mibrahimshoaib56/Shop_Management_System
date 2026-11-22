import { useEffect } from "react"
import { RouterProvider, createBrowserRouter } from "react-router-dom"

import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useUiStore } from "@/stores/uiStore"
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

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/catalog", element: <CustomerCatalogPage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { path: "dashboard", element: <DashboardPage /> },
      { path: "pos", element: <PosPage /> },
      { path: "sales", element: <SalesPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "suppliers", element: <SuppliersPage /> },
      { path: "purchases", element: <PurchasesPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings/users", element: <UsersPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
])

export default function App() {
  const darkMode = useUiStore((state) => state.darkMode)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])

  return <RouterProvider router={router} />
}
