export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-600" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-tide-400 border-t-transparent" />
      <span className="text-sm font-medium">{label}…</span>
    </div>
  )
}
