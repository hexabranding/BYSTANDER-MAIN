import { useEffect, useRef, useState } from 'react'
import { Menu, LogOut, Search, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { HOME_FOR_ROLE } from '@/routes/nav'
import { Avatar } from '@/components/common/Avatar'
import { NotificationCenter } from './NotificationCenter'
import { useClickOutside } from '@/hooks/useUi'

export function Topbar({ onMenuClick, search, searchPlaceholder = 'Search…', actions, title }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setMenuOpen(false), menuOpen)

  useEffect(() => setMenuOpen(false), [title])

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-ink lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        {search ? (
          <label className="relative hidden max-w-md sm:block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-10 w-full rounded-xl border border-line bg-slate-50 pl-10 pr-3 text-sm text-ink placeholder:text-faint transition focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:outline-none"
            />
          </label>
        ) : (
          <p className="truncate font-display text-base font-bold text-ink sm:text-lg">{title}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {actions}
        <NotificationCenter />

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-line bg-white py-1 pl-1 pr-1.5 transition hover:border-primary-300 sm:pr-3"
            aria-label="Account menu"
            aria-expanded={menuOpen}
          >
            <Avatar src={user?.avatar} name={user?.name} size="sm" />
            <span className="hidden text-left sm:block">
              <span className="block max-w-[9rem] truncate text-xs font-bold text-ink">{user?.name}</span>
              <span className="block text-[10px] capitalize text-faint">
                {user?.role === 'caregiver' ? 'caretaker' : user?.role}
              </span>
            </span>
          </button>

          {menuOpen ? (
            <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white shadow-raised">
              <div className="border-b border-line px-4 py-3">
                <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
              <Link
                to={user?.role === 'caregiver' ? '/caregiver/profile' : user?.role === 'admin' ? '/admin/settings' : '/customer/profile'}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                <UserRound className="h-4 w-4 text-muted" /> My profile
              </Link>
              <Link
                to={HOME_FOR_ROLE[user?.role] || '/'}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                <Menu className="h-4 w-4 text-muted" /> Switch workspace
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-sm font-semibold text-danger-600 transition hover:bg-danger-50"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default Topbar
