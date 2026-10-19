import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck, Inbox, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { relativeTime } from '@/utils/format'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import { useClickOutside } from '@/hooks/useUi'
import { notificationService } from '@/services'

const toneMap = {
  success: 'bg-success-500',
  warning: 'bg-warning-400',
  danger: 'bg-danger-500',
  info: 'bg-accent-400',
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [apiNotifications, setApiNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  const { notifications: localNotifications, markNotificationRead: localMarkRead, markAllNotificationsRead: localMarkAll } = useData()
  const { user } = useAuth()

  useClickOutside(ref, () => setOpen(false), open)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const [listResult, countResult] = await Promise.all([
        notificationService.getNotifications({ limit: 12 }),
        notificationService.getUnreadCount(),
      ])
      setApiNotifications(listResult.notifications || [])
      setUnreadCount(countResult.count ?? (listResult.notifications || []).filter((n) => !n.read).length)
    } catch {
      // In case of unauthenticated or network error, keep current state safely
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleOpenToggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      fetchNotifications()
    }
  }

  const handleMarkAllRead = async () => {
    setApiNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await notificationService.markAllAsRead()
    } catch {
      // Ignore background error
    }
    if (typeof localMarkAll === 'function') {
      localMarkAll()
    }
  }

  const handleMarkOneRead = async (id) => {
    setApiNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await notificationService.markOneAsRead(id)
    } catch {
      // Ignore background error
    }
    if (typeof localMarkRead === 'function') {
      localMarkRead(id)
    }
    setOpen(false)
  }

  // Display real notifications if available, otherwise fallback to local notifications for demo
  const visible = useMemo(() => {
    if (apiNotifications.length > 0) return apiNotifications
    if (!user) return localNotifications || []
    return (localNotifications || []).filter((n) => !n.audience || n.audience.includes(user.role))
  }, [apiNotifications, localNotifications, user])

  const displayUnread = apiNotifications.length > 0
    ? unreadCount
    : visible.filter((n) => !n.read).length

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpenToggle}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-primary-300 hover:text-primary-700"
        aria-label={`Notifications (${displayUnread} unread)`}
        aria-expanded={open}
      >
        <Bell className="h-4.5 w-4.5" size={18} />
        {displayUnread > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {displayUnread}
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
              <div className="flex items-center gap-2">
                <p className="font-display text-sm font-bold text-ink">Notifications</p>
                {loading ? <Loader2 className="h-3 w-3 animate-spin text-muted" /> : null}
              </div>
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            </div>
            <div className="thin-scrollbar max-h-80 overflow-y-auto">
              {visible.length ? (
                visible.slice(0, 10).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleMarkOneRead(n.id)}
                    className={cn(
                      'flex w-full gap-3 border-b border-line px-4 py-3 text-left transition last:border-0 hover:bg-slate-50',
                      !n.read && 'bg-mint-50/60',
                    )}
                  >
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneMap[n.tone] || toneMap.info)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{n.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">{n.body || n.message}</span>
                      <span className="mt-1 block text-[11px] text-faint">{relativeTime(n.time || n.createdAt)}</span>
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
