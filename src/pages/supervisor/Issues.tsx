import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { useMyAssignments } from '../../hooks/useAssignments'
import { formatDateTime } from '../../lib/format'
import { uploadPublicImage } from '../../lib/uploads'
import { ComplaintThread } from '../../components/ComplaintThread'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import {
  COMPLAINT_CATEGORIES,
  TASK_PRIORITIES,
  type ComplaintWithRelations,
  type DocumentItem,
} from '../../types/database'

const schema = z.object({
  site_id: z.string().min(1),
  title: z.string().min(3),
  category: z.enum(COMPLAINT_CATEGORIES),
  priority: z.enum(TASK_PRIORITIES),
  description: z.string().min(8, 'Describe the issue'),
})

type FormValues = z.infer<typeof schema>

export function SupervisorIssuesPage() {
  const { user } = useAuth()
  const { sites, loading } = useMyAssignments()
  const [rows, setRows] = useState<ComplaintWithRelations[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const defaultSite = sites[0]?.id ?? ''
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: useMemo(
      () => ({ site_id: defaultSite, title: '', category: 'general', priority: 'medium', description: '' }),
      [defaultSite],
    ),
  })

  async function load() {
    const ids = sites.map((site) => site.id)
    if (!ids.length) return
    const { data, error: queryError } = await supabase
      .from('complaints')
      .select('*, complaint_comments(*, profiles(*))')
      .in('site_id', ids)
      .order('raised_at', { ascending: false })
    if (queryError) setError(queryError.message)
    setRows(
      ((data as unknown as ComplaintWithRelations[]) ?? []).map((row) => ({
        ...row,
        complaint_comments: [...(row.complaint_comments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      })),
    )
  }

  useEffect(() => {
    if (!loading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sites.map((site) => site.id).join(',')])

  async function onSubmit(values: FormValues) {
    setError(null)
    setDone(false)
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
      client_id: site?.client_id ?? null,
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
    setDone(true)
    setFiles([])
    form.reset({ ...values, title: '', description: '' })
    await load()
  }

  if (loading) return <Spinner />
  if (!sites.length) return <EmptyState title="No managed sites" />

  return (
    <div>
      <PageHeader title="Site issues" subtitle="Raise a maintenance issue with photos. It goes to the operations queue." />
      <Card>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Select label="Site" {...form.register('site_id')}>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Input label="Title" error={form.formState.errors.title?.message} {...form.register('title')} />
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
          <Textarea label="Issue" error={form.formState.errors.description?.message} {...form.register('description')} />
          <label className="block text-sm font-medium text-ink-800">
            Photos
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              capture="environment"
              multiple
              className="mt-1 block w-full text-sm"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 6))}
            />
          </label>
          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
          {done ? <p className="text-sm font-medium text-emerald-700">Issue sent to operations.</p> : null}
          <Button type="submit" full>
            Raise issue
          </Button>
        </form>
      </Card>

      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <EmptyState title="No issues on your sites" />
        ) : (
          rows.map((row) => (
            <Card key={row.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-950">{row.title ?? row.description}</p>
                  <p className="text-xs text-ink-600">{formatDateTime(row.raised_at)}</p>
                </div>
                <Badge value={row.status} />
              </div>
              <p className="text-sm text-ink-700">{row.description}</p>
              <ComplaintThread
                complaintId={row.id}
                comments={row.complaint_comments ?? []}
                profileId={user?.id}
                onPosted={load}
              />
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
