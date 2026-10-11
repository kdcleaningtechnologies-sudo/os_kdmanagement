import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useMyClients } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { printClientOperationsGuide } from '../../lib/clientBriefing'
import { formatDate, formatPercent } from '../../lib/format'
import { generateClientMonth, printMonthlyReport, reportTitle } from '../../lib/monthlyReports'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { StatCard } from '../../components/ui/StatCard'
import type { Contract, MonthlyReportWithRelations } from '../../types/database'

export function ClientReportsPage() {
  const { organization } = useAuth()
  const { sites, clients, loading } = useMyClients()
  const [rows, setRows] = useState<MonthlyReportWithRelations[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const ids = clients.map((client) => client.id)
    if (!ids.length) {
      setRows([])
      return
    }
    const [{ data, error: queryError }, { data: contractRows }] = await Promise.all([
      supabase
        .from('monthly_reports')
        .select('*, clients(*), sites(*)')
        .in('client_id', ids)
        .order('period_start', { ascending: false }),
      supabase.from('contracts').select('*').in('client_id', ids),
    ])
    if (queryError) setError(queryError.message)
    setRows((data as unknown as MonthlyReportWithRelations[]) ?? [])
    setContracts((contractRows as Contract[]) ?? [])
  }

  useEffect(() => {
    if (!loading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, clients.map((client) => client.id).join(',')])

  async function generate() {
    const client = clients[0]
    if (!client) return
    setBusy(true)
    setError(null)
    try {
      await generateClientMonth({ clientId: client.id, sites })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate reports')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  const latest = rows.find((row) => !row.site_id) ?? rows[0]

  return (
    <div>
      <PageHeader
        title="Monthly reports"
        subtitle="One snapshot per site, plus a roll-up. Print or save as PDF from the browser dialog."
        action={
          <div className="flex flex-wrap gap-2">
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
            <Button disabled={busy || !clients[0]} onClick={() => void generate()}>
              {busy ? 'Generating…' : 'Generate this month'}
            </Button>
          </div>
        }
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}

      {latest ? (
        <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Workers deployed" value={latest.workers_deployed} />
          <StatCard label="Attendance" value={formatPercent(latest.attendance_pct)} />
          <StatCard label="Tasks completed" value={latest.tasks_completed} hint={`${latest.tasks_pending} pending`} />
          <StatCard label="SLA" value={formatPercent(latest.sla_compliance_pct)} />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No monthly reports yet"
          body="Generate this month to store attendance, tasks, complaints, scores, and photos."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-950">{reportTitle(row, row.sites?.name)}</p>
                  <p className="text-xs text-ink-600">
                    {formatDate(row.period_start)} – {formatDate(row.period_end)} · generated {formatDate(row.generated_at)}
                  </p>
                </div>
                <Badge value={row.site_id ? 'site' : 'all_sites'} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-ink-700 sm:grid-cols-4">
                <p>Workers {row.workers_deployed}</p>
                <p>Attendance {formatPercent(row.attendance_pct)}</p>
                <p>
                  Tasks {row.tasks_completed}/{row.tasks_completed + row.tasks_pending}
                </p>
                <p>
                  Complaints {row.complaints_resolved}/{row.complaints_total}
                </p>
                <p>Inspection {row.avg_inspection_score ?? '—'}</p>
                <p>SLA {formatPercent(row.sla_compliance_pct)}</p>
              </div>
              {row.photo_urls?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.photo_urls.slice(0, 4).map((url) => (
                    <img key={url} src={url} alt="" className="h-16 w-20 rounded-lg object-cover" />
                  ))}
                </div>
              ) : null}
              <Button
                className="mt-4"
                variant="secondary"
                onClick={() =>
                  printMonthlyReport(row, {
                    clientName: row.clients?.business_name ?? clients[0]?.business_name ?? 'Client',
                    siteName: row.sites?.name ?? 'All sites',
                    slaTerms: contracts.find((item) => item.client_id === row.client_id)?.sla_terms,
                  })
                }
              >
                Print / Save PDF
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
