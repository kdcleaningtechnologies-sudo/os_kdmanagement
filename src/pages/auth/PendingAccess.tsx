import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { hasSoftwareAccess, PORTAL_HOME, ROLE_LABELS } from '../../lib/auth/roles'
import { Logo } from '../../components/brand/Logo'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'

export function PendingAccessPage() {
  const { loading, session, profile, role, signOut, refreshProfile } = useAuth()

  if (loading) return <Spinner label="Checking access" />
  if (!session) return <Navigate to="/login" replace />
  if (profile && hasSoftwareAccess(profile) && role) return <Navigate to={PORTAL_HOME[role]} replace />

  const rejected = profile?.access_status === 'rejected'
  const requested = profile?.requested_role ?? profile?.role

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#f3f1eb] px-4 py-10">
      <Card className="w-full max-w-md space-y-5">
        <Logo />
        <div>
          <h1 className="text-xl font-semibold text-ink-950">
            {rejected ? 'Access not approved' : 'Waiting for admin approval'}
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            {rejected
              ? profile?.access_note || 'An administrator declined this account. Contact your office if this is a mistake.'
              : 'Your sign-in works, but FacilityOS stays locked until an administrator approves this ID.'}
          </p>
        </div>
        <div className="rounded-xl bg-sand-50 px-3 py-3 text-sm text-ink-800">
          <p className="font-semibold text-ink-950">{profile?.full_name ?? 'Your account'}</p>
          {requested ? <p className="mt-1 text-xs text-ink-600">Requested: {ROLE_LABELS[requested]}</p> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => {
              void refreshProfile()
            }}
          >
            Check again
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  )
}
