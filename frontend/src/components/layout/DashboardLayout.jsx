import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import {
  messageService,
  bookingService,
  adaptBookingToJob,
  onBookingBroadcast,
  onBookingClaimed,
} from '@/services'
import { playBroadcastSound } from '@/utils/sound'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { SosButton } from '@/components/common/SosButton'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Sidebar, MobileSidebar } from './Sidebar'
import { Topbar } from './Topbar'

function useBadgeValues() {
  const { conversations, jobs, verifications, sos, caregivers } = useData()
  const { user } = useAuth()
  const location = useLocation()
  const [apiUnreadCaregiver, setApiUnreadCaregiver] = useState(0)
  const [apiUnreadCustomer, setApiUnreadCustomer] = useState(0)
  const [apiOpenJobs, setApiOpenJobs] = useState(0)

  useEffect(() => {
    if (!user) return
    if (user.role === 'caregiver') {
      messageService
        .getUnreadCounts()
        .then((res) => {
          setApiUnreadCaregiver(Number(res?.totalUnread) || 0)
        })
        .catch(() => setApiUnreadCaregiver(0))
    } else if (user.role === 'customer') {
      messageService
        .getUnreadCounts()
        .then((res) => {
          setApiUnreadCustomer(Number(res?.totalUnread) || 0)
        })
        .catch(() => setApiUnreadCustomer(0))
    }
  }, [user, location.pathname])

  const fetchOpenJobs = useCallback(async () => {
    if (!user || user.role !== 'caregiver') return
    try {
      const res = await bookingService.getBookings({ limit: 50 })
      const bookings = res?.bookings || []
      const myUserId = String(user?._id || user?.id || '')
      const caregiverGender = user?.gender || 'Female'

      let dismissed = []
      try {
        const key = myUserId ? `bystander.dismissed_declined_${myUserId}` : 'bystander.dismissed_declined'
        const saved = localStorage.getItem(key)
        dismissed = saved ? JSON.parse(saved) : []
      } catch {}

      const count = bookings.reduce((acc, b) => {
        const job = adaptBookingToJob(b, myUserId)
        if (!job || job.status !== 'Open') return acc
        if (dismissed.includes(String(job.id))) return acc
        const pref = job.preferredGender || 'Any'
        if (pref && pref !== 'Any' && caregiverGender) {
          if (caregiverGender.toLowerCase() !== pref.toLowerCase()) return acc
        }
        return acc + 1
      }, 0)

      setApiOpenJobs(count)
    } catch {
      setApiOpenJobs(0)
    }
  }, [user])

  useEffect(() => {
    if (!user || user.role !== 'caregiver') return

    fetchOpenJobs()

    const unsubBroadcast = onBookingBroadcast((newBooking) => {
      fetchOpenJobs()
      playBroadcastSound()
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/caregiver/jobs')) {
        toast.info('New Caretaker Job Available!', {
          description: `${newBooking?.serviceName || 'Patient Care'} nearby. Tap to view open shifts.`,
          action: {
            label: 'View Jobs',
            onClick: () => {
              window.location.href = '/caregiver/jobs'
            },
          },
        })
      }
    })
    const unsubClaimed = onBookingClaimed(() => fetchOpenJobs())

    const handleUpdate = () => fetchOpenJobs()
    window.addEventListener('focus', handleUpdate)
    window.addEventListener('bystander:bookings_updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)

    const interval = setInterval(fetchOpenJobs, 30000)

    return () => {
      unsubBroadcast()
      unsubClaimed()
      window.removeEventListener('focus', handleUpdate)
      window.removeEventListener('bystander:bookings_updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
      clearInterval(interval)
    }
  }, [user, fetchOpenJobs, location.pathname])

  return useMemo(
    () => ({
      unreadCustomer: user?.role === 'customer'
        ? apiUnreadCustomer
        : conversations.filter((c) => c.audience.includes('customer') && c.unread > 0).length,
      unreadCaregiver: user?.role === 'caregiver'
        ? apiUnreadCaregiver
        : conversations.filter((c) => c.audience.includes('caregiver') && c.unread > 0).length,
      openJobs: user?.role === 'caregiver'
        ? apiOpenJobs
        : jobs.filter((j) => j.status === 'Open').length,
      pendingVerifications: verifications.filter((v) => v.status === 'Pending' || v.status === 'Under Review').length,
      activeSos: sos.filter((s) => s.status === 'Open' || s.status === 'Under Investigation').length,
      pendingCaregivers: caregivers.filter((c) => !c.verified).length,
    }),
    [conversations, jobs, verifications, sos, caregivers, user, apiUnreadCaregiver, apiUnreadCustomer, apiOpenJobs],
  )
}

export function DashboardLayout({ nav, variant = 'customer', sidebarFooter, topbarSearch, topbarActions }) {
  const [collapsed, setCollapsed] = useLocalStorage(`bystander.sidebar.${variant}`, false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const values = useBadgeValues()
  const { pathname } = useLocation()
  const logoSize = variant === 'admin' ? 'lg' : 'md'

  const lastSegment = pathname.split('/').filter(Boolean).pop() || 'dashboard'
  const title = lastSegment.replace(/-/g, ' ')

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        nav={nav}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        values={values}
        footer={sidebarFooter}
        logoSize={logoSize}
      />
      <MobileSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        nav={nav}
        values={values}
        footer={sidebarFooter}
        logoSize={logoSize}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          search={topbarSearch}
          actions={topbarActions}
          title={title.replace(/\b\w/g, (c) => c.toUpperCase())}
        />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {variant === 'customer' || variant === 'caregiver' ? <SosButton /> : null}
    </div>
  )
}

export default DashboardLayout
