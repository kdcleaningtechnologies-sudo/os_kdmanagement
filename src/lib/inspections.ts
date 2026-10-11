import { INSPECTION_CATEGORIES } from '../types/database'
import type { InspectionItem, InspectionReport } from '../types/database'

export function itemStatusFromScore(score: number | null | undefined) {
  if (score == null || Number.isNaN(Number(score))) return 'pending' as const
  const value = Number(score)
  if (value >= 85) return 'pass' as const
  if (value < 60) return 'fail' as const
  return 'needs_attention' as const
}

export function averageItemScore(items: Pick<InspectionItem, 'score'>[] | undefined) {
  const scores = (items ?? []).map((item) => Number(item.score)).filter((n) => !Number.isNaN(n))
  if (!scores.length) return null
  return Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length)
}

export function displayInspectionScore(report: Pick<InspectionReport, 'overall_score' | 'ai_score'>) {
  return report.overall_score ?? report.ai_score ?? null
}

export function defaultInspectionCategories() {
  return [...INSPECTION_CATEGORIES]
}
