import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { useMyClients } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../lib/format'
import { uploadPublicImage } from '../../lib/uploads'
import { ComplaintThread } from '../../components/ComplaintThread'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import {
  COMPLAINT_CATEGORIES,
  TASK_PRIORITIES,
  type ComplaintWithRelations,
  type DocumentItem,
} from '../../types/database'

const schema = z.object({
  site_id: z.string().min(1),
  title: z.string().min(3, 'Add a short title'),
  category: z.enum(COMPLAINT_CATEGORIES),
  priority: z.enum(TASK_PRIORITIES),
  description: z.string().min(8, 'Please describe the issue'),
})

type FormValues = z.infer<typeof schema>

export function ClientComplaintsPage() {
  const { user } = useAuth()
  const { sites, clients, loading } = useMyClients()
  const [rows, setRows] = useState<ComplaintWithRelations[]>([])
  const [viewing, setViewing] = useState<ComplaintWithRelations | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    const ids = clients.map((client) => client.id)
    if (!ids.length) return
    const { data, error: queryError } = await supabase
      .from('complaints')
      .select('*, sites(*), complaint_comments(*, profiles(*))')
      .in('client_id', ids)
      .order('raised_at', { ascending: false })
    if (queryError) setError(queryError.message)
    const list = ((data as unknown as ComplaintWithRelations[]) ?? []).map((row) => ({
      ...row,
      complaint_comments: [...(row.complaint_comments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
    setRows(list)
    if (viewing) setViewing(list.find((row) => row.id === viewing.id) ?? null)
  }

  useEffect(() => {
    if (!loading) {
      if (sites[0]) {
        form.reset({
          site_id: sites[0].id,
          title: '',
          category: 'general',
          priority: 'medium',
          description: '',
        })
      }
      void load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sites.map((s) => s.id).join(','), clients.map((c) => c.id).join(',')])

  async function onSubmit(values: FormValues) {
    const site = sites.find((item) => item.id === values.site_id)
    const photos: DocumentItem[] = []
    try {
      for (const file of files) {
        const uploaded = await uploadPublicImage('complaint-photos', values.site_id, file)
        photos.push({ name: file.name, url: uploaded.url })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed')
      return
    }
    const { error: insertError } = await supabase.from('complaints').insert({
      site_id: values.site_id,
      client_id: site?.client_id ?? clients[0]?.id ?? null,
      title: values.title,
      category: values.category,
      priority: values.priority,
      description: values.description,
      photos,
      created_by: user?.id ?? null,
      status: 'open',
    })
    if (insertError) {
      setError(insertError.message)
      return
    }
    setFiles([])
    form.reset({ ...values, title: '', description: '' })
    await load()
  }

  async function confirmResolved(id: string) {
    const { error: updateError } = await supabase
      .from('complaints')
      .update({ status: 'client_confirmed' })
      .eq('id', id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Complaints" subtitle="Raise an issue with photos, then confirm when operations have fixed it." />
      <Card className="mb-6">
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Select label="Site" {...form.register('site_id')}>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Input label="Title" error={form.formState.errors.title?.message} {...form.register('title')} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Category" {...form.register('category')}>
              {COMPLAINT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select label="Priority" {...form.register('priority')}>
              {TASK_PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
          <Textarea label="What happened?" error={form.formState.errors.description?.message} {...form.register('description')} />
          <label className="block text-sm font-medium text-ink-800">
            Photos
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              className="mt-1 block w-full text-sm"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 6))}
            />
          </label>
          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
          <Button type="submit">Submit complaint</Button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No complaints yet" />
      ) : (
        <Table headers={['Raised', 'Issue', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>{formatDateTime(row.raised_at)}</Td>
              <Td>
                <p className="font-medium">{row.title ?? row.description}</p>
                <p className="text-xs text-ink-600">{row.category}</p>
              </Td>
              <Td>
                <Badge value={row.status} />
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

      <Modal title={viewing?.title ?? 'Complaint'} open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-800">{viewing.description}</p>
            <Badge value={viewing.status} />
            {viewing.photos?.length ? (
              <div className="grid grid-cols-2 gap-2">
                {viewing.photos.map((photo) => (
                  <img key={photo.url} src={photo.url} alt={photo.name} className="h-28 w-full rounded-xl object-cover" />
                ))}
              </div>
            ) : null}
            {viewing.status === 'resolved' ? (
              <Button full onClick={() => void confirmResolved(viewing.id)}>
                Confirm this is fixed
              </Button>
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
