import type { ReactNode } from 'react'
import { Card } from './Card'

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight break-words text-ink-950 sm:text-3xl">{value}</p>
          {hint ? <p className="mt-1 text-xs text-ink-600">{hint}</p> : null}
        </div>
        {icon ? (
          <div className="rounded-xl bg-tide-50 p-2.5 text-tide-600">{icon}</div>
        ) : null}
      </div>
    </Card>
  )
}
