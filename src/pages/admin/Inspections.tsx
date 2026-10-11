import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../lib/format'
import { displayInspectionScore } from '../../lib/inspections'
import { InspectionReportCard } from '../../components/InspectionReportCard'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import type { InspectionItem, InspectionPhoto, InspectionWithRelations, Site } from '../../types/database'

export function AdminInspectionsPage() {
  const [rows, setRows] = useState<InspectionWithRelations[]>([])
  const [items, setItems] = useState<InspectionItem[]>([])
  const [photos, setPhotos] = useState<InspectionPhoto[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [viewing, setViewing] = useState<InspectionWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void supabase
      .from('sites')
      .select('*')
      .order('name')
      .then(({ data }) => setSites((data as Site[]) ?? []))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      let query = supabase
        .from('inspection_reports')
        .select('*, sites(*)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (siteId) query = query.eq('site_id', siteId)
      const { data, error: queryError } = await query
      if (cancelled) return
      if (queryError) setError(queryError.message)
      const list = (data as unknown as InspectionWithRelations[]) ?? []
      setRows(list)
      if (list.length) {
        const ids = list.map((row) => row.id)
        const [{ data: itemRows }, { data: photoRows }] = await Promise.all([
          supabase.from('inspection_items').select('*').in('inspection_id', ids),
          supabase.from('inspection_photos').select('*').in('inspection_id', ids),
        ])
        if (!cancelled) {
          setItems((itemRows as InspectionItem[]) ?? [])
          setPhotos((photoRows as InspectionPhoto[]) ?? [])
        }
      } else {
        setItems([])
        setPhotos([])
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [siteId])

  return (
    <div>
      <PageHeader title="Inspections" subtitle="Area scores, photos, and the supervisor’s final mark versus the AI suggestion." />
      <div className="mb-5 max-w-sm">
        <Select label="Site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </Select>
      </div>
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No inspections" body="Supervisors submit scored visits with photos from the field." />
      ) : (
        <Table headers={['When', 'Site', 'Overall', 'AI suggested', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>{formatDateTime(row.created_at)}</Td>
              <Td>{row.sites?.name ?? '—'}</Td>
              <Td className="font-semibold">{displayInspectionScore(row) ?? '—'}</Td>
              <Td>{row.ai_score ?? '—'}</Td>
              <Td>
                <Badge value={row.status} />
              </Td>
              <Td>
                <Button variant="ghost" onClick={() => setViewing(row)}>
                  View
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title="Inspection" open={Boolean(viewing)} onClose={() => setViewing(null)} wide>
        {viewing ? (
          <InspectionReportCard
            report={viewing}
            siteName={viewing.sites?.name ?? undefined}
            items={items.filter((item) => item.inspection_id === viewing.id)}
            photos={photos.filter((photo) => photo.inspection_id === viewing.id)}
          />
        ) : null}
      </Modal>
    </div>
  )
}
