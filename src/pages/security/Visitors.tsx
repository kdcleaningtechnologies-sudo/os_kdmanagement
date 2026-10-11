import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMyAssignments } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import type { VisitorWithRelations } from '../../types/database'

const schema = z.object({
  site_id: z.string().min(1),
  visitor_name: z.string().min(2),
  phone: z.string().optional(),
  purpose: z.string().optional(),
  host: z.string().optional(),
  vehicle_number: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function SecurityVisitorsPage() {
  const { assignments, sites, loading } = useMyAssignments()
  const [rows, setRows] = useState<VisitorWithRelations[]>([])
  const [error, setError] = useState<string | null>(null)
  const defaultSite = sites[0]?.id ?? ''
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: useMemo(
      () => ({
        site_id: defaultSite,
        visitor_name: '',
        phone: '',
        purpose: '',
        host: '',
        vehicle_number: '',
      }),
      [defaultSite],
    ),
  })

  async function load() {
    const ids = sites.map((site) => site.id)
    if (!ids.length) return
    const { data, error: queryError } = await supabase
      .from('visitors')
      .select('*, sites(*)')
      .in('site_id', ids)
      .order('entry_time', { ascending: false })
    if (queryError) setError(queryError.message)
    setRows((data as unknown as VisitorWithRelations[]) ?? [])
  }

  useEffect(() => {
    if (!loading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sites.map((site) => site.id).join(',')])

  async function onSubmit(values: FormValues) {
    setError(null)
    const { error: insertError } = await supabase.from('visitors').insert({
      site_id: values.site_id,
      visitor_name: values.visitor_name,
      phone: values.phone || null,
      purpose: values.purpose || null,
      host: values.host || null,
      vehicle_number: values.vehicle_number || null,
      logged_by: assignments[0]?.id ?? null,
      status: 'on_site',
    })
    if (insertError) {
      setError(insertError.message)
      return
    }
    form.reset({ site_id: values.site_id, visitor_name: '', phone: '', purpose: '', host: '', vehicle_number: '' })
    await load()
  }

  async function markExit(id: string) {
    const { error: updateError } = await supabase
      .from('visitors')
      .update({ status: 'exited', exit_time: new Date().toISOString() })
      .eq('id', id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Visitors" subtitle="Name, host, purpose, vehicle, and exit time." />
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
          <Input label="Visitor name" error={form.formState.errors.visitor_name?.message} {...form.register('visitor_name')} />
          <Input label="Phone" {...form.register('phone')} />
          <Input label="Purpose" {...form.register('purpose')} />
          <Input label="Host" {...form.register('host')} />
          <Input label="Vehicle number" {...form.register('vehicle_number')} />
          <Button type="submit" full disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving…' : 'Sign in'}
          </Button>
        </form>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="No visitors logged" />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-950">{row.visitor_name}</p>
                  <p className="text-xs text-ink-600">
                    {row.host ?? 'No host'} · {row.purpose ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-ink-600">In {formatDateTime(row.entry_time)}</p>
                  {row.exit_time ? <p className="text-xs text-ink-600">Out {formatDateTime(row.exit_time)}</p> : null}
                </div>
                <Badge value={row.status} />
              </div>
              {row.status === 'on_site' ? (
                <Button className="mt-3" variant="secondary" full onClick={() => void markExit(row.id)}>
                  Mark exit
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
