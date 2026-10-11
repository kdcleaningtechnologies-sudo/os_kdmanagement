import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMyClients } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { formatDate } from '../../lib/format'
import { displayInspectionScore } from '../../lib/inspections'
import { InspectionReportCard } from '../../components/InspectionReportCard'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { InspectionItem, InspectionPhoto, InspectionReport, Site } from '../../types/database'

type Row = InspectionReport & { sites: Site | null }

export function ClientInspectionsPage() {
  const { sites, loading } = useMyClients()
  const [rows, setRows] = useState<Row[]>([])
  const [items, setItems] = useState<InspectionItem[]>([])
  const [photos, setPhotos] = useState<InspectionPhoto[]>([])

  useEffect(() => {
    const ids = sites.map((site) => site.id)
    if (loading || !ids.length) return
    void supabase
      .from('inspection_reports')
      .select('*, sites(*)')
      .in('site_id', ids)
      .neq('status', 'draft')
      .order('created_at', { ascending: true })
      .then(async ({ data }) => {
        const list = (data as unknown as Row[]) ?? []
        setRows(list)
        if (!list.length) {
          setItems([])
          setPhotos([])
          return
        }
        const reportIds = list.map((row) => row.id)
        const [{ data: itemRows }, { data: photoRows }] = await Promise.all([
          supabase.from('inspection_items').select('*').in('inspection_id', reportIds),
          supabase.from('inspection_photos').select('*').in('inspection_id', reportIds),
        ])
        setItems((itemRows as InspectionItem[]) ?? [])
        setPhotos((photoRows as InspectionPhoto[]) ?? [])
      })
  }, [loading, sites])

  const chartData = useMemo(
    () =>
      rows
        .map((row) => ({ row, score: displayInspectionScore(row) }))
        .filter((entry) => entry.score != null)
        .map((entry) => ({
          day: formatDate(entry.row.created_at, 'dd MMM'),
          score: Number(entry.score),
        })),
    [rows],
  )

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Inspection reports" subtitle="Supervisor scores and site photos. AI numbers are labelled as suggestions only." />
      <Card className="mb-6">
        <p className="mb-4 text-sm font-semibold text-ink-800">Score trend</p>
        <div className="h-56 overflow-hidden sm:h-64">
          {chartData.length === 0 ? (
            <EmptyState title="No scored inspections yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ece7dc" />
                <XAxis dataKey="day" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#0f8a7a" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {[...rows].reverse().map((row) => (
          <InspectionReportCard
            key={row.id}
            report={row}
            siteName={row.sites?.name ?? undefined}
            items={items.filter((item) => item.inspection_id === row.id)}
            photos={photos.filter((photo) => photo.inspection_id === row.id)}
          />
        ))}
      </div>
    </div>
  )
}
