import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { formatCurrency, formatDate } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { FormError } from '../../components/ui/FormError'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import { ASSET_CONDITIONS, type AssetMaintenance, type AssetWithRelations, type Site } from '../../types/database'

const assetSchema = z.object({
  site_id: z.string().min(1),
  asset_code: z.string().optional(),
  name: z.string().min(2),
  serial_number: z.string().optional(),
  purchase_date: z.string().optional(),
  warranty_end: z.string().optional(),
  last_service: z.string().optional(),
  next_service: z.string().optional(),
  condition: z.enum(ASSET_CONDITIONS),
})

const serviceSchema = z.object({
  service_date: z.string().min(1),
  next_service: z.string().optional(),
  cost: z.string().optional(),
  notes: z.string().optional(),
})

type AssetValues = z.infer<typeof assetSchema>
type ServiceValues = z.infer<typeof serviceSchema>

export function AdminAssetsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<AssetWithRelations[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [assetOpen, setAssetOpen] = useState(false)
  const [servicing, setServicing] = useState<AssetWithRelations | null>(null)
  const assetForm = useForm<AssetValues>({ resolver: zodResolver(assetSchema) })
  const serviceForm = useForm<ServiceValues>({ resolver: zodResolver(serviceSchema) })

  async function load() {
    setLoading(true)
    const [assetRes, siteRes] = await Promise.all([
      supabase.from('assets').select('*, sites(*), asset_maintenance(*)').order('name'),
      supabase.from('sites').select('*').order('name'),
    ])
    if (assetRes.error) setError(assetRes.error.message)
    setRows((assetRes.data as unknown as AssetWithRelations[]) ?? [])
    setSites((siteRes.data as Site[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const dueSoon = useMemo(() => {
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + 30)
    const limit = horizon.toISOString().slice(0, 10)
    return rows.filter((row) => row.next_service && row.next_service <= limit)
  }, [rows])

  async function addAsset(values: AssetValues) {
    setFormError(null)
    const { error: insertError } = await supabase.from('assets').insert(
      withOrg(
        {
          site_id: values.site_id,
          asset_code: values.asset_code || null,
          name: values.name,
          serial_number: values.serial_number || null,
          purchase_date: values.purchase_date || null,
          warranty_end: values.warranty_end || null,
          last_service: values.last_service || null,
          next_service: values.next_service || null,
          condition: values.condition,
        },
        profile?.organization_id,
      ),
    )
    if (insertError) {
      setFormError(insertError.message)
      setError(insertError.message)
      return
    }
    setAssetOpen(false)
    assetForm.reset()
    await load()
  }

  async function addService(values: ServiceValues) {
    if (!servicing) return
    const { error: insertError } = await supabase.from('asset_maintenance').insert(
      withOrg(
        {
          asset_id: servicing.id,
          service_date: values.service_date,
          next_service: values.next_service || null,
          cost: values.cost ? Number(values.cost) : null,
          notes: values.notes || null,
        },
        profile?.organization_id,
      ),
    )
    if (insertError) {
      setError(insertError.message)
      return
    }
    await supabase
      .from('assets')
      .update({
        last_service: values.service_date,
        next_service: values.next_service || servicing.next_service,
      })
      .eq('id', servicing.id)
    setServicing(null)
    serviceForm.reset()
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle="Machines on site — serial, warranty, and service dates."
        action={
          <Button
            onClick={() => {
              setFormError(null)
              setAssetOpen(true)
            }}
          >
            Add asset
          </Button>
        }
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {dueSoon.length > 0 ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          Service due or overdue: {dueSoon.map((row) => row.name).join(', ')}
        </p>
      ) : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No assets" />
      ) : (
        <Table headers={['Asset', 'Site', 'Serial', 'Warranty', 'Next service', 'Condition', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-ink-600">{row.asset_code ?? '—'}</p>
              </Td>
              <Td>{row.sites?.name ?? '—'}</Td>
              <Td>{row.serial_number ?? '—'}</Td>
              <Td>{formatDate(row.warranty_end)}</Td>
              <Td>{formatDate(row.next_service)}</Td>
              <Td>
                <Badge value={row.condition} />
              </Td>
              <Td>
                <Button variant="secondary" onClick={() => setServicing(row)}>
                  Log service
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title="Add asset" open={assetOpen} onClose={() => setAssetOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={assetForm.handleSubmit(addAsset, () => setFormError('Fill the required fields: site and name.'))}
        >
          <FormError message={formError} />
          <Select label="Site" error={assetForm.formState.errors.site_id?.message} {...assetForm.register('site_id')}>
            <option value="">Select site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Input label="Name" error={assetForm.formState.errors.name?.message} {...assetForm.register('name')} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Asset code" {...assetForm.register('asset_code')} />
            <Input label="Serial" {...assetForm.register('serial_number')} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Purchase" type="date" {...assetForm.register('purchase_date')} />
            <Input label="Warranty end" type="date" {...assetForm.register('warranty_end')} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Last service" type="date" {...assetForm.register('last_service')} />
            <Input label="Next service" type="date" {...assetForm.register('next_service')} />
          </div>
          <Select label="Condition" {...assetForm.register('condition')}>
            {ASSET_CONDITIONS.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
          <Button type="submit" full>
            Save asset
          </Button>
        </form>
      </Modal>

      <Modal title={servicing ? `Service ${servicing.name}` : 'Service'} open={Boolean(servicing)} onClose={() => setServicing(null)}>
        <form className="space-y-3" onSubmit={serviceForm.handleSubmit(addService)}>
          <Input label="Service date" type="date" {...serviceForm.register('service_date')} />
          <Input label="Next service" type="date" {...serviceForm.register('next_service')} />
          <Input label="Cost" {...serviceForm.register('cost')} />
          <Textarea label="Notes" {...serviceForm.register('notes')} />
          {servicing?.asset_maintenance?.length ? (
            <p className="text-xs text-ink-600">
              Last logged:{' '}
              {formatDate(
                [...(servicing.asset_maintenance as AssetMaintenance[])].sort((a, b) =>
                  b.service_date.localeCompare(a.service_date),
                )[0]?.service_date,
              )}{' '}
              {servicing.asset_maintenance[0]?.cost != null
                ? `(${formatCurrency(servicing.asset_maintenance[0].cost)})`
                : ''}
            </p>
          ) : null}
          <Button type="submit" full>
            Save service
          </Button>
        </form>
      </Modal>
    </div>
  )
}
