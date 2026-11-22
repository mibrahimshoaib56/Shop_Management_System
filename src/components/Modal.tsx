import { X } from "lucide-react"
import type { ReactNode } from "react"

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export function Modal({ open, title, onClose, children, wide = false }: ModalProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 sm:items-start sm:p-4 sm:pt-16"
      onClick={onClose}
    >
      <div
        className={`card w-full rounded-b-none sm:rounded-xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} p-4 sm:p-5 max-h-[92vh] overflow-y-auto`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
