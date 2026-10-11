import { Sparkles } from 'lucide-react'
import type { InspectionFeedback } from '../types/database'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

export function AISuggestionPanel({
  feedback,
  onApply,
}: {
  feedback: InspectionFeedback
  onApply?: () => void
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-tide-200 bg-tide-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-tide-700 uppercase">
            <Sparkles size={13} />
            AI-generated suggestion
          </p>
          <p className="mt-1 text-sm text-ink-700">
            Suggested score <span className="font-semibold text-ink-950">{Math.round(feedback.overall_score)}</span>
            {feedback.provider ? (
              <span className="text-xs text-ink-600"> · {feedback.provider}{feedback.model ? `/${feedback.model}` : ''}</span>
            ) : null}
          </p>
        </div>
        {onApply ? (
          <Button type="button" variant="secondary" onClick={onApply}>
            Apply score
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge value={feedback.floor_cleanliness === 'pass' ? 'pass' : 'fail'} />
        <Badge value={feedback.dust_detected ? 'dust' : 'clear'} />
        <Badge value={feedback.bin_status} />
        <Badge value={feedback.supplies_status === 'low' ? 'low' : 'ok'} />
      </div>
      {feedback.issues?.length ? (
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">Detected issues</p>
          <ul className="mt-1 list-disc pl-4 text-sm text-ink-800">
            {feedback.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {feedback.recommended_actions?.length ? (
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">Recommended actions</p>
          <ul className="mt-1 list-disc pl-4 text-sm text-ink-800">
            {feedback.recommended_actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
