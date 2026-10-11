import type { UserRole } from '../../types/database'

export const ADMIN_ROLES: UserRole[] = ['super_admin', 'admin', 'operations_manager']
export const CLIENT_ROLES: UserRole[] = ['client', 'client_admin', 'client_user']
export const SUPERVISOR_ROLES: UserRole[] = ['supervisor']
export const WORKER_ROLES: UserRole[] = ['worker']
export const SECURITY_ROLES: UserRole[] = ['security_guard']

export const PORTAL_HOME: Record<UserRole, string> = {
  super_admin: '/admin',
  admin: '/admin',
  operations_manager: '/admin',
  supervisor: '/supervisor',
  worker: '/worker',
  security_guard: '/security',
  client_admin: '/client',
  client_user: '/client',
  client: '/client',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Platform Super Admin',
  admin: 'Organization Admin',
  operations_manager: 'Operations Manager',
  supervisor: 'Supervisor',
  worker: 'Worker',
  security_guard: 'Security Guard',
  client_admin: 'Client Admin',
  client_user: 'Client User',
  client: 'Client',
}

export function isAdminRole(role: UserRole | null | undefined) {
  return Boolean(role && ADMIN_ROLES.includes(role))
}

export function hasSoftwareAccess(profile?: { access_status?: string | null } | null) {
  if (!profile) return false
  return profile.access_status == null || profile.access_status === 'active'
}
