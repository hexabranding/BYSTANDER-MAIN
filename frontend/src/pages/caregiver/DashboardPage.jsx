import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  MapPin,
  ShieldCheck,
  Star,
  Wallet,
  Lock,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { formatCurrency, formatDate, relativeTime } from '@/utils/format'
import { formatDuration } from '@/utils/duration'
import { PLATFORM_COMMISSION } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { EASE } from '@/utils/motion'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { StatCard } from '@/components/common/StatCard'
import { SectionLabel } from '@/components/common/SectionLabel'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RatingStars } from '@/components/common/RatingStars'
import { ProgressBar } from '@/components/common/Tabs'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { EmptyState } from '@/components/common/States'
import { bookingService } from '@/services/bookingService'
import { financeService } from '@/services/financeService'
import { notificationService } from '@/services/notificationService'

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #E6ECF2',
  boxShadow: '0 10px 28px -18px rgba(16,42,67,0.35)',
  fontSize: 12,
  color: '#172B3A',
}

const toneDots = {
  success: 'bg-success-500',
  warning: 'bg-warning-400',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
}

export function DashboardPage() {
  useDocumentTitle('Caretaker Dashboard')

  const { user } = useAuth()
  const [realBookings, setRealBookings] = useState([])
  const [realEarnings, setRealEarnings] = useState(null)
  const [realNotifications, setRealNotifications] = useState([])
  const [acceptTarget, setAcceptTarget] = useState(null)
  const [requestTarget, setRequestTarget] = useState(null)

  const caregiver = {
    name: user?.fullName || user?.name || 'Caretaker',
    qualification: user?.qualification || 'Certified Caretaker',
    experienceYears: user?.experienceYears ?? 0,
    verificationStatus: user?.verificationStatus || 'pending',
    rating: user?.rating?.average ?? 5.0,
    reviewCount: user?.rating?.count ?? 0,
    trustScore: user?.trustScore ?? 94,
    responseRate: user?.responseRate ?? 98,
    badges: user?.badges || ['Police verified', 'CPR certified'],
  }

  const verified = Boolean(
    user?.verified === true ||
    String(user?.verificationStatus || '').toLowerCase() === 'verified',
  )

  const loadDashboard = useCallback(async () => {
    try {
      const [bookingsRes, earningsRes, notificationsRes] = await Promise.allSettled([
        bookingService.getBookings({ limit: 50 }),
        financeService.getCaregiverEarnings(),
        notificationService.getNotifications({ limit: 10 }),
      ])

      if (bookingsRes.status === 'fulfilled') {
        setRealBookings(bookingsRes.value?.bookings || [])
      }
      if (earningsRes.status === 'fulfilled') {
        setRealEarnings(earningsRes.value || null)
      }
      if (notificationsRes.status === 'fulfilled') {
        setRealNotifications(notificationsRes.value?.notifications || [])
      }
    } catch (err) {
      console.warn('[Caregiver Dashboard Load Error]', err)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const myBookings = useMemo(() => realBookings || [], [realBookings])

  const bookingRequests = useMemo(
    () => myBookings.filter((b) => b.status === 'Pending').sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [myBookings],
  )

  const upcoming = useMemo(
    () => myBookings.filter((b) => ['Confirmed', 'In Progress'].includes(b.status)).sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [myBookings],
  )

  const completedJobs = useMemo(
    () => myBookings.filter((b) => b.status === 'Completed'),
    [myBookings],
  )

  const caregiverGender = user?.gender || 'Female'

  const openJobs = useMemo(
    () =>
      myBookings.filter((b) => {
        if (b.status !== 'Pending') return false
        const pref = b.preferredGender || 'Any'
        if (!pref || pref === 'Any') return true
        if (!caregiverGender) return true
        return caregiverGender.toLowerCase() === pref.toLowerCase()
      }),
    [myBookings, caregiverGender],
  )

  const acceptedJobs = useMemo(
    () => myBookings.filter((b) => b.status === 'Confirmed' || b.status === 'In Progress'),
    [myBookings],
  )

  const totalEarned = realEarnings?.stats?.totalNet ?? 0
  const pendingPayout = realEarnings?.stats?.pendingPayout ?? 0
  const clearedPayouts = realEarnings?.stats?.availableBalance ?? 0

  const caregiverNotifications = useMemo(() => {
    return (realNotifications || []).slice(0, 4)
  }, [realNotifications])

  const recommended = openJobs.slice(0, 3)

  const firstName = (caregiver?.name || 'Caretaker').split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const liveShifts = myBookings.filter((b) => b.status !== 'Cancelled')
  const bookedHours = liveShifts.reduce((sum, b) => sum + (b.hours || 0), 0)
  const cancelledShifts = myBookings.filter((b) => b.status === 'Cancelled').length
  const decidedShifts = completedJobs.length + cancelledShifts
  const completionRate = decidedShifts ? Math.round((completedJobs.length / decidedShifts) * 100) : null
  const nextShift = upcoming[0]

  const weeklyEarningsData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const result = days.map((day) => ({ day, earnings: 0 }))

    const now = new Date()
    const dayOfWeek = (now.getDay() + 6) % 7 // Monday = 0, Sunday = 6
    const monday = new Date(now)
    monday.setDate(now.getDate() - dayOfWeek)
    monday.setHours(0, 0, 0, 0)

    const list = realEarnings?.earnings || []
    list.forEach((e) => {
      if (e.status !== 'Released' && e.status !== 'Paid') return
      const d = new Date(e.date)
      if (isNaN(d.getTime())) return
      const diffDays = Math.floor((d.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays >= 0 && diffDays < 7) {
        result[diffDays].earnings += Number(e.net || 0)
      }
    })

    return result
  }, [realEarnings])

  const handleAccept = async () => {
    if (!acceptTarget) return
    try {
      await bookingService.acceptBooking(acceptTarget.id)
      toast.success('Job accepted — added to your schedule')
      setAcceptTarget(null)
      loadDashboard()
    } catch (err) {
      toast.error('Failed to accept job', { description: err?.message || 'Please try again.' })
    }
  }

  const handleRequestConfirm = async () => {
    if (!requestTarget) return
    try {
      if (requestTarget.action === 'accept') {
        await bookingService.acceptBooking(requestTarget.booking.id)
        toast.success('Booking request accepted', {
          description: `${requestTarget.booking.service} on ${formatDate(requestTarget.booking.date, { long: true })} is confirmed.`,
        })
      } else {
        await bookingService.rejectBooking(requestTarget.booking.id, 'Declined by caretaker')
        toast.info('Booking request declined', { description: 'The customer has been notified.' })
      }
      setRequestTarget(null)
      loadDashboard()
    } catch (err) {
      toast.error('Action failed', { description: err?.message || 'Could not update booking' })
    }
  }

  return (
    <div className="space-y-6">
      {/* ---------------- hero band ---------------- */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="relative overflow-hidden rounded-panel bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 shadow-raised"
      >
        <div aria-hidden="true" className="grid-pattern pointer-events-none absolute inset-0 opacity-[0.14]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.25),transparent)] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(163,229,218,0.22),transparent)] blur-3xl"
        />

        <div className="relative flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-300 backdrop-blur-sm">
              <Star className="h-3.5 w-3.5" />
              Caretaker overview
            </span>
            <h1 className="mt-3 font-display text-2xl font-extrabold text-white sm:text-3xl">
              {greeting}, {firstName}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/60">
              Your shifts, earnings and verification status — all in one place.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <StatusBadge
                status={
                  verified
                    ? 'Verified'
                    : user?.verificationStatus
                      ? user.verificationStatus.charAt(0).toUpperCase() + user.verificationStatus.slice(1)
                      : caregiver?.verificationStatus || 'Pending'
                }
              />
              <span className="text-xs text-white/55">
                {user?.qualification || caregiver?.qualification} · {user?.experienceYears ?? caregiver?.experienceYears ?? 0} yrs experience
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <Button
              variant="accent"
              to="/caregiver/documents"
              icon={verified ? ShieldCheck : AlertTriangle}
            >
              {verified ? 'View documents' : 'Complete verification'}
            </Button>
            <Button
              variant="secondary"
              to={verified ? '/caregiver/jobs' : '/caregiver/documents'}
              icon={verified ? Briefcase : Lock}
              onClick={(e) => {
                if (!verified) {
                  toast.info('Please complete verification documents to unlock job browsing.')
                }
              }}
            >
              {verified ? 'Browse jobs' : 'Unlock jobs'}
            </Button>
          </div>
        </div>

        <div className="relative grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
          {[
            {
              label: 'Booked hours',
              value: `${bookedHours} hrs`,
              note: `Scheduled across ${liveShifts.length} shifts`,
            },
            {
              label: 'Completion rate',
              value: completionRate === null ? '—' : `${completionRate}%`,
              note: `${completedJobs.length} completed · ${cancelledShifts} cancelled`,
            },
            {
              label: 'Payouts cleared',
              value: formatCurrency(clearedPayouts),
              note: 'Settled to your bank account',
            },
            {
              label: 'Next shift',
              value: nextShift ? formatDate(nextShift.date) : '—',
              note: nextShift
                ? [nextShift.startTime, formatDuration(nextShift.hours, { short: true }), nextShift.city || nextShift.address]
                    .filter(Boolean)
                    .join(' · ')
                : 'No shift booked yet',
            },
          ].map((metric, i) => (
            <div
              key={metric.label}
              className={cn(
                'border-white/10 px-5 py-4 sm:px-6 sm:border-t-0',
                i >= 2 && 'border-t',
                i % 2 === 1 && 'border-l',
                i >= 1 && 'sm:border-l',
              )}
            >
              <p className="text-[11px] font-bold uppercase leading-tight tracking-[0.14em] text-white/45">
                {metric.label}
              </p>
              <p className="mt-1.5 font-display text-xl font-extrabold tabular-nums text-white sm:text-2xl">
                {metric.value}
              </p>
              <p className="mt-1 text-xs leading-snug text-white/50">{metric.note}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {verified ? (
        <div className="flex flex-col gap-3 rounded-card border border-success-500/30 bg-gradient-to-br from-success-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-success-50 to-success-100 text-success-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-success-700">Identity verified — you are fully trusted</p>
              <p className="mt-0.5 text-sm leading-relaxed text-success-700/80">
                All your documents are approved. Customers see the Verified badge on your profile and you receive priority in job matches.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" to="/caregiver/documents">
            Manage documents
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-card border border-warning-400/40 bg-gradient-to-br from-warning-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-warning-50 to-warning-100 text-warning-700">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-warning-700">Verification incomplete</p>
              <p className="mt-0.5 text-sm leading-relaxed text-warning-700/90">
                Upload or re-submit the pending documents to unlock bookings and payouts. Your current status is{' '}
                {caregiver?.verificationStatus || 'Pending'}.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" to="/caregiver/documents">
            Go to documents
          </Button>
        </div>
      )}

      <SectionLabel>At a glance</SectionLabel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open jobs"
          value={verified ? openJobs.length : 0}
          icon={ClipboardList}
          tone={verified ? 'primary' : 'muted'}
          hint={verified ? 'Waiting for your response' : 'Locked until verified'}
          delay={0}
        />
        <StatCard label="Accepted jobs" value={acceptedJobs.length} icon={Briefcase} tone="accent" hint="On your schedule" delay={0.05} />
        <StatCard label="Upcoming shifts" value={upcoming.length} icon={CalendarCheck} tone="info" hint="Confirmed & in progress" delay={0.1} />
        <StatCard label="Completed jobs" value={completedJobs.length || caregiver?.completedJobs} icon={CheckCircle2} tone="success" hint="Lifetime on CareMate" delay={0.15} />
      </div>

      <SectionLabel>Performance</SectionLabel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Earnings summary"
            subtitle="This week on CareMate"
            icon={Wallet}
            action={
              <Button
                variant="link"
                size="sm"
                to={verified ? '/caregiver/earnings' : '/caregiver/documents'}
                icon={verified ? undefined : Lock}
              >
                {verified ? 'View earnings' : 'Earnings locked'}
              </Button>
            }
          />
          <CardBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-faint">Total earned</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-ink">{formatCurrency(totalEarned)}</p>
                <p className="mt-1 text-xs text-muted">Net of 12% platform commission</p>
              </div>
              <div className="rounded-xl border border-primary-100 bg-gradient-to-br from-mint-50 to-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-faint">Pending payout</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-primary-700">
                  {formatCurrency(pendingPayout)}
                </p>
                <p className="mt-1 text-xs text-muted">Settles in 2 working days</p>
              </div>
            </div>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyEarningsData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cgWeeklyEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2DD4BF" />
                      <stop offset="100%" stopColor="#0F766E" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF2" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}k`}
                  />
                  <Tooltip cursor={{ fill: 'rgba(15,118,110,0.06)' }} contentStyle={tooltipStyle} formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="earnings" fill="url(#cgWeeklyEarnings)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Rating & trust" subtitle="How customers see you" icon={Star} />
          <CardBody className="space-y-5">
            <div>
              <div className="flex items-end justify-between gap-3">
                <p className="font-display text-3xl font-extrabold tabular-nums text-ink">
                  {(caregiver?.rating ?? 0).toFixed(1)}
                </p>
                <span className="text-sm text-muted">{caregiver?.reviewCount ?? 0} reviews</span>
              </div>
              <RatingStars value={caregiver?.rating ?? 0} size={18} className="mt-2" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink-soft">Trust score</span>
                  <span className="font-bold text-primary-700">{caregiver?.trustScore ?? 0}/100</span>
                </div>
                <ProgressBar value={caregiver?.trustScore ?? 0} tone="primary" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink-soft">Response rate</span>
                  <span className="font-bold text-accent-600">{caregiver?.responseRate ?? 0}%</span>
                </div>
                <ProgressBar value={caregiver?.responseRate ?? 0} tone="accent" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(caregiver?.badges || []).map((badge) => (
                <span key={badge} className="rounded-full bg-mint-100 px-2.5 py-1 text-[11px] font-semibold text-primary-800">
                  {badge}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <SectionLabel>Shifts &amp; updates</SectionLabel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Upcoming shifts"
            subtitle={`Next ${Math.min(3, upcoming.length)} scheduled visits`}
            icon={CalendarCheck}
            action={
              <Button variant="link" size="sm" to="/caregiver/bookings">
                All bookings
              </Button>
            }
          />
          <CardBody>
            {upcoming.length ? (
              <ul className="space-y-3">
                {upcoming.slice(0, 3).map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 transition hover:border-primary-200 hover:bg-mint-50/50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-ink">{b.service}</p>
                        <StatusBadge status={b.status} size="sm" />
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span>
                          {formatDate(b.date)} · {b.startTime} · {formatDuration(b.hours, { short: true })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {b.city}
                        </span>
                      </p>
                    </div>
                    <Button variant="outline" size="xs" to={`/caregiver/jobs/${b.id}`}>
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CalendarCheck}
                title="No upcoming shifts"
                description="Accept a job request and it will appear here with date and time."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    to={verified ? '/caregiver/jobs' : '/caregiver/documents'}
                    icon={verified ? undefined : Lock}
                  >
                    {verified ? 'Browse jobs' : 'Unlock jobs'}
                  </Button>
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent notifications"
            subtitle="Updates for your account"
            icon={Bell}
            action={
              <Button
                variant="link"
                size="sm"
                to={verified ? '/caregiver/messages' : '/caregiver/documents'}
                icon={verified ? undefined : Lock}
              >
                {verified ? 'Messages' : 'Messages locked'}
              </Button>
            }
          />
          <CardBody>
            {caregiverNotifications.length ? (
              <ul className="space-y-4">
                {caregiverNotifications.map((n) => (
                  <li key={n.id} className="flex gap-3">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneDots[n.tone] || 'bg-slate-400')} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted">{n.body}</p>
                      <p className="mt-1 text-xs text-faint">{relativeTime(n.time)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Bell} title="No notifications yet" description="Job matches and payout updates will show up here." />
            )}
          </CardBody>
        </Card>
      </div>

      {bookingRequests.length ? (
        <section>
          <SectionLabel
            className="mb-3"
            hint="Customers waiting for your response — accept to lock the shift in."
            action={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-50 px-2.5 py-1 text-[11px] font-bold text-danger-600">
                {bookingRequests.length} waiting
              </span>
            }
          >
            Booking requests
          </SectionLabel>
          <Card>
            <CardBody className="divide-y divide-line p-0">
              {bookingRequests.map((b) => {
                const customerName = b.patient?.name
                return (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-mint-50/60">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-ink">{b.service}</p>
                        <StatusBadge status={b.status} size="sm" />
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <CalendarCheck className="h-3 w-3" />
                          {formatDate(b.date, { long: true })} · {b.startTime} · {formatDuration(b.hours, { short: true })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {b.city || b.address}
                        </span>
                        <span className="font-semibold text-ink">{formatCurrency(b.total)}</span>
                      </p>
                      {customerName ? <p className="mt-0.5 text-xs text-faint">Patient {customerName}</p> : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRequestTarget({ booking: b, action: 'decline' })}
                      >
                        Decline
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={CheckCircle2}
                        onClick={() => setRequestTarget({ booking: b, action: 'accept' })}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardBody>
          </Card>
        </section>
      ) : null}

      <section>
        <SectionLabel
          className="mb-3"
          hint="Open shifts matched to your qualification and area preferences."
          action={
            <Button variant="link" size="sm" to="/caregiver/jobs">
              View all jobs
            </Button>
          }
        >
          Recommended for you
        </SectionLabel>
        {recommended.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommended.map((job) => (
              <Card
                key={job.id}
                hover
                className={cn(
                  'flex flex-col overflow-hidden transition-all duration-200',
                  job.isUrgent && 'border-orange-300 ring-1 ring-orange-200/80 bg-gradient-to-b from-orange-50/20 via-white to-white shadow-sm hover:border-orange-400'
                )}
              >
                {job.isUrgent ? (
                  <div className="h-1 w-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-400" />
                ) : null}
                <CardBody className="flex flex-1 flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-primary-700">{job.id}</span>
                        {job.isUrgent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-xs">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-80" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                            </span>
                            <Zap className="h-2.5 w-2.5 fill-current" />
                            Urgent
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-1 truncate font-display text-base font-bold text-ink">{job.service}</h3>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {job.area}, {job.city} · {job.distanceKm} km
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-lg font-extrabold tabular-nums text-ink">
                      {formatCurrency(job.payment)}
                    </p>
                  </div>
                  <p className="text-xs text-muted">
                    {formatDate(job.date, { long: true })} · {job.shift} · est. net{' '}
                    {formatCurrency(job.payment - Math.round(job.payment * PLATFORM_COMMISSION))}
                  </p>
                </CardBody>
                <div className="flex gap-2 border-t border-line px-5 py-3.5">
                  <Button variant="outline" size="sm" className="flex-1" to={`/caregiver/jobs/${job.id}`}>
                    Details
                  </Button>
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => setAcceptTarget(job)}>
                    Accept
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={Briefcase}
              title="No open jobs right now"
              description="New requests matching your profile will appear here — check back soon."
            />
          </Card>
        )}
      </section>

      <ConfirmationDialog
        open={Boolean(acceptTarget)}
        onClose={() => setAcceptTarget(null)}
        onConfirm={handleAccept}
        tone="success"
        title="Accept this job?"
        message={
          acceptTarget
            ? `${acceptTarget.service} on ${formatDate(acceptTarget.date, { long: true })} at ${acceptTarget.shift} in ${acceptTarget.area}. Accepting adds it to your schedule immediately.`
            : ''
        }
        confirmLabel="Accept job"
      />

      <ConfirmationDialog
        open={Boolean(requestTarget)}
        onClose={() => setRequestTarget(null)}
        onConfirm={handleRequestConfirm}
        tone={requestTarget?.action === 'accept' ? 'success' : 'danger'}
        title={requestTarget?.action === 'accept' ? 'Accept this booking?' : 'Decline this booking?'}
        message={
          requestTarget
            ? `${requestTarget.booking.service} on ${formatDate(requestTarget.booking.date, { long: true })} at ${requestTarget.booking.startTime} for ${formatDuration(requestTarget.booking.hours, { short: true })}. ${
                requestTarget.action === 'accept'
                  ? 'The shift is confirmed and payment is held in escrow.'
                  : 'The customer will be notified and matched with another caretaker.'
              }`
            : ''
        }
        confirmLabel={requestTarget?.action === 'accept' ? 'Accept booking' : 'Decline booking'}
      />
    </div>
  )
}

export default DashboardPage
