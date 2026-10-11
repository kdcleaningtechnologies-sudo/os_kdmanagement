import { supabase } from './supabaseClient'
import type { PatrolCheckStatus, PatrolStatus, SecurityCheckpoint, SecurityPatrol } from '../types/database'

export function isPatrolOpen(status: PatrolStatus | null | undefined) {
  return status === 'scheduled' || status === 'in_progress'
}

export function isVisitorOnSite(status: string | null | undefined) {
  return status === 'on_site'
}

export async function seedPatrolChecks(patrol: Pick<SecurityPatrol, 'id' | 'site_id' | 'organization_id'>) {
  const { data: existing } = await supabase.from('security_patrol_checks').select('id').eq('patrol_id', patrol.id)
  if (existing?.length) return

  const { data: points, error } = await supabase
    .from('security_checkpoints')
    .select('*')
    .eq('site_id', patrol.site_id)
    .eq('status', 'active')
    .order('sort_order')
  if (error) throw error

  const rows = ((points as SecurityCheckpoint[]) ?? []).map((point) => ({
    patrol_id: patrol.id,
    checkpoint_id: point.id,
    organization_id: patrol.organization_id,
    status: 'pending' as PatrolCheckStatus,
  }))
  if (!rows.length) return
  const { error: insertError } = await supabase.from('security_patrol_checks').insert(rows)
  if (insertError) throw insertError
}
