import { NavLink, Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { ROLE_LABELS } from '../../lib/constants'
import { Logo } from '../brand/Logo'
import type { NavItem } from './DesktopSidebarLayout'

export function MobilePortalLayout({ items }: { items: NavItem[] }) {
  const { profile, role, signOut } = useAuth()
  const tabCols = items.length > 5 ? 'grid-cols-4' : 'grid-cols-5'

  return (
    <div className="mx-auto flex min-h-svh min-w-0 max-w-lg flex-col overflow-x-hidden bg-[#f3f1eb]">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-sand-100 bg-[#f3f1eb]/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <Logo />
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-ink-600"
        >
          <LogOut size={14} />
          Out
        </button>
      </header>

      <div className="min-w-0 px-4 pt-3">
        <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">{role ? ROLE_LABELS[role] : ''}</p>
        <p className="truncate text-sm font-semibold text-ink-950">{profile?.full_name}</p>
      </div>

      <main className="min-w-0 flex-1 px-4 py-4 pb-32">
        <Outlet />
      </main>

      <nav className="fixed right-0 bottom-0 left-0 z-30 mx-auto max-w-lg border-t border-sand-100 bg-white/95 px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className={`grid gap-1 ${tabCols}`}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center text-[10px] leading-tight font-semibold ${
                  isActive ? 'bg-tide-50 text-ink-900' : 'text-ink-600'
                }`
              }
            >
              <item.icon size={18} />
              <span className="max-w-full break-words">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
