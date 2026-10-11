import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { todayISODate } from '../../lib/format'
import { useMyAssignments } from '../../hooks/useAssignments'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select, Textarea } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'

const schema = z.object({
  site_id: z.string().min(1),
  body: z.string().min(8, 'Write what the next shift needs to know'),
})

type FormValues = z.infer<typeof schema>

export function SupervisorHandoverPage() {
  const { profile } = useAuth()
  const { sites, loading } = useMyAssignments()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const defaultSite = sites[0]?.id ?? ''
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: useMemo(() => ({ site_id: defaultSite, body: '' }), [defaultSite]),
  })

  async function onSubmit(values: FormValues) {
    setError(null)
    setDone(false)
    const site = sites.find((item) => item.id === values.site_id)
    const { error: insertError } = await supabase.from('announcements').insert(
      withOrg(
        {
          title: `Handover · ${site?.name ?? 'Site'} · ${todayISODate()}`,
          body: values.body,
          target_role: 'all',
        },
        profile?.organization_id,
      ),
    )
    if (insertError) {
      setError(insertError.message)
      return
    }
    form.reset({ site_id: values.site_id, body: '' })
    setDone(true)
  }

  if (loading) return <Spinner />
  if (!sites.length) {
    return <EmptyState title="No managed sites" body="Ask admin to assign your supervisor profile to a site." />
  }

  return (
    <div>
      <PageHeader
        title="Shift handover"
        subtitle="Notes go to staff News so the next shift sees open work, keys, and visitors."
      />
      <Card>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Select label="Site" {...form.register('site_id')}>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Textarea
            label="Handover notes"
            error={form.formState.errors.body?.message}
            {...form.register('body')}
          />
          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
          {done ? (
            <p className="rounded-xl bg-tide-50 px-3 py-2 text-sm text-ink-800">Handover posted to News.</p>
          ) : null}
          <Button type="submit" full>
            Post handover
          </Button>
        </form>
      </Card>
    </div>
  )
}
