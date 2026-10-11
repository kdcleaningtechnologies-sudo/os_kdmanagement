import { format, parseISO } from 'date-fns'

export function formatDate(value: string | null | undefined, pattern = 'dd MMM yyyy') {
  if (!value) return '—'
  try {
    return format(parseISO(value), pattern)
  } catch {
    return value
  }
}

export function formatDateTime(value: string | null | undefined) {
  return formatDate(value, 'dd MMM yyyy, hh:mm a')
}

export function formatCurrency(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(amount)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Math.round(value)}%`
}

export function todayISODate() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function startOfTodayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function titleCase(value: string | null | undefined) {
  if (!value) return '—'
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
