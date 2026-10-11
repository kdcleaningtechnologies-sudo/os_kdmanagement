import { endOfMonth, format, startOfMonth } from 'date-fns'
import { supabase } from './supabaseClient'
import { isComplaintResolved } from './complaints'
import type { MonthlyReport, Site } from '../types/database'

export const SLA_INSPECTION_PASS = 80

export function monthBounds(date = new Date()) {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  return {
    start,
    end,
    periodStart: format(start, 'yyyy-MM-dd'),
    periodEnd: format(end, 'yyyy-MM-dd'),
    startISO: start.toISOString(),
    endISO: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString(),
    label: format(start, 'MMMM yyyy'),
  }
}

export function reportTitle(report: Pick<MonthlyReport, 'period_start' | 'site_id'>, siteName?: string | null) {
  const month = format(new Date(`${report.period_start}T00:00:00`), 'MMMM yyyy')
  return siteName ? `${siteName} · ${month}` : `All sites · ${month}`
}

function pct(part: number, whole: number) {
  if (!whole) return null
  return Math.round((part / whole) * 1000) / 10
}

export async function generateMonthlyReport(input: {
  clientId: string
  siteId?: string | null
  sites: Site[]
  date?: Date
}) {
  const bounds = monthBounds(input.date)
  const siteIds = input.siteId ? [input.siteId] : input.sites.map((site) => site.id)
  if (!siteIds.length) throw new Error('No sites in scope for this report.')

  const now = new Date()
  const days =
    bounds.start.getMonth() === now.getMonth() && bounds.start.getFullYear() === now.getFullYear()
      ? Math.max(now.getDate(), 1)
      : bounds.end.getDate()

  const [employeesRes, attendanceRes, tasksRes, complaintsRes, scoresRes, photosRes] = await Promise.all([
    supabase.from('employees').select('id').in('site_id', siteIds).eq('employment_status', 'active'),
    supabase
      .from('attendance')
      .select('status, created_at')
      .in('site_id', siteIds)
      .gte('created_at', bounds.startISO)
      .lte('created_at', bounds.endISO),
    supabase
      .from('tasks')
      .select('status')
      .in('site_id', siteIds)
      .gte('created_at', bounds.startISO)
      .lte('created_at', bounds.endISO),
    supabase
      .from('complaints')
      .select('status')
      .eq('client_id', input.clientId)
      .in('site_id', siteIds)
      .gte('raised_at', bounds.startISO)
      .lte('raised_at', bounds.endISO),
    supabase
      .from('inspection_reports')
      .select('id, overall_score, ai_score')
      .in('site_id', siteIds)
      .neq('status', 'draft')
      .gte('created_at', bounds.startISO)
      .lte('created_at', bounds.endISO),
    supabase
      .from('inspection_photos')
      .select('photo_url, created_at, inspection_id')
      .gte('created_at', bounds.startISO)
      .lte('created_at', bounds.endISO)
      .order('created_at', { ascending: false })
      .limit(40),
  ])

  const firstError =
    employeesRes.error ||
    attendanceRes.error ||
    tasksRes.error ||
    complaintsRes.error ||
    scoresRes.error ||
    photosRes.error
  if (firstError) throw firstError

  const workers = employeesRes.data?.length ?? 0
  const present = (attendanceRes.data ?? []).filter((row) => row.status === 'present' || row.status === 'late').length
  const expected = Math.max(workers * days, 1)
  const tasks = tasksRes.data ?? []
  const tasksCompleted = tasks.filter((row) => row.status === 'completed').length
  const tasksPending = tasks.filter((row) => row.status !== 'completed').length
  const complaints = complaintsRes.data ?? []
  const complaintsResolved = complaints.filter((row) => isComplaintResolved(row.status)).length
  const scores = (scoresRes.data ?? [])
    .map((row) => Number(row.overall_score ?? row.ai_score))
    .filter((n) => !Number.isNaN(n))
  const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null
  const inspectionPass = scores.length ? scores.filter((n) => n >= SLA_INSPECTION_PASS).length / scores.length : null
  const complaintPass = complaints.length ? complaintsResolved / complaints.length : null
  const slaParts = [inspectionPass, complaintPass].filter((n): n is number => n != null)
  const sla = slaParts.length ? Math.round((slaParts.reduce((a, b) => a + b, 0) / slaParts.length) * 1000) / 10 : null

  const reportIds = new Set((scoresRes.data ?? []).map((row) => row.id))
  const photoUrls = ((photosRes.data ?? []) as { photo_url: string; inspection_id: string }[])
    .filter((row) => reportIds.has(row.inspection_id))
    .map((row) => row.photo_url)
    .slice(0, 8)

  const payload = {
    client_id: input.clientId,
    site_id: input.siteId ?? null,
    period_start: bounds.periodStart,
    period_end: bounds.periodEnd,
    workers_deployed: workers,
    attendance_present: present,
    attendance_expected: expected,
    attendance_pct: pct(present, expected),
    tasks_completed: tasksCompleted,
    tasks_pending: tasksPending,
    complaints_total: complaints.length,
    complaints_resolved: complaintsResolved,
    avg_inspection_score: avgScore,
    sla_compliance_pct: sla,
    photo_urls: photoUrls,
    generated_at: new Date().toISOString(),
  }

  let query = supabase
    .from('monthly_reports')
    .select('id')
    .eq('client_id', input.clientId)
    .eq('period_start', bounds.periodStart)
  query = input.siteId ? query.eq('site_id', input.siteId) : query.is('site_id', null)
  const { data: existing, error: findError } = await query.maybeSingle()
  if (findError) throw findError

  const saved = existing
    ? await supabase.from('monthly_reports').update(payload).eq('id', existing.id).select('*').single()
    : await supabase.from('monthly_reports').insert(payload).select('*').single()
  if (saved.error || !saved.data) throw saved.error ?? new Error('Could not save monthly report')
  return saved.data as MonthlyReport
}

export async function generateClientMonth(input: { clientId: string; sites: Site[]; date?: Date }) {
  const perSite = await Promise.all(
    input.sites.map((site) =>
      generateMonthlyReport({ clientId: input.clientId, siteId: site.id, sites: [site], date: input.date }),
    ),
  )
  const rollup = await generateMonthlyReport({
    clientId: input.clientId,
    siteId: null,
    sites: input.sites,
    date: input.date,
  })
  return { rollup, perSite }
}

export function printMonthlyReport(
  report: MonthlyReport,
  extras: { clientName: string; siteName: string; orgName?: string | null; slaTerms?: string | null },
) {
  const month = format(new Date(`${report.period_start}T00:00:00`), 'MMMM yyyy')
  const photos = (report.photo_urls ?? [])
    .map((url) => `<img src="${url}" alt="Site photo" style="width:24%;height:90px;object-fit:cover;border-radius:8px;margin:2px" />`)
    .join('')
  const logoSrc = `${window.location.origin}/kd-logo-light.png`
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${extras.siteName} — ${month}</title>
  <style>
    body { font-family: Georgia, serif; color: #14221f; padding: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .masthead { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .masthead img { width: 64px; height: 48px; object-fit: contain; background: #fff; }
    .muted { color: #5b6b66; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
    .card { border: 1px solid #e6e0d4; border-radius: 12px; padding: 12px; }
    .label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #5b6b66; }
    .value { font-size: 22px; font-weight: 700; margin-top: 6px; }
    @media print { button { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="masthead">
    <img src="${logoSrc}" alt="KD Facilities Management Services" />
    <div>
      <p class="muted" style="margin:0">${extras.orgName ?? 'KD Facilities Management Services'}</p>
      <h1>Monthly service report</h1>
    </div>
  </div>
  <p class="muted">${extras.clientName} · ${extras.siteName} · ${month}</p>
  <div class="grid">
    <div class="card"><div class="label">Workers deployed</div><div class="value">${report.workers_deployed}</div></div>
    <div class="card"><div class="label">Attendance</div><div class="value">${report.attendance_pct ?? '—'}%</div><div class="muted">${report.attendance_present} / ${report.attendance_expected} person-days</div></div>
    <div class="card"><div class="label">Tasks</div><div class="value">${report.tasks_completed}</div><div class="muted">${report.tasks_pending} pending</div></div>
    <div class="card"><div class="label">Complaints</div><div class="value">${report.complaints_resolved}/${report.complaints_total}</div><div class="muted">resolved</div></div>
    <div class="card"><div class="label">Inspection score</div><div class="value">${report.avg_inspection_score ?? '—'}</div></div>
    <div class="card"><div class="label">SLA compliance</div><div class="value">${report.sla_compliance_pct ?? '—'}%</div><div class="muted">Inspection ≥ ${SLA_INSPECTION_PASS} and resolved tickets</div></div>
  </div>
  ${extras.slaTerms ? `<p class="muted"><strong>Contract SLA</strong><br/>${extras.slaTerms}</p>` : ''}
  <p class="muted">Photos from submitted inspections this month</p>
  <div>${photos || '<p class="muted">No photos in this period.</p>'}</div>
  <p class="muted">Generated ${format(new Date(report.generated_at), 'dd MMM yyyy, hh:mm a')}. Use the browser print dialog to save as PDF.</p>
  <script>window.onload = function () { window.print(); }</script>
</body>
</html>`
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200')
  if (!popup) throw new Error('Allow pop-ups to print or save the PDF.')
  popup.document.write(html)
  popup.document.close()
}

