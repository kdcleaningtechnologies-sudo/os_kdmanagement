import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { Announcement } from '../../types/database'

export function WorkerAnnouncementsPage() {
  const [rows, setRows] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void supabase
      .from('announcements')
      .select('*')
      .in('target_role', ['worker', 'all'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRows((data as Announcement[]) ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Announcements" />
      {rows.length === 0 ? (
        <EmptyState title="No announcements" />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <p className="text-xs font-semibold text-tide-600 uppercase">{row.target_role}</p>
              <h2 className="mt-1 font-semibold text-ink-950">{row.title}</h2>
              <p className="mt-2 text-sm text-ink-700">{row.body}</p>
              <p className="mt-3 text-xs text-ink-600">{formatDateTime(row.created_at)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
