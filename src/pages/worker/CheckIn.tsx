import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useAutoAttendance } from '../../contexts/AutoAttendanceContext'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../lib/format'
import { formatShiftWindow, greetingFor, pickTodayRoster } from '../../lib/shifts'
import { displayTaskStatus, isTaskOpen, taskTitle } from '../../lib/tasks'
import { useMyAssignments } from '../../hooks/useAssignments'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { RosterWithRelations, Shift, Task } from '../../types/database'

export function WorkerCheckInPage({ variant = 'worker' }: { variant?: 'worker' | 'security' }) {
  const { profile } = useAuth()
  const { assignments, loading } = useMyAssignments()
  const auto = useAutoAttendance()
  const [rosters, setRosters] = useState<RosterWithRelations[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const selected = assignments.find((row) => row.sites) ?? assignments[0]
  const roster = pickTodayRoster(rosters, selected?.site_id)
  const shift = (roster?.shifts ?? null) as Shift | null
  const today = auto.today

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    async function load() {
      const [{ data: rosterRows }, { data: taskRows }] = await Promise.all([
        supabase
          .from('rosters')
          .select('*, shifts(*), sites(*)')
          .eq('employee_id', selected.id)
          .eq('status', 'active'),
        supabase.from('tasks').select('*').eq('assigned_to', selected.id).order('due_date', { ascending: true }),
      ])
      if (cancelled) return
      setRosters((rosterRows as RosterWithRelations[]) ?? [])
      setTasks(((taskRows as Task[]) ?? []).filter((task) => isTaskOpen(task.status)))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selected])

  if (loading || !auto.ready) return <Spinner />
  if (!selected) {
    return <EmptyState title="No site assignment" body="Ask admin to assign your profile to a site." />
  }

  const checkedIn = Boolean(today?.check_in_time && !today.check_out_time)
  const closed = Boolean(today?.check_in_time && today.check_out_time)
  const distanceLabel =
    auto.distance != null ? `${Math.round(auto.distance)}m from pin` : 'Waiting for GPS…'
  const circle = auto.limit ?? 200

  return (
    <div>
      <PageHeader
        title={greetingFor(new Date(), profile?.full_name)}
        subtitle="Admin set the site pin once. This phone checks you in inside the circle and out when you leave."
      />

      <div className="mb-4 space-y-2 rounded-2xl border border-tide-100 bg-tide-50 p-4">
        <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">Auto attendance</p>
        <p className="text-sm font-semibold text-ink-950">
          {auto.watching ? 'Watching this phone’s GPS' : 'GPS not active'}
          {auto.inside == null ? '' : auto.inside ? ' · inside the site' : ' · outside the site'}
        </p>
        <p className="text-xs text-ink-700">
          {distanceLabel}. Circle is {circle}m. Keep FacilityOS open on this phone at work.
        </p>
        {auto.holdHint ? <p className="text-xs font-medium text-ink-800">{auto.holdHint}</p> : null}
      </div>

      <Card className="space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">Today’s site</p>
          <p className="mt-1 text-lg font-semibold text-ink-950">{selected.sites?.name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">Today’s shift</p>
          {shift ? (
            <>
              <p className="mt-1 text-lg font-semibold text-ink-950">{shift.name}</p>
              <p className="text-sm text-ink-700">{formatShiftWindow(shift)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-700">No shift assigned. Auto punch still uses the site circle.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge value={today?.status ?? (checkedIn ? 'present' : 'not_checked_in')} />
          {today ? <Badge value={today.location_verified ? 'verified' : 'unverified'} /> : null}
          {auto.inside ? <Badge value="on_site" /> : null}
        </div>
        <div className="text-sm text-ink-700">
          <p>In: {formatDateTime(today?.check_in_time)}</p>
          <p>Out: {formatDateTime(today?.check_out_time)}</p>
        </div>
        {auto.message ? <p className="rounded-xl bg-white px-3 py-2 text-sm text-ink-800">{auto.message}</p> : null}
        {auto.error ? <p className="text-sm font-medium text-rose-600">{auto.error}</p> : null}
        <p className="text-xs text-ink-600">Manual buttons are only a backup if GPS is blocked.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button full disabled={auto.busy || checkedIn || closed} onClick={() => void auto.punch('in')}>
            {auto.busy ? 'Saving…' : 'Check in'}
          </Button>
          <Button full variant="secondary" disabled={auto.busy || !checkedIn} onClick={() => void auto.punch('out')}>
            Check out
          </Button>
        </div>
      </Card>

      {variant === 'security' ? (
        <div className="mt-6">
          <Card className="py-3">
            <p className="text-sm font-semibold text-ink-950">Patrols and visitors</p>
            <p className="mt-1 text-xs text-ink-600">
              Use the tabs below to verify checkpoints, log incidents, and sign guests in or out.
            </p>
          </Card>
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Today’s tasks</h2>
            <Link to="/worker/tasks" className="text-xs font-semibold text-tide-600">
              Open list
            </Link>
          </div>
          {tasks.length === 0 ? (
            <EmptyState title="No tasks assigned" />
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 4).map((task) => (
                <Card key={task.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-ink-950">{taskTitle(task)}</p>
                    <Badge value={displayTaskStatus(task)} />
                  </div>
                  <p className="mt-1 text-xs text-ink-600">
                    {(task.checklist ?? []).filter((item) => item.done).length}/{task.checklist?.length ?? 0} done
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
