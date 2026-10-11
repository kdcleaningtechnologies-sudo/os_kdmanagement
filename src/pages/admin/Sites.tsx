import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { titleCase } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select } from '../../components/ui/Input'
import { FormError } from '../../components/ui/FormError'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import {
  SITE_TYPES,
  type Client,
  type EmployeeWithRelations,
  type Site,
} from '../../types/database'

const schema = z.object({
  name: z.string().min(2, 'Site name is required'),
  client_id: z.string().min(1, 'Select a client'),
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  site_type: z.enum(SITE_TYPES),
  area_sqft: z.string().optional(),
  city: z.string().optional(),
  shift_timings: z.string().optional(),
  services: z.string().optional(),
  geofence_radius: z.string().optional(),
  supervisor_id: z.string().optional(),
  status: z.enum(['active', 'inactive']),
})

type FormValues = z.infer<typeof schema>
type SiteRow = Site & { clients: Client | null }

export function AdminSitesPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<SiteRow[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [supervisors, setSupervisors] = useState<EmployeeWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SiteRow | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    const [{ data, error: queryError }, { data: clientRows }, { data: supervisorRows }] = await Promise.all([
      supabase.from('sites').select('*, clients(*)').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('business_name'),
      supabase.from('employees').select('*, profiles(*), sites!site_id(name)').eq('designation', 'supervisor'),
    ])
    if (queryError) setError(queryError.message)
    setRows((data as SiteRow[]) ?? [])
    setClients((clientRows as Client[]) ?? [])
    setSupervisors((supervisorRows as EmployeeWithRelations[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  function startCreate() {
    setEditing(null)
    setFormError(null)
    const onlyClient = clients.filter((client) => (client.status ?? 'active') === 'active')
    form.reset({
      name: '',
      client_id: onlyClient.length === 1 ? onlyClient[0].id : '',
      address: '',
      latitude: '',
      longitude: '',
      site_type: 'corporate',
      area_sqft: '',
      city: '',
      shift_timings: '',
      services: '',
      geofence_radius: '200',
      supervisor_id: '',
      status: 'active',
    })
    setOpen(true)
  }

  function startEdit(row: SiteRow) {
    setEditing(row)
    setFormError(null)
    form.reset({
      name: row.name,
      client_id: row.client_id ?? '',
      address: row.address ?? '',
      latitude: row.latitude?.toString() ?? '',
      longitude: row.longitude?.toString() ?? '',
      site_type: row.site_type ?? 'commercial',
      area_sqft: row.area_sqft?.toString() ?? '',
      city: row.city ?? '',
      shift_timings: row.shift_timings ?? '',
      services: (row.services ?? []).join(', '),
      geofence_radius: String(row.geofence_radius ?? 200),
      supervisor_id: row.supervisor_id ?? '',
      status: row.status ?? 'active',
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    setFormError(null)
    if (!values.client_id) {
      setFormError('Select a client first. Add a client if the list is empty.')
      return
    }
    const payload = {
      name: values.name.trim(),
      client_id: values.client_id,
      address: values.address || null,
      latitude: values.latitude ? Number(values.latitude) : null,
      longitude: values.longitude ? Number(values.longitude) : null,
      site_type: values.site_type,
      area_sqft: values.area_sqft ? Number(values.area_sqft) : null,
      city: values.city || null,
      shift_timings: values.shift_timings || null,
      services: (values.services ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      geofence_radius: values.geofence_radius ? Number(values.geofence_radius) : 200,
      supervisor_id: values.supervisor_id || null,
      status: values.status,
      organization_id: profile?.organization_id ?? null,
    }
    const result = editing
      ? await supabase.from('sites').update(payload).eq('id', editing.id)
      : await supabase.from('sites').insert(payload)
    if (result.error?.message?.toLowerCase().includes('schema cache')) {
      const core = { ...payload }
      delete (core as { services?: unknown }).services
      delete (core as { shift_timings?: unknown }).shift_timings
      const retry = editing
        ? await supabase.from('sites').update(core).eq('id', editing.id)
        : await supabase.from('sites').insert(core)
      if (retry.error) {
        setFormError(retry.error.message)
        setError(retry.error.message)
        return
      }
    } else if (result.error) {
      setFormError(result.error.message)
      setError(result.error.message)
      return
    }
    setOpen(false)
    setError(null)
    await load()
  }

  async function setStatus(id: string, status: 'active' | 'inactive') {
    const { error: updateError } = await supabase.from('sites').update({ status }).eq('id', id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  const activeClients = clients.filter((client) => (client.status ?? 'active') === 'active')

  return (
    <div>
      <PageHeader
        title="Sites"
        subtitle="Set the map pin once. Workers and guards auto check-in inside the circle and auto check-out when they leave."
        action={<Button onClick={startCreate}>Add site</Button>}
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No sites yet" body="Add a site after the client record exists." />
      ) : (
        <Table headers={['Site', 'Client', 'Type', 'Geofence', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-ink-600">
                  {row.city ?? ''} {row.address ?? ''}
                </p>
              </Td>
              <Td>{row.clients?.business_name ?? '—'}</Td>
              <Td>{titleCase(row.site_type)}</Td>
              <Td>{row.geofence_radius ?? 200}m</Td>
              <Td>
                <Badge value={row.status ?? 'active'} />
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void setStatus(row.id, row.status === 'inactive' ? 'active' : 'inactive')}
                  >
                    {row.status === 'inactive' ? 'Activate' : 'Deactivate'}
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title={editing ? 'Edit site' : 'New site'} open={open} onClose={() => setOpen(false)} wide>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit, () => {
            setFormError('Fill the required fields: site name and client.')
          })}
        >
          {activeClients.length === 0 && !editing ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Add a client first, then come back and save this site.
            </p>
          ) : null}
          <FormError message={formError} />
          <Input label="Site name" error={form.formState.errors.name?.message} {...form.register('name')} />
          <Select label="Client" error={form.formState.errors.client_id?.message} {...form.register('client_id')}>
            <option value="">Select client</option>
            {(editing ? clients : activeClients).map((client) => (
              <option key={client.id} value={client.id}>
                {client.business_name}
              </option>
            ))}
          </Select>
          <Select label="Site type" {...form.register('site_type')}>
            {SITE_TYPES.map((type) => (
              <option key={type} value={type}>
                {titleCase(type)}
              </option>
            ))}
          </Select>
          <Input label="Address" {...form.register('address')} />
          <Input label="City" {...form.register('city')} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Latitude"
              hint="Paste from Google Maps. Required for auto attendance."
              {...form.register('latitude')}
            />
            <Input
              label="Longitude"
              hint="Paste from Google Maps. Required for auto attendance."
              {...form.register('longitude')}
            />
          </div>
          <Input
            label="Geofence radius (meters)"
            hint="Workers inside this circle auto check-in. After they leave it, they auto check-out. Default 200m."
            {...form.register('geofence_radius')}
          />
          <Select label="Site supervisor" {...form.register('supervisor_id')}>
            <option value="">Unassigned</option>
            {supervisors.map((row) => (
              <option key={row.id} value={row.id}>
                {row.profiles?.full_name ?? row.employee_code} — {row.sites?.name ?? 'unassigned site'}
              </option>
            ))}
          </Select>
          <Input label="Area (sqft)" {...form.register('area_sqft')} />
          <Input label="Shift timings" placeholder="07:00–19:00" {...form.register('shift_timings')} />
          <Input
            label="Services"
            hint="Comma separated, e.g. housekeeping, security, pantry"
            {...form.register('services')}
          />
          <Select label="Status" {...form.register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || (activeClients.length === 0 && !editing)}>
              {form.formState.isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
