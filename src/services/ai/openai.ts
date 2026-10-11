import type { InspectionFeedback } from '../../types/database'
import { markAsAi, type AIInspectionProvider } from './types'

type ModelJson = {
  floor_cleanliness?: string
  dust_detected?: boolean
  bin_status?: string
  supplies_status?: string
  overall_score?: number
  issues?: string[]
  recommended_actions?: string[]
}

const SYSTEM = `You inspect facility housekeeping photos for a facility-management company.
Return JSON only with:
floor_cleanliness: pass|fail
dust_detected: boolean
bin_status: ok|needs_attention
supplies_status: ok|low
overall_score: integer 0-100
issues: string[]
recommended_actions: string[]
Be conservative. If the photo is unclear, lower the score and say so in issues.`

export function createOpenAIProvider(apiKey: string, model = 'gpt-4o-mini'): AIInspectionProvider {
  return {
    name: 'openai',
    async analyze(photoUrl: string) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analyze this site cleaning inspection photo.' },
                { type: 'image_url', image_url: { url: photoUrl } },
              ],
            },
          ],
        }),
      })
      if (!response.ok) {
        throw new Error(`OpenAI inspection failed (${response.status})`)
      }
      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] }
      const raw = payload.choices?.[0]?.message?.content
      if (!raw) throw new Error('OpenAI returned an empty inspection result')
      const parsed = JSON.parse(raw) as ModelJson
      const score = Math.max(0, Math.min(100, Math.round(Number(parsed.overall_score ?? 80))))
      return markAsAi(
        {
          floor_cleanliness: parsed.floor_cleanliness === 'fail' ? 'fail' : 'pass',
          dust_detected: Boolean(parsed.dust_detected),
          bin_status: parsed.bin_status === 'needs_attention' ? 'needs_attention' : 'ok',
          supplies_status: parsed.supplies_status === 'low' ? 'low' : 'ok',
          overall_score: score,
          issues: parsed.issues ?? [],
          recommended_actions: parsed.recommended_actions ?? [],
        },
        'openai',
        model,
      ) satisfies InspectionFeedback
    },
  }
}
