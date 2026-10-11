import { useEffect, useMemo, useState } from 'react'
import { analyzeInspectionPhoto } from '../../services/aiInspection'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useMyAssignments } from '../../hooks/useAssignments'
import { averageItemScore, defaultInspectionCategories, itemStatusFromScore } from '../../lib/inspections'
import { uploadPublicImage } from '../../lib/uploads'
import { AISuggestionPanel } from '../../components/AISuggestionPanel'
import { InspectionReportCard } from '../../components/InspectionReportCard'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import type { InspectionFeedback, InspectionItem, InspectionPhoto, InspectionReport } from '../../types/database'

type DraftItem = {
  category: string
  score: string
  remarks: string
}

export function SupervisorInspectionsPage() {
  const { user } = useAuth()
  const { sites, assignments, loading } = useMyAssignments()
  const [siteId, setSiteId] = useState('')
  const [reports, setReports] = useState<InspectionReport[]>([])
  const [itemsByReport, setItemsByReport] = useState<Record<string, InspectionItem[]>>({})
  const [photosByReport, setPhotosByReport] = useState<Record<string, InspectionPhoto[]>>({})
  const [notes, setNotes] = useState('')
  const [overrideScore, setOverrideScore] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [draftItems, setDraftItems] = useState<DraftItem[]>(
    defaultInspectionCategories().map((category) => ({ category, score: '', remarks: '' })),
  )
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<InspectionFeedback | null>(null)
  const [analyzedCover, setAnalyzedCover] = useState<{ url: string; path: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedSite = useMemo(() => sites.find((site) => site.id === siteId) ?? sites[0], [siteId, sites])
  const supervisorRow = assignments.find((row) => row.site_id === selectedSite?.id) ?? assignments[0]

  useEffect(() => {
    if (sites[0] && !siteId) setSiteId(sites[0].id)
  }, [sites, siteId])

  async function load(id: string) {
    const { data, error: queryError } = await supabase
      .from('inspection_reports')
      .select('*')
      .eq('site_id', id)
      .order('created_at', { ascending: false })
    if (queryError) {
      setError(queryError.message)
      return
    }
    const list = (data as InspectionReport[]) ?? []
    setReports(list)
    if (!list.length) {
      setItemsByReport({})
      setPhotosByReport({})
      return
    }
    const ids = list.map((row) => row.id)
    const [{ data: itemRows }, { data: photoRows }] = await Promise.all([
      supabase.from('inspection_items').select('*').in('inspection_id', ids),
      supabase.from('inspection_photos').select('*').in('inspection_id', ids),
    ])
    const items: Record<string, InspectionItem[]> = {}
    for (const item of (itemRows as InspectionItem[]) ?? []) {
      items[item.inspection_id] = [...(items[item.inspection_id] ?? []), item]
    }
    const photos: Record<string, InspectionPhoto[]> = {}
    for (const photo of (photoRows as InspectionPhoto[]) ?? []) {
      photos[photo.inspection_id] = [...(photos[photo.inspection_id] ?? []), photo]
    }
    setItemsByReport(items)
    setPhotosByReport(photos)
  }

  useEffect(() => {
    if (selectedSite) void load(selectedSite.id)
  }, [selectedSite])

  function updateDraft(index: number, patch: Partial<DraftItem>) {
    setDraftItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  async function analyze() {
    if (!selectedSite || !files[0]) {
      setError('Add at least one photo before analyzing.')
      return
    }
    setAnalyzing(true)
    setError(null)
    try {
      const uploaded = await uploadPublicImage('inspection-photos', selectedSite.id, files[0])
      const result = await analyzeInspectionPhoto(uploaded.url)
      setAnalyzedCover(uploaded)
      setAnalysis(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function submit() {
    if (!selectedSite || !user) return
    setBusy(true)
    setError(null)
    try {
      const scored = draftItems.map((item) => ({
        ...item,
        numeric: item.score === '' ? null : Number(item.score),
      }))
      const computed = averageItemScore(scored.map((item) => ({ score: item.numeric })))
      const override = overrideScore === '' ? null : Number(overrideScore)
      let feedback = analysis
      const uploaded: { url: string; path: string }[] = []
      if (analyzedCover) uploaded.push(analyzedCover)
      for (const file of analyzedCover ? files.slice(1) : files) {
        uploaded.push(await uploadPublicImage('inspection-photos', selectedSite.id, file))
      }
      const coverUrl = uploaded[0]?.url ?? null
      if (coverUrl && !feedback) {
        feedback = await analyzeInspectionPhoto(coverUrl)
        setAnalysis(feedback)
      }

      const overall = override ?? computed ?? feedback?.overall_score ?? null
      const { data: created, error: insertError } = await supabase
        .from('inspection_reports')
        .insert({
          site_id: selectedSite.id,
          supervisor_id: supervisorRow?.id ?? null,
          photo_url: coverUrl,
          ai_score: feedback?.overall_score ?? null,
          ai_feedback: feedback,
          notes: notes || null,
          status: 'submitted',
          overall_score: overall,
        })
        .select('id')
        .single()
      if (insertError || !created) throw insertError ?? new Error('Could not save inspection')

      const { error: itemsError } = await supabase.from('inspection_items').insert(
        scored.slice(0, 40).map((item, index) => ({
          inspection_id: created.id,
          category: item.category,
          score: item.numeric,
          remarks: item.remarks || null,
          status: itemStatusFromScore(item.numeric),
          sort_order: index + 1,
        })),
      )
      if (itemsError) throw itemsError

      if (uploaded.length) {
        const { error: photosError } = await supabase.from('inspection_photos').insert(
          uploaded.map((photo) => ({
            inspection_id: created.id,
            photo_url: photo.url,
            storage_path: photo.path,
          })),
        )
        if (photosError) throw photosError
      }

      setNotes('')
      setOverrideScore('')
      setFiles([])
      setAnalysis(null)
      setAnalyzedCover(null)
      setDraftItems(defaultInspectionCategories().map((category) => ({ category, score: '', remarks: '' })))
      await load(selectedSite.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (!selectedSite) return <EmptyState title="No managed sites" />

  return (
    <div>
      <PageHeader
        title="Inspections"
        subtitle="Analyze a photo for an AI suggestion, then apply or edit the score before you submit."
      />
      <Card className="space-y-3">
        <Select label="Site" value={selectedSite.id} onChange={(e) => setSiteId(e.target.value)}>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </Select>
        {draftItems.map((item, index) => (
          <div key={item.category} className="grid gap-2 rounded-xl bg-sand-50 p-3 sm:grid-cols-[1fr_90px]">
            <div>
              <p className="text-sm font-semibold text-ink-900">{item.category}</p>
              <Input
                placeholder="Remarks"
                value={item.remarks}
                onChange={(e) => updateDraft(index, { remarks: e.target.value })}
              />
            </div>
            <Input
              label="Score"
              type="number"
              min={0}
              max={100}
              value={item.score}
              onChange={(e) => updateDraft(index, { score: e.target.value })}
            />
          </div>
        ))}
        <label className="block text-sm font-medium text-ink-800">
          Photos
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            multiple
            className="mt-1 block w-full text-sm"
            onChange={(e) => {
              setFiles(Array.from(e.target.files ?? []).slice(0, 6))
              setAnalysis(null)
              setAnalyzedCover(null)
            }}
          />
          <span className="mt-1 block text-xs text-ink-600">
            {files.length ? `${files.length} selected` : 'One or more. First photo is sent to AI as a labelled suggestion.'}
          </span>
        </label>
        <Button
          type="button"
          variant="secondary"
          full
          disabled={analyzing || busy || files.length === 0}
          onClick={() => void analyze()}
        >
          {analyzing ? 'Analyzing…' : 'Analyze photos'}
        </Button>
        {analysis ? (
          <AISuggestionPanel
            feedback={analysis}
            onApply={() => setOverrideScore(String(Math.round(analysis.overall_score)))}
          />
        ) : (
          <p className="text-xs text-ink-600">
            AI is a suggestion only. Analyze first, then apply or type your own score.
          </p>
        )}
        <Input
          label="Supervisor overall score"
          type="number"
          min={0}
          max={100}
          hint="Apply the AI suggestion or enter your own. Leave blank to use the area-score average."
          value={overrideScore}
          onChange={(e) => setOverrideScore(e.target.value)}
        />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
        <Button full disabled={busy || analyzing} onClick={() => void submit()}>
          {busy ? 'Saving…' : 'Submit inspection'}
        </Button>
      </Card>

      <div className="mt-5 space-y-3">
        {reports.length === 0 ? (
          <EmptyState title="No inspections yet" />
        ) : (
          reports.map((report) => (
            <InspectionReportCard
              key={report.id}
              report={report}
              siteName={selectedSite.name}
              items={itemsByReport[report.id]}
              photos={photosByReport[report.id]}
              compact
            />
          ))
        )}
      </div>
    </div>
  )
}
