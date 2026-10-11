import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  title,
  open,
  onClose,
  children,
  wide = false,
}: {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 p-0 sm:items-center sm:p-3">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div
        className={`relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-5 ${wide ? 'max-w-3xl' : 'max-w-lg'} pb-[max(1rem,env(safe-area-inset-bottom))]`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-500 hover:bg-sand-50 hover:text-ink-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
