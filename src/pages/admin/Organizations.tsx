import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { canManageOrganizations } from '../../lib/permissions'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import type { Organization } from '../../types/database'

const schema = z.object({
  name: z.string().min(2, 'Organization name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  tagline: z.string().optional(),
  status: z.enum(['active', 'inactive']),
})

type FormValues = z.infer<typeof schema>

export function AdminOrganizationsPage() {
  const { role } = useAuth()
  const [rows, setRows] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Organization | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    setRows((data as Organization[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  if (!canManageOrganizations(role)) {
    return (
      <EmptyState
        title="Platform only"
        body="Organization registry is limited to the KD platform super admin."
      />
    )
  }

  function startCreate() {
    setEditing(null)
    form.reset({
      name: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      tagline: 'Cleaner Spaces | Safer Spaces | Better Living',
      status: 'active',
    })
    setOpen(true)
  }

  function startEdit(row: Organization) {
    setEditing(row)
    form.reset({
      name: row.name,
      email: row.email ?? '',
      phone: row.phone ?? '',
      website: row.website ?? '',
      address: row.address ?? '',
      tagline: row.tagline ?? '',
      status: row.status,
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      website: values.website || null,
      address: values.address || null,
      tagline: values.tagline || null,
      status: values.status,
      updated_at: new Date().toISOString(),
    }

    const result = editing
      ? await supabase.from('organizations').update(payload).eq('id', editing.id).select('id').single()
      : await supabase.from('organizations').insert(payload).select('id').single()

    if (result.error) {
      setError(result.error.message)
      return
    }

    if (!editing && result.data) {
      await supabase.from('organization_settings').insert({ organization_id: result.data.id })
      await supabase.from('audit_logs').insert({
        organization_id: result.data.id,
        action: 'organization.created',
        module: 'organizations',
        record_table: 'organizations',
        record_id: result.data.id,
      })
    }

    setOpen(false)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Organizations"
        subtitle="Each facility-management company is an isolated tenant."
        action={<Button onClick={startCreate}>Add organization</Button>}
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No organizations" />
      ) : (
        <Table headers={['Name', 'Email', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-ink-600">{row.tagline}</p>
              </Td>
              <Td>{row.email ?? '—'}</Td>
              <Td>
                <Badge value={row.status} />
              </Td>
              <Td>
                <Button variant="ghost" onClick={() => startEdit(row)}>
                  Edit
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title={editing ? 'Edit organization' : 'New organization'} open={open} onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Input label="Name" error={form.formState.errors.name?.message} {...form.register('name')} />
          <Input label="Email" type="email" {...form.register('email')} />
          <Input label="Phone" {...form.register('phone')} />
          <Input label="Website" {...form.register('website')} />
          <Textarea label="Address" {...form.register('address')} />
          <Input label="Tagline" {...form.register('tagline')} />
          <Select label="Status" {...form.register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
