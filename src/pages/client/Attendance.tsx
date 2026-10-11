import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMyClients } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { daysAgoISO, formatDate, startOfTodayISO } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { StatCard } from '../../components/ui/StatCard'
import type { Attendance } from '../../types/database'

export function ClientAttendancePage() {
  const { sites, loading } = useMyClients()
  const [rows, setRows] = useState<Attendance[]>([])

  useEffect(() => {
    const ids = sites.map((site) => site.id)
    if (loading || !ids.length) return
    void supabase
      .from('attendance')
      .select('*')
      .in('site_id', ids)
      .gte('created_at', daysAgoISO(30))
      .then(({ data }) => setRows((data as Attendance[]) ?? []))
  }, [loading, sites])

  const todayCount = rows.filter(
    (row) => (row.status === 'present' || row.status === 'late') && (row.created_at ?? '') >= startOfTodayISO(),
  ).length

  const chartData = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const row of rows) {
      if (row.status !== 'present' && row.status !== 'late') continue
      const day = (row.check_in_time ?? row.created_at).slice(0, 10)
      buckets.set(day, (buckets.get(day) ?? 0) + 1)
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day: formatDate(day, 'dd MMM'), count }))
  }, [rows])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Today plus the last 30 days across your sites." />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="On site today" value={todayCount} />
        <StatCard
          label="Verified today"
          value={rows.filter((row) => row.location_verified && (row.created_at ?? '') >= startOfTodayISO()).length}
        />
        <StatCard label="Records (30 days)" value={rows.length} />
      </div>
      <Card>
        <p className="mb-4 text-sm font-semibold text-ink-800">Daily present / late count</p>
        <div className="h-56 overflow-hidden sm:h-72">
          {chartData.length === 0 ? (
            <EmptyState title="No attendance in this window" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ece7dc" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#14b8a6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  )
}
