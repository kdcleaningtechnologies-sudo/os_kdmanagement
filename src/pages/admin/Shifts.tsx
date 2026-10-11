import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { formatShiftWindow } from '../../lib/shifts'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { FormError } from '../../components/ui/FormError'
import { Input, Select } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import { SHIFT_KINDS, SHIFT_STATUSES, type ShiftWithRelations, type Site } from '../../types/database'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  kind: z.enum(SHIFT_KINDS),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  grace_minutes: z.string(),
  site_id: z.string().optional(),
  status: z.enum(SHIFT_STATUSES),
})

type FormValues = z.infer<typeof schema>

export function AdminShiftsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ShiftWithRelations[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ShiftWithRelations | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    const [{ data, error: queryError }, { data: siteRows }] = await Promise.all([
      supabase.from('shifts').select('*, sites(*)').order('start_time'),
      supabase.from('sites').select('*').order('name'),
    ])
    if (queryError) setError(queryError.message)
    setRows((data as ShiftWithRelations[]) ?? [])
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
      name: '',
      kind: 'morning',
      start_time: '07:00',
      end_time: '15:00',
      grace_minutes: '15',
      site_id: '',
      status: 'active',
    })
    setOpen(true)
  }

  function startEdit(row: ShiftWithRelations) {
    setEditing(row)
    setFormError(null)
    form.reset({
      name: row.name,
      kind: row.kind,
      start_time: row.start_time.slice(0, 5),
      end_time: row.end_time.slice(0, 5),
      grace_minutes: String(row.grace_minutes ?? 15),
      site_id: row.site_id ?? '',
      status: row.status,
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = withOrg(
      {
        name: values.name,
        kind: values.kind,
        start_time: values.start_time,
        end_time: values.end_time,
        grace_minutes: Number(values.grace_minutes) || 15,
        site_id: values.site_id || null,
        status: values.status,
      },
      profile?.organization_id,
    )
    const result = editing
      ? await supabase.from('shifts').update(payload).eq('id', editing.id)
      : await supabase.from('shifts').insert(payload)
    if (result.error) {
      setFormError(result.error.message)
      setError(result.error.message)
      return
    }
    setOpen(false)
    setError(null)
    await load()
  }

  async function deactivate(row: ShiftWithRelations) {
    const next = row.status === 'active' ? 'inactive' : 'active'
    const { error: updateError } = await supabase.from('shifts').update({ status: next }).eq('id', row.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Shifts"
        subtitle="Morning, afternoon, evening, night, or a custom window. Late is measured from shift start plus grace."
        action={<Button onClick={startCreate}>Add shift</Button>}
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No shifts yet" body="Create the windows staff will be rostered against." />
      ) : (
        <Table headers={['Shift', 'Hours', 'Grace', 'Site', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <p className="font-medium">{row.name}</p>
                <Badge value={row.kind} />
              </Td>
              <Td>{formatShiftWindow(row)}</Td>
              <Td>{row.grace_minutes} min</Td>
              <Td>{row.sites?.name ?? 'All sites'}</Td>
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

      <Modal title={editing ? 'Edit shift' : 'New shift'} open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit, () => setFormError('Fill the required fields: name and shift times.'))}
        >
          <FormError message={formError} />
          <Input label="Name" error={form.formState.errors.name?.message} {...form.register('name')} />
          <Select label="Kind" {...form.register('kind')}>
            {SHIFT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Start" type="time" {...form.register('start_time')} />
            <Input label="End" type="time" {...form.register('end_time')} />
          </div>
          <Input
            label="Grace minutes"
            type="number"
            min={0}
            hint="Minutes after start before a punch is marked late."
            {...form.register('grace_minutes')}
          />
          <Select label="Site" hint="Leave as all sites for an org-wide template." {...form.register('site_id')}>
            <option value="">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Select label="Status" {...form.register('status')}>
            {SHIFT_STATUSES.map((status) => (
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
