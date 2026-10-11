import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../../lib/supabaseClient'
import { formatDate } from '../../lib/format'
import { useMyAssignments } from '../../hooks/useAssignments'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import type { LeaveRequest } from '../../types/database'

const schema = z.object({
  employee_id: z.string().min(1),
  from_date: z.string().min(1),
  to_date: z.string().min(1),
  reason: z.string().min(3),
})

type FormValues = z.infer<typeof schema>

export function WorkerLeavePage() {
  const { assignments, loading } = useMyAssignments()
  const [rows, setRows] = useState<LeaveRequest[]>([])
  const [error, setError] = useState<string | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  const ids = assignments.map((row) => row.id)

  async function load() {
    if (!ids.length) return
    const { data, error: queryError } = await supabase
      .from('leave_requests')
      .select('*')
      .in('employee_id', ids)
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    setRows((data as LeaveRequest[]) ?? [])
  }

  useEffect(() => {
    if (!loading && assignments[0]) {
      form.reset({
        employee_id: assignments[0].id,
        from_date: '',
        to_date: '',
        reason: '',
      })
      void load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ids.join(',')])

  async function onSubmit(values: FormValues) {
    const { error: insertError } = await supabase.from('leave_requests').insert({
      ...values,
      status: 'pending',
    })
    if (insertError) {
      setError(insertError.message)
      return
    }
    form.reset({ ...values, from_date: '', to_date: '', reason: '' })
    await load()
  }

  if (loading) return <Spinner />
  if (!assignments.length) return <EmptyState title="No employee record" />

  return (
    <div>
      <PageHeader title="Leave request" subtitle="Admins are notified when you submit." />
      <Card>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          {assignments.length > 1 ? (
            <Select label="Assignment" {...form.register('employee_id')}>
              {assignments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.sites?.name}
                </option>
              ))}
            </Select>
          ) : (
            <input type="hidden" {...form.register('employee_id')} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="From" type="date" {...form.register('from_date')} />
            <Input label="To" type="date" {...form.register('to_date')} />
          </div>
          <Textarea label="Reason" {...form.register('reason')} />
          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
          <Button type="submit" full>
            Submit
          </Button>
        </form>
      </Card>

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <Card key={row.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-950">
                {formatDate(row.from_date)} – {formatDate(row.to_date)}
              </p>
              <p className="text-xs text-ink-600">{row.reason}</p>
            </div>
            <Badge value={row.status} />
          </Card>
        ))}
      </div>
    </div>
  )
}
