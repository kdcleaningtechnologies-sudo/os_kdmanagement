import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { formatDateTime } from '../lib/format'
import type { Notification } from '../types/database'

export function NotificationBell() {
  const { profile } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!profile) return

    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (!cancelled) setItems((data as Notification[]) ?? [])
    }

    void load()

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${profile.id}`,
        },
        (payload) => {
          setItems((prev) => [payload.new as Notification, ...prev].slice(0, 20))
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${profile.id}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [profile])

  const unread = items.filter((item) => !item.is_read).length

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)))
  }

  async function markAllRead() {
    if (!profile) return
    await supabase.from('notifications').update({ is_read: true }).eq('profile_id', profile.id).eq('is_read', false)
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })))
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl p-2 text-ink-800 hover:bg-sand-50"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-3 top-16 z-40 max-h-[70dvh] overflow-hidden rounded-2xl border border-sand-100 bg-white shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-80">
          <div className="flex items-center justify-between border-b border-sand-50 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            {unread > 0 ? (
              <button type="button" onClick={() => void markAllRead()} className="text-xs font-semibold text-tide-600">
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-600">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void markRead(item.id)}
                  className={`block w-full border-b border-sand-50 px-4 py-3 text-left last:border-0 ${item.is_read ? 'bg-white' : 'bg-tide-50/60'}`}
                >
                  <p className="text-sm text-ink-900">{item.message}</p>
                  <p className="mt-1 text-[11px] text-ink-600">{formatDateTime(item.created_at)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
