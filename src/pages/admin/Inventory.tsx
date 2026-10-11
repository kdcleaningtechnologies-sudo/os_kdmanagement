import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { isLowStock, stockLabel } from '../../lib/inventory'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select } from '../../components/ui/Input'
import { FormError } from '../../components/ui/FormError'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import {
  INVENTORY_CATEGORIES,
  INVENTORY_TX_KINDS,
  type InventoryItemWithSite,
  type InventoryTxKind,
  type Site,
} from '../../types/database'

const itemSchema = z.object({
  site_id: z.string().min(1),
  name: z.string().min(2),
  category: z.enum(INVENTORY_CATEGORIES),
  quantity: z.string().min(1),
  minimum_quantity: z.string().min(1),
  unit: z.string().min(1),
})

const txSchema = z.object({
  kind: z.enum(INVENTORY_TX_KINDS),
  quantity: z.string().min(1),
  note: z.string().optional(),
})

type ItemValues = z.infer<typeof itemSchema>
type TxValues = z.infer<typeof txSchema>

export function AdminInventoryPage() {
  const { user, profile } = useAuth()
  const [rows, setRows] = useState<InventoryItemWithSite[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [itemOpen, setItemOpen] = useState(false)
  const [moving, setMoving] = useState<InventoryItemWithSite | null>(null)
  const itemForm = useForm<ItemValues>({ resolver: zodResolver(itemSchema) })
  const txForm = useForm<TxValues>({ resolver: zodResolver(txSchema), defaultValues: { kind: 'in' } })

  async function load() {
    setLoading(true)
    const [itemRes, siteRes] = await Promise.all([
      supabase.from('inventory_items').select('*, sites(*)').order('name'),
      supabase.from('sites').select('*').order('name'),
    ])
    if (itemRes.error) setError(itemRes.error.message)
    setRows((itemRes.data as unknown as InventoryItemWithSite[]) ?? [])
    setSites((siteRes.data as Site[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const low = useMemo(() => rows.filter(isLowStock), [rows])

  async function addItem(values: ItemValues) {
    setFormError(null)
    const { error: insertError } = await supabase.from('inventory_items').insert(
      withOrg(
        {
          site_id: values.site_id,
          name: values.name,
          category: values.category,
          quantity: Number(values.quantity),
          minimum_quantity: Number(values.minimum_quantity),
          unit: values.unit,
        },
        profile?.organization_id,
      ),
    )
    if (insertError) {
      setFormError(insertError.message)
      setError(insertError.message)
      return
    }
    setItemOpen(false)
    itemForm.reset()
    await load()
  }

  async function moveStock(values: TxValues) {
    if (!moving) return
    const qty = Number(values.quantity)
    if (values.kind === 'out' && qty > Number(moving.quantity)) {
      setError('Not enough stock for that issue.')
      return
    }
    const { error: insertError } = await supabase.from('inventory_transactions').insert(
      withOrg(
        {
          item_id: moving.id,
          site_id: moving.site_id,
          kind: values.kind as InventoryTxKind,
          quantity: qty,
          note: values.note || null,
          created_by: user?.id ?? null,
        },
        profile?.organization_id,
      ),
    )
    if (insertError) {
      setError(insertError.message)
      return
    }
    setMoving(null)
    txForm.reset({ kind: 'in', quantity: '', note: '' })
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Chemicals, PPE, and consumables. Quantity at or below the minimum is flagged."
        action={
          <Button
            onClick={() => {
              setFormError(null)
              setItemOpen(true)
            }}
          >
            Add item
          </Button>
        }
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {low.length > 0 ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          Low stock: {low.map((item) => item.name).join(', ')}
        </p>
      ) : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No inventory items" />
      ) : (
        <Table headers={['Item', 'Site', 'Category', 'On hand', 'Min', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="font-medium">{row.name}</Td>
              <Td>{row.sites?.name ?? '—'}</Td>
              <Td>
                <Badge value={row.category} />
              </Td>
              <Td>
                {stockLabel(row)}
                {isLowStock(row) ? <span className="ml-2 text-xs font-semibold text-rose-700">Low</span> : null}
              </Td>
              <Td>
                {row.minimum_quantity} {row.unit}
              </Td>
              <Td>
                <Button variant="secondary" onClick={() => setMoving(row)}>
                  Stock move
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title="Add inventory item" open={itemOpen} onClose={() => setItemOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={itemForm.handleSubmit(addItem, () => setFormError('Fill the required fields: site, name, and quantity.'))}
        >
          <FormError message={formError} />
          <Select label="Site" error={itemForm.formState.errors.site_id?.message} {...itemForm.register('site_id')}>
            <option value="">Select site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Input label="Item" error={itemForm.formState.errors.name?.message} {...itemForm.register('name')} />
          <Select label="Category" {...itemForm.register('category')}>
            {INVENTORY_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Quantity" {...itemForm.register('quantity')} />
            <Input label="Minimum" {...itemForm.register('minimum_quantity')} />
            <Input label="Unit" {...itemForm.register('unit')} />
          </div>
          <Button type="submit" full>
            Save item
          </Button>
        </form>
      </Modal>

      <Modal title={moving ? `Move ${moving.name}` : 'Stock move'} open={Boolean(moving)} onClose={() => setMoving(null)}>
        <form className="space-y-3" onSubmit={txForm.handleSubmit(moveStock)}>
          <Select label="Type" {...txForm.register('kind')}>
            <option value="in">Stock in</option>
            <option value="out">Stock out</option>
            <option value="adjust">Set quantity</option>
          </Select>
          <Input label="Quantity" {...txForm.register('quantity')} />
          <Input label="Note" {...txForm.register('note')} />
          <Button type="submit" full>
            Record
          </Button>
        </form>
      </Modal>
    </div>
  )
}
