import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { addDays, format } from 'date-fns'
import { Link } from 'react-router-dom'
import { Building2, ClipboardCheck, Receipt, ShieldAlert, Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency, formatPercent, startOfTodayISO, todayISODate } from '../../lib/format'
import { SLA_INSPECTION_PASS } from '../../lib/monthlyReports'
import { isComplaintOpen, isComplaintResolved } from '../../lib/complaints'
import { isLowStock } from '../../lib/inventory'
import { isInvoiceOverdue } from '../../lib/invoices'
import { average, dayKeys, dayLabel, lastDays, lastMonths, monthKeys, monthLabel } from '../../lib/analytics'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatCard } from '../../components/ui/StatCard'
import { Spinner } from '../../components/ui/Spinner'
import type { Client, ComplaintStatus, Contract, Invoice, Site } from '../../types/database'

type ComplaintRow = { status: ComplaintStatus; raised_at: string; resolved_at: string | null }
type ScoreRow = {
  site_id: string | null
  overall_score: number | null
  ai_score: number | null
  created_at: string
}

type Metrics = {
  clients: number
  sites: number
  employees: number
  attendancePct: number
  openComplaints: number
  avgScore: number | null
  slaPct: number | null
  revenue: number
  contractsExpiring: number
  pendingLeave: number
  pendingAccess: number
  lowStock: number
  overdueInvoices: number
  assetsDue: number
}

type ChartRow = Record<string, string | number>

function ChartCard({
  title,
  empty,
  children,
}: {
  title: string
  empty: boolean
  children: ReactNode
}) {
  return (
    <Card>
      <p className="mb-4 text-sm font-semibold text-ink-800">{title}</p>
      <div className="h-56 overflow-hidden sm:h-64">{empty ? <EmptyState title="No data in this window" /> : children}</div>
    </Card>
  )
}

export function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [attendanceRows, setAttendanceRows] = useState<{ status: string | null; created_at: string }[]>([])
  const [complaintRows, setComplaintRows] = useState<ComplaintRow[]>([])
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const today = startOfTodayISO()
      const window30 = lastDays(30)
      const window6m = lastMonths(6)
      const todayDate = todayISODate()
      const horizonDate = format(addDays(new Date(), 60), 'yyyy-MM-dd')

      const [
        clientsRes,
        sitesRes,
        employeesRes,
        todayAttRes,
        attRes,
        complaintsRes,
        scoresRes,
        invoicesRes,
        contractsRes,
        leaveRes,
        stockRes,
        assetRes,
        accessRes,
      ] = await Promise.all([
        supabase.from('clients').select('id, created_at, status').limit(1000),
        supabase.from('sites').select('*').limit(500),
        supabase.from('employees').select('id, designation').eq('employment_status', 'active').limit(2000),
        supabase.from('attendance').select('status').gte('created_at', today).limit(5000),
        supabase
          .from('attendance')
          .select('status, created_at')
          .gte('created_at', window30.startISO)
          .lte('created_at', window30.endISO)
          .limit(8000),
        supabase.from('complaints').select('status, raised_at, resolved_at').limit(2000),
        supabase.from('inspection_reports').select('site_id, overall_score, ai_score, created_at').neq('status', 'draft').limit(2000),
        supabase.from('invoices').select('*').gte('created_at', window6m.startISO).limit(1000),
        supabase.from('contracts').select('id, end_date').limit(500),
        supabase.from('leave_requests').select('id').eq('status', 'pending').limit(500),
        supabase.from('inventory_items').select('quantity, minimum_quantity').limit(2000),
        supabase.from('assets').select('next_service').limit(2000),
        supabase.from('profiles').select('id').eq('access_status', 'pending').limit(200),
      ])

      const firstError =
        clientsRes.error ||
        sitesRes.error ||
        employeesRes.error ||
        todayAttRes.error ||
        attRes.error ||
        complaintsRes.error ||
        scoresRes.error ||
        invoicesRes.error ||
        contractsRes.error
      if (firstError) {
        if (!cancelled) setError(firstError.message)
        return
      }

      const clientRows = (clientsRes.data as Client[]) ?? []
      const siteRows = (sitesRes.data as Site[]) ?? []
      const staffRows = employeesRes.data ?? []
      const employeeCount = staffRows.length
      const punchableCount = staffRows.filter(
        (row) => row.designation === 'worker' || row.designation === 'security_guard',
      ).length
      const presentToday = (todayAttRes.data ?? []).filter(
        (row) => row.status === 'present' || row.status === 'late',
      ).length
      const complaints = (complaintsRes.data ?? []) as ComplaintRow[]
      const scores = (scoresRes.data ?? []) as ScoreRow[]
      const scoreValues = scores
        .map((row) => Number(row.overall_score ?? row.ai_score))
        .filter((n) => !Number.isNaN(n))
      const recentScores = scores.filter((row) => row.created_at >= window30.startISO)
      const recentScoreValues = recentScores
        .map((row) => Number(row.overall_score ?? row.ai_score))
        .filter((n) => !Number.isNaN(n))
      const recentComplaints = complaints.filter((row) => row.raised_at >= window30.startISO)
      const inspectionPass = recentScoreValues.length
        ? recentScoreValues.filter((n) => n >= SLA_INSPECTION_PASS).length / recentScoreValues.length
        : null
      const complaintPass = recentComplaints.length
        ? recentComplaints.filter((row) => isComplaintResolved(row.status)).length / recentComplaints.length
        : null
      const slaParts = [inspectionPass, complaintPass].filter((n): n is number => n != null)
      const invoiceRows = (invoicesRes.data as Invoice[]) ?? []
      const thisMonth = new Date().toISOString().slice(0, 7)
      const revenue = invoiceRows
        .filter((row) => (row.created_at ?? '').startsWith(thisMonth) || (row.period ?? '').startsWith(thisMonth))
        .reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
      const expiring = ((contractsRes.data as Contract[]) ?? []).filter((row) => {
        if (!row.end_date) return false
        return row.end_date >= todayDate && row.end_date <= horizonDate
      }).length
      const serviceLimit = format(addDays(new Date(), 30), 'yyyy-MM-dd')
      const pendingLeave = leaveRes.data?.length ?? 0
      const pendingAccess = accessRes.error ? 0 : (accessRes.data?.length ?? 0)
      const lowStock = ((stockRes.data as { quantity: number; minimum_quantity: number }[]) ?? []).filter(isLowStock).length
      const overdueInvoices = invoiceRows.filter((row) => isInvoiceOverdue(row)).length
      const assetsDue = ((assetRes.data as { next_service: string | null }[]) ?? []).filter(
        (row) => row.next_service && row.next_service <= serviceLimit,
      ).length

      if (cancelled) return
      setClients(clientRows)
      setSites(siteRows)
      setAttendanceRows((attRes.data as { status: string | null; created_at: string }[]) ?? [])
      setComplaintRows(recentComplaints)
      setScoreRows(scores)
      setInvoices(invoiceRows)
      setMetrics({
        clients: clientRows.filter((row) => row.status === 'active').length,
        sites: siteRows.filter((row) => row.status === 'active').length,
        employees: employeeCount,
        attendancePct: punchableCount === 0 ? 0 : (presentToday / punchableCount) * 100,
        openComplaints: complaints.filter((row) => isComplaintOpen(row.status)).length,
        avgScore: average(scoreValues),
        slaPct: slaParts.length ? (slaParts.reduce((a, b) => a + b, 0) / slaParts.length) * 100 : null,
        revenue,
        contractsExpiring: expiring,
        pendingLeave,
        pendingAccess,
        lowStock,
        overdueInvoices,
        assetsDue,
      })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const attendanceChart = useMemo(() => {
    const keys = dayKeys(30)
    return keys.map((day) => {
      const rows = attendanceRows.filter((row) => row.created_at.slice(0, 10) === day)
      return {
        day: dayLabel(day),
        present: rows.filter((row) => row.status === 'present').length,
        late: rows.filter((row) => row.status === 'late').length,
        absent: rows.filter((row) => row.status === 'absent').length,
      }
    })
  }, [attendanceRows])

  const absenteeismChart = useMemo<ChartRow[]>(
    () => attendanceChart.map((row) => ({ day: row.day, absent: row.absent })),
    [attendanceChart],
  )

  const complaintsChart = useMemo(() => {
    const keys = dayKeys(30)
    return keys.map((day) => ({
      day: dayLabel(day),
      opened: complaintRows.filter((row) => row.raised_at.slice(0, 10) === day).length,
      resolved: complaintRows.filter((row) => {
        if (!isComplaintResolved(row.status)) return false
        return (row.resolved_at ?? row.raised_at).slice(0, 10) === day
      }).length,
    }))
  }, [complaintRows])

  const qualityChart = useMemo(() => {
    const buckets = new Map<string, number[]>()
    for (const row of scoreRows) {
      const name = sites.find((site) => site.id === row.site_id)?.name ?? 'Unassigned'
      const score = Number(row.overall_score ?? row.ai_score)
      if (Number.isNaN(score)) continue
      buckets.set(name, [...(buckets.get(name) ?? []), score])
    }
    return [...buckets.entries()]
      .map(([site, values]) => ({ site, score: Math.round(average(values) ?? 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }, [scoreRows, sites])

  const revenueChart = useMemo(() => {
    const keys = monthKeys(6)
    return keys.map((month) => ({
      month: monthLabel(month),
      total: invoices
        .filter((row) => (row.created_at ?? '').startsWith(month) || (row.period ?? '').startsWith(month))
        .reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    }))
  }, [invoices])

  const growthChart = useMemo(() => {
    const keys = monthKeys(6)
    return keys.map((month) => ({
      month: monthLabel(month),
      clients: clients.filter((row) => (row.created_at ?? '').startsWith(month)).length,
    }))
  }, [clients])

  if (!metrics && !error) return <Spinner label="Loading analytics" />

  return (
    <div>
      <PageHeader
        title="Operations analytics"
        subtitle="Clients, sites, attendance, quality, SLA, and revenue across this organization."
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatCard label="Total clients" value={metrics?.clients ?? 0} icon={<Building2 size={18} />} />
        <StatCard label="Total sites" value={metrics?.sites ?? 0} icon={<Building2 size={18} />} />
        <StatCard label="Total employees" value={metrics?.employees ?? 0} icon={<Users size={18} />} />
        <StatCard
          label="Today’s attendance"
          value={formatPercent(metrics?.attendancePct)}
          hint="Present or late vs active headcount"
          icon={<ClipboardCheck size={18} />}
        />
        <StatCard label="Open complaints" value={metrics?.openComplaints ?? 0} icon={<ShieldAlert size={18} />} />
        <StatCard
          label="Average site score"
          value={metrics?.avgScore == null ? '—' : Math.round(metrics.avgScore)}
        />
        <StatCard
          label="SLA compliance"
          value={formatPercent(metrics?.slaPct)}
          hint={`Inspections ≥ ${SLA_INSPECTION_PASS} and resolved tickets`}
        />
        <StatCard
          label="Revenue"
          value={formatCurrency(metrics?.revenue)}
          hint="Invoices this calendar month"
          icon={<Receipt size={18} />}
        />
        <StatCard label="Contracts expiring" value={metrics?.contractsExpiring ?? 0} hint="Next 60 days" />
      </div>

      {(metrics?.pendingAccess || metrics?.pendingLeave || metrics?.lowStock || metrics?.overdueInvoices || metrics?.assetsDue) ? (
        <Card className="mt-6">
          <p className="text-sm font-semibold text-ink-800">Needs attention</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {metrics.pendingAccess ? (
              <Link to="/admin/access" className="rounded-xl bg-tide-50 px-3 py-2 text-xs font-semibold text-tide-900">
                {metrics.pendingAccess} access request{metrics.pendingAccess === 1 ? '' : 's'}
              </Link>
            ) : null}
            {metrics.pendingLeave ? (
              <Link to="/admin/leaves" className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                {metrics.pendingLeave} leave request{metrics.pendingLeave === 1 ? '' : 's'}
              </Link>
            ) : null}
            {metrics.lowStock ? (
              <Link to="/admin/inventory" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                {metrics.lowStock} low-stock item{metrics.lowStock === 1 ? '' : 's'}
              </Link>
            ) : null}
            {metrics.overdueInvoices ? (
              <Link to="/admin/revenue" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                {metrics.overdueInvoices} overdue invoice{metrics.overdueInvoices === 1 ? '' : 's'}
              </Link>
            ) : null}
            {metrics.assetsDue ? (
              <Link to="/admin/assets" className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                {metrics.assetsDue} asset{metrics.assetsDue === 1 ? '' : 's'} due for service
              </Link>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Attendance (30 days)" empty={attendanceRows.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={attendanceChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ece7dc" />
              <XAxis dataKey="day" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" stackId="a" fill="#0f8a7a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="late" stackId="a" fill="#d97706" />
              <Bar dataKey="absent" stackId="a" fill="#e11d48" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Complaints (30 days)" empty={complaintRows.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={complaintsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ece7dc" />
              <XAxis dataKey="day" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="opened" stroke="#0284c7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resolved" stroke="#0f8a7a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Site quality" empty={qualityChart.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={qualityChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#ece7dc" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="site" width={72} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="score" fill="#0f8a7a" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue (6 months)" empty={invoices.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ece7dc" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="total" fill="#0f8a7a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Client growth" empty={clients.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={growthChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ece7dc" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="clients" stroke="#14b8a6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Employee absenteeism (30 days)" empty={attendanceRows.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={absenteeismChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ece7dc" />
              <XAxis dataKey="day" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="absent" stroke="#e11d48" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
