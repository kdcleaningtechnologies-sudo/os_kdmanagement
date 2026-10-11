import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { hasSoftwareAccess, PORTAL_HOME } from '../../lib/auth/roles'
import type { UserRole } from '../../types/database'
import { Spinner } from '../ui/Spinner'

export function ProtectedRoute({ roles }: { roles: UserRole[] }) {
  const { loading, session, role, profile } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-svh bg-sand-50">
        <Spinner label="Checking session" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!profile || !role) {
    return <Navigate to="/login" replace />
  }

  if (!hasSoftwareAccess(profile)) {
    return <Navigate to="/pending" replace />
  }

  if (!roles.includes(role)) {
    return <Navigate to={PORTAL_HOME[role]} replace />
  }

  return <Outlet />
}
