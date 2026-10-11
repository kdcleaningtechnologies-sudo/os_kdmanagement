import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatDate } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import type { LeaveRequest, LeaveStatus } from '../../types/database'

type LeaveRow = LeaveRequest & {
  employees: { employee_code: string | null; profiles: { full_name: string } | null } | null
}

export function AdminLeavesPage() {
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('leave_requests')
      .select('*, employees(employee_code, profiles(full_name))')
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    setRows((data as LeaveRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function setStatus(id: string, status: LeaveStatus) {
    const { error: updateError } = await supabase.from('leave_requests').update({ status }).eq('id', id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  return (
    <div>
      <PageHeader title="Leave requests" subtitle="Approve or reject worker time off." />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No leave requests" />
      ) : (
        <Table headers={['Employee', 'Dates', 'Reason', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>{row.employees?.profiles?.full_name ?? row.employees?.employee_code ?? '—'}</Td>
              <Td>
                {formatDate(row.from_date)} – {formatDate(row.to_date)}
              </Td>
              <Td>{row.reason}</Td>
              <Td>
                <Badge value={row.status} />
              </Td>
              <Td>
                {row.status === 'pending' ? (
                  <div className="flex gap-2">
                    <Button variant="soft" onClick={() => void setStatus(row.id, 'approved')}>
                      Approve
                    </Button>
                    <Button variant="ghost" onClick={() => void setStatus(row.id, 'rejected')}>
                      Reject
                    </Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
