import { useEffect, useMemo, useState } from 'react'
import { useMyAssignments } from '../../hooks/useAssignments'
import { getCurrentPosition } from '../../lib/geo'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../lib/format'
import { isPatrolOpen, seedPatrolChecks } from '../../lib/security'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { PatrolCheckStatus, SecurityPatrolWithRelations } from '../../types/database'

export function SecurityPatrolsPage() {
  const { assignments, sites, loading } = useMyAssignments()
  const [rows, setRows] = useState<SecurityPatrolWithRelations[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const assignment = assignments[0]
  const siteIds = sites.map((site) => site.id)

  async function load() {
    if (!siteIds.length) return
    const { data, error: queryError } = await supabase
      .from('security_patrols')
      .select('*, sites(*), employees(*, profiles(*)), security_patrol_checks(*, security_checkpoints(*))')
      .in('site_id', siteIds)
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    setRows((data as unknown as SecurityPatrolWithRelations[]) ?? [])
  }

  useEffect(() => {
    if (!loading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, siteIds.join(',')])

  const active = useMemo(
    () => rows.find((row) => isPatrolOpen(row.status) && (!assignment || !row.guard_id || row.guard_id === assignment.id)) ?? rows.find((row) => isPatrolOpen(row.status)),
    [rows, assignment],
  )

  async function startNew() {
    if (!assignment?.site_id) return
    setBusy(true)
    setError(null)
    try {
      const { data, error: insertError } = await supabase
        .from('security_patrols')
        .insert({
          site_id: assignment.site_id,
          guard_id: assignment.id,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .select('*')
        .single()
      if (insertError || !data) throw insertError ?? new Error('Could not start patrol')
      await seedPatrolChecks(data)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start patrol')
    } finally {
      setBusy(false)
    }
  }

  async function startExisting(row: SecurityPatrolWithRelations) {
    setBusy(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('security_patrols')
        .update({
          status: 'in_progress',
          started_at: row.started_at ?? new Date().toISOString(),
          guard_id: row.guard_id ?? assignment?.id ?? null,
        })
        .eq('id', row.id)
      if (updateError) throw updateError
      await seedPatrolChecks(row)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start patrol')
    } finally {
      setBusy(false)
    }
  }

  async function markCheck(checkId: string, status: PatrolCheckStatus) {
    setBusy(true)
    setError(null)
    try {
      const coords = status === 'verified' ? await getCurrentPosition().catch(() => null) : null
      const { error: updateError } = await supabase
        .from('security_patrol_checks')
        .update({
          status,
          checked_at: new Date().toISOString(),
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
        })
        .eq('id', checkId)
      if (updateError) throw updateError
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update checkpoint')
    } finally {
      setBusy(false)
    }
  }

  async function complete(row: SecurityPatrolWithRelations) {
    setBusy(true)
    const { error: updateError } = await supabase
      .from('security_patrols')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', row.id)
    if (updateError) setError(updateError.message)
    else await load()
    setBusy(false)
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Patrols" subtitle="Start a round and verify each checkpoint." />
      {error ? <p className="mb-3 text-sm font-medium text-rose-600">{error}</p> : null}
      {!active ? (
        <Card className="space-y-3">
          <EmptyState title="No open patrol" body="Start a round for your assigned site." />
          <Button full disabled={busy || !assignment} onClick={() => void startNew()}>
            {busy ? 'Starting…' : 'Start patrol'}
          </Button>
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">{active.sites?.name}</p>
              <p className="mt-1 font-semibold text-ink-950">{active.notes || 'Site patrol'}</p>
              <p className="text-xs text-ink-600">{formatDateTime(active.started_at ?? active.created_at)}</p>
            </div>
            <Badge value={active.status} />
          </div>
          {active.status === 'scheduled' ? (
            <Button full disabled={busy} onClick={() => void startExisting(active)}>
              Begin round
            </Button>
          ) : null}
          <div className="space-y-2">
            {(active.security_patrol_checks ?? []).map((check) => (
              <div key={check.id} className="rounded-xl border border-sand-100 bg-sand-50 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink-950">{check.security_checkpoints?.name ?? 'Checkpoint'}</p>
                    <p className="text-xs text-ink-600">{check.security_checkpoints?.location_hint ?? ''}</p>
                  </div>
                  <Badge value={check.status} />
                </div>
                {check.status === 'pending' ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button disabled={busy} onClick={() => void markCheck(check.id, 'verified')}>
                      Verify
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => void markCheck(check.id, 'skipped')}>
                      Skip
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ink-600">{formatDateTime(check.checked_at)}</p>
                )}
              </div>
            ))}
          </div>
          {active.status === 'in_progress' ? (
            <Button full variant="secondary" disabled={busy} onClick={() => void complete(active)}>
              Complete patrol
            </Button>
          ) : null}
        </Card>
      )}
    </div>
  )
}
