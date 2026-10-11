import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { daysAgoISO, formatDateTime } from '../../lib/format'
import { useMyAssignments } from '../../hooks/useAssignments'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import type { AttendanceWithRelations } from '../../types/database'

export function WorkerAttendanceHistoryPage() {
  const { assignments, loading } = useMyAssignments()
  const [rows, setRows] = useState<AttendanceWithRelations[]>([])
  const ids = assignments.map((row) => row.id)

  useEffect(() => {
    if (loading || !ids.length) return
    void supabase
      .from('attendance')
      .select('*, shifts(*)')
      .in('employee_id', ids)
      .gte('created_at', daysAgoISO(30))
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows((data as AttendanceWithRelations[]) ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ids.join(',')])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Attendance history" subtitle="Last 30 days." />
      {rows.length === 0 ? (
        <EmptyState title="No recent attendance" />
      ) : (
        <Table headers={['Shift', 'Status', 'Location', 'In', 'Out']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>{row.shifts?.name ?? '—'}</Td>
              <Td>
                <Badge value={row.status} />
              </Td>
              <Td>
                <Badge value={row.location_verified ? 'verified' : 'unverified'} />
              </Td>
              <Td>{formatDateTime(row.check_in_time)}</Td>
              <Td>{formatDateTime(row.check_out_time)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
