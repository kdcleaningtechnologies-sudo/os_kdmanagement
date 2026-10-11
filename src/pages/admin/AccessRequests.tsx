import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../lib/format'
import { ROLE_LABELS } from '../../lib/auth/roles'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select, Textarea } from '../../components/ui/Input'
import { FormError } from '../../components/ui/FormError'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import {
  SIGNUP_ROLES,
  type AccessStatus,
  type Profile,
  type Site,
  type UserRole,
} from '../../types/database'

const schema = z.object({
  role: z.string().min(1),
  site_id: z.string().optional(),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>
type Filter = AccessStatus | 'all'

const ASSIGNABLE: UserRole[] = ['worker', 'supervisor', 'security_guard', 'client']

export function AdminAccessRequestsPage() {
  const [rows, setRows] = useState<Profile[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('pending')
  const [reviewing, setReviewing] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    const [{ data, error: queryError }, { data: siteRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .or('access_status.eq.pending,access_status.eq.rejected,reviewed_at.not.is.null')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('sites').select('*').order('name').limit(200),
    ])
    if (queryError) setError(queryError.message)
    setRows((data as Profile[]) ?? [])
    setSites((siteRows as Site[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const visible = useMemo(() => {
    if (filter === 'all') {
      return rows.filter((row) => row.access_status === 'pending' || row.access_status === 'rejected' || row.reviewed_at)
    }
    if (filter === 'active') return rows.filter((row) => row.access_status === 'active' && row.reviewed_at)
    return rows.filter((row) => row.access_status === filter)
  }, [filter, rows])

  function startReview(row: Profile) {
    setReviewing(row)
    form.reset({
      role: row.requested_role && ASSIGNABLE.includes(row.requested_role) ? row.requested_role : 'worker',
      site_id: '',
      note: '',
    })
  }

  async function decide(decision: 'approve' | 'reject') {
    if (!reviewing) return
    const values = form.getValues()
    setBusy(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('review_access_request', {
      p_profile_id: reviewing.id,
      p_decision: decision,
      p_role: decision === 'approve' ? values.role : null,
      p_site_id: decision === 'approve' && values.site_id ? values.site_id : null,
      p_note: values.note || null,
    })
    setBusy(false)
    if (rpcError) {
      const message = rpcError.message || 'Could not save that decision. Confirm 015_signup_approval.sql has been run.'
      setError(message)
      return
    }
    setReviewing(null)
    await load()
  }

  const staffRole = ['worker', 'supervisor', 'security_guard'].includes(form.watch('role'))

  return (
    <div>
      <PageHeader
        title="Access requests"
        subtitle="New sign-ups stay locked until you approve the ID and choose a portal role."
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {(['pending', 'active', 'rejected', 'all'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === value ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-sand-100'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState
          title={filter === 'pending' ? 'No pending requests' : 'No matching accounts'}
          body="When someone uses Create account, they appear here for approval."
        />
      ) : (
        <Table headers={['Name', 'Requested', 'Status', 'Submitted', '']}>
          {visible.map((row) => (
            <tr key={row.id}>
              <Td>
                <p className="font-semibold text-ink-900">{row.full_name}</p>
                <p className="text-xs text-ink-500">{row.email ?? row.phone ?? '—'}</p>
              </Td>
              <Td>{row.requested_role ? ROLE_LABELS[row.requested_role] : ROLE_LABELS[row.role]}</Td>
              <Td>
                <Badge value={row.access_status ?? 'active'} />
              </Td>
              <Td>{formatDateTime(row.created_at)}</Td>
              <Td>
                {row.access_status === 'pending' ? (
                  <Button variant="soft" onClick={() => startReview(row)}>
                    Review
                  </Button>
                ) : row.access_status === 'active' && row.requested_role ? (
                  <span className="text-xs text-ink-500">Approved</span>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Approve access"
      >
        {reviewing ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void decide('approve')
            }}
          >
            <FormError message={error} />
            <p className="text-sm text-ink-700">
              <span className="font-semibold text-ink-950">{reviewing.full_name}</span>
              {reviewing.email ? ` · ${reviewing.email}` : ''} asked for{' '}
              {reviewing.requested_role ? ROLE_LABELS[reviewing.requested_role] : 'access'}.
            </p>
            <Select label="Portal role after approval" {...form.register('role')}>
              {SIGNUP_ROLES.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {ROLE_LABELS[roleOption]}
                </option>
              ))}
            </Select>
            {staffRole ? (
              <Select label="Assign site (optional)" hint="Creates an employee record so check-in can work." {...form.register('site_id')}>
                <option value="">Assign site later</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Textarea label="Note" hint="Optional. Shown to the person if you reject." {...form.register('note')} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void decide('reject')}>
                Reject
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Approve and unlock'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
