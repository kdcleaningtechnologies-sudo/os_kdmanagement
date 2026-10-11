import type { InspectionFeedback } from '../../types/database'

export type AIInspectionProvider = {
  name: string
  analyze(photoUrl: string): Promise<InspectionFeedback>
}

export function markAsAi(
  feedback: Omit<InspectionFeedback, 'ai_generated'> & Partial<InspectionFeedback>,
  provider: string,
  model?: string | null,
): InspectionFeedback {
  return {
    ...feedback,
    provider,
    model: model ?? feedback.model ?? null,
    ai_generated: true,
    issues: feedback.issues ?? [],
    recommended_actions: feedback.recommended_actions ?? [],
  }
}
