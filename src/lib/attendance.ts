import { isOutsideGeofence, type Coordinates } from './geo'
import { supabase } from './supabaseClient'
import { startOfTodayISO } from './format'
import type { Attendance, AttendanceStatus } from '../types/database'

type SitePin = {
  latitude: number | null
  longitude: number | null
  geofence_radius?: number | null
}

export function assessPunchLocation(coords: Coordinates | null, site: SitePin) {
  if (!coords) {
    return {
      verified: false,
      geo: { flagged: true, distance: null as number | null, limit: null as number | null },
    }
  }
  const geo = isOutsideGeofence(coords, site)
  return {
    verified: !geo.flagged && geo.distance != null,
    geo,
  }
}

export async function loadTodayAttendance(employeeId: string) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('created_at', startOfTodayISO())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { row: (data as Attendance | null) ?? null, error }
}

export async function upsertTodayAttendance(input: {
  existingId?: string | null
  employee_id: string
  site_id: string
  shift_id?: string | null
  status: AttendanceStatus
  check_in_time?: string | null
  check_out_time?: string | null
  check_in_lat?: number | null
  check_in_lng?: number | null
  check_out_lat?: number | null
  check_out_lng?: number | null
  location_verified?: boolean
}) {
  const payload = {
    employee_id: input.employee_id,
    site_id: input.site_id,
    shift_id: input.shift_id ?? null,
    status: input.status,
    check_in_time: input.check_in_time ?? null,
    check_in_lat: input.check_in_lat ?? null,
    check_in_lng: input.check_in_lng ?? null,
    location_verified: input.location_verified ?? false,
    ...(input.check_out_time !== undefined ? { check_out_time: input.check_out_time } : {}),
    ...(input.check_out_lat !== undefined ? { check_out_lat: input.check_out_lat } : {}),
    ...(input.check_out_lng !== undefined ? { check_out_lng: input.check_out_lng } : {}),
  }

  if (input.existingId) {
    return supabase.from('attendance').update(payload).eq('id', input.existingId)
  }
  return supabase.from('attendance').insert(payload)
}
