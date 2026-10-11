import { eachDayOfInterval, eachMonthOfInterval, format, subDays, subMonths } from 'date-fns'

export function lastDays(days: number) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = subDays(end, days - 1)
  start.setHours(0, 0, 0, 0)
  return { start, end, startISO: start.toISOString(), endISO: end.toISOString() }
}

export function lastMonths(count: number) {
  const end = new Date()
  const start = subMonths(end, count - 1)
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  return { start, end, startISO: start.toISOString() }
}

export function dayKeys(days: number) {
  const { start, end } = lastDays(days)
  return eachDayOfInterval({ start, end }).map((day) => format(day, 'yyyy-MM-dd'))
}

export function monthKeys(count: number) {
  const { start, end } = lastMonths(count)
  return eachMonthOfInterval({ start, end }).map((month) => format(month, 'yyyy-MM'))
}

export function dayLabel(isoDate: string) {
  return format(new Date(`${isoDate}T00:00:00`), 'dd MMM')
}

export function monthLabel(ym: string) {
  return format(new Date(`${ym}-01T00:00:00`), 'MMM yy')
}

export function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((sum, n) => sum + n, 0) / values.length
}
