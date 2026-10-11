import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { formatCurrency, formatDate, todayISODate } from '../../lib/format'
import { displayInvoiceStatus, isInvoiceOverdue } from '../../lib/invoices'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select } from '../../components/ui/Input'
import { FormError } from '../../components/ui/FormError'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import { INVOICE_STATUSES, type Client, type Contract, type Invoice } from '../../types/database'

const schema = z.object({
  client_id: z.string().min(1),
  contract_id: z.string().optional(),
  invoice_number: z.string().optional(),
  period: z.string().min(2),
  amount: z.string().min(1),
  tax: z.string().optional(),
  due_date: z.string().optional(),
  status: z.enum(INVOICE_STATUSES),
})

type FormValues = z.infer<typeof schema>
type InvoiceRow = Invoice & { clients: Client | null }

export function AdminRevenuePage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    const [{ data, error: queryError }, { data: clientRows }, { data: contractRows }] = await Promise.all([
      supabase.from('invoices').select('*, clients(*)').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('business_name'),
      supabase.from('contracts').select('*'),
    ])
    if (queryError) setError(queryError.message)
    setRows((data as InvoiceRow[]) ?? [])
    setClients((clientRows as Client[]) ?? [])
    setContracts((contractRows as Contract[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const chartData = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const row of rows) {
      const key = row.created_at.slice(0, 7)
      buckets.set(key, (buckets.get(key) ?? 0) + Number(row.amount ?? 0))
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }))
  }, [rows])

  async function onSubmit(values: FormValues) {
    const amount = Number(values.amount)
    const tax = values.tax ? Number(values.tax) : 0
    setFormError(null)
    const { error: insertError } = await supabase.from('invoices').insert(
      withOrg(
        {
          client_id: values.client_id,
          contract_id: values.contract_id || null,
          invoice_number: values.invoice_number || null,
          period: values.period,
          amount,
          tax,
          total: amount + tax,
          due_date: values.due_date || null,
          status: values.status,
        },
        profile?.organization_id,
      ),
    )
    if (insertError) {
      setFormError(insertError.message)
      setError(insertError.message)
      return
    }
    setOpen(false)
    form.reset()
    await load()
  }

  async function setInvoiceStatus(id: string, status: (typeof INVOICE_STATUSES)[number]) {
    const { error: updateError } = await supabase.from('invoices').update({ status }).eq('id', id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Revenue"
        subtitle="Raise invoices, send them, and mark NEFT/cheque/cash as paid. Card/UPI checkout is not wired."
        action={
          <Button
            onClick={() => {
              setFormError(null)
              form.reset({
                client_id: '',
                contract_id: '',
                invoice_number: '',
                period: '',
                amount: '',
                tax: '',
                due_date: '',
                status: 'draft',
              })
              setOpen(true)
            }}
          >
            Add invoice
          </Button>
        }
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      <Card className="mb-6">
        <p className="mb-4 text-sm font-semibold text-ink-800">Monthly invoice total</p>
        <div className="h-72">
          {chartData.length === 0 ? (
            <EmptyState title="No invoice data yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ece7dc" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="total" fill="#0f8a7a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : (
        <Table headers={['Invoice', 'Client', 'Period', 'Amount', 'Due', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>{row.invoice_number ?? '—'}</Td>
              <Td>{row.clients?.business_name ?? '—'}</Td>
              <Td>{row.period ?? '—'}</Td>
              <Td>{formatCurrency(row.total ?? row.amount)}</Td>
              <Td>{formatDate(row.due_date)}</Td>
              <Td>
                <Badge value={displayInvoiceStatus(row)} />
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  {row.status === 'draft' ? (
                    <Button variant="ghost" onClick={() => void setInvoiceStatus(row.id, 'sent')}>
                      Send
                    </Button>
                  ) : null}
                  {row.status === 'sent' || row.status === 'overdue' || isInvoiceOverdue(row) ? (
                    <Button variant="soft" onClick={() => void setInvoiceStatus(row.id, 'paid')}>
                      Mark paid
                    </Button>
                  ) : null}
                  {row.status === 'sent' && row.due_date && row.due_date < todayISODate() ? (
                    <Button variant="ghost" onClick={() => void setInvoiceStatus(row.id, 'overdue')}>
                      Overdue
                    </Button>
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title="New invoice" open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit, () =>
            setFormError('Fill the required fields: client, period, and amount.'),
          )}
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
          <Select label="Contract" {...form.register('contract_id')}>
            <option value="">None</option>
            {contracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.billing_type} · {formatCurrency(contract.rate)}
              </option>
            ))}
          </Select>
          <Input label="Invoice number" {...form.register('invoice_number')} />
          <Input label="Period" placeholder="2026-09" {...form.register('period')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount" {...form.register('amount')} />
            <Input label="Tax" {...form.register('tax')} />
          </div>
          <Input label="Due date" type="date" {...form.register('due_date')} />
          <Select label="Status" {...form.register('status')}>
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
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
