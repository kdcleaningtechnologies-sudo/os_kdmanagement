import { useEffect, useState } from 'react'
import { useMyClients } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import type { SecurityIncidentWithRelations, VisitorWithRelations } from '../../types/database'

export function ClientSecurityPage() {
  const { sites, loading } = useMyClients()
  const [incidents, setIncidents] = useState<SecurityIncidentWithRelations[]>([])
  const [visitors, setVisitors] = useState<VisitorWithRelations[]>([])
  const [error, setError] = useState<string | null>(null)
  const ids = sites.map((site) => site.id)

  useEffect(() => {
    if (loading || !ids.length) return
    void Promise.all([
      supabase.from('security_incidents').select('*, sites(*)').in('site_id', ids).order('created_at', { ascending: false }),
      supabase.from('visitors').select('*, sites(*)').in('site_id', ids).order('entry_time', { ascending: false }).limit(20),
    ]).then(([incidentRes, visitorRes]) => {
      const firstError = incidentRes.error || visitorRes.error
      if (firstError) setError(firstError.message)
      setIncidents((incidentRes.data as unknown as SecurityIncidentWithRelations[]) ?? [])
      setVisitors((visitorRes.data as unknown as VisitorWithRelations[]) ?? [])
    })
  }, [loading, ids.join(',')])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Security" subtitle="Incidents and recent visitors at your sites." />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}

      <h2 className="mb-3 text-sm font-semibold text-ink-900">Incidents</h2>
      {incidents.length === 0 ? (
        <EmptyState title="No incidents reported" />
      ) : (
        <div className="mb-8 space-y-2">
          {incidents.map((row) => (
            <Card key={row.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.sites?.name}</p>
                  <p className="text-sm text-ink-700">{row.description}</p>
                  <p className="mt-1 text-xs text-ink-600">{formatDateTime(row.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge value={row.incident_type} />
                  <Badge value={row.severity} />
                  <Badge value={row.status} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-ink-900">Visitors</h2>
      {visitors.length === 0 ? (
        <EmptyState title="No visitor records" />
      ) : (
        <Table headers={['Visitor', 'Site', 'In', 'Status']}>
          {visitors.map((row) => (
            <tr key={row.id}>
              <Td>
                <p className="font-medium">{row.visitor_name}</p>
                <p className="text-xs text-ink-600">{row.purpose ?? row.host ?? '—'}</p>
              </Td>
              <Td>{row.sites?.name ?? '—'}</Td>
              <Td>{formatDateTime(row.entry_time)}</Td>
              <Td>
                <Badge value={row.status} />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
