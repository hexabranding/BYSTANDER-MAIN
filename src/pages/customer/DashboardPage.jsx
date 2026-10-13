import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  IndianRupee,
  MessageSquare,
  Receipt,
  ShieldAlert,
  Stethoscope,
  Star,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { CUSTOMER_SPEND } from '@/data/charts'
import { formatCurrency, formatDate, formatTime, relativeTime } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Avatar } from '@/components/common/Avatar'
import { ProgressBar } from '@/components/common/Tabs'
import { EmptyState } from '@/components/common/States'
import { RatingModal } from '@/components/booking/RatingModal'

const toneIcons = {
  success: CheckCircle2,
  warning: ShieldAlert,
  danger: ShieldAlert,
  info: MessageSquare,
}

const toneDots = {
  success: 'bg-success-500',
  warning: 'bg-warning-400',
  danger: 'bg-danger-500',
  info: 'bg-accent-400',
}

const QUICK_LINKS = [
  { to: '/customer/invoices', label: 'Invoices', hint: 'Download GST invoices', icon: Receipt },
  { to: '/customer/messages', label: 'Messages', hint: 'Chat with caregivers', icon: MessageSquare },
  { to: '/customer/complaints', label: 'Complaints', hint: 'Raise or track issues', icon: ShieldAlert },
  { to: '/customer/profile', label: 'Profile', hint: 'Personal details & preferences', icon: UserRound },
]

export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const { bookings, caregivers, notifications, markNotificationRead, addReview, updateBooking } = useData()
  const [rateTarget, setRateTarget] = useState(null)

  const customerId = user?.id || 'cu-201'
  const firstName = (user?.name || 'Priya Sharma').split(' ')[0]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const { myBookings, active, upcoming, previous, completedCount, totalSpent, caregiverFor } = useMemo(() => {
    const list = bookings.filter((b) => b.customerId === customerId)
    const today = new Date().toISOString().slice(0, 10)
    const activeList = list.filter((b) => b.status === 'In Progress' || b.status === 'Confirmed')
    const inProgress = list.find((b) => b.status === 'In Progress') || activeList[0] || null
    const upcomingList = list
      .filter((b) => (b.status === 'Pending' || b.status === 'Confirmed') && b.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
    const completed = list.filter((b) => b.status === 'Completed')
    const previousList = [...completed].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
    const spent = list
      .filter((b) => b.status !== 'Cancelled')
      .reduce((sum, b) => sum + (b.total || 0), 0)
    const cgMap = new Map(caregivers.map((c) => [c.id, c]))
    return {
      myBookings: list,
      active: inProgress,
      upcoming: upcomingList,
      previous: previousList,
      completedCount: completed.length,
      totalSpent: spent,
      caregiverFor: (b) => (b ? cgMap.get(b.caregiverId) : null),
    }
  }, [bookings, caregivers, customerId])

  const activity = useMemo(
    () => notifications.filter((n) => n.audience?.includes('customer')).slice(0, 6),
    [notifications],
  )

  const activeCaregiver = caregiverFor(active)
  const activeStepsDone = active?.timeline?.filter((t) => t.status === 'completed').length || 1
  const activeStepsTotal = active?.timeline?.length || 5

  const handleSubmitRating = (b, { criteria, average, comment }) => {
    addReview({
      bookingId: b.id,
      caregiverId: b.caregiverId,
      customerId: b.customerId,
      customerName: user?.name || 'Customer',
      rating: average,
      criteria,
      comment: comment || 'Great service, thank you!',
    })
    updateBooking(b.id, { customerRating: { ...criteria, average, at: new Date().toISOString() } })
    toast.success('Thank you for your review!', {
      description: `${caregiverFor(b)?.name || 'Your caregiver'} received your ${average}-star rating.`,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle="Here's what is happening with your care bookings today."
        action={
          <>
            <Button to="/customer/caregivers" variant="outline" icon={UserRound}>
              Browse caregivers
            </Button>
            <Button to="/customer/book-caregiver" icon={CalendarClock}>
              Book a caregiver
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Active bookings"
          value={active ? 1 : 0}
          icon={Stethoscope}
          tone="primary"
          hint={active ? active.service : 'None in progress'}
          delay={0}
        />
        <StatCard
          label="Upcoming bookings"
          value={upcoming.length}
          icon={CalendarClock}
          tone="accent"
          hint={upcoming[0] ? `Next on ${formatDate(upcoming[0].date)}` : 'Nothing scheduled'}
          delay={0.05}
        />
        <StatCard
          label="Completed services"
          value={completedCount}
          icon={CheckCircle2}
          tone="success"
          trend={12}
          hint="Across all time"
          delay={0.1}
        />
        <StatCard
          label="Total spending"
          value={formatCurrency(totalSpent)}
          icon={IndianRupee}
          tone="info"
          trend={8}
          hint={`${myBookings.length} bookings lifetime`}
          delay={0.15}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {active ? (
            <Card>
              <CardHeader
                title="Active booking"
                subtitle={`${active.service} · ${active.careType}`}
                action={<StatusBadge status={active.status} />}
              />
              <CardBody className="space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar src={activeCaregiver?.photo} name={activeCaregiver?.name || 'Caregiver'} size="lg" verified={activeCaregiver?.verified} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold text-ink">
                      {activeCaregiver?.name || 'Caregiver being assigned'}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {activeCaregiver?.qualification} · {formatCurrency(active.hourlyRate)}/hr
                    </p>
                    <p className="mt-1 text-xs text-faint">
                      Patient {active.patient?.name} · {active.startTime}–{' '}
                      {active.hours} hrs on {formatDate(active.date, { long: true })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button to={`/customer/bookings/${active.id}`} variant="outline" size="sm">
                      View booking
                    </Button>
                    <Button to="/customer/messages" size="sm" icon={MessageSquare}>
                      Message
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
                    <span>
                      Step {Math.min(activeStepsDone + 1, activeStepsTotal)} of {activeStepsTotal}
                    </span>
                    <span>{Math.round((activeStepsDone / activeStepsTotal) * 100)}% complete</span>
                  </div>
                  <ProgressBar value={activeStepsDone} max={activeStepsTotal} tone="primary" />
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={Stethoscope}
                title="No active booking right now"
                description="When you book a caregiver, the live status will appear here."
                action={
                  <Button to="/customer/book-caregiver" icon={CalendarClock}>
                    Book a caregiver
                  </Button>
                }
              />
            </Card>
          )}

          <Card>
            <CardHeader
              title="Upcoming bookings"
              subtitle="Your next scheduled visits"
              action={
                <Button to="/customer/bookings" variant="link" size="sm" iconRight={ArrowRight}>
                  View all
                </Button>
              }
            />
            <CardBody className="divide-y divide-line p-0">
              {upcoming.length ? (
                upcoming.slice(0, 3).map((b) => {
                  const cg = caregiverFor(b)
                  return (
                    <Link
                      key={b.id}
                      to={`/customer/bookings/${b.id}`}
                      className="flex items-center gap-4 px-5 py-4 transition hover:bg-mint-50/60"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
                        <CalendarClock className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{b.service}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatDate(b.date)} · {b.startTime}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="h-3 w-3" /> {cg?.name || 'Assigning caregiver'}
                          </span>
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-bold tabular-nums text-ink">{formatCurrency(b.total)}</p>
                        <StatusBadge status={b.status} size="sm" />
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-faint" />
                    </Link>
                  )
                })
              ) : (
                <EmptyState
                  icon={CalendarClock}
                  title="Nothing upcoming"
                  description="Schedule a visit and it will show up here."
                  action={
                    <Button to="/customer/book-caregiver" variant="secondary" size="sm">
                      Book now
                    </Button>
                  }
                  className="py-10"
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Previous bookings"
              subtitle="Completed visits — revisit or rate them"
              action={
                <Button to="/customer/bookings" variant="link" size="sm" iconRight={ArrowRight}>
                  View all
                </Button>
              }
            />
            <CardBody className="divide-y divide-line p-0">
              {previous.length ? (
                previous.map((b) => {
                  const cg = caregiverFor(b)
                  return (
                    <div key={b.id} className="flex items-center gap-4 px-5 py-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-success-50 text-success-700">
                        <CheckCircle2 className="h-5 w-5" />
                      </span>
                      <Link to={`/customer/bookings/${b.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{b.service}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatDate(b.date)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="h-3 w-3" /> {cg?.name || 'Caregiver'}
                          </span>
                        </p>
                      </Link>
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-bold tabular-nums text-ink">{formatCurrency(b.total)}</p>
                        {b.customerRating ? (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {b.customerRating.average}
                          </p>
                        ) : (
                          <StatusBadge status={b.status} size="sm" />
                        )}
                      </div>
                      {!b.customerRating ? (
                        <Button size="xs" variant="outline" icon={Star} onClick={() => setRateTarget(b)}>
                          Rate
                        </Button>
                      ) : null}
                      <ArrowRight className="h-4 w-4 shrink-0 text-faint" />
                    </div>
                  )
                })
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="No previous bookings"
                  description="Completed visits will appear here once your first service finishes."
                  className="py-10"
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Your spending"
              subtitle="Last 6 months across all services"
              action={
                <Button to="/customer/payments" variant="link" size="sm" iconRight={ArrowRight}>
                  Payments
                </Button>
              }
            />
            <CardBody>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={CUSTOMER_SPEND} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="customerSpendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0F766E" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#0F766E" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      tickFormatter={(v) => `₹${v / 1000}k`}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), 'Spend']}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 10px 30px -18px rgba(23,43,58,0.35)',
                        fontSize: 13,
                      }}
                    />
                    <Area type="monotone" dataKey="spend" stroke="#0F766E" strokeWidth={2.5} fill="url(#customerSpendFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-success-50 text-success-700">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-2xl font-extrabold tabular-nums text-ink">{completedCount}</p>
                <p className="text-sm text-muted">Completed services</p>
              </div>
              <Button to="/customer/bookings" variant="ghost" size="sm" className="ml-auto shrink-0">
                History
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Quick access" />
            <CardBody className="space-y-2">
              {QUICK_LINKS.map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 transition hover:border-primary-200 hover:bg-mint-50/60"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mint-100 text-primary-700">
                    <q.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{q.label}</p>
                    <p className="truncate text-xs text-muted">{q.hint}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-faint" />
                </Link>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent activity" subtitle="Updates on your account" />
            <CardBody className="divide-y divide-line p-0">
              {activity.length ? (
                activity.map((n) => {
                  const Icon = toneIcons[n.tone] || MessageSquare
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => !n.read && markNotificationRead(n.id)}
                      className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-mint-50/60"
                    >
                      <span className="relative mt-0.5 shrink-0">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-muted">
                          <Icon className="h-4 w-4" />
                        </span>
                        {!n.read ? (
                          <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${toneDots[n.tone] || 'bg-accent-400'}`} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${n.read ? 'text-muted' : 'font-bold text-ink'}`}>{n.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{n.body}</span>
                        <span className="mt-1 block text-[11px] text-faint">{relativeTime(n.time)}</span>
                      </span>
                    </button>
                  )
                })
              ) : (
                <EmptyState icon={MessageSquare} title="No activity yet" description="Booking and payment updates will appear here." className="py-10" />
              )}
            </CardBody>
          </Card>

          <Card className="bg-mint-50/60">
            <CardBody className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-primary-700 shadow-card">
                <Stethoscope className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">Need help choosing?</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Our care coordinators can help you pick the right service for {user?.patientInfo?.name || 'your loved one'}.
                </p>
                <p className="mt-2 text-xs text-faint">Last visit: {formatDate(myBookings[myBookings.length - 1]?.createdAt)} · {formatTime(myBookings[myBookings.length - 1]?.createdAt)}</p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <RatingModal
        open={Boolean(rateTarget)}
        onClose={() => setRateTarget(null)}
        subjectName={rateTarget ? caregiverFor(rateTarget)?.name || '' : ''}
        onSubmit={(rating) => rateTarget && handleSubmitRating(rateTarget, rating)}
      />
    </div>
  )
}

export default DashboardPage
