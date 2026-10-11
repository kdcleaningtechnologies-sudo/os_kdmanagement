import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  full?: boolean
  children: ReactNode
}

const styles: Record<Variant, string> = {
  primary:
    'bg-tide-600 text-white shadow-sm hover:bg-ink-700 disabled:bg-ink-100 disabled:text-ink-500',
  secondary:
    'border border-ink-100 bg-white text-ink-800 hover:border-tide-400 hover:text-tide-600',
  ghost: 'text-ink-700 hover:bg-ink-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  soft: 'bg-tide-50 text-ink-800 hover:bg-tide-100',
}

export function Button({ variant = 'primary', full, className = '', children, ...props }: Props) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition touch-manipulation disabled:cursor-not-allowed ${full ? 'w-full' : ''} ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
