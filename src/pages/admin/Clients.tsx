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
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import type { ClientWithCompany, Profile } from '../../types/database'

const schema = z.object({
  business_name: z.string().min(2, 'Client name is required'),
  company_name: z.string().optional(),
  contact_person: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  gst_number: z.string().optional(),
  profile_id: z.string().optional(),
  status: z.enum(['active', 'inactive']),
})

type FormValues = z.infer<typeof schema>

export function AdminClientsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ClientWithCompany[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<ClientWithCompany | null>(null)
  const [editing, setEditing] = useState<ClientWithCompany | null>(null)
  const [removing, setRemoving] = useState<ClientWithCompany | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    const [{ data, error: queryError }, { data: profileRows }] = await Promise.all([
      supabase.from('clients').select('*, companies(*)').order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .in('role', ['client', 'client_admin', 'client_user'])
        .eq('access_status', 'active')
        .order('full_name'),
    ])
    if (queryError) setError(queryError.message)
    setRows((data as ClientWithCompany[]) ?? [])
    setProfiles((profileRows as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  function startCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({
      business_name: '',
      company_name: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      address: '',
      gst_number: '',
      profile_id: '',
      status: 'active',
    })
    setOpen(true)
  }

  function startEdit(row: ClientWithCompany) {
    setEditing(row)
    setFormError(null)
    form.reset({
      business_name: row.business_name,
      company_name: row.companies?.name ?? '',
      contact_person: row.contact_person ?? '',
      contact_email: row.contact_email ?? '',
      contact_phone: row.contact_phone ?? '',
      address: row.address ?? '',
      gst_number: row.gst_number ?? '',
      profile_id: row.profile_id ?? '',
      status: row.status ?? 'active',
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    setError(null)
    setFormError(null)
    const orgId = profile?.organization_id ?? null
    let companyId = editing?.company_id ?? null
    if (values.company_name) {
      if (companyId) {
        await supabase.from('companies').update({ name: values.company_name }).eq('id', companyId)
      } else {
        const { data, error: companyError } = await supabase
          .from('companies')
          .insert(withOrg({ name: values.company_name }, orgId))
          .select('id')
          .single()
        if (companyError) {
          setFormError(companyError.message)
          setError(companyError.message)
          return
        }
        companyId = data.id
      }
    }

    const payload = withOrg(
      {
        business_name: values.business_name,
        contact_person: values.contact_person || null,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
        address: values.address || null,
        gst_number: values.gst_number || null,
        profile_id: values.profile_id || null,
        company_id: companyId,
        status: values.status,
      },
      orgId,
    )

    const result = editing
      ? await supabase.from('clients').update(payload).eq('id', editing.id)
      : await supabase.from('clients').insert(payload)

    if (result.error) {
      setFormError(result.error.message)
      setError(result.error.message)
      return
    }
    setOpen(false)
    setError(null)
    await load()
  }

  async function setStatus(id: string, status: 'active' | 'inactive') {
    const { error: updateError } = await supabase.from('clients').update({ status }).eq('id', id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  async function removeClient(row: ClientWithCompany) {
    const { error: deleteError } = await supabase.from('clients').delete().eq('id', row.id)
    setRemoving(null)
    if (deleteError) setError(deleteError.message)
    else await load()
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Contracted site owners — corporates, RWAs, hospitals, and other facilities you serve."
        action={<Button onClick={startCreate}>Add client</Button>}
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No clients yet" body="Create a client to attach sites and contracts." />
      ) : (
        <Table headers={['Client', 'Contact', 'GST', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <p className="font-medium">{row.business_name}</p>
                <p className="text-xs text-ink-600">{row.companies?.name ?? '—'}</p>
              </Td>
              <Td>
                <p>{row.contact_person ?? '—'}</p>
                <p className="text-xs text-ink-600">{row.contact_email ?? row.contact_phone ?? ''}</p>
              </Td>
              <Td className="font-mono text-xs">{row.gst_number ?? '—'}</Td>
              <Td>
                <Badge value={row.status ?? 'active'} />
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setViewing(row)}>
                    View
                  </Button>
                  <Button variant="ghost" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void setStatus(row.id, row.status === 'inactive' ? 'active' : 'inactive')}
                  >
                    {row.status === 'inactive' ? 'Activate' : 'Deactivate'}
                  </Button>
                  <Button variant="ghost" onClick={() => setRemoving(row)}>
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title={editing ? 'Edit client' : 'New client'} open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit, () => setFormError('Fill the required fields: client name is required.'))}
        >
          <FormError message={formError} />
          <Input label="Client name" error={form.formState.errors.business_name?.message} {...form.register('business_name')} />
          <Input label="Legal company name" {...form.register('company_name')} />
          <Input label="Contact person" {...form.register('contact_person')} />
          <Input label="Email" type="email" {...form.register('contact_email')} />
          <Input label="Phone" {...form.register('contact_phone')} />
          <Textarea label="Address" {...form.register('address')} />
          <Input label="GST number" {...form.register('gst_number')} />
          <Select label="Client portal user" {...form.register('profile_id')}>
            <option value="">Unassigned</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name}
              </option>
            ))}
          </Select>
          <Select label="Status" {...form.register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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

      <Modal title="Delete client" open={Boolean(removing)} onClose={() => setRemoving(null)}>
        {removing ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-700">
              Delete <span className="font-semibold text-ink-950">{removing.business_name}</span>? Sites and contracts
              for this client will be removed.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setRemoving(null)}>
                Keep
              </Button>
              <Button type="button" variant="danger" onClick={() => void removeClient(removing)}>
                Delete
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title="Client" open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">Client</dt>
              <dd className="font-medium text-ink-950">{viewing.business_name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">Company</dt>
              <dd>{viewing.companies?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">Contact</dt>
              <dd>
                {viewing.contact_person ?? '—'}
                <br />
                {viewing.contact_email ?? ''} {viewing.contact_phone ?? ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">Address</dt>
              <dd>{viewing.address ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">GST</dt>
              <dd className="font-mono">{viewing.gst_number ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-600 uppercase">Status</dt>
              <dd>
                <Badge value={viewing.status ?? 'active'} />
              </dd>
            </div>
            <p className="text-xs text-ink-600">Added {formatDate(viewing.created_at)}</p>
          </dl>
        ) : null}
      </Modal>
    </div>
  )
}
