import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { useMyAssignments } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { isLowStock, stockLabel } from '../../lib/inventory'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import type { InventoryItemWithSite } from '../../types/database'

const schema = z.object({
  quantity: z.string().min(1),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function SupervisorInventoryPage() {
  const { user } = useAuth()
  const { sites, loading } = useMyAssignments()
  const [rows, setRows] = useState<InventoryItemWithSite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [issuing, setIssuing] = useState<InventoryItemWithSite | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })
  const ids = sites.map((site) => site.id)

  async function load() {
    if (!ids.length) return
    const { data, error: queryError } = await supabase
      .from('inventory_items')
      .select('*, sites(*)')
      .in('site_id', ids)
      .order('name')
    if (queryError) setError(queryError.message)
    setRows((data as unknown as InventoryItemWithSite[]) ?? [])
  }

  useEffect(() => {
    if (!loading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ids.join(',')])

  async function issue(values: FormValues) {
    if (!issuing) return
    const qty = Number(values.quantity)
    if (qty > Number(issuing.quantity)) {
      setError('Not enough stock.')
      return
    }
    const { error: insertError } = await supabase.from('inventory_transactions').insert({
      item_id: issuing.id,
      site_id: issuing.site_id,
      kind: 'out',
      quantity: qty,
      note: values.note || null,
      created_by: user?.id ?? null,
    })
    if (insertError) {
      setError(insertError.message)
      return
    }
    setIssuing(null)
    form.reset()
    await load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Stock" subtitle="Issue consumables from your sites. Low stock is marked." />
      {error ? <p className="mb-3 text-sm font-medium text-rose-600">{error}</p> : null}
      {rows.length === 0 ? (
        <EmptyState title="No stock on your sites" />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-ink-600">
                    {row.sites?.name} · {stockLabel(row)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge value={row.category} />
                  {isLowStock(row) ? <Badge value="low" /> : null}
                  <Button variant="secondary" onClick={() => setIssuing(row)}>
                    Issue
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal title={issuing ? `Issue ${issuing.name}` : 'Issue'} open={Boolean(issuing)} onClose={() => setIssuing(null)}>
        <form className="space-y-3" onSubmit={form.handleSubmit(issue)}>
          <Input label="Quantity" {...form.register('quantity')} />
          <Input label="Note" {...form.register('note')} />
          <Button type="submit" full>
            Confirm issue
          </Button>
        </form>
      </Modal>
    </div>
  )
}
