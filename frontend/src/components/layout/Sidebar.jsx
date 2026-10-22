import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/utils/cn'
import { Logo } from '@/components/common/Logo'
import { useAuth } from '@/context/AuthContext'

function resolveBadge(item, values) {
  const raw = item.badge
  if (!raw) return null
  const key = String(raw).startsWith('key:') ? String(raw).slice(4) : raw
  const value = values?.[key]
  return value ? { value, tone: item.tone } : null
}

export function Sidebar({ nav, collapsed = false, onToggle, values = {}, footer, logoSize = 'md' }) {
  const largeLogo = logoSize === 'lg'
  const { user } = useAuth()
  const isUnverifiedCaregiver =
    user?.role === 'caregiver' &&
    !(user?.verified === true || String(user?.verificationStatus || '').toLowerCase() === 'verified')

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-white transition-all duration-300 lg:flex',
        collapsed ? 'w-[76px]' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex items-center border-b border-line px-4',
          largeLogo ? 'h-24' : 'h-16',
          collapsed && 'justify-center px-0',
        )}
      >
        <Logo compact={collapsed} size={logoSize} markClass={largeLogo ? 'h-14 w-14' : undefined} />
      </div>

      <nav className="thin-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {nav.map((group) => (
          <div key={group.section}>
            {!collapsed ? (
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">{group.section}</p>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-line" />
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const badge = resolveBadge(item, values)
                const Icon = item.icon
                const isLocked =
                  isUnverifiedCaregiver &&
                  item.to !== '/caregiver/dashboard' &&
                  item.to !== '/caregiver/documents'

                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      title={collapsed ? (isLocked ? `${item.label} (Locked · Verification Required)` : item.label) : undefined}
                      onClick={(e) => {
                        if (isLocked) {
                          e.preventDefault()
                          toast.error(`Verification required: "${item.label}" is locked until admin approves your documents.`)
                        }
                      }}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                          collapsed && 'justify-center px-0',
                          isLocked
                            ? 'cursor-not-allowed text-faint opacity-65 hover:bg-transparent'
                            : isActive
                              ? 'bg-primary-700 text-white shadow-[0_10px_22px_-14px_rgba(15,118,110,1)]'
                              : 'text-muted hover:bg-slate-100 hover:text-ink',
                        )
                      }
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                      {isLocked ? (
                        !collapsed ? (
                          <span className="ml-auto inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            <Lock className="h-2.5 w-2.5" />
                            Locked
                          </span>
                        ) : (
                          <span className="absolute right-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-amber-100 text-amber-700">
                            <Lock className="h-2 w-2" />
                          </span>
                        )
                      ) : badge ? (
                        <span
                          className={cn(
                            'grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[10px] font-bold',
                            collapsed
                              ? 'absolute right-1.5 top-1.5 h-2.5 min-w-2.5 bg-danger-500 px-0 text-white'
                              : badge.tone === 'danger'
                                ? 'bg-danger-500 text-white'
                                : 'bg-primary-100 text-primary-800',
                          )}
                        >
                          {collapsed ? '' : badge.value}
                        </span>
                      ) : null}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {footer ? <div className="border-t border-line p-3">{footer}</div> : null}

      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 border-t border-line px-4 py-3 text-xs font-semibold text-muted transition hover:text-primary-700"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed ? 'Collapse sidebar' : ''}
        </button>
      ) : null}
    </aside>
  )
}

export function MobileSidebar({ open, onClose, nav, values = {}, header, footer, logoSize = 'md' }) {
  const largeLogo = logoSize === 'lg'
  const { user } = useAuth()
  const isUnverifiedCaregiver =
    user?.role === 'caregiver' &&
    !(user?.verified === true || String(user?.verificationStatus || '').toLowerCase() === 'verified')

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-50 bg-[#0B1F2C]/55 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden="true"
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-white shadow-raised transition-transform duration-300 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            'flex items-center justify-between border-b border-line px-4',
            largeLogo ? 'h-24' : 'h-16',
          )}
        >
          {header ?? <Logo size={logoSize} />}
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-slate-100"
            aria-label="Close navigation"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="thin-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {nav.map((group) => (
            <div key={group.section}>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">{group.section}</p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const badge = resolveBadge(item, values)
                  const Icon = item.icon
                  const isLocked =
                    isUnverifiedCaregiver &&
                    item.to !== '/caregiver/dashboard' &&
                    item.to !== '/caregiver/documents'

                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={(e) => {
                          if (isLocked) {
                            e.preventDefault()
                            toast.error(`Verification required: "${item.label}" is locked until admin approves your documents.`)
                            return
                          }
                          onClose()
                        }}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                            isLocked
                              ? 'cursor-not-allowed text-faint opacity-65'
                              : isActive
                                ? 'bg-primary-700 text-white'
                                : 'text-muted hover:bg-slate-100 hover:text-ink',
                          )
                        }
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {isLocked ? (
                          <span className="ml-auto inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            <Lock className="h-2.5 w-2.5" />
                            Locked
                          </span>
                        ) : badge ? (
                          <span
                            className={cn(
                              'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold',
                              badge.tone === 'danger' ? 'bg-danger-500 text-white' : 'bg-primary-100 text-primary-800',
                            )}
                          >
                            {badge.value}
                          </span>
                        ) : null}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
        {footer ? <div className="border-t border-line p-3">{footer}</div> : null}
      </aside>
    </>
  )
}

export default Sidebar
