import { useEffect, useState } from 'react'
import { useMyAssignments } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { SecurityIncidentWithRelations, SecurityPatrolWithRelations, VisitorWithRelations } from '../../types/database'

export function SupervisorSecurityPage() {
  const { sites, loading } = useMyAssignments()
  const [patrols, setPatrols] = useState<SecurityPatrolWithRelations[]>([])
  const [incidents, setIncidents] = useState<SecurityIncidentWithRelations[]>([])
  const [visitors, setVisitors] = useState<VisitorWithRelations[]>([])
  const [error, setError] = useState<string | null>(null)
  const ids = sites.map((site) => site.id)

  async function load() {
    if (!ids.length) return
    const [patrolRes, incidentRes, visitorRes] = await Promise.all([
      supabase
        .from('security_patrols')
        .select('*, sites(*), employees(*, profiles(*)), security_patrol_checks(*, security_checkpoints(*))')
        .in('site_id', ids)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('security_incidents').select('*, sites(*)').in('site_id', ids).order('created_at', { ascending: false }).limit(8),
      supabase.from('visitors').select('*, sites(*)').in('site_id', ids).eq('status', 'on_site').order('entry_time', { ascending: false }),
    ])
    const firstError = patrolRes.error || incidentRes.error || visitorRes.error
    if (firstError) setError(firstError.message)
    setPatrols((patrolRes.data as unknown as SecurityPatrolWithRelations[]) ?? [])
    setIncidents((incidentRes.data as unknown as SecurityIncidentWithRelations[]) ?? [])
    setVisitors((visitorRes.data as unknown as VisitorWithRelations[]) ?? [])
  }

  useEffect(() => {
    if (!loading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ids.join(',')])

  async function markExit(id: string) {
    const { error: updateError } = await supabase
      .from('visitors')
      .update({ status: 'exited', exit_time: new Date().toISOString() })
      .eq('id', id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Security" subtitle="Patrol progress, open incidents, and guests still on site." />
      {error ? <p className="mb-3 text-sm font-medium text-rose-600">{error}</p> : null}

      <h2 className="mb-2 text-sm font-semibold text-ink-900">Open visitors</h2>
      {visitors.length === 0 ? (
        <EmptyState title="No one on site" />
      ) : (
        <div className="mb-5 space-y-2">
          {visitors.map((row) => (
            <Card key={row.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.visitor_name}</p>
                  <p className="text-xs text-ink-600">
                    {row.sites?.name} · in {formatDateTime(row.entry_time)}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => void markExit(row.id)}>
                  Exit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Incidents</h2>
      {incidents.length === 0 ? (
        <EmptyState title="No incidents" />
      ) : (
        <div className="mb-5 space-y-2">
          {incidents.map((row) => (
            <Card key={row.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.sites?.name}</p>
                  <p className="text-sm text-ink-700">{row.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge value={row.severity} />
                  <Badge value={row.status} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Recent patrols</h2>
      {patrols.length === 0 ? (
        <EmptyState title="No patrols" />
      ) : (
        <div className="space-y-2">
          {patrols.map((row) => {
            const checks = row.security_patrol_checks ?? []
            const done = checks.filter((item) => item.status === 'verified').length
            return (
              <Card key={row.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.sites?.name}</p>
                    <p className="text-xs text-ink-600">
                      {row.employees?.profiles?.full_name ?? 'Unassigned'} · {done}/{checks.length} verified
                    </p>
                  </div>
                  <Badge value={row.status} />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
