import type { InspectionFeedback } from '../types/database'
import { aiInspectionService } from './ai/service'

/**
 * Provider-agnostic inspection analysis.
 * Tries OpenAI / the `ai-inspection` Edge Function, then a local heuristic.
 */
export async function analyzeInspectionPhoto(photoUrl: string): Promise<InspectionFeedback> {
  return aiInspectionService.analyze(photoUrl)
}

export { AIInspectionService } from './ai/service'
