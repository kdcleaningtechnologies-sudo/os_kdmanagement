import { useEffect, useState } from 'react'
import { useMyClients } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency, formatDate } from '../../lib/format'
import { displayInvoiceStatus } from '../../lib/invoices'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import type { Invoice } from '../../types/database'

export function ClientInvoicesPage() {
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

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Amounts billed for your contract. Payments are recorded after bank transfer or cheque." />
      {rows.length === 0 ? (
        <EmptyState title="No invoices" />
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
