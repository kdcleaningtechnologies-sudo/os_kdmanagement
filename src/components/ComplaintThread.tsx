import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatDateTime } from '../lib/format'
import { Button } from './ui/Button'
import { Textarea } from './ui/Input'
import type { ComplaintCommentWithProfile } from '../types/database'

export function ComplaintThread({
  complaintId,
  comments,
  profileId,
  onPosted,
}: {
  complaintId: string
  comments: ComplaintCommentWithProfile[]
  profileId: string | null | undefined
  onPosted: () => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function post() {
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('complaint_comments').insert({
      complaint_id: complaintId,
      profile_id: profileId ?? null,
      body: body.trim(),
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setBody('')
    await onPosted()
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">Comments</p>
      {comments.length === 0 ? <p className="text-sm text-ink-600">No comments yet.</p> : null}
      {comments.map((comment) => (
        <div key={comment.id} className="rounded-xl bg-sand-50 px-3 py-2">
          <p className="text-xs font-semibold text-ink-800">
            {comment.profiles?.full_name ?? 'Team'} · {formatDateTime(comment.created_at)}
          </p>
          <p className="mt-1 text-sm text-ink-800">{comment.body}</p>
        </div>
      ))}
      <Textarea label="Add a comment" value={body} onChange={(e) => setBody(e.target.value)} />
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      <Button type="button" variant="secondary" disabled={busy || !body.trim()} onClick={() => void post()}>
        {busy ? 'Posting…' : 'Post comment'}
      </Button>
    </div>
  )
}
