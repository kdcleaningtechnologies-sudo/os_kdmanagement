export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{message}</p>
}
