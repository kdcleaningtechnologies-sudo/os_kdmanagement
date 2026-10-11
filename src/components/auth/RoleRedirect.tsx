import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { hasSoftwareAccess, PORTAL_HOME } from '../../lib/auth/roles'
import { Spinner } from '../ui/Spinner'

export function RoleRedirect() {
  const { loading, session, role, profile } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh bg-sand-50">
        <Spinner label="Opening portal" />
      </div>
    )
  }

  if (!session || !role) return <Navigate to="/login" replace />
  if (!hasSoftwareAccess(profile)) return <Navigate to="/pending" replace />
  return <Navigate to={PORTAL_HOME[role]} replace />
}
