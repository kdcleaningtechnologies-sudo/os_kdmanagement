import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useMyClients } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { formatPercent, startOfTodayISO } from '../../lib/format'
import { printClientOperationsGuide } from '../../lib/clientBriefing'
import { monthBounds, SLA_INSPECTION_PASS } from '../../lib/monthlyReports'
import { isComplaintOpen, isComplaintResolved } from '../../lib/complaints'
import { SiteLocationCard } from '../../components/SiteLocationCard'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { StatCard } from '../../components/ui/StatCard'
import { Spinner } from '../../components/ui/Spinner'
import type { Contract, InspectionPhoto, Invoice } from '../../types/database'

type Metrics = {
  staff: number
  present: number
  openComplaints: number
  tasksCompletedPct: number | null
  avgScore: number | null
  slaPct: number | null
}

export function ClientOverviewPage() {
  const { organization } = useAuth()
  const { sites, clients, loading } = useMyClients()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [photos, setPhotos] = useState<InspectionPhoto[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])

  useEffect(() => {
    if (loading) return
    const siteIds = sites.map((site) => site.id)
    const clientIds = clients.map((client) => client.id)
    if (!siteIds.length) {
      setMetrics({ staff: 0, present: 0, openComplaints: 0, tasksCompletedPct: null, avgScore: null, slaPct: null })
      return
    }

    const month = monthBounds()
    void Promise.all([
      supabase.from('employees').select('id').in('site_id', siteIds).eq('employment_status', 'active'),
      supabase.from('attendance').select('status').in('site_id', siteIds).gte('created_at', startOfTodayISO()),
      supabase.from('complaints').select('status').in('client_id', clientIds),
      supabase.from('tasks').select('status').in('site_id', siteIds).gte('created_at', month.startISO),
      supabase.from('inspection_reports').select('id, overall_score, ai_score').in('site_id', siteIds).neq('status', 'draft'),
      supabase.from('invoices').select('*').in('client_id', clientIds).order('created_at', { ascending: false }).limit(3),
      supabase.from('contracts').select('*').in('client_id', clientIds).order('created_at', { ascending: false }).limit(3),
    ]).then(async ([staffRes, attRes, complaintRes, taskRes, scoreRes, invoiceRes, contractRes]) => {
      const staff = staffRes.data?.length ?? 0
      const present = (attRes.data ?? []).filter((row) => row.status === 'present' || row.status === 'late').length
      const complaints = complaintRes.data ?? []
      const tasks = taskRes.data ?? []
      const completed = tasks.filter((row) => row.status === 'completed').length
      const scores = (scoreRes.data ?? [])
        .map((row) => Number(row.overall_score ?? row.ai_score))
        .filter((n) => !Number.isNaN(n))
      const inspectionPass = scores.length ? scores.filter((n) => n >= SLA_INSPECTION_PASS).length / scores.length : null
      const complaintPass = complaints.length
        ? complaints.filter((row) => isComplaintResolved(row.status)).length / complaints.length
        : null
      const slaParts = [inspectionPass, complaintPass].filter((n): n is number => n != null)
      setMetrics({
        staff,
        present,
        openComplaints: complaints.filter((row) => isComplaintOpen(row.status)).length,
        tasksCompletedPct: tasks.length ? (completed / tasks.length) * 100 : null,
        avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
        slaPct: slaParts.length ? (slaParts.reduce((a, b) => a + b, 0) / slaParts.length) * 100 : null,
      })
      setInvoices((invoiceRes.data as Invoice[]) ?? [])
      setContracts((contractRes.data as Contract[]) ?? [])

      const reportIds = (scoreRes.data ?? []).map((row) => row.id)
      if (reportIds.length) {
        const { data } = await supabase
          .from('inspection_photos')
          .select('*')
          .in('inspection_id', reportIds)
          .order('created_at', { ascending: false })
          .limit(8)
        setPhotos((data as InspectionPhoto[]) ?? [])
      } else {
        setPhotos([])
      }
    })
  }, [loading, sites, clients])

  if (loading || !metrics) return <Spinner />

  return (
    <div>
      <PageHeader
        title={clients[0]?.business_name ?? 'Your facilities'}
        subtitle="Today’s workforce, service quality, and the latest photos from your sites."
        action={
          <Button
            variant="secondary"
            onClick={() =>
              printClientOperationsGuide({
                clientName: clients[0]?.business_name,
                orgName: organization?.name,
                siteNames: sites.map((site) => site.name),
              })
            }
          >
            How it works PDF
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatCard label="Today’s workforce" value={metrics.staff} hint="Active staff on your sites" />
        <StatCard
          label="Attendance today"
          value={metrics.present}
          hint={formatPercent(metrics.staff ? (metrics.present / metrics.staff) * 100 : 0)}
        />
        <StatCard label="Open complaints" value={metrics.openComplaints} />
        <StatCard label="Task completion" value={formatPercent(metrics.tasksCompletedPct)} hint="This calendar month" />
        <StatCard label="Inspection score" value={metrics.avgScore == null ? '—' : Math.round(metrics.avgScore)} />
        <StatCard
          label="SLA performance"
          value={formatPercent(metrics.slaPct)}
          hint={`Inspections ≥ ${SLA_INSPECTION_PASS} and resolved tickets`}
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Monthly reports</h2>
            <Link to="/client/reports" className="text-xs font-semibold text-tide-600">
              Open
            </Link>
          </div>
          <p className="text-sm text-ink-700">Attendance, tasks, complaints, scores, and site photos — one PDF per month.</p>
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Invoices</h2>
            <Link to="/client/invoices" className="text-xs font-semibold text-tide-600">
              All
            </Link>
          </div>
          <p className="text-sm text-ink-700">
            {invoices.length ? `${invoices.length} recent invoice${invoices.length === 1 ? '' : 's'} on file.` : 'No invoices yet.'}
          </p>
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Contracts</h2>
            <Link to="/client/contracts" className="text-xs font-semibold text-tide-600">
              All
            </Link>
          </div>
          <p className="text-sm text-ink-700">
            {contracts.length ? `${contracts.length} contract${contracts.length === 1 ? '' : 's'} on file.` : 'No contracts on file.'}
          </p>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-ink-950">Recent photos</h2>
        {photos.length === 0 ? (
          <p className="mt-3 text-sm text-ink-600">Inspection photos will appear here after a site visit is submitted.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {photos.map((photo) => (
              <img
                key={photo.id}
                src={photo.photo_url}
                alt={photo.caption ?? 'Site inspection'}
                className="h-28 w-full rounded-2xl object-cover"
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-end justify-between">
        <h2 className="text-lg font-semibold text-ink-950">Sites on this contract</h2>
        <Link to="/client/locations" className="text-sm font-semibold text-tide-600">
          All locations
        </Link>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {sites.map((site) => (
          <SiteLocationCard key={site.id} site={site} />
        ))}
      </div>
    </div>
  )
}
