import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { formatDateTime } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { FormError } from '../../components/ui/FormError'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import type { Announcement } from '../../types/database'

const schema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  target_role: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

export function AdminAnnouncementsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    setRows((data as Announcement[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSubmit(values: FormValues) {
    setFormError(null)
    const { error: insertError } = await supabase.from('announcements').insert(withOrg(values, profile?.organization_id))
    if (insertError) {
      setFormError(insertError.message)
      setError(insertError.message)
      return
    }
    setOpen(false)
    form.reset()
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Broadcast to a role or everyone."
        action={
          <Button
            onClick={() => {
              setFormError(null)
              form.reset({ title: '', body: '', target_role: 'all' })
              setOpen(true)
            }}
          >
            New announcement
          </Button>
        }
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No announcements" />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <p className="text-xs font-semibold tracking-wide text-tide-600 uppercase">{row.target_role}</p>
              <h2 className="mt-1 font-semibold text-ink-950">{row.title}</h2>
              <p className="mt-2 text-sm text-ink-700">{row.body}</p>
              <p className="mt-3 text-xs text-ink-600">{formatDateTime(row.created_at)}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal title="New announcement" open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit, () => setFormError('Fill the required fields: title and body.'))}
        >
          <FormError message={formError} />
          <Input label="Title" error={form.formState.errors.title?.message} {...form.register('title')} />
          <Textarea label="Body" {...form.register('body')} />
          <Select label="Audience" {...form.register('target_role')}>
            <option value="all">All roles</option>
            <option value="worker">Workers</option>
            <option value="supervisor">Supervisors</option>
            <option value="client">Clients</option>
            <option value="super_admin">Admins</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Publishing…' : 'Publish'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
