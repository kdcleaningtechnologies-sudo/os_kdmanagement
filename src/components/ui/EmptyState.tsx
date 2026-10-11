import type { ReactNode } from 'react'

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-sand-100 bg-white px-6 py-12 text-center">
      <p className="font-semibold text-ink-900">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
