import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  DollarSign,
  Edit2,
  FileText,
  HandCoins,
  History,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { Customer, KhataEntry, KhataLedger, KhataSummary } from "@/types/api"

import { EmptyState } from "@/components/EmptyState"
import { ErrorPanel } from "@/components/ErrorPanel"
import { Modal } from "@/components/Modal"
import { Spinner } from "@/components/Spinner"
import { api } from "@/lib/api"
import { formatDate, money } from "@/lib/format"
import { buildKhataReminderMessage, openWhatsAppLink } from "@/lib/whatsapp"
import { useAuthStore } from "@/stores/authStore"

export function CustomersPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === "admin"

  const [search, setSearch] = useState("")
  const [filterBalance, setFilterBalance] = useState<"all" | "debtors" | "clear">("all")

  // Modals state
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [ledgerCustomerId, setLedgerCustomerId] = useState<number | null>(null)
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null)

  // Customer Form state
  const [formName, setFormName] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formAddress, setFormAddress] = useState("")
  const [formNotes, setFormNotes] = useState("")

  // Payment Form state
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")

  // Queries
  const summaryQuery = useQuery<KhataSummary>({
    queryKey: ["customers-summary"],
    queryFn: async () => (await api.get("/customers/summary")).data,
  })

  const customersQuery = useQuery<Customer[]>({
    queryKey: ["customers", search],
    queryFn: async () =>
      (
        await api.get("/customers", {
          params: { search: search.trim() || undefined, active_only: true },
        })
      ).data,
  })

  // Mutations
  const saveCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!formName.trim()) throw new Error("Customer name is required.")
      const payload = {
        name: formName.trim(),
        phone: formPhone.trim() || null,
        address: formAddress.trim() || null,
        notes: formNotes.trim() || null,
      }
      if (editingCustomer) {
        return (await api.put(`/customers/${editingCustomer.id}`, payload)).data
      } else {
        return (await api.post("/customers", payload)).data
      }
    },
    onSuccess: () => {
      toast.success(editingCustomer ? "Customer updated successfully" : "Customer created successfully")
      setCustomerModalOpen(false)
      setEditingCustomer(null)
      setFormName("")
      setFormPhone("")
      setFormAddress("")
      setFormNotes("")
      void queryClient.invalidateQueries({ queryKey: ["customers"] })
      void queryClient.invalidateQueries({ queryKey: ["customers-summary"] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save customer")
    },
  })

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/customers/${id}`)
    },
    onSuccess: () => {
      toast.success("Customer removed.")
      void queryClient.invalidateQueries({ queryKey: ["customers"] })
      void queryClient.invalidateQueries({ queryKey: ["customers-summary"] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete customer")
    },
  })

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentCustomer) return
      const amount = parseFloat(paymentAmount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid payment amount.")
      }
      return (
        await api.post(`/customers/${paymentCustomer.id}/payment`, {
          amount: amount,
          notes: paymentNotes.trim() || null,
        })
      ).data
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully! Balance updated.")
      setPaymentCustomer(null)
      setPaymentAmount("")
      setPaymentNotes("")
      void queryClient.invalidateQueries({ queryKey: ["customers"] })
      void queryClient.invalidateQueries({ queryKey: ["customers-summary"] })
      if (ledgerCustomerId) {
        void queryClient.invalidateQueries({ queryKey: ["customer-ledger", ledgerCustomerId] })
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to record payment")
    },
  })

  // Helpers
  const handleOpenAdd = () => {
    setEditingCustomer(null)
    setFormName("")
    setFormPhone("")
    setFormAddress("")
    setFormNotes("")
    setCustomerModalOpen(true)
  }

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormName(customer.name)
    setFormPhone(customer.phone || "")
    setFormAddress(customer.address || "")
    setFormNotes(customer.notes || "")
    setCustomerModalOpen(true)
  }

  const handleWhatsAppReminder = (customer: Customer) => {
    if (!customer.phone) {
      toast.error("No phone number saved for this customer.")
      return
    }
    const message = buildKhataReminderMessage(customer)
    openWhatsAppLink(customer.phone, message)
    toast.success(`Opening WhatsApp reminder for ${customer.name}`)
  }

  const filteredCustomers = (customersQuery.data || []).filter((c) => {
    const bal = Number(c.outstanding_balance)
    if (filterBalance === "debtors") return bal > 0
    if (filterBalance === "clear") return bal <= 0
    return true
  })

  const debtorsCount = (customersQuery.data || []).filter((c) => Number(c.outstanding_balance) > 0).length

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-sky-600" />
            Customers &amp; Khata (Udhaar) Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage regular clients, track credit (Udhaar) balances, view transaction history, and send WhatsApp payment reminders.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-4 p-5 border-l-4 border-l-sky-500">
          <div className="rounded-xl bg-sky-50 p-3 text-sky-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Registered Customers</p>
            <p className="text-2xl font-bold text-slate-900">
              {summaryQuery.data?.total_customers ?? customersQuery.data?.length ?? 0}
            </p>
          </div>
        </div>

        <div className="card flex items-center gap-4 p-5 border-l-4 border-l-rose-500">
          <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Outstanding Udhaar</p>
            <p className="text-2xl font-extrabold text-rose-600">
              {money(summaryQuery.data?.total_outstanding ?? 0)}
            </p>
          </div>
        </div>

        <div className="card flex items-center gap-4 p-5 border-l-4 border-l-amber-500">
          <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
            <HandCoins className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Customers with Pending Balance</p>
            <p className="text-2xl font-bold text-amber-700">{debtorsCount}</p>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Search by customer name or mobile number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setFilterBalance("all")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              filterBalance === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({customersQuery.data?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setFilterBalance("debtors")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              filterBalance === "debtors"
                ? "bg-rose-500 text-white shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Has Udhaar ({debtorsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterBalance("clear")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              filterBalance === "clear" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Settled (Rs. 0)
          </button>
        </div>
      </div>

      {/* Customers Table */}
      {customersQuery.isLoading ? (
        <Spinner />
      ) : customersQuery.isError ? (
        <ErrorPanel onRetry={() => customersQuery.refetch()} />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title="No customers found"
          subtitle={search ? `No customer matching "${search}".` : "Add customers to start managing Khata and Udhaar."}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="th">Customer</th>
                <th className="th">Mobile Number</th>
                <th className="th">Address / Notes</th>
                <th className="th text-right">Khata Balance</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredCustomers.map((cust) => {
                const bal = Number(cust.outstanding_balance)
                return (
                  <tr key={cust.id} className="hover:bg-slate-50 transition">
                    <td className="td">
                      <div className="font-semibold text-slate-900">{cust.name}</div>
                      <div className="text-xs text-slate-400">Added {formatDate(cust.created_at)}</div>
                    </td>
                    <td className="td whitespace-nowrap">
                      {cust.phone ? (
                        <div className="flex items-center gap-1.5 font-mono text-slate-700">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span>{cust.phone}</span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-400">No phone</span>
                      )}
                    </td>
                    <td className="td max-w-xs truncate text-slate-600">
                      <div>{cust.address || "—"}</div>
                      {cust.notes && <div className="text-xs italic text-slate-400">{cust.notes}</div>}
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      {bal > 0 ? (
                        <div className="inline-flex flex-col items-end">
                          <span className="font-mono text-base font-bold text-rose-600">
                            {money(bal)}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                            Udhaar Due
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          Clear (Rs. 0)
                        </span>
                      )}
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* WhatsApp Reminder (if has Udhaar & phone) */}
                        {bal > 0 && cust.phone ? (
                          <button
                            type="button"
                            onClick={() => handleWhatsAppReminder(cust)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition ring-1 ring-inset ring-emerald-200"
                            title="Send WhatsApp payment reminder"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Remind</span>
                          </button>
                        ) : null}

                        {/* Record Payment */}
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentCustomer(cust)
                            setPaymentAmount(bal > 0 ? bal.toString() : "")
                            setPaymentNotes("")
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition ring-1 ring-inset ring-sky-200"
                          title="Record Cash In / Payment"
                        >
                          <HandCoins className="h-3.5 w-3.5" />
                          <span>Pay In</span>
                        </button>

                        {/* View Ledger */}
                        <button
                          type="button"
                          onClick={() => setLedgerCustomerId(cust.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                          title="View Ledger Book"
                        >
                          <History className="h-3.5 w-3.5" />
                          <span>Ledger</span>
                        </button>

                        {/* Edit Customer */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cust)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                          title="Edit Customer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        {/* Delete (Admin only) */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${cust.name}?`)) {
                                deleteCustomerMutation.mutate(cust.id)
                              }
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Delete Customer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT CUSTOMER MODAL */}
      {customerModalOpen && (
        <Modal
          open={true}
          title={editingCustomer ? "Edit Customer Details" : "Register New Customer"}
          onClose={() => setCustomerModalOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveCustomerMutation.mutate()
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. Haji Muhammad Aslam"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number (for WhatsApp &amp; Invoices)
              </label>
              <input
                type="tel"
                className="input-field font-mono"
                placeholder="e.g. 03001234567"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Format: 03XXXXXXXXX (used for 1-click WhatsApp receipts and payment reminders)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Address / Location
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Shop # 4, Main Bazar"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                General Notes / Credit Limit
              </label>
              <textarea
                rows={2}
                className="input-field"
                placeholder="e.g. Trusted customer, max credit Rs. 20,000"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setCustomerModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveCustomerMutation.isPending}
                className="btn-primary text-xs"
              >
                {saveCustomerMutation.isPending ? "Saving…" : editingCustomer ? "Update Customer" : "Create Customer"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* RECORD PAYMENT MODAL */}
      {paymentCustomer && (
        <Modal
          open={true}
          title={`Record Payment — ${paymentCustomer.name}`}
          onClose={() => setPaymentCustomer(null)}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Current Outstanding Balance:</span>
                <span className="font-mono text-base font-bold text-rose-600">
                  {money(paymentCustomer.outstanding_balance)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Amount Received (Rs.) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Rs.</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  className="input-field pl-9 font-mono text-base font-semibold"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  autoFocus
                />
              </div>
              {Number(paymentCustomer.outstanding_balance) > 0 && (
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(paymentCustomer.outstanding_balance.toString())}
                    className="text-[11px] font-semibold text-sky-600 hover:underline"
                  >
                    Full Settlement ({money(paymentCustomer.outstanding_balance)})
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method / Note
              </label>
              <input
                type="text"
                className="input-field text-xs"
                placeholder="e.g. Received Cash at shop / EasyPaisa TRX #12345"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setPaymentCustomer(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={recordPaymentMutation.isPending}
                onClick={() => recordPaymentMutation.mutate()}
                className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {recordPaymentMutation.isPending ? "Recording…" : "Save Payment (+ Cash In)"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* CUSTOMER LEDGER MODAL */}
      {ledgerCustomerId && (
        <LedgerModal
          customerId={ledgerCustomerId}
          onClose={() => setLedgerCustomerId(null)}
          onRecordPayment={(customer) => {
            setPaymentCustomer(customer)
            setPaymentAmount(Number(customer.outstanding_balance) > 0 ? customer.outstanding_balance.toString() : "")
            setPaymentNotes("")
          }}
          onWhatsAppReminder={handleWhatsAppReminder}
        />
      )}
    </div>
  )
}

function LedgerModal({
  customerId,
  onClose,
  onRecordPayment,
  onWhatsAppReminder,
}: {
  customerId: number
  onClose: () => void
  onRecordPayment: (customer: Customer) => void
  onWhatsAppReminder: (customer: Customer) => void
}) {
  const ledgerQuery = useQuery<KhataLedger>({
    queryKey: ["customer-ledger", customerId],
    queryFn: async () => (await api.get(`/customers/${customerId}/ledger`)).data,
  })

  if (ledgerQuery.isLoading) {
    return (
      <Modal open={true} title="Customer Ledger" onClose={onClose}>
        <Spinner />
      </Modal>
    )
  }

  if (ledgerQuery.isError || !ledgerQuery.data) {
    return (
      <Modal open={true} title="Customer Ledger" onClose={onClose}>
        <p className="text-sm text-rose-600">Failed to load ledger records.</p>
      </Modal>
    )
  }

  const { customer, entries, total_credit, total_paid, outstanding } = ledgerQuery.data
  const bal = Number(outstanding)

  return (
    <Modal open={true} wide={true} title={`Khata Ledger: ${customer.name}`} onClose={onClose}>
      <div className="space-y-4 max-w-2xl">
        {/* Customer Header & Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase">Total Credit (Udhaar)</span>
            <p className="font-mono text-base font-bold text-slate-900">{money(total_credit)}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase">Total Paid Back</span>
            <p className="font-mono text-base font-bold text-emerald-600">{money(total_paid)}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase">Net Balance Due</span>
            <p className={`font-mono text-lg font-extrabold ${bal > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {money(bal)}
            </p>
          </div>
        </div>

        {/* Quick Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="text-xs text-slate-500">
            {customer.phone && <span className="font-mono">{customer.phone} · </span>}
            {customer.address || "No address specified"}
          </div>
          <div className="flex items-center gap-2">
            {bal > 0 && customer.phone && (
              <button
                type="button"
                onClick={() => onWhatsAppReminder(customer)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>WhatsApp Reminder</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onRecordPayment(customer)}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 transition"
            >
              <HandCoins className="h-3.5 w-3.5" />
              <span>Record Payment</span>
            </button>
          </div>
        </div>

        {/* Entries Table */}
        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
          {entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No transactions recorded yet in this customer's khata.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-100 font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Details / Notes</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const isCredit = entry.entry_type === "credit"
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isCredit ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                            Credit Sale
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            Payment Received
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>{entry.notes || (isCredit ? "Store Purchase" : "Cash Settlement")}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold text-sm">
                        {isCredit ? (
                          <span className="text-rose-600">+{money(entry.amount)}</span>
                        ) : (
                          <span className="text-emerald-600">-{money(entry.amount)}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  )
}
