import { format } from 'date-fns'
import type { AttendanceStatus, Roster, Shift } from '../types/database'

export const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const

export function formatTimeOfDay(value: string | null | undefined) {
  if (!value) return '—'
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value.slice(0, 5)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return format(date, 'h:mm a')
}

export function formatShiftWindow(shift: Pick<Shift, 'start_time' | 'end_time'> | null | undefined) {
  if (!shift) return '—'
  return `${formatTimeOfDay(shift.start_time)} – ${formatTimeOfDay(shift.end_time)}`
}

export function weekdayLabel(weekday: number | null | undefined) {
  if (weekday == null) return 'Every day'
  return WEEKDAYS.find((day) => day.value === weekday)?.label ?? 'Every day'
}

export function isRosterActiveOn(roster: Pick<Roster, 'status' | 'weekday' | 'effective_from' | 'effective_to'>, date = new Date()) {
  if (roster.status !== 'active') return false
  if (roster.weekday != null && roster.weekday !== date.getDay()) return false
  const day = format(date, 'yyyy-MM-dd')
  if (roster.effective_from && roster.effective_from > day) return false
  if (roster.effective_to && roster.effective_to < day) return false
  return true
}

export function pickTodayRoster<T extends Roster>(rows: T[], siteId?: string | null) {
  const today = rows.filter((row) => isRosterActiveOn(row))
  if (siteId) {
    const atSite = today.find((row) => row.site_id === siteId)
    if (atSite) return atSite
  }
  return today[0] ?? null
}

function parseTimeOfDay(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return { hours, minutes }
}

export function attendanceStatusFromShift(
  now: Date,
  shift: Pick<Shift, 'start_time' | 'end_time' | 'grace_minutes'> | null | undefined,
): AttendanceStatus {
  if (!shift) return 'present'
  const startParts = parseTimeOfDay(shift.start_time)
  if (!startParts) return 'present'
  const start = new Date(now)
  start.setHours(startParts.hours, startParts.minutes, 0, 0)

  const endParts = parseTimeOfDay(shift.end_time)
  if (endParts) {
    const end = new Date(now)
    end.setHours(endParts.hours, endParts.minutes, 0, 0)
    const overnight = end.getTime() <= start.getTime()
    if (overnight && now.getTime() < end.getTime()) {
      start.setDate(start.getDate() - 1)
    }
  }

  const graceMs = (shift.grace_minutes ?? 15) * 60_000
  return now.getTime() > start.getTime() + graceMs ? 'late' : 'present'
}

export function greetingFor(now: Date, name: string | null | undefined) {
  const hour = now.getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const first = name?.trim().split(/\s+/)[0]
  return first ? `${part}, ${first}` : part
}
