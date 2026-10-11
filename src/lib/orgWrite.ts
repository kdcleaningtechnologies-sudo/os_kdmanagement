export function withOrg<T extends object>(
  payload: T,
  organizationId: string | null | undefined,
): T {
  if (!organizationId) return payload
  return { ...payload, organization_id: organizationId }
}
