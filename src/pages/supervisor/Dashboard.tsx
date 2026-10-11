import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useMyAssignments } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { startOfTodayISO, todayISODate } from '../../lib/format'
import { greetingFor, isRosterActiveOn } from '../../lib/shifts'
import { displayTaskStatus, isTaskOpen, taskTitle } from '../../lib/tasks'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { StatCard } from '../../components/ui/StatCard'
import type { Attendance, Roster, Task } from '../../types/database'

export function SupervisorDashboardPage() {
  const { profile } = useAuth()
  const { sites, loading } = useMyAssignments()
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [rosters, setRosters] = useState<Roster[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)

  const siteIds = sites.map((site) => site.id)

  useEffect(() => {
    if (!siteIds.length) return
    let cancelled = false

    async function load() {
      const [{ data: attRows, error: attError }, { data: rosterRows }, { data: taskRows, error: taskError }] =
        await Promise.all([
          supabase.from('attendance').select('*').in('site_id', siteIds).gte('created_at', startOfTodayISO()),
          supabase.from('rosters').select('*').in('site_id', siteIds).eq('status', 'active'),
          supabase.from('tasks').select('*').in('site_id', siteIds).order('due_date', { ascending: true }),
        ])
      if (cancelled) return
      if (attError || taskError) setError(attError?.message ?? taskError?.message ?? null)
      setAttendance((attRows as Attendance[]) ?? [])
      setRosters((rosterRows as Roster[]) ?? [])
      setTasks((taskRows as Task[]) ?? [])
    }

    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteIds.join(',')])

  const scheduled = useMemo(() => {
    const ids = new Set(rosters.filter((row) => isRosterActiveOn(row)).map((row) => row.employee_id))
    return ids.size
  }, [rosters])

  const present = attendance.filter((row) => row.status === 'present').length
  const late = attendance.filter((row) => row.status === 'late').length
  const absent = attendance.filter((row) => row.status === 'absent').length
  const notCheckedIn = Math.max(0, scheduled - attendance.filter((row) => row.status !== 'absent' && row.check_in_time).length)

  const openTasks = tasks.filter((task) => isTaskOpen(task.status))
  const overdue = openTasks.filter((task) => displayTaskStatus(task) === 'overdue')
  const dueToday = openTasks.filter((task) => !task.due_date || task.due_date === todayISODate())

  if (loading) return <Spinner />
  if (!sites.length) {
    return <EmptyState title="No managed sites" body="Ask admin to assign your supervisor profile to a site." />
  }

  return (
    <div>
      <PageHeader
        title={greetingFor(new Date(), profile?.full_name)}
        subtitle="Today’s attendance, open work, and your sites."
      />
      {error ? <p className="mb-3 text-sm font-medium text-rose-600">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Scheduled" value={scheduled || '—'} hint="Rostered today" />
        <StatCard label="On site" value={present + late} hint={`${late} late`} />
        <StatCard label="Absent / not in" value={`${absent} / ${notCheckedIn}`} />
        <StatCard label="Open tasks" value={openTasks.length} hint={`${overdue.length} overdue`} />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">Today’s tasks</h2>
          <Link to="/supervisor/tasks" className="text-xs font-semibold text-tide-600">
            All tasks
          </Link>
        </div>
        {dueToday.length === 0 ? (
          <EmptyState title="No tasks due today" />
        ) : (
          <div className="space-y-2">
            {dueToday.slice(0, 5).map((task) => (
              <Card key={task.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink-950">{taskTitle(task)}</p>
                    <p className="text-xs text-ink-600">
                      {sites.find((site) => site.id === task.site_id)?.name ?? 'Site'}
                    </p>
                  </div>
                  <Badge value={displayTaskStatus(task)} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">My sites</h2>
        <div className="space-y-2">
          {sites.map((site) => (
            <Card key={site.id} className="py-3">
              <p className="font-semibold text-ink-950">{site.name}</p>
              <p className="text-xs text-ink-600">{site.city ?? site.address}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/supervisor/attendance"
                  className="rounded-xl bg-tide-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  Attendance
                </Link>
                <Link
                  to="/supervisor/tasks"
                  className="rounded-xl bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-800"
                >
                  Tasks
                </Link>
                <Link
                  to="/supervisor/sites"
                  className="rounded-xl bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-800"
                >
                  Sites
                </Link>
                <Link
                  to="/supervisor/leave"
                  className="rounded-xl bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-800"
                >
                  Leave
                </Link>
                <Link
                  to="/supervisor/handover"
                  className="rounded-xl bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-800"
                >
                  Handover
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
