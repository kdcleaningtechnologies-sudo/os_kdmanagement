import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useMyClients } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency, formatDate } from '../../lib/format'
import { displayInvoiceStatus, isInvoiceOpen } from '../../lib/invoices'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { StatCard } from '../../components/ui/StatCard'
import { Table, Td } from '../../components/ui/Table'
import type { Invoice } from '../../types/database'

export function ClientPaymentsPage() {
  const { organization } = useAuth()
  const { clients, loading } = useMyClients()
  const [rows, setRows] = useState<Invoice[]>([])

  useEffect(() => {
    const ids = clients.map((client) => client.id)
    if (loading || !ids.length) return
    void supabase
      .from('invoices')
      .select('*')
      .in('client_id', ids)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows((data as Invoice[]) ?? []))
  }, [loading, clients])

  const outstanding = useMemo(
    () => rows.filter((row) => isInvoiceOpen(displayInvoiceStatus(row))).reduce((sum, row) => sum + Number(row.total ?? row.amount ?? 0), 0),
    [rows],
  )
  const paid = useMemo(
    () => rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.total ?? row.amount ?? 0), 0),
    [rows],
  )

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Pay KD by bank transfer, cheque, or cash. Online card/UPI is not enabled yet — admin marks the invoice paid when funds arrive."
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} />
        <StatCard label="Paid" value={formatCurrency(paid)} />
      </div>
      <Card className="mb-5">
        <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">Pay to</p>
        <p className="mt-1 font-semibold text-ink-950">{organization?.name ?? 'KD Facilities Management Services'}</p>
        <p className="mt-1 text-sm text-ink-700">{organization?.email ?? 'Accounts will confirm on the invoice.'}</p>
        {organization?.phone ? <p className="text-sm text-ink-700">{organization.phone}</p> : null}
        <p className="mt-2 text-xs text-ink-600">
          Quote the invoice number in the transfer remark. Status here updates after KD records the receipt.
        </p>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="No invoices yet" />
      ) : (
        <Table headers={['Invoice', 'Period', 'Amount', 'Due', 'Status']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="font-medium">{row.invoice_number ?? '—'}</Td>
              <Td>{row.period ?? '—'}</Td>
              <Td>{formatCurrency(row.total ?? row.amount)}</Td>
              <Td>{formatDate(row.due_date)}</Td>
              <Td>
                <Badge value={displayInvoiceStatus(row)} />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
