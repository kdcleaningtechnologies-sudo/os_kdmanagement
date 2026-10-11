import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border border-sand-100 bg-white shadow-[0_1px_2px_rgba(7,36,34,0.04)] ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
