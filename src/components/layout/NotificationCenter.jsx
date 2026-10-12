import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { relativeTime } from '@/utils/format'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import { useClickOutside } from '@/hooks/useUi'

const toneMap = {
  success: 'bg-success-500',
  warning: 'bg-warning-400',
  danger: 'bg-danger-500',
  info: 'bg-accent-400',
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { notifications, markNotificationRead, markAllNotificationsRead } = useData()
  const { user } = useAuth()

  useClickOutside(ref, () => setOpen(false), open)

  const visible = useMemo(() => {
    if (!user) return notifications
    return notifications.filter((n) => !n.audience || n.audience.includes(user.role))
  }, [notifications, user])

  const unread = visible.filter((n) => !n.read).length

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-primary-300 hover:text-primary-700"
        aria-label={`Notifications (${unread} unread)`}
        aria-expanded={open}
      >
        <Bell className="h-4.5 w-4.5" size={18} />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 z-50 mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-raised"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-display text-sm font-bold text-ink">Notifications</p>
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            </div>
            <div className="thin-scrollbar max-h-80 overflow-y-auto">
              {visible.length ? (
                visible.slice(0, 8).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      markNotificationRead(n.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full gap-3 border-b border-line px-4 py-3 text-left transition last:border-0 hover:bg-slate-50',
                      !n.read && 'bg-mint-50/60',
                    )}
                  >
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneMap[n.tone] || toneMap.info)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{n.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-faint">{relativeTime(n.time)}</span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-10 text-center">
                  <Inbox className="mx-auto h-6 w-6 text-faint" />
                  <p className="mt-2 text-sm text-muted">You are all caught up.</p>
                </div>
              )}
            </div>
            <div className="border-t border-line bg-slate-50 px-4 py-2.5 text-center">
              <Link
                to={user?.role === 'admin' ? '/admin/bookings' : user?.role === 'caregiver' ? '/caregiver/bookings' : '/customer/bookings'}
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-primary-700 hover:underline"
              >
                View booking activity
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default NotificationCenter
