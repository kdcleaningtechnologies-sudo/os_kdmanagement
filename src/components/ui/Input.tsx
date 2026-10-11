import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type FieldProps = {
  label?: string
  error?: string
  hint?: string
}

export function Input({
  label,
  error,
  hint,
  className = '',
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const inputId = id ?? props.name
  return (
    <label className="block space-y-1.5" htmlFor={inputId}>
      {label ? <span className="text-sm font-medium text-ink-800">{label}</span> : null}
      <input
        id={inputId}
        className={`w-full max-w-full rounded-xl border border-sand-100 bg-sand-50 px-3.5 py-2.5 text-base text-ink-900 outline-none transition placeholder:text-ink-500/60 focus:border-tide-400 focus:bg-white focus:ring-4 focus:ring-tide-100 md:text-sm ${className}`}
        {...props}
      />
      {hint ? <span className="text-xs text-ink-600">{hint}</span> : null}
      {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  )
}

export function Textarea({
  label,
  error,
  hint,
  className = '',
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const inputId = id ?? props.name
  return (
    <label className="block space-y-1.5" htmlFor={inputId}>
      {label ? <span className="text-sm font-medium text-ink-800">{label}</span> : null}
      <textarea
        id={inputId}
        className={`min-h-24 w-full max-w-full rounded-xl border border-sand-100 bg-sand-50 px-3.5 py-2.5 text-base text-ink-900 outline-none transition placeholder:text-ink-500/60 focus:border-tide-400 focus:bg-white focus:ring-4 focus:ring-tide-100 md:text-sm ${className}`}
        {...props}
      />
      {hint ? <span className="text-xs text-ink-600">{hint}</span> : null}
      {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  )
}

export function Select({
  label,
  error,
  hint,
  className = '',
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps & { children: ReactNode }) {
  const inputId = id ?? props.name
  return (
    <label className="block space-y-1.5" htmlFor={inputId}>
      {label ? <span className="text-sm font-medium text-ink-800">{label}</span> : null}
      <select
        id={inputId}
        className={`w-full max-w-full rounded-xl border border-sand-100 bg-sand-50 px-3.5 py-2.5 text-base text-ink-900 outline-none transition focus:border-tide-400 focus:bg-white focus:ring-4 focus:ring-tide-100 md:text-sm ${className}`}
        {...props}
      >
        {children}
      </select>
      {hint ? <span className="text-xs text-ink-600">{hint}</span> : null}
      {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  )
}
