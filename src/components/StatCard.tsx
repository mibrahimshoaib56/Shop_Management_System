import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  tone?: "default" | "warning" | "success"
}

const toneClasses = {
  default: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
}

export function StatCard({ label, value, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <div className="card flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 ${toneClasses[tone]}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
        <p className="truncate text-base font-semibold text-slate-900 sm:text-xl">{value}</p>
      </div>
    </div>
  )
}
