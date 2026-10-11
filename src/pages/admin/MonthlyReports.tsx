import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { printClientOperationsGuide } from '../../lib/clientBriefing'
import { formatDate, formatPercent } from '../../lib/format'
import { generateClientMonth, printMonthlyReport } from '../../lib/monthlyReports'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import type { Client, MonthlyReportWithRelations, Site } from '../../types/database'

export function AdminMonthlyReportsPage() {
  const { organization } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [rows, setRows] = useState<MonthlyReportWithRelations[]>([])
  const [clientId, setClientId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: clientRows }, { data: siteRows }, { data, error: queryError }] = await Promise.all([
      supabase.from('clients').select('*').order('business_name'),
      supabase.from('sites').select('*').order('name'),
      supabase
        .from('monthly_reports')
        .select('*, clients(*), sites(*)')
        .order('period_start', { ascending: false })
        .limit(200),
    ])
    if (queryError) setError(queryError.message)
    setClients((clientRows as Client[]) ?? [])
    setSites((siteRows as Site[]) ?? [])
    setRows((data as unknown as MonthlyReportWithRelations[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function generate() {
    const client = clients.find((row) => row.id === clientId)
    if (!client) return
    setBusy(true)
    setError(null)
    try {
      await generateClientMonth({
        clientId: client.id,
        sites: sites.filter((site) => site.client_id === client.id),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate reports')
    } finally {
      setBusy(false)
    }
  }

  const visible = clientId ? rows.filter((row) => row.client_id === clientId) : rows

  return (
    <div>
      <PageHeader
        title="Monthly reports"
        subtitle="Generate a stored month snapshot per client and site. Clients can print the same report as PDF."
      />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <Select label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.business_name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            const client = clients.find((row) => row.id === clientId)
            printClientOperationsGuide({
              clientName: client?.business_name,
              orgName: organization?.name,
              siteNames: sites.filter((site) => !clientId || site.client_id === clientId).map((site) => site.name),
            })
          }}
        >
          How it works PDF
        </Button>
        <Button disabled={busy || !clientId} onClick={() => void generate()}>
          {busy ? 'Generating…' : 'Generate this month'}
        </Button>
      </div>
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState title="No reports" body="Pick a client and generate the current month." />
      ) : (
        <Table headers={['Period', 'Client', 'Scope', 'Attendance', 'SLA', '']}>
          {visible.map((row) => (
            <tr key={row.id}>
              <Td>{formatDate(row.period_start, 'MMM yyyy')}</Td>
              <Td>{row.clients?.business_name ?? '—'}</Td>
              <Td>
                <Badge value={row.sites?.name ?? 'all sites'} />
              </Td>
              <Td>{formatPercent(row.attendance_pct)}</Td>
              <Td>{formatPercent(row.sla_compliance_pct)}</Td>
              <Td>
                <Button
                  variant="ghost"
                  onClick={() =>
                    printMonthlyReport(row, {
                      clientName: row.clients?.business_name ?? 'Client',
                      siteName: row.sites?.name ?? 'All sites',
                    })
                  }
                >
                  PDF
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
