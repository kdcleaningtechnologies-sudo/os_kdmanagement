import type { UserRole } from '../types/database'
import { isAdminRole } from './auth/roles'

export function canManageOrganizations(role: UserRole | null | undefined) {
  return role === 'super_admin'
}

export function canEditOrganizationSettings(role: UserRole | null | undefined) {
  return isAdminRole(role)
}

export function canManageDirectory(role: UserRole | null | undefined) {
  return isAdminRole(role)
}
