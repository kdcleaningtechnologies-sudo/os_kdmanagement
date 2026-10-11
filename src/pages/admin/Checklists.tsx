import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { FormError } from '../../components/ui/FormError'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import {
  DIRECTORY_STATUSES,
  SITE_TYPES,
  type ChecklistTemplateWithRelations,
  type Site,
  type SiteType,
} from '../../types/database'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  site_type: z.string().optional(),
  site_id: z.string().optional(),
  items_text: z.string().min(1, 'Add at least one checklist item'),
  status: z.enum(DIRECTORY_STATUSES),
})

type FormValues = z.infer<typeof schema>

export function AdminChecklistsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ChecklistTemplateWithRelations[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ChecklistTemplateWithRelations | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    const [{ data, error: queryError }, { data: siteRows }] = await Promise.all([
      supabase
        .from('checklist_templates')
        .select('*, sites(*), checklist_template_items(*)')
        .order('created_at', { ascending: false }),
      supabase.from('sites').select('*').order('name'),
    ])
    if (queryError) setError(queryError.message)
    const list = ((data as unknown as ChecklistTemplateWithRelations[]) ?? []).map((row) => ({
      ...row,
      checklist_template_items: [...(row.checklist_template_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    }))
    setRows(list)
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
      site_type: '',
      site_id: '',
      items_text: '',
      status: 'active',
    })
    setOpen(true)
  }

  function startEdit(row: ChecklistTemplateWithRelations) {
    setEditing(row)
    setFormError(null)
    form.reset({
      name: row.name,
      site_type: row.site_type ?? '',
      site_id: row.site_id ?? '',
      items_text: (row.checklist_template_items ?? []).map((item) => item.label).join('\n'),
      status: row.status,
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const labels = values.items_text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    setFormError(null)
    const payload = withOrg(
      {
        name: values.name,
        site_type: (values.site_type || null) as SiteType | null,
        site_id: values.site_id || null,
        status: values.status,
      },
      profile?.organization_id,
    )
    const saved = editing
      ? await supabase.from('checklist_templates').update(payload).eq('id', editing.id).select('id').single()
      : await supabase.from('checklist_templates').insert(payload).select('id').single()
    if (saved.error || !saved.data) {
      const message = saved.error?.message ?? 'Could not save checklist'
      setFormError(message)
      setError(message)
      return
    }
    const templateId = saved.data.id
    if (editing) {
      const { error: deleteError } = await supabase
        .from('checklist_template_items')
        .delete()
        .eq('template_id', templateId)
      if (deleteError) {
        setError(deleteError.message)
        return
      }
    }
    const { error: itemsError } = await supabase.from('checklist_template_items').insert(
      labels.map((label, index) =>
        withOrg(
          {
            template_id: templateId,
            label,
            sort_order: index + 1,
          },
          profile?.organization_id,
        ),
      ),
    )
    if (itemsError) {
      setError(itemsError.message)
      return
    }
    setOpen(false)
    await load()
  }

  async function deactivate(row: ChecklistTemplateWithRelations) {
    const next = row.status === 'active' ? 'inactive' : 'active'
    const { error: updateError } = await supabase.from('checklist_templates').update({ status: next }).eq('id', row.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Checklists"
        subtitle="Reusable cleaning lists by site type. Supervisors apply these when they create a task."
        action={<Button onClick={startCreate}>Add checklist</Button>}
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No checklists yet" body="Start with corporate, warehouse, or a site-specific list." />
      ) : (
        <Table headers={['Checklist', 'Applies to', 'Items', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="font-medium">{row.name}</Td>
              <Td>
                {row.sites?.name ?? (row.site_type ? row.site_type : 'All sites')}
              </Td>
              <Td className="text-ink-600">{row.checklist_template_items?.length ?? 0} items</Td>
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

      <Modal title={editing ? 'Edit checklist' : 'New checklist'} open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit, () =>
            setFormError('Fill the required fields: name and at least one checklist item.'),
          )}
        >
          <FormError message={formError} />
          <Input label="Name" error={form.formState.errors.name?.message} {...form.register('name')} />
          <Select label="Site type" {...form.register('site_type')}>
            <option value="">Any type</option>
            {SITE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          <Select label="Site" hint="Optional. Use this for a list that only applies to one building." {...form.register('site_id')}>
            <option value="">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Textarea
            label="Items"
            hint="One area per line — reception, washroom, loading bay…"
            error={form.formState.errors.items_text?.message}
            {...form.register('items_text')}
          />
          <Select label="Status" {...form.register('status')}>
            {DIRECTORY_STATUSES.map((status) => (
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
