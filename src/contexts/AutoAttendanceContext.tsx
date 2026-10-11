import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useMyAssignments } from '../hooks/useAssignments'
import {
  assessPunchLocation,
  loadTodayAttendance,
  upsertTodayAttendance,
} from '../lib/attendance'
import { ENTER_HOLD_MS, EXIT_HOLD_MS, formatHold, holdRemaining } from '../lib/autoAttendance'
import { isOutsideGeofence, type Coordinates } from '../lib/geo'
import { supabase } from '../lib/supabaseClient'
import { attendanceStatusFromShift, pickTodayRoster } from '../lib/shifts'
import type { Attendance, EmployeeWithRelations, RosterWithRelations, Shift } from '../types/database'

type Permission = 'unknown' | 'granted' | 'denied' | 'unavailable'

type AutoAttendanceValue = {
  ready: boolean
  watching: boolean
  permission: Permission
  inside: boolean | null
  distance: number | null
  limit: number | null
  siteName: string | null
  today: Attendance | null
  message: string | null
  error: string | null
  busy: boolean
  holdHint: string | null
  punch: (kind: 'in' | 'out') => Promise<void>
}

const AutoAttendanceContext = createContext<AutoAttendanceValue | undefined>(undefined)

type WakeLockSentinel = { release: () => Promise<void> }

function pickNearestSite(assignments: EmployeeWithRelations[], coords: Coordinates) {
  const withPin = assignments.filter(
    (row) => row.sites && row.sites.latitude != null && row.sites.longitude != null,
  )
  if (!withPin.length) return null
  let best = withPin[0]
  let bestGeo = isOutsideGeofence(coords, best.sites!)
  for (const row of withPin.slice(1)) {
    const geo = isOutsideGeofence(coords, row.sites!)
    if (geo.distance != null && (bestGeo.distance == null || geo.distance < bestGeo.distance)) {
      best = row
      bestGeo = geo
    }
  }
  return { assignment: best, geo: bestGeo, inside: !bestGeo.flagged && bestGeo.distance != null }
}

async function requestWakeLock() {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
  }
  try {
    return (await nav.wakeLock?.request('screen')) ?? null
  } catch {
    return null
  }
}

export function AutoAttendanceProvider({ children }: { children: ReactNode }) {
  const { assignments, loading } = useMyAssignments()
  const [watching, setWatching] = useState(false)
  const [permission, setPermission] = useState<Permission>('unknown')
  const [inside, setInside] = useState<boolean | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [limit, setLimit] = useState<number | null>(null)
  const [today, setToday] = useState<Attendance | null>(null)
  const [rosters, setRosters] = useState<RosterWithRelations[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [holdHint, setHoldHint] = useState<string | null>(null)

  const todayRef = useRef<Attendance | null>(null)
  const busyRef = useRef(false)
  const insideSinceRef = useRef<number | null>(null)
  const outsideSinceRef = useRef<number | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const assignmentsRef = useRef(assignments)
  const rostersRef = useRef(rosters)

  assignmentsRef.current = assignments
  rostersRef.current = rosters
  todayRef.current = today

  const primary = assignments.find((row) => row.sites) ?? assignments[0] ?? null
  const siteName = primary?.sites?.name ?? null
  const hasPin = Boolean(primary?.sites && primary.sites.latitude != null && primary.sites.longitude != null)

  const loadToday = useCallback(async (employeeId: string) => {
    const [{ row, error: attError }, { data: rosterRows }] = await Promise.all([
      loadTodayAttendance(employeeId),
      supabase
        .from('rosters')
        .select('*, shifts(*), sites(*)')
        .eq('employee_id', employeeId)
        .eq('status', 'active'),
    ])
    if (attError) setError(attError.message)
    setToday(row)
    todayRef.current = row
    setRosters((rosterRows as RosterWithRelations[]) ?? [])
    return row
  }, [])

  useEffect(() => {
    if (primary?.id) void loadToday(primary.id)
  }, [primary?.id, loadToday])

  const performPunch = useCallback(
    async (kind: 'in' | 'out', coords: Coordinates | null, source: 'auto' | 'manual') => {
      const assignment =
        (coords ? pickNearestSite(assignmentsRef.current, coords)?.assignment : null) ??
        assignmentsRef.current.find((row) => row.sites) ??
        assignmentsRef.current[0]
      if (!assignment?.sites) {
        setError('Site details could not be loaded. Ask admin to set the site pin.')
        return
      }
      if (busyRef.current) return
      const current = todayRef.current
      const roster = pickTodayRoster(rostersRef.current, assignment.site_id)
      const shift = (roster?.shifts ?? null) as Shift | null
      const { verified, geo } = assessPunchLocation(coords, assignment.sites)
      const now = new Date()

      busyRef.current = true
      setBusy(true)
      setError(null)

      try {
        if (kind === 'out') {
          if (!current?.check_in_time || current.check_out_time) {
            if (source === 'manual') throw new Error('Check in first.')
            return
          }
          const { error: updateError } = await supabase
            .from('attendance')
            .update({
              check_out_time: now.toISOString(),
              check_out_lat: coords?.latitude ?? null,
              check_out_lng: coords?.longitude ?? null,
            })
            .eq('id', current.id)
          if (updateError) throw updateError
          const prefix = source === 'auto' ? 'Left the site — checked out automatically. ' : ''
          setMessage(
            !coords
              ? `${prefix}Checked out.`
              : geo.flagged && geo.distance != null
                ? `${prefix}You were ${Math.round(geo.distance)}m from the pin.`
                : `${prefix}Checked out.`,
          )
        } else {
          if (current?.check_in_time && !current.check_out_time) {
            if (source === 'manual') throw new Error('Already checked in. Use check out.')
            return
          }
          if (current?.check_out_time) {
            if (source === 'manual') throw new Error('Today’s attendance is already closed.')
            return
          }
          const { error: saveError } = await upsertTodayAttendance({
            existingId: current?.id,
            employee_id: assignment.id,
            site_id: assignment.site_id ?? assignment.sites.id,
            shift_id: shift?.id ?? null,
            check_in_time: now.toISOString(),
            check_in_lat: coords?.latitude ?? null,
            check_in_lng: coords?.longitude ?? null,
            location_verified: verified,
            status: attendanceStatusFromShift(now, shift),
          })
          if (saveError) throw saveError
          const prefix = source === 'auto' ? 'Arrived on site — checked in automatically. ' : ''
          setMessage(
            verified
              ? `${prefix}Location verified.`
              : coords && geo.distance != null
                ? `${prefix}You are ${Math.round(geo.distance)}m from the pin (limit ${geo.limit ?? 200}m).`
                : `${prefix}Allow location on this phone to verify the site.`,
          )
        }
        await loadToday(assignment.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save attendance')
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [loadToday],
  )

  const onCoords = useCallback(
    (coords: Coordinates) => {
      const nearest = pickNearestSite(assignmentsRef.current, coords)
      if (!nearest) {
        setInside(null)
        setHoldHint(null)
        return
      }
      setPermission('granted')
      setDistance(nearest.geo.distance)
      setLimit(nearest.geo.limit)
      setInside(nearest.inside)
      const now = Date.now()
      const current = todayRef.current
      const checkedIn = Boolean(current?.check_in_time && !current.check_out_time)
      const closed = Boolean(current?.check_in_time && current.check_out_time)

      if (nearest.inside) {
        outsideSinceRef.current = null
        if (!insideSinceRef.current) insideSinceRef.current = now
        const wait = holdRemaining(insideSinceRef.current, ENTER_HOLD_MS, now)
        if (!checkedIn && !closed && wait > 0) {
          setHoldHint(`Stay on site ${formatHold(wait)} more — then check-in is automatic.`)
        } else {
          setHoldHint(checkedIn ? 'On site. Check-out happens when you leave.' : null)
        }
        if (!checkedIn && !closed && wait === 0) {
          void performPunch('in', coords, 'auto')
        }
      } else {
        insideSinceRef.current = null
        if (!outsideSinceRef.current) outsideSinceRef.current = now
        const wait = holdRemaining(outsideSinceRef.current, EXIT_HOLD_MS, now)
        if (checkedIn && wait > 0) {
          setHoldHint(`Outside the site. Auto check-out in ${formatHold(wait)}.`)
        } else if (!checkedIn) {
          setHoldHint('Go to the site. Check-in starts automatically inside the circle.')
        } else {
          setHoldHint(null)
        }
        if (checkedIn && wait === 0) {
          void performPunch('out', coords, 'auto')
        }
      }
    },
    [performPunch],
  )

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setPermission('unavailable')
      setError('This device cannot read GPS. Use a phone and allow location.')
      return
    }
    if (watchIdRef.current != null) return
    setWatching(true)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        onCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      },
      (err) => {
        setWatching(false)
        setPermission('denied')
        setError(err.message || 'Allow location so attendance can punch automatically.')
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
    )
    void requestWakeLock().then((lock) => {
      wakeLockRef.current = lock
    })
  }, [onCoords])

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setWatching(false)
    void wakeLockRef.current?.release()
    wakeLockRef.current = null
  }, [])

  useEffect(() => {
    if (loading || !hasPin) {
      stopWatch()
      return
    }
    startWatch()
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        stopWatch()
        startWatch()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      stopWatch()
    }
  }, [loading, hasPin, startWatch, stopWatch])

  const punch = useCallback(
    async (kind: 'in' | 'out') => {
      const coords = await new Promise<Coordinates | null>((resolve) => {
        if (!navigator.geolocation) {
          resolve(null)
          return
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
        )
      })
      await performPunch(kind, coords, 'manual')
    },
    [performPunch],
  )

  const value = useMemo<AutoAttendanceValue>(
    () => ({
      ready: !loading,
      watching,
      permission,
      inside,
      distance,
      limit,
      siteName,
      today,
      message,
      error: !hasPin && primary ? 'Admin has not set this site’s map pin yet. Auto attendance needs latitude and longitude.' : error,
      busy,
      holdHint,
      punch,
    }),
    [loading, watching, permission, inside, distance, limit, siteName, today, message, error, busy, holdHint, punch, hasPin, primary],
  )

  return <AutoAttendanceContext.Provider value={value}>{children}</AutoAttendanceContext.Provider>
}

export function useAutoAttendance() {
  const ctx = useContext(AutoAttendanceContext)
  if (!ctx) throw new Error('useAutoAttendance must be used inside AutoAttendanceProvider')
  return ctx
}
