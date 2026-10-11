// Deploy: supabase functions deploy ai-inspection
// Secret: supabase secrets set OPENAI_API_KEY=...
// Optional: supabase secrets set ALLOWED_ORIGIN=https://your-domain.example

const SYSTEM = `You inspect facility housekeeping photos for a facility-management company.
Return JSON only with:
floor_cleanliness: pass|fail
dust_detected: boolean
bin_status: ok|needs_attention
supplies_status: ok|low
overall_score: integer 0-100
issues: string[]
recommended_actions: string[]`

function cors(req: Request) {
  const allowed = Deno.env.get('ALLOWED_ORIGIN')
  const origin = req.headers.get('Origin') ?? ''
  const local = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')
  const permit = allowed ? (origin === allowed ? allowed : '') : local ? origin : ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (permit) headers['Access-Control-Allow-Origin'] = permit
  return headers
}

async function callerIsSignedIn(authHeader: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return false
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
    },
  })
  return res.ok
}

function isAllowedPhotoUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.') || host === '169.254.169.254') {
    return false
  }
  return host.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors(req) })
  }
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors(req) })
  }

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ') || !(await callerIsSignedIn(auth))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors(req) })
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0')
  if (contentLength > 32_768) {
    return Response.json({ error: 'Payload too large' }, { status: 413, headers: cors(req) })
  }

  try {
    const { photoUrl } = (await req.json()) as { photoUrl?: string }
    if (!photoUrl || !isAllowedPhotoUrl(photoUrl)) {
      return Response.json({ error: 'photoUrl must be a Supabase Storage https URL' }, { status: 400, headers: cors(req) })
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return Response.json({ error: 'OPENAI_API_KEY is not set' }, { status: 501, headers: cors(req) })
    }

    const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'
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
      return Response.json({ error: 'Upstream inspection failed' }, { status: 502, headers: cors(req) })
    }

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? '{}') as {
      floor_cleanliness?: string
      dust_detected?: boolean
      bin_status?: string
      supplies_status?: string
      overall_score?: number
      issues?: string[]
      recommended_actions?: string[]
    }

    return Response.json(
      {
        floor_cleanliness: parsed.floor_cleanliness === 'fail' ? 'fail' : 'pass',
        dust_detected: Boolean(parsed.dust_detected),
        bin_status: parsed.bin_status === 'needs_attention' ? 'needs_attention' : 'ok',
        supplies_status: parsed.supplies_status === 'low' ? 'low' : 'ok',
        overall_score: Math.max(0, Math.min(100, Math.round(Number(parsed.overall_score ?? 80)))),
        issues: parsed.issues ?? [],
        recommended_actions: parsed.recommended_actions ?? [],
        provider: 'openai',
        model,
        ai_generated: true,
      },
      { headers: cors(req) },
    )
  } catch {
    return Response.json({ error: 'Analysis failed' }, { status: 500, headers: cors(req) })
  }
})
