import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { formatCurrency, formatDate, titleCase, todayISODate } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { FormError } from '../../components/ui/FormError'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import { BILLING_TYPES, type Client, type Contract } from '../../types/database'

const schema = z.object({
  client_id: z.string().min(1, 'Select a client'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  sla_terms: z.string().optional(),
  billing_type: z.enum(BILLING_TYPES),
  rate: z.string().min(1, 'Rate is required'),
})

type FormValues = z.infer<typeof schema>
type ContractRow = Contract & { clients: Client | null }

export function AdminContractsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ContractRow[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ContractRow | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    const [{ data, error: queryError }, { data: clientRows }] = await Promise.all([
      supabase.from('contracts').select('*, clients(*)').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('business_name'),
    ])
    if (queryError) setError(queryError.message)
    setRows((data as ContractRow[]) ?? [])
    setClients((clientRows as Client[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  function startCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({
      client_id: '',
      start_date: '',
      end_date: '',
      sla_terms: '',
      billing_type: 'fixed',
      rate: '',
    })
    setOpen(true)
  }

  function startEdit(row: ContractRow) {
    setEditing(row)
    setFormError(null)
    form.reset({
      client_id: row.client_id ?? '',
      start_date: row.start_date ?? '',
      end_date: row.end_date ?? '',
      sla_terms: row.sla_terms ?? '',
      billing_type: row.billing_type ?? 'fixed',
      rate: row.rate?.toString() ?? '',
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = withOrg(
      {
        client_id: values.client_id,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        sla_terms: values.sla_terms || null,
        billing_type: values.billing_type,
        rate: Number(values.rate),
      },
      profile?.organization_id,
    )
    const result = editing
      ? await supabase.from('contracts').update(payload).eq('id', editing.id)
      : await supabase.from('contracts').insert(payload)
    if (result.error) {
      setFormError(result.error.message)
      setError(result.error.message)
      return
    }
    setOpen(false)
    setError(null)
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this contract?')) return
    const { error: deleteError } = await supabase.from('contracts').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await load()
  }

  return (
    <div>
      <PageHeader
        title="Contracts"
        subtitle="SLA terms and billing basis. Payments stay stubbed for now."
        action={<Button onClick={startCreate}>Add contract</Button>}
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {rows.filter((row) => {
        if (!row.end_date) return false
        const horizon = new Date()
        horizon.setDate(horizon.getDate() + 60)
        return row.end_date >= todayISODate() && row.end_date <= horizon.toISOString().slice(0, 10)
      }).length > 0 ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          Contracts ending in 60 days:{' '}
          {rows
            .filter((row) => {
              if (!row.end_date) return false
              const horizon = new Date()
              horizon.setDate(horizon.getDate() + 60)
              return row.end_date >= todayISODate() && row.end_date <= horizon.toISOString().slice(0, 10)
            })
            .map((row) => row.clients?.business_name ?? 'Contract')
            .join(', ')}
        </p>
      ) : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No contracts" />
      ) : (
        <Table headers={['Client', 'Period', 'Billing', 'Rate', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="font-medium">{row.clients?.business_name ?? '—'}</Td>
              <Td>
                {formatDate(row.start_date)} – {formatDate(row.end_date)}
              </Td>
              <Td>{titleCase(row.billing_type)}</Td>
              <Td>{formatCurrency(row.rate)}</Td>
              <Td>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => void remove(row.id)}>
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title={editing ? 'Edit contract' : 'New contract'} open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit, () => setFormError('Fill the required fields: client and rate.'))}
        >
          <FormError message={formError} />
          <Select label="Client" error={form.formState.errors.client_id?.message} {...form.register('client_id')}>
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.business_name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start" type="date" {...form.register('start_date')} />
            <Input label="End" type="date" {...form.register('end_date')} />
          </div>
          <Select label="Billing type" {...form.register('billing_type')}>
            {BILLING_TYPES.map((type) => (
              <option key={type} value={type}>
                {titleCase(type)}
              </option>
            ))}
          </Select>
          <Input label="Rate" error={form.formState.errors.rate?.message} {...form.register('rate')} />
          <Textarea label="SLA terms" {...form.register('sla_terms')} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
