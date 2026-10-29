import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import { messageService } from '@/services'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { SosButton } from '@/components/common/SosButton'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Sidebar, MobileSidebar } from './Sidebar'
import { Topbar } from './Topbar'

function useBadgeValues() {
  const { conversations, jobs, verifications, sos, caregivers } = useData()
  const { user } = useAuth()
  const [apiUnreadCaregiver, setApiUnreadCaregiver] = useState(0)

  useEffect(() => {
    if (!user) return
    if (user.role === 'caregiver') {
      messageService
        .getUnreadCounts()
        .then((res) => {
          setApiUnreadCaregiver(Number(res?.totalUnread) || 0)
        })
        .catch(() => setApiUnreadCaregiver(0))
    }
  }, [user])

  return useMemo(
    () => ({
      unreadCustomer: conversations.filter((c) => c.audience.includes('customer') && c.unread > 0).length,
      unreadCaregiver: user?.role === 'caregiver'
        ? apiUnreadCaregiver
        : conversations.filter((c) => c.audience.includes('caregiver') && c.unread > 0).length,
      openJobs: jobs.filter((j) => j.status === 'Open').length,
      pendingVerifications: verifications.filter((v) => v.status === 'Pending' || v.status === 'Under Review').length,
      activeSos: sos.filter((s) => s.status === 'Open' || s.status === 'Under Investigation').length,
      pendingCaregivers: caregivers.filter((c) => !c.verified).length,
    }),
    [conversations, jobs, verifications, sos, caregivers, user, apiUnreadCaregiver],
  )
}

export function DashboardLayout({ nav, variant = 'customer', sidebarFooter, topbarSearch, topbarActions }) {
  const [collapsed, setCollapsed] = useLocalStorage(`caremate.sidebar.${variant}`, false)
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
