import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../lib/format'
import { isComplaintResolved } from '../../lib/complaints'
import { ComplaintThread } from '../../components/ComplaintThread'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import {
  COMPLAINT_STATUSES,
  type ComplaintStatus,
  type ComplaintWithRelations,
  type EmployeeWithRelations,
} from '../../types/database'

export function AdminComplaintsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<ComplaintWithRelations[]>([])
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([])
  const [viewing, setViewing] = useState<ComplaintWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data, error: queryError }, { data: staff }] = await Promise.all([
      supabase
        .from('complaints')
        .select('*, clients(*), sites(*), employees(*, profiles(*)), complaint_comments(*, profiles(*))')
        .order('raised_at', { ascending: false }),
      supabase
        .from('employees')
        .select('*, profiles(*)')
        .in('designation', ['supervisor', 'worker'])
        .eq('employment_status', 'active'),
    ])
    if (queryError) setError(queryError.message)
    const list = ((data as unknown as ComplaintWithRelations[]) ?? []).map((row) => ({
      ...row,
      complaint_comments: [...(row.complaint_comments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
    setRows(list)
    setEmployees((staff as unknown as EmployeeWithRelations[]) ?? [])
    if (viewing) setViewing(list.find((row) => row.id === viewing.id) ?? null)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function update(id: string, patch: Partial<{ status: ComplaintStatus; assigned_to: string | null }>) {
    const current = rows.find((row) => row.id === id)
    const status = patch.status ?? current?.status
    const payload = {
      ...patch,
      resolved_at: status && isComplaintResolved(status) ? (current?.resolved_at ?? new Date().toISOString()) : null,
    }
    const { error: updateError } = await supabase.from('complaints').update(payload).eq('id', id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  return (
    <div>
      <PageHeader title="Complaints" subtitle="Client tickets and supervisor issues. Assign, comment, then close after the client confirms." />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No complaints" body="New issues from clients or supervisors will land here." />
      ) : (
        <Table headers={['When', 'Site', 'Issue', 'Priority', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>{formatDateTime(row.raised_at)}</Td>
              <Td>{row.sites?.name ?? '—'}</Td>
              <Td>
                <p className="font-medium">{row.title ?? row.description}</p>
                <p className="text-xs text-ink-600">{row.category}</p>
              </Td>
              <Td>
                <Badge value={row.priority ?? 'medium'} />
              </Td>
              <Td>
                <Select
                  value={row.status}
                  onChange={(e) => void update(row.id, { status: e.target.value as ComplaintStatus })}
                >
                  {COMPLAINT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll('_', ' ')}
                    </option>
                  ))}
                </Select>
              </Td>
              <Td>
                <Button variant="ghost" onClick={() => setViewing(row)}>
                  View
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title={viewing?.title ?? 'Complaint'} open={Boolean(viewing)} onClose={() => setViewing(null)} wide>
        {viewing ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-800">{viewing.description}</p>
            <p className="text-xs text-ink-600">
              {viewing.clients?.business_name ?? '—'} · {viewing.sites?.name ?? '—'}
            </p>
            <Select
              label="Assign to"
              value={viewing.assigned_to ?? ''}
              onChange={(e) =>
                void update(viewing.id, {
                  assigned_to: e.target.value || null,
                  status: e.target.value && viewing.status === 'open' ? 'assigned' : viewing.status,
                })
              }
            >
              <option value="">Unassigned</option>
              {employees.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.profiles?.full_name ?? row.employee_code}
                </option>
              ))}
            </Select>
            {viewing.photos?.length ? (
              <div className="grid grid-cols-2 gap-2">
                {viewing.photos.map((photo) => (
                  <img key={photo.url} src={photo.url} alt={photo.name} className="h-32 w-full rounded-xl object-cover" />
                ))}
              </div>
            ) : null}
            <ComplaintThread
              complaintId={viewing.id}
              comments={viewing.complaint_comments ?? []}
              profileId={user?.id}
              onPosted={load}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
