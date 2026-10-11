import type { InspectionFeedback } from '../../types/database'
import { edgeProvider } from './edge'
import { heuristicProvider } from './heuristic'
import type { AIInspectionProvider } from './types'

function configuredProviders(): AIInspectionProvider[] {
  const preferred = (import.meta.env.VITE_AI_INSPECTION_PROVIDER as string | undefined)?.toLowerCase()
  const providers: AIInspectionProvider[] = []
  if (preferred !== 'heuristic') providers.push(edgeProvider)
  providers.push(heuristicProvider)
  return providers
}

export class AIInspectionService {
  private readonly providers: AIInspectionProvider[]

  constructor(providers: AIInspectionProvider[] = configuredProviders()) {
    this.providers = providers
  }

  async analyze(photoUrl: string): Promise<InspectionFeedback> {
    let lastError: unknown = null
    for (const provider of this.providers) {
      try {
        return await provider.analyze(photoUrl)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('No AI inspection provider succeeded')
  }
}

export const aiInspectionService = new AIInspectionService()
