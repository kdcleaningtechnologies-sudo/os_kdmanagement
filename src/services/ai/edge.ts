import { supabase } from '../../lib/supabaseClient'
import type { InspectionFeedback } from '../../types/database'
import { markAsAi, type AIInspectionProvider } from './types'

export const edgeProvider: AIInspectionProvider = {
  name: 'edge',
  async analyze(photoUrl: string) {
    const { data, error } = await supabase.functions.invoke('ai-inspection', {
      body: { photoUrl },
    })
    if (error) throw error
    const result = data as InspectionFeedback | null
    if (!result || result.overall_score == null) throw new Error('Edge function returned no score')
    return markAsAi(result, result.provider ?? 'edge', result.model)
  },
}
