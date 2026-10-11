import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMyAssignments } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../lib/format'
import { uploadPublicImage } from '../../lib/uploads'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select, Textarea } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { INCIDENT_SEVERITIES, INCIDENT_TYPES, type SecurityIncidentWithRelations } from '../../types/database'

const schema = z.object({
  site_id: z.string().min(1),
  incident_type: z.enum(INCIDENT_TYPES),
  severity: z.enum(INCIDENT_SEVERITIES),
  description: z.string().min(8, 'Describe what happened'),
})

type FormValues = z.infer<typeof schema>

export function SecurityIncidentsPage() {
  const { assignments, sites, loading } = useMyAssignments()
  const [rows, setRows] = useState<SecurityIncidentWithRelations[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const defaultSite = sites[0]?.id ?? ''
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: useMemo(
      () => ({ site_id: defaultSite, incident_type: 'other', severity: 'medium', description: '' }),
      [defaultSite],
    ),
  })

  async function load() {
    const ids = sites.map((site) => site.id)
    if (!ids.length) return
    const { data, error: queryError } = await supabase
      .from('security_incidents')
      .select('*, sites(*)')
      .in('site_id', ids)
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    setRows((data as unknown as SecurityIncidentWithRelations[]) ?? [])
  }

  useEffect(() => {
    if (!loading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sites.map((site) => site.id).join(',')])

  async function onSubmit(values: FormValues) {
    setError(null)
    try {
      const photos: string[] = []
      if (file) {
        const uploaded = await uploadPublicImage('incident-photos', values.site_id, file)
        photos.push(uploaded.url)
      }
      const { error: insertError } = await supabase.from('security_incidents').insert({
        site_id: values.site_id,
        guard_id: assignments[0]?.id ?? null,
        incident_type: values.incident_type,
        severity: values.severity,
        description: values.description,
        photo_url: photos[0] ?? null,
        photos,
      })
      if (insertError) throw insertError
      form.reset({ site_id: values.site_id, incident_type: 'other', severity: 'medium', description: '' })
      setFile(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save incident')
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Incidents" subtitle="Report trespass, theft, fire, medical, or other events." />
      {error ? <p className="mb-3 text-sm font-medium text-rose-600">{error}</p> : null}
      <Card className="mb-5">
        <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
          {sites.length > 1 ? (
            <Select label="Site" {...form.register('site_id')}>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </Select>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" {...form.register('incident_type')}>
              {INCIDENT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select label="Severity" {...form.register('severity')}>
              {INCIDENT_SEVERITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
          <Textarea label="Description" error={form.formState.errors.description?.message} {...form.register('description')} />
          <label className="block text-sm font-medium text-ink-800">
            Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              capture="environment"
              className="mt-1.5 block w-full text-xs"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button type="submit" full disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving…' : 'Log incident'}
          </Button>
        </form>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="No incidents yet" />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-950">{row.sites?.name}</p>
                  <p className="mt-1 text-sm text-ink-700">{row.description}</p>
                  <p className="mt-1 text-xs text-ink-600">{formatDateTime(row.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge value={row.incident_type} />
                  <Badge value={row.severity} />
                  <Badge value={row.status} />
                </div>
              </div>
              {row.photo_url ? (
                <img src={row.photo_url} alt="" className="mt-3 h-28 w-full rounded-xl object-cover" />
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
