import { useEffect, useState } from 'react'
import { useMyClients } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency, formatDate, titleCase } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { Contract } from '../../types/database'

export function ClientContractsPage() {
  const { clients, loading } = useMyClients()
  const [rows, setRows] = useState<Contract[]>([])

  useEffect(() => {
    const ids = clients.map((client) => client.id)
    if (loading || !ids.length) return
    void supabase
      .from('contracts')
      .select('*')
      .in('client_id', ids)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows((data as Contract[]) ?? []))
  }, [loading, clients])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Contracts" subtitle="Read-only commercial terms." />
      {rows.length === 0 ? (
        <EmptyState title="No contracts on file" />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <p className="text-xs font-semibold tracking-wide text-tide-600 uppercase">
                {titleCase(row.billing_type)} · {formatCurrency(row.rate)}
              </p>
              <p className="mt-2 text-sm text-ink-800">
                {formatDate(row.start_date)} – {formatDate(row.end_date)}
              </p>
              <p className="mt-3 text-sm leading-6 text-ink-700">{row.sla_terms || 'No SLA text stored.'}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
