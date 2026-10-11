import { CheckCircle2, CircleAlert, Sparkles } from 'lucide-react'
import type { InspectionFeedback, InspectionItem, InspectionPhoto, InspectionReport } from '../types/database'
import { displayInspectionScore } from '../lib/inspections'
import { formatDateTime } from '../lib/format'
import { AISuggestionPanel } from './AISuggestionPanel'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'

function ScoreRing({ score }: { score: number }) {
  const tone = score >= 85 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-rose-600'
  return (
    <div className={`flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 border-current ${tone}`}>
      <span className="text-2xl font-bold">{Math.round(score)}</span>
      <span className="text-[10px] font-semibold tracking-wider uppercase">Score</span>
    </div>
  )
}

function FeedbackRow({
  label,
  ok,
  detail,
}: {
  label: string
  ok: boolean
  detail: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-sand-50 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-ink-900">{label}</p>
        <p className="text-xs text-ink-600">{detail}</p>
      </div>
      {ok ? (
        <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} />
      ) : (
        <CircleAlert className="mt-0.5 shrink-0 text-amber-600" size={18} />
      )}
    </div>
  )
}

export function InspectionReportCard({
  report,
  siteName,
  items,
  photos,
  compact = false,
}: {
  report: InspectionReport
  siteName?: string
  items?: InspectionItem[]
  photos?: InspectionPhoto[]
  compact?: boolean
}) {
  const feedback = report.ai_feedback as InspectionFeedback | null
  const score = displayInspectionScore(report)
  const gallery = photos?.length
    ? photos
    : report.photo_url
      ? [{ id: 'cover', photo_url: report.photo_url } as InspectionPhoto]
      : []

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge value={report.status ?? 'submitted'} />
            {report.ai_score != null ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-tide-600 uppercase">
                <Sparkles size={12} />
                AI suggested {Math.round(Number(report.ai_score))}
              </span>
            ) : null}
          </div>
          <h3 className="font-semibold text-ink-950">{siteName ?? 'Site inspection'}</h3>
          <p className="text-xs text-ink-600">{formatDateTime(report.created_at)}</p>
        </div>
        {score != null ? <ScoreRing score={Number(score)} /> : <Badge value="pending" />}
      </div>

      {gallery.length ? (
        <div className={`grid gap-2 ${gallery.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {gallery.map((photo) => (
            <img
              key={photo.id}
              src={photo.photo_url}
              alt={photo.caption ?? 'Inspection'}
              className="h-36 w-full rounded-xl object-cover"
            />
          ))}
        </div>
      ) : null}

      {items?.length ? (
        <div className="space-y-2">
          {items
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-sand-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-ink-900">{item.category}</p>
                  {item.remarks ? <p className="text-xs text-ink-600">{item.remarks}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink-950">{item.score ?? '—'}</p>
                  <Badge value={item.status} />
                </div>
              </div>
            ))}
        </div>
      ) : !feedback ? (
        <p className="text-sm text-ink-600">No category scores yet.</p>
      ) : null}

      {feedback ? (
        compact ? (
          <AISuggestionPanel feedback={feedback} />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <FeedbackRow
                label="Floor cleanliness"
                ok={feedback.floor_cleanliness === 'pass'}
                detail={feedback.floor_cleanliness === 'pass' ? 'Meets standard' : 'Needs rework'}
              />
              <FeedbackRow
                label="Dust"
                ok={!feedback.dust_detected}
                detail={feedback.dust_detected ? 'Dust detected' : 'Clear'}
              />
              <FeedbackRow
                label="Bins"
                ok={feedback.bin_status === 'ok'}
                detail={feedback.bin_status === 'ok' ? 'Emptied' : 'Needs attention'}
              />
              <FeedbackRow
                label="Supplies"
                ok={feedback.supplies_status === 'ok'}
                detail={feedback.supplies_status === 'ok' ? 'Stocked' : 'Running low'}
              />
            </div>
            {feedback.issues?.length || feedback.recommended_actions?.length ? (
              <AISuggestionPanel feedback={feedback} />
            ) : feedback.ai_generated ? (
              <p className="text-xs font-semibold tracking-wide text-tide-700 uppercase">
                AI-generated suggestion
                {feedback.provider ? ` · ${feedback.provider}` : ''}
              </p>
            ) : null}
          </div>
        )
      ) : null}

      {report.notes ? <p className="text-sm text-ink-700">{report.notes}</p> : null}
    </Card>
  )
}
