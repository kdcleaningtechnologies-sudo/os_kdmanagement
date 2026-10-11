import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { formatDate } from '../../lib/format'
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
  DEPARTMENTS,
  DESIGNATIONS,
  EMPLOYMENT_STATUSES,
  type EmployeeWithRelations,
  type Profile,
  type Site,
} from '../../types/database'

const schema = z.object({
  profile_id: z.string().min(1, 'Select a user profile'),
  site_id: z.string().min(1, 'Select a site'),
  employee_code: z.string().optional(),
  designation: z.enum(DESIGNATIONS),
  job_title: z.string().optional(),
  department: z.string().optional(),
  joining_date: z.string().optional(),
  emergency_contact: z.string().optional(),
  supervisor_id: z.string().optional(),
  employment_status: z.enum(EMPLOYMENT_STATUSES),
})

type FormValues = z.infer<typeof schema>

export function AdminEmployeesPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<EmployeeWithRelations[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<EmployeeWithRelations | null>(null)
  const [editing, setEditing] = useState<EmployeeWithRelations | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    const [{ data, error: queryError }, { data: profileRows }, { data: siteRows }] = await Promise.all([
      supabase.from('employees').select('*, profiles(*), sites!site_id(*)').order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .in('role', ['worker', 'supervisor', 'security_guard'])
        .eq('access_status', 'active')
        .order('full_name'),
      supabase.from('sites').select('*').order('name'),
    ])
    if (queryError) setError(queryError.message)
    setRows((data as EmployeeWithRelations[]) ?? [])
    setProfiles((profileRows as Profile[]) ?? [])
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
      profile_id: '',
      site_id: '',
      employee_code: '',
      designation: 'worker',
      job_title: '',
      department: 'Housekeeping',
      joining_date: '',
      emergency_contact: '',
      supervisor_id: '',
      employment_status: 'active',
    })
    setOpen(true)
  }

  function startEdit(row: EmployeeWithRelations) {
    setEditing(row)
    setFormError(null)
    form.reset({
      profile_id: row.profile_id ?? '',
      site_id: row.site_id ?? '',
      employee_code: row.employee_code ?? '',
      designation: row.designation ?? 'worker',
      job_title: row.job_title ?? '',
      department: row.department ?? '',
      joining_date: row.joining_date ?? '',
      emergency_contact: row.emergency_contact ?? '',
      supervisor_id: row.supervisor_id ?? '',
      employment_status: row.employment_status ?? 'active',
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = withOrg(
      {
        profile_id: values.profile_id,
        site_id: values.site_id,
        employee_code: values.employee_code || null,
        designation: values.designation,
        job_title: values.job_title || null,
        department: values.department || null,
        joining_date: values.joining_date || null,
        emergency_contact: values.emergency_contact || null,
        supervisor_id: values.supervisor_id || null,
        employment_status: values.employment_status,
      },
      profile?.organization_id,
    )
    const result = editing
      ? await supabase.from('employees').update(payload).eq('id', editing.id)
      : await supabase.from('employees').insert(payload)
    if (result.error) {
      setFormError(result.error.message)
      setError(result.error.message)
      return
    }
    setOpen(false)
    setError(null)
    await load()
  }

  const supervisorOptions = rows.filter((row) => row.designation === 'supervisor')

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Site staff for housekeeping, security, and facility operations. Emergency contacts stay off the client portal."
        action={<Button onClick={startCreate}>Add employee</Button>}
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No employees yet" body="Create Auth users with staff roles, then assign them to a site." />
      ) : (
        <Table headers={['Name', 'Code', 'Department', 'Site', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <p className="font-medium">{row.profiles?.full_name ?? 'Unlinked'}</p>
                <p className="text-xs text-ink-600">{row.job_title ?? row.designation}</p>
              </Td>
              <Td className="font-mono text-xs">{row.employee_code ?? '—'}</Td>
              <Td>{row.department ?? '—'}</Td>
              <Td>{row.sites?.name ?? '—'}</Td>
              <Td>
                <Badge value={row.employment_status ?? 'active'} />
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setViewing(row)}>
                    View
                  </Button>
                  <Button variant="ghost" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title={editing ? 'Edit employee' : 'New employee'} open={open} onClose={() => setOpen(false)} wide>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit, () =>
            setFormError('Fill the required fields: approved user and site.'),
          )}
        >
          <FormError message={formError} />
          {profiles.length === 0 && !editing ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Approve a worker, supervisor, or guard on Access requests first, then assign them here.
            </p>
          ) : null}
          {sites.length === 0 && !editing ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Add a site first, then come back and save this employee.
            </p>
          ) : null}
          <Select label="Profile" error={form.formState.errors.profile_id?.message} {...form.register('profile_id')}>
            <option value="">Select user</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name} ({profile.role})
              </option>
            ))}
          </Select>
          <Select label="Site" error={form.formState.errors.site_id?.message} {...form.register('site_id')}>
            <option value="">Select site</option>
            {sites
              .filter((site) => (site.status ?? 'active') === 'active' || site.id === editing?.site_id)
              .map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
          </Select>
          <Input label="Employee code" {...form.register('employee_code')} />
          <Select label="Operations role" {...form.register('designation')}>
            {DESIGNATIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Input label="Job title" placeholder="Housekeeping executive" {...form.register('job_title')} />
          <Select label="Department" {...form.register('department')}>
            <option value="">Select department</option>
            {DEPARTMENTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select label="Reporting supervisor" {...form.register('supervisor_id')}>
            <option value="">Unassigned</option>
            {supervisorOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.profiles?.full_name ?? row.employee_code}
              </option>
            ))}
          </Select>
          <Input label="Joining date" type="date" {...form.register('joining_date')} />
          <Input
            label="Emergency contact"
            hint="Visible to KD operations only — never shown on the client portal."
            {...form.register('emergency_contact')}
          />
          <Select label="Employment status" {...form.register('employment_status')}>
            {EMPLOYMENT_STATUSES.map((status) => (
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

      <Modal title="Employee" open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">Name</dt>
              <dd className="font-medium">{viewing.profiles?.full_name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">Phone</dt>
              <dd>{viewing.profiles?.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">Site / department</dt>
              <dd>
                {viewing.sites?.name ?? '—'} · {viewing.department ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">Job</dt>
              <dd>
                {viewing.job_title ?? viewing.designation} · {viewing.employee_code}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">Emergency contact</dt>
              <dd>{viewing.emergency_contact ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">Joined</dt>
              <dd>{formatDate(viewing.joining_date)}</dd>
            </div>
            <Badge value={viewing.employment_status ?? 'active'} />
          </dl>
        ) : null}
      </Modal>
    </div>
  )
}
