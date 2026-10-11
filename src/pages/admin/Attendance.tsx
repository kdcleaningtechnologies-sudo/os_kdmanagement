import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime, startOfTodayISO } from '../../lib/format'
import { upsertTodayAttendance } from '../../lib/attendance'
import { pickTodayRoster } from '../../lib/shifts'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import type { AttendanceStatus, AttendanceWithRelations, EmployeeWithRelations, Site } from '../../types/database'

export function AdminAttendancePage() {
  const [rows, setRows] = useState<AttendanceWithRelations[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([])
  const [siteId, setSiteId] = useState('')
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [status, setStatus] = useState<AttendanceStatus>('present')

  useEffect(() => {
    void Promise.all([
      supabase.from('sites').select('*').order('name'),
      supabase
        .from('employees')
        .select('*, profiles(*), sites!site_id(*)')
        .in('designation', ['worker', 'security_guard'])
        .eq('employment_status', 'active')
        .order('created_at', { ascending: false }),
    ]).then(([siteRes, employeeRes]) => {
      setSites((siteRes.data as Site[]) ?? [])
      setEmployees((employeeRes.data as EmployeeWithRelations[]) ?? [])
      if (siteRes.error) setError(siteRes.error.message)
      else if (employeeRes.error) setError(employeeRes.error.message)
    })
  }, [])

  async function loadRows() {
    setLoading(true)
    let query = supabase
      .from('attendance')
      .select('*, employees(*, profiles(*)), sites(*), shifts(*)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (siteId) query = query.eq('site_id', siteId)
    if (date) {
      const start = new Date(`${date}T00:00:00`)
      const end = new Date(`${date}T23:59:59`)
      query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
    }

    const { data, error: queryError } = await query
    setError(queryError?.message ?? null)
    setRows((data as AttendanceWithRelations[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, date])

  async function recordAttendance() {
    const employee = employees.find((row) => row.id === employeeId)
    if (!employee?.site_id) {
      setError('Select an employee who is assigned to a site.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const [{ data: existing }, { data: rosterRows }] = await Promise.all([
        supabase
          .from('attendance')
          .select('id, shift_id, check_out_time')
          .eq('employee_id', employee.id)
          .gte('created_at', startOfTodayISO())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('rosters')
          .select('*')
          .eq('employee_id', employee.id)
          .eq('status', 'active'),
      ])

      const roster = pickTodayRoster(rosterRows ?? [], employee.site_id)
      const now = new Date().toISOString()
      const { error: saveError } = await upsertTodayAttendance({
        existingId: existing?.id,
        employee_id: employee.id,
        site_id: employee.site_id,
        shift_id: roster?.shift_id ?? existing?.shift_id ?? null,
        status,
        check_in_time: status === 'absent' ? null : now,
        check_out_time: status === 'absent' ? null : existing?.check_out_time ?? null,
        location_verified: false,
      })
      if (saveError) throw saveError
      setOpen(false)
      setEmployeeId('')
      setStatus('present')
      await loadRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record attendance')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Check-ins with shift window and geofence verification."
        action={<Button onClick={() => setOpen(true)}>Record attendance</Button>}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Select label="Site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </Select>
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No attendance rows" body="Workers punch from their portal, supervisors mark the board, or use Record attendance here." />
      ) : (
        <Table headers={['Employee', 'Site', 'Shift', 'Status', 'Verified', 'Check in', 'Check out']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="font-medium">{row.employees?.profiles?.full_name ?? '—'}</Td>
              <Td>{row.sites?.name ?? '—'}</Td>
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

      <Modal title="Record attendance" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Select label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select employee</option>
            {employees.map((row) => (
              <option key={row.id} value={row.id}>
                {row.profiles?.full_name ?? row.employee_code} · {row.sites?.name ?? 'No site'}
              </option>
            ))}
          </Select>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
          </Select>
          <p className="text-xs text-ink-600">
            Admin records are saved as unverified. Use this when a punch was missed, not to replace on-site GPS.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving || !employeeId} onClick={() => void recordAttendance()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
