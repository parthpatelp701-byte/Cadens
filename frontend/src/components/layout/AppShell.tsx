import { type ReactNode, useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Bookmark, Sun, CalendarDays, Users, User } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'
import { fetchUnreadCount } from '@/lib/notifications'
import { clsx } from 'clsx'
import { AmbientBackground } from '@/components/layout/AmbientBackground'
import { RouteProgress } from '@/components/layout/RouteProgress'

const navItems = [
  { to: '/', icon: Sun, label: 'Today' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/saves', icon: Bookmark, label: 'Saves' },
  { to: '/people', icon: Users, label: 'People' },
  { to: '/you', icon: User, label: 'You' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let ok = true
    fetchUnreadCount()
      .then((n) => {
        if (ok) setUnread(n)
      })
      .catch(() => {
        if (ok) setUnread(0)
      })
    return () => {
      ok = false
    }
  }, [location.pathname])

  return (
    <div className="min-h-dvh flex flex-col md:flex-row bg-[var(--color-bg)] relative">
      <AmbientBackground />
      <RouteProgress />
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-[220px] lg:w-[240px] flex-col border-r border-[var(--color-line2)] bg-[var(--color-s1)] z-50 safe-top">
        <div className="px-5 py-6">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <div className="font-display text-lg font-bold tracking-tight leading-none">Cadens</div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1" aria-label="Primary">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              viewTransition
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.9rem] font-semibold transition-all duration-200 nav-item',
                  isActive
                    ? 'bg-[color-mix(in_srgb,var(--color-acc)_18%,transparent)] text-[var(--color-txt)]'
                    : 'text-[var(--color-dim)] hover:bg-[var(--color-s2)] hover:text-[var(--color-txt)]'
                )
              }
            >
              <Icon size={20} strokeWidth={2.2} />
              <span className="flex-1">{label}</span>
              {to === '/you' && unread > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-[10px] font-bold flex items-center justify-center" aria-label={`${unread} unread`}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 md:ml-[220px] lg:ml-[240px] flex flex-col min-h-dvh">
        <main id="main-content" tabIndex={-1} className="relative z-[1] flex-1 w-full max-w-[1120px] mx-auto px-4 py-4 md:px-8 md:py-6 main-with-tabs">
          {children}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-[var(--color-line2)] bg-[color-mix(in_srgb,var(--color-s1)_92%,transparent)] backdrop-blur-xl nav-bottom" aria-label="Primary">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active =
            to === '/'
              ? location.pathname === '/'
              : location.pathname === to || location.pathname.startsWith(to + '/')
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              viewTransition
              className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[52px] py-1.5 text-[0.58rem] font-bold relative"
            >
              <span
                className={clsx(
                  'w-11 h-7 rounded-full flex items-center justify-center relative',
                  active && 'bg-[color-mix(in_srgb,var(--color-acc)_22%,transparent)] text-[var(--color-acc)]'
                )}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.4 : 2}
                  className={active ? 'text-[var(--color-acc)]' : 'text-[var(--color-mute)]'}
                />
                {to === '/you' && unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-[9px] font-bold flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </span>
              <span className={active ? 'text-[var(--color-txt)]' : 'text-[var(--color-mute)]'}>{label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
