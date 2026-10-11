import { supabase } from './supabaseClient'

export async function notifySuperAdmins(message: string) {
  const { data: admins, error } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['super_admin', 'admin'])

  if (error || !admins?.length) return

  await supabase.from('notifications').insert(
    admins.map((admin) => ({
      profile_id: admin.id,
      message,
      is_read: false,
    })),
  )
}
