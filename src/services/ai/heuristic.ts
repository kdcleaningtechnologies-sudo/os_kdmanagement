import type { InspectionFeedback } from '../../types/database'
import { markAsAi, type AIInspectionProvider } from './types'

export const heuristicProvider: AIInspectionProvider = {
  name: 'heuristic',
  async analyze(photoUrl: string) {
    await new Promise((resolve) => setTimeout(resolve, 400))

    let hash = 0
    for (let i = 0; i < photoUrl.length; i += 1) {
      hash = (hash + photoUrl.charCodeAt(i) * (i + 1)) % 23
    }

    const overall_score = 74 + hash
    const dust_detected = hash % 3 !== 0
    const suppliesLow = hash % 4 === 0
    const binAttention = hash % 2 === 0
    const floorPass = overall_score >= 78

    const issues: string[] = []
    const recommended_actions: string[] = []
    if (!floorPass) {
      issues.push('Floor cleanliness below pass threshold')
      recommended_actions.push('Re-mop high-traffic lanes and lift lobbies')
    }
    if (dust_detected) {
      issues.push('Dust detected')
      recommended_actions.push('Dust ledges, skirting, and HVAC vents')
    }
    if (binAttention) {
      issues.push('Bin needs attention')
      recommended_actions.push('Empty bins and replace liners')
    }
    if (suppliesLow) {
      issues.push('Supplies low')
      recommended_actions.push('Restock tissue, soap, and bin bags')
    }
    if (!issues.length) recommended_actions.push('Maintain current standard on the next shift')

    return markAsAi(
      {
        floor_cleanliness: floorPass ? 'pass' : 'fail',
        dust_detected,
        bin_status: binAttention ? 'needs_attention' : 'ok',
        supplies_status: suppliesLow ? 'low' : 'ok',
        overall_score,
        issues,
        recommended_actions,
      },
      'heuristic',
      'local-v1',
    ) satisfies InspectionFeedback
  },
}
