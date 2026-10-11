import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatDate } from '../../lib/format'
import { useMyAssignments } from '../../hooks/useAssignments'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { LeaveRequest, LeaveStatus } from '../../types/database'

type LeaveRow = LeaveRequest & {
  employees: { employee_code: string | null; site_id: string | null; profiles: { full_name: string } | null } | null
}

export function SupervisorLeavePage() {
  const { sites, loading } = useMyAssignments()
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const siteIds = sites.map((site) => site.id)

  async function load() {
    if (!siteIds.length) return
    const { data, error: queryError } = await supabase
      .from('leave_requests')
      .select('*, employees(employee_code, site_id, profiles(full_name))')
      .order('created_at', { ascending: false })
    if (queryError) {
      setError(queryError.message)
      return
    }
    const siteSet = new Set(siteIds)
    setRows(
      ((data as LeaveRow[]) ?? []).filter((row) => row.employees?.site_id && siteSet.has(row.employees.site_id)),
    )
  }

  useEffect(() => {
    if (!loading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, siteIds.join(',')])

  async function setStatus(id: string, status: LeaveStatus) {
    setBusyId(id)
    setError(null)
    const { error: updateError } = await supabase.from('leave_requests').update({ status }).eq('id', id)
    if (updateError) setError(updateError.message)
    else await load()
    setBusyId(null)
  }

  if (loading) return <Spinner />
  if (!sites.length) {
    return <EmptyState title="No managed sites" body="Ask admin to assign your supervisor profile to a site." />
  }

  return (
    <div>
      <PageHeader title="Leave" subtitle="Approve time off for staff on your sites." />
      {error ? <p className="mb-3 text-sm font-medium text-rose-600">{error}</p> : null}
      {rows.length === 0 ? (
        <EmptyState title="No leave requests" />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-950">
                    {row.employees?.profiles?.full_name ?? row.employees?.employee_code ?? 'Staff'}
                  </p>
                  <p className="text-sm text-ink-700">
                    {formatDate(row.from_date)} – {formatDate(row.to_date)}
                  </p>
                  <p className="mt-1 text-xs text-ink-600">{row.reason}</p>
                </div>
                <Badge value={row.status} />
              </div>
              {row.status === 'pending' ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="soft" disabled={busyId === row.id} onClick={() => void setStatus(row.id, 'approved')}>
                    Approve
                  </Button>
                  <Button variant="ghost" disabled={busyId === row.id} onClick={() => void setStatus(row.id, 'rejected')}>
                    Reject
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
