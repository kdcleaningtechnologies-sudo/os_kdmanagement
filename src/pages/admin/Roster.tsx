import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { formatShiftWindow, weekdayLabel, WEEKDAYS } from '../../lib/shifts'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { FormError } from '../../components/ui/FormError'
import { Input, Select } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import {
  ROSTER_STATUSES,
  type EmployeeWithRelations,
  type RosterWithRelations,
  type Shift,
  type Site,
} from '../../types/database'

const schema = z.object({
  employee_id: z.string().min(1, 'Select an employee'),
  shift_id: z.string().min(1, 'Select a shift'),
  site_id: z.string().optional(),
  weekday: z.string(),
  effective_from: z.string().optional(),
  effective_to: z.string().optional(),
  status: z.enum(ROSTER_STATUSES),
})

type FormValues = z.infer<typeof schema>

export function AdminRosterPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<RosterWithRelations[]>([])
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [siteFilter, setSiteFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RosterWithRelations | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    const [{ data, error: queryError }, { data: employeeRows }, { data: shiftRows }, { data: siteRows }] =
      await Promise.all([
        supabase
          .from('rosters')
          .select('*, employees(*, profiles(*)), shifts(*), sites(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('employees')
          .select('*, profiles(*), sites!site_id(*)')
          .in('designation', ['worker', 'security_guard', 'supervisor'])
          .order('created_at', { ascending: false }),
        supabase.from('shifts').select('*').eq('status', 'active').order('start_time'),
        supabase.from('sites').select('*').order('name'),
      ])
    if (queryError) setError(queryError.message)
    setRows((data as RosterWithRelations[]) ?? [])
    setEmployees((employeeRows as EmployeeWithRelations[]) ?? [])
    setShifts((shiftRows as Shift[]) ?? [])
    setSites((siteRows as Site[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  function startCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({
      employee_id: '',
      shift_id: '',
      site_id: '',
      weekday: '',
      effective_from: '',
      effective_to: '',
      status: 'active',
    })
    setOpen(true)
  }

  function startEdit(row: RosterWithRelations) {
    setEditing(row)
    setFormError(null)
    form.reset({
      employee_id: row.employee_id,
      shift_id: row.shift_id,
      site_id: row.site_id ?? '',
      weekday: row.weekday == null ? '' : String(row.weekday),
      effective_from: row.effective_from ?? '',
      effective_to: row.effective_to ?? '',
      status: row.status,
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    setFormError(null)
    const employee = employees.find((row) => row.id === values.employee_id)
    const payload = withOrg(
      {
        employee_id: values.employee_id,
        shift_id: values.shift_id,
        site_id: values.site_id || employee?.site_id || null,
        weekday: values.weekday === '' ? null : Number(values.weekday),
        effective_from: values.effective_from || null,
        effective_to: values.effective_to || null,
        status: values.status,
      },
      profile?.organization_id,
    )
    const result = editing
      ? await supabase.from('rosters').update(payload).eq('id', editing.id)
      : await supabase.from('rosters').insert(payload)
    if (result.error) {
      setFormError(result.error.message)
      setError(result.error.message)
      return
    }
    setOpen(false)
    setError(null)
    await load()
  }

  async function deactivate(row: RosterWithRelations) {
    const next = row.status === 'active' ? 'inactive' : 'active'
    const { error: updateError } = await supabase.from('rosters').update({ status: next }).eq('id', row.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await load()
  }

  const visible = siteFilter ? rows.filter((row) => row.site_id === siteFilter) : rows

  return (
    <div>
      <PageHeader
        title="Roster"
        subtitle="Assign staff to a shift and site. Leave weekday empty for every day."
        action={<Button onClick={startCreate}>Assign shift</Button>}
      />
      <div className="mb-5 max-w-sm">
        <Select label="Site" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          <option value="">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </Select>
      </div>
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState title="No roster rows" body="Assign employees to a shift so worker check-in knows today's window." />
      ) : (
        <Table headers={['Employee', 'Shift', 'Site', 'Days', 'Status', '']}>
          {visible.map((row) => (
            <tr key={row.id}>
              <Td className="font-medium">{row.employees?.profiles?.full_name ?? '—'}</Td>
              <Td>
                <p>{row.shifts?.name ?? '—'}</p>
                <p className="text-xs text-ink-600">{formatShiftWindow(row.shifts)}</p>
              </Td>
              <Td>{row.sites?.name ?? '—'}</Td>
              <Td>{weekdayLabel(row.weekday)}</Td>
              <Td>
                <Badge value={row.status} />
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => void deactivate(row)}>
                    {row.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title={editing ? 'Edit roster' : 'Assign shift'} open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit, () =>
            setFormError('Fill the required fields: employee and shift.'),
          )}
        >
          <FormError message={formError} />
          <Select label="Employee" error={form.formState.errors.employee_id?.message} {...form.register('employee_id')}>
            <option value="">Select employee</option>
            {employees
              .filter((row) => (row.employment_status ?? 'active') === 'active' || row.id === editing?.employee_id)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.profiles?.full_name ?? row.employee_code} · {row.sites?.name ?? 'No site'}
                </option>
              ))}
          </Select>
          <Select label="Shift" error={form.formState.errors.shift_id?.message} {...form.register('shift_id')}>
            <option value="">Select shift</option>
            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name} · {formatShiftWindow(shift)}
              </option>
            ))}
          </Select>
          <Select label="Site" hint="Defaults to the employee's assigned site." {...form.register('site_id')}>
            <option value="">Employee site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Select label="Weekday" {...form.register('weekday')}>
            <option value="">Every day</option>
            {WEEKDAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Effective from" type="date" {...form.register('effective_from')} />
            <Input label="Effective to" type="date" {...form.register('effective_to')} />
          </div>
          <Select label="Status" {...form.register('status')}>
            {ROSTER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
