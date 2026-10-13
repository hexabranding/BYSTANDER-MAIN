import { useMemo, useState } from 'react'
import { toast } from 'sonner'
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
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { WEEKLY_EARNINGS } from '@/data/charts'
import { formatCurrency, formatDate, relativeTime } from '@/utils/format'
import { PLATFORM_COMMISSION } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { RatingStars } from '@/components/common/RatingStars'
import { ProgressBar } from '@/components/common/Tabs'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { EmptyState } from '@/components/common/States'

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
  useDocumentTitle('Caregiver Dashboard')

  const { user } = useAuth()
  const { caregivers, jobs, bookings, notifications, earnings, acceptJob, confirmBooking, cancelBooking } = useData()

  const myId = user?.caregiverId || 'cg-101'
  const caregiver = caregivers.find((c) => c.id === myId) || caregivers[0]
  const verified = (caregiver?.verificationStatus || 'Pending') === 'Verified'

  const [acceptTarget, setAcceptTarget] = useState(null)
  const [requestTarget, setRequestTarget] = useState(null)

  const myJobs = useMemo(() => jobs.filter((j) => j.status === 'Open' || j.caregiverId === myId), [jobs, myId])
  const myBookings = useMemo(() => bookings.filter((b) => b.caregiverId === myId), [bookings, myId])

  const openJobs = myJobs.filter((j) => j.status === 'Open')
  const acceptedJobs = myJobs.filter((j) => j.status === 'Accepted')
  const bookingRequests = useMemo(
    () => myBookings.filter((b) => b.status === 'Pending').sort((a, b) => a.date.localeCompare(b.date)),
    [myBookings],
  )
  const upcoming = myBookings
    .filter((b) => ['Confirmed', 'In Progress'].includes(b.status))
    .sort((a, b) => a.date.localeCompare(b.date))
  const completedJobs = myBookings.filter((b) => b.status === 'Completed')

  const myBookingIds = useMemo(() => new Set(myBookings.map((b) => b.id)), [myBookings])
  const myEarnings = useMemo(
    () => earnings.filter((e) => e.caregiverId === myId || (e.caregiverId == null && myBookingIds.has(e.bookingId))),
    [earnings, myId, myBookingIds],
  )
  const totalEarned = myEarnings.reduce((sum, e) => sum + e.net, 0)
  const pendingPayout = myEarnings.filter((e) => e.status === 'Pending').reduce((sum, e) => sum + e.net, 0)

  const caregiverNotifications = useMemo(
    () =>
      notifications
        .filter((n) => n.audience?.includes('caregiver'))
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 4),
    [notifications],
  )

  const recommended = openJobs.slice(0, 3)

  const firstName = (caregiver?.name || user?.name || 'Caregiver').split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const handleAccept = () => {
    if (!acceptTarget) return
    acceptJob(acceptTarget.id, caregiver?.id)
    toast.success('Job accepted — added to your schedule')
    setAcceptTarget(null)
  }

  const handleRequestConfirm = () => {
    if (!requestTarget) return
    if (requestTarget.action === 'accept') {
      confirmBooking(requestTarget.booking.id)
      toast.success('Booking request accepted', {
        description: `${requestTarget.booking.service} on ${formatDate(requestTarget.booking.date, { long: true })} is confirmed.`,
      })
    } else {
      cancelBooking(requestTarget.booking.id, 'Declined by caregiver')
      toast.info('Booking request declined', { description: 'The customer has been notified.' })
    }
    setRequestTarget(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle="Your shifts, earnings and verification status — all in one place."
        meta={
          <>
            <StatusBadge status={caregiver?.verificationStatus || 'Pending'} />
            <span className="text-xs text-muted">
              {caregiver?.qualification} · {caregiver?.experienceYears} yrs experience
            </span>
          </>
        }
        action={
          <Button variant={verified ? 'outline' : 'primary'} to="/caregiver/documents" icon={verified ? ShieldCheck : AlertTriangle}>
            {verified ? 'View documents' : 'Complete verification'}
          </Button>
        }
      />

      {verified ? (
        <div className="flex flex-col gap-3 rounded-card border border-success-500/30 bg-success-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success-100 text-success-700">
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
        <div className="flex flex-col gap-3 rounded-card border border-warning-400/40 bg-warning-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning-100 text-warning-700">
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open jobs" value={openJobs.length} icon={ClipboardList} tone="primary" hint="Waiting for your response" delay={0} />
        <StatCard label="Accepted jobs" value={acceptedJobs.length} icon={Briefcase} tone="accent" hint="On your schedule" delay={0.05} />
        <StatCard label="Upcoming shifts" value={upcoming.length} icon={CalendarCheck} tone="info" hint="Confirmed & in progress" delay={0.1} />
        <StatCard label="Completed jobs" value={completedJobs.length || caregiver?.completedJobs} icon={CheckCircle2} tone="success" hint="Lifetime on CareMate" delay={0.15} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Earnings summary"
            subtitle="This week on CareMate"
            icon={Wallet}
            action={
              <Button variant="link" size="sm" to="/caregiver/earnings">
                View earnings
              </Button>
            }
          />
          <CardBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-faint">Total earned</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-ink">{formatCurrency(totalEarned)}</p>
                <p className="mt-1 text-xs text-muted">Net of 12% platform commission</p>
              </div>
              <div className="rounded-xl border border-line bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-faint">Pending payout</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-primary-700">
                  {formatCurrency(pendingPayout)}
                </p>
                <p className="mt-1 text-xs text-muted">Settles in 2 working days</p>
              </div>
            </div>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={WEEKLY_EARNINGS} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
                  <Bar dataKey="earnings" fill="#0F766E" radius={[6, 6, 0, 0]} maxBarSize={38} />
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Upcoming shifts"
            subtitle={`Next ${Math.min(3, upcoming.length)} scheduled visits`}
            icon={CalendarCheck}
            action={
              <Button variant="link" size="sm" to="/caregiver/schedule">
                Full schedule
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
                          {formatDate(b.date)} · {b.startTime} · {b.hours} hrs
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
                  <Button variant="primary" size="sm" to="/caregiver/jobs">
                    Browse jobs
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
              <Button variant="link" size="sm" to="/caregiver/messages">
                Messages
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
          <div className="mb-3">
            <h2 className="font-display text-base font-bold text-ink">Booking requests</h2>
            <p className="text-sm text-muted">Customers waiting for your response — accept to lock the shift in.</p>
          </div>
          <Card>
            <CardBody className="divide-y divide-line p-0">
              {bookingRequests.map((b) => {
                const customerName = b.patient?.name
                return (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-ink">{b.service}</p>
                        <StatusBadge status={b.status} size="sm" />
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <CalendarCheck className="h-3 w-3" />
                          {formatDate(b.date, { long: true })} · {b.startTime} · {b.hours} hrs
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-ink">Recommended for you</h2>
            <p className="text-sm text-muted">Open shifts matched to your qualification and area preferences.</p>
          </div>
          <Button variant="link" size="sm" to="/caregiver/jobs">
            View all jobs
          </Button>
        </div>
        {recommended.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommended.map((job) => (
              <Card key={job.id} hover className="flex flex-col">
                <CardBody className="flex flex-1 flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-primary-700">{job.id}</span>
                        <StatusBadge status={job.urgency} size="sm" />
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
            ? `${requestTarget.booking.service} on ${formatDate(requestTarget.booking.date, { long: true })} at ${requestTarget.booking.startTime} for ${requestTarget.booking.hours} hrs. ${
                requestTarget.action === 'accept'
                  ? 'The shift is confirmed and payment is held in escrow.'
                  : 'The customer will be notified and matched with another caregiver.'
              }`
            : ''
        }
        confirmLabel={requestTarget?.action === 'accept' ? 'Accept booking' : 'Decline booking'}
      />
    </div>
  )
}

export default DashboardPage
