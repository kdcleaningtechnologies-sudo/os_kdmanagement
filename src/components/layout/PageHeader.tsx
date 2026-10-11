import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight break-words text-ink-950 sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-600">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center [&>button]:w-full sm:[&>button]:w-auto">{action}</div> : null}
    </div>
  )
}
