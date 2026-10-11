import { useEffect, useMemo, useState } from 'react'
import { assessPunchLocation, upsertTodayAttendance } from '../../lib/attendance'
import { tryGetCurrentPosition } from '../../lib/geo'
import { notifySuperAdmins } from '../../lib/notify'
import { supabase } from '../../lib/supabaseClient'
import { startOfTodayISO } from '../../lib/format'
import { formatShiftWindow, isRosterActiveOn, pickTodayRoster } from '../../lib/shifts'
import { useMyAssignments } from '../../hooks/useAssignments'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { StatCard } from '../../components/ui/StatCard'
import type { Attendance, EmployeeWithRelations, RosterWithRelations } from '../../types/database'

export function SupervisorAttendancePage() {
  const { sites, loading } = useMyAssignments()
  const [siteId, setSiteId] = useState('')
  const [workers, setWorkers] = useState<EmployeeWithRelations[]>([])
  const [rosters, setRosters] = useState<RosterWithRelations[]>([])
  const [todayRows, setTodayRows] = useState<Attendance[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedSite = useMemo(() => sites.find((site) => site.id === siteId) ?? sites[0], [siteId, sites])

  useEffect(() => {
    if (sites[0] && !siteId) setSiteId(sites[0].id)
  }, [sites, siteId])

  async function loadCrew(id: string) {
    const [{ data: crew, error: crewError }, { data: attendance, error: attError }, { data: rosterRows, error: rosterError }] =
      await Promise.all([
        supabase
          .from('employees')
          .select('*, profiles(*)')
          .eq('site_id', id)
          .in('designation', ['worker', 'security_guard'])
          .eq('employment_status', 'active'),
        supabase.from('attendance').select('*').eq('site_id', id).gte('created_at', startOfTodayISO()),
        supabase
          .from('rosters')
          .select('*, shifts(*), employees(*, profiles(*))')
          .eq('site_id', id)
          .eq('status', 'active'),
      ])
    const loadError = crewError?.message ?? attError?.message ?? rosterError?.message ?? null
    setError(loadError)
    setWorkers((crew as EmployeeWithRelations[]) ?? [])
    setTodayRows((attendance as Attendance[]) ?? [])
    setRosters((rosterRows as unknown as RosterWithRelations[]) ?? [])
  }

  useEffect(() => {
    if (!selectedSite) return
    void loadCrew(selectedSite.id)
  }, [selectedSite])

  const scheduledIds = useMemo(() => {
    const ids = new Set(
      rosters.filter((row) => isRosterActiveOn(row)).map((row) => row.employee_id),
    )
    if (ids.size === 0) workers.forEach((row) => ids.add(row.id))
    return ids
  }, [rosters, workers])

  const board = useMemo(() => {
    const byId = new Map(workers.map((row) => [row.id, row]))
    for (const row of rosters) {
      if (!isRosterActiveOn(row) || !row.employees) continue
      if (!byId.has(row.employee_id)) byId.set(row.employee_id, row.employees as EmployeeWithRelations)
    }
    return [...byId.values()].filter(
      (row) => scheduledIds.has(row.id) || todayRows.some((att) => att.employee_id === row.id),
    )
  }, [rosters, scheduledIds, todayRows, workers])

  const counts = useMemo(() => {
    let present = 0
    let absent = 0
    let late = 0
    let notCheckedIn = 0
    for (const worker of board) {
      const row = todayRows.find((item) => item.employee_id === worker.id)
      if (!row) notCheckedIn += 1
      else if (row.status === 'absent') absent += 1
      else if (row.status === 'late') late += 1
      else if (row.status === 'present') present += 1
    }
    return { scheduled: scheduledIds.size, present, absent, late, notCheckedIn }
  }, [board, scheduledIds, todayRows])

  function rowFor(employeeId: string) {
    return todayRows.find((row) => row.employee_id === employeeId)
  }

  function rosterFor(employeeId: string) {
    return pickTodayRoster(
      rosters.filter((row) => row.employee_id === employeeId),
      selectedSite?.id,
    )
  }

  async function mark(employee: EmployeeWithRelations, status: 'present' | 'absent' | 'late') {
    if (!selectedSite) return
    setBusyId(employee.id)
    setError(null)
    setMessage(null)
    try {
      const coords = status === 'absent' ? null : await tryGetCurrentPosition()
      const { verified, geo } = assessPunchLocation(coords, selectedSite)
      const roster = rosterFor(employee.id)
      const existing = rowFor(employee.id)
      const now = new Date().toISOString()
      const { error: saveError } = await upsertTodayAttendance({
        existingId: existing?.id,
        employee_id: employee.id,
        site_id: selectedSite.id,
        shift_id: roster?.shift_id ?? existing?.shift_id ?? null,
        status,
        check_in_time: status === 'absent' ? null : now,
        check_out_time: status === 'absent' ? null : existing?.check_out_time ?? null,
        check_in_lat: coords?.latitude ?? null,
        check_in_lng: coords?.longitude ?? null,
        location_verified: status === 'absent' ? false : verified,
      })

      if (saveError) throw saveError

      if (status === 'absent') {
        void notifySuperAdmins(
          `Absent worker reported: ${employee.profiles?.full_name ?? 'Worker'} at ${selectedSite.name}`,
        )
      }

      if (status !== 'absent' && !coords) {
        setMessage(`${employee.profiles?.full_name ?? 'Worker'} marked ${status}. Location was not captured.`)
      } else if (geo.flagged && geo.distance != null) {
        setMessage(
          `${employee.profiles?.full_name} marked ${status}, but GPS is ${Math.round(geo.distance)}m from the site (>${geo.limit ?? 200}m).`,
        )
      } else {
        setMessage(`${employee.profiles?.full_name ?? 'Worker'} marked ${status}.`)
      }
      await loadCrew(selectedSite.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark attendance')
    } finally {
      setBusyId(null)
    }
  }

  async function checkOut(employee: EmployeeWithRelations) {
    const existing = rowFor(employee.id)
    if (!existing?.check_in_time || existing.check_out_time) return
    setBusyId(employee.id)
    setError(null)
    setMessage(null)
    try {
      const coords = await tryGetCurrentPosition()
      const { error: updateError } = await supabase
        .from('attendance')
        .update({
          check_out_time: new Date().toISOString(),
          check_out_lat: coords?.latitude ?? null,
          check_out_lng: coords?.longitude ?? null,
        })
        .eq('id', existing.id)
      if (updateError) throw updateError
      setMessage(`${employee.profiles?.full_name ?? 'Worker'} checked out.`)
      if (selectedSite) await loadCrew(selectedSite.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check out')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Spinner />
  if (!selectedSite) {
    return <EmptyState title="No managed sites" body="You need a supervisor assignment before marking attendance." />
  }

  return (
    <div>
      <PageHeader
        title="Attendance board"
        subtitle="Scheduled vs punched. GPS is captured only when you mark present or late."
      />
      <Select label="Site" value={selectedSite.id} onChange={(e) => setSiteId(e.target.value)}>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </Select>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Scheduled" value={counts.scheduled} />
        <StatCard label="Present" value={counts.present} />
        <StatCard label="Absent" value={counts.absent} />
        <StatCard label="Late" value={counts.late} />
        <StatCard label="Not checked in" value={counts.notCheckedIn} />
      </div>

      {message ? <p className="mt-3 rounded-xl bg-tide-50 px-3 py-2 text-sm text-ink-800">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {board.length === 0 ? (
          <EmptyState title="No workers scheduled at this site" />
        ) : (
          board.map((worker) => {
            const current = rowFor(worker.id)
            const roster = rosterFor(worker.id)
            const boardStatus = current?.status ?? 'not_checked_in'
            return (
              <Card key={worker.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink-950">{worker.profiles?.full_name ?? 'Worker'}</p>
                    <p className="text-xs text-ink-600">{worker.employee_code ?? 'No code'}</p>
                    <p className="mt-1 text-xs text-ink-700">
                      {roster?.shifts
                        ? `${roster.shifts.name} · ${formatShiftWindow(roster.shifts)}`
                        : 'No shift assigned'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge value={boardStatus} />
                    {current ? <Badge value={current.location_verified ? 'verified' : 'unverified'} /> : null}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="soft"
                    disabled={busyId === worker.id}
                    onClick={() => void mark(worker, 'present')}
                  >
                    Present
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busyId === worker.id}
                    onClick={() => void mark(worker, 'late')}
                  >
                    Late
                  </Button>
                  {current?.check_in_time && !current.check_out_time ? (
                    <Button
                      variant="secondary"
                      disabled={busyId === worker.id}
                      onClick={() => void checkOut(worker)}
                    >
                      Check out
                    </Button>
                  ) : null}
                  <Button
                    variant="danger"
                    className={current?.check_in_time && !current.check_out_time ? '' : 'col-span-2'}
                    disabled={busyId === worker.id}
                    onClick={() => void mark(worker, 'absent')}
                  >
                    Report absent
                  </Button>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
