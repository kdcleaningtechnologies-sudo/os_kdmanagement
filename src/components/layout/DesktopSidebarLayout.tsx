import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { ROLE_LABELS } from '../../lib/constants'
import { Logo } from '../brand/Logo'
import { NotificationBell } from '../NotificationBell'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export function DesktopSidebarLayout({
  items,
  eyebrow,
}: {
  items: NavItem[]
  eyebrow: string
}) {
  const { profile, role, organization, signOut } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const current = items.find((item) =>
    item.end ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  )

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <div className="flex min-h-svh min-w-0 bg-[#f3f1eb]">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col bg-ink-950 text-ink-50 md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Logo light />
          <p className="mt-3 text-[10px] font-semibold tracking-[0.2em] text-tide-400 uppercase">{eyebrow}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-white/10 text-white' : 'text-ink-100/80 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-semibold text-white">{profile?.full_name}</p>
          <p className="truncate text-xs text-ink-100/70">{organization?.name ?? ''}</p>
          <p className="text-xs text-ink-100/70">{role ? ROLE_LABELS[role] : ''}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-tide-300 hover:text-white"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-ink-950/50" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-ink-950 text-ink-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <Logo light />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl p-2 text-white"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <p className="px-4 pt-3 text-[10px] font-semibold tracking-[0.2em] text-tide-400 uppercase">{eyebrow}</p>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                      isActive ? 'bg-white/10 text-white' : 'text-ink-100/80'
                    }`
                  }
                >
                  <item.icon size={17} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <p className="truncate text-sm font-semibold text-white">{profile?.full_name}</p>
              <p className="truncate text-xs text-ink-100/70">{role ? ROLE_LABELS[role] : ''}</p>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-tide-300"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-sand-100 bg-[#f3f1eb]/90 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:px-8 md:pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-xl p-2 text-ink-800 hover:bg-sand-50 md:hidden"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0 md:hidden">
              <p className="truncate text-sm font-semibold text-ink-950">{current?.label ?? 'FacilityOS'}</p>
              <p className="truncate text-[11px] text-ink-600">{profile?.full_name}</p>
            </div>
            <p className="hidden text-sm text-ink-600 md:block">KD FacilityOS</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-ink-600 hover:bg-sand-50 md:hidden"
            >
              <LogOut size={14} />
              Out
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 py-5 sm:px-4 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
