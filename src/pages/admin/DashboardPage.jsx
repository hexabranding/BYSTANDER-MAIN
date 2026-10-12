import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  HandCoins,
  IndianRupee,
  Siren,
  Stethoscope,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { CUSTOMERS, getCustomerById } from '@/data/bookings'
import { PAYOUTS } from '@/data/finance'
import { BOOKING_ACTIVITY, CITY_DISTRIBUTION, REVENUE_SPLIT, SERVICE_DISTRIBUTION } from '@/data/charts'
import { formatCompactCurrency, formatCurrency, formatDate, formatNumber, relativeTime } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Avatar } from '@/components/common/Avatar'
import { EmptyState } from '@/components/common/States'

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #E6ECF2',
  boxShadow: '0 10px 28px -18px rgba(16,42,67,0.35)',
  fontSize: 12,
  color: '#172B3A',
}

const rupeeTick = (v) => `₹${(v / 1000).toFixed(0)}k`

const activityLegend = [
  { color: '#0F766E', label: 'Requested' },
  { color: '#38BDF8', label: 'Completed' },
  { color: '#94A3B8', label: 'Cancelled' },
]

function LegendDots({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export function DashboardPage() {
  useDocumentTitle('Admin dashboard')

  const { bookings, caregivers, verifications, sos } = useData()

  const stats = useMemo(() => {
    const active = bookings.filter((b) => ['Pending', 'Confirmed', 'In Progress'].includes(b.status))
    const completed = bookings.filter((b) => b.status === 'Completed')
    const cancelled = bookings.filter((b) => b.status === 'Cancelled')
    const live = bookings.filter((b) => b.status !== 'Cancelled')
    const gross = live.reduce((sum, b) => sum + (b.total || 0), 0)
    const revenue = live.reduce((sum, b) => sum + (b.commission || 0), 0)
    const pendingVerifications = verifications.filter((v) => v.status === 'Pending' || v.status === 'Under Review')
    return {
      customers: CUSTOMERS.length,
      caregivers: caregivers.length,
      pendingVerifications,
      active: active.length,
      completed: completed.length,
      cancelled: cancelled.length,
      gross,
      revenue,
    }
  }, [bookings, caregivers, verifications])

  const recentBookings = useMemo(
    () =>
      [...bookings]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [bookings],
  )

  const recentRegistrations = useMemo(
    () =>
      [
        ...CUSTOMERS.map((c) => ({
          id: c.id,
          kind: 'Customer',
          name: c.name,
          avatar: c.avatar,
          meta: c.city,
          joinedOn: c.joinedOn,
        })),
        ...caregivers.map((c) => ({
          id: c.id,
          kind: 'Caregiver',
          name: c.name,
          avatar: c.photo,
          meta: c.qualification,
          joinedOn: c.joinedOn,
        })),
      ]
        .sort((a, b) => String(b.joinedOn).localeCompare(String(a.joinedOn)))
        .slice(0, 5),
    [caregivers],
  )

  const activeSos = useMemo(() => sos.filter((s) => s.status === 'Open' || s.status === 'Under Investigation'), [sos])

  const payoutSummary = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7)
    const due = PAYOUTS.filter((p) => p.status === 'Pending' || p.status === 'Processing').reduce(
      (sum, p) => sum + p.net,
      0,
    )
    const processing = PAYOUTS.filter((p) => p.status === 'Processing').reduce((sum, p) => sum + p.net, 0)
    const settled = PAYOUTS.filter((p) => p.status === 'Settled' && String(p.requestedOn).startsWith(month)).reduce(
      (sum, p) => sum + p.net,
      0,
    )
    return { due, processing, settled }
  }, [])

  const serviceTotal = SERVICE_DISTRIBUTION.reduce((sum, s) => sum + s.value, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin dashboard"
        subtitle="CareMate at a glance — demand, supply, verification queue, revenue and live incidents."
        action={
          <>
            <Button to="/admin/verifications" variant="outline" icon={FileCheck2}>
              Review verifications
            </Button>
            <Button to="/admin/bookings" icon={ClipboardList}>
              All bookings
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total customers"
          value={formatNumber(stats.customers)}
          icon={Users}
          tone="primary"
          trend={9}
          hint="Registered accounts"
          delay={0}
        />
        <StatCard
          label="Total caregivers"
          value={formatNumber(stats.caregivers)}
          icon={Stethoscope}
          tone="accent"
          trend={6}
          hint="Verified and in review"
          delay={0.05}
        />
        <StatCard
          label="Pending verifications"
          value={stats.pendingVerifications.length}
          icon={FileCheck2}
          tone="warning"
          hint="Awaiting a decision"
          delay={0.1}
        />
        <StatCard
          label="Active bookings"
          value={stats.active}
          icon={CalendarClock}
          tone="info"
          trend={14}
          hint="Pending, confirmed or live"
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Completed bookings"
          value={stats.completed}
          icon={CheckCircle2}
          tone="success"
          trend={11}
          hint="All time"
          delay={0}
        />
        <StatCard
          label="Cancelled bookings"
          value={stats.cancelled}
          icon={XCircle}
          tone="warning"
          hint="Refunds issued"
          delay={0.05}
        />
        <StatCard
          label="Gross booking value"
          value={formatCompactCurrency(stats.gross)}
          icon={IndianRupee}
          tone="primary"
          trend={16}
          hint="Excludes cancelled bookings"
          delay={0.1}
        />
        <StatCard
          label="Platform revenue"
          value={formatCompactCurrency(stats.revenue)}
          icon={Banknote}
          tone="success"
          trend={12}
          hint="12% commission earned"
          delay={0.15}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Booking activity"
            subtitle="Requests vs completions and cancellations"
            icon={Activity}
            action={<LegendDots items={activityLegend} />}
          />
          <CardBody>
            <div dir="ltr" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={BOOKING_ACTIVITY} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF2" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(15,118,110,0.06)' }}
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [formatNumber(value), name]}
                  />
                  <Bar dataKey="bookings" name="Requested" fill="#0F766E" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="completed" name="Completed" fill="#38BDF8" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="cancelled" name="Cancelled" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Revenue"
            subtitle="Gross booking value and platform commission"
            icon={Banknote}
            action={
              <LegendDots
                items={[
                  { color: '#0F766E', label: 'Gross value' },
                  { color: '#38BDF8', label: 'Commission' },
                ]}
              />
            }
          />
          <CardBody>
            <div dir="ltr" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={REVENUE_SPLIT} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0F766E" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="#0F766E" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF2" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tickLine={false} axisLine={false} width={54} tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={rupeeTick} />
                  <Tooltip
                    cursor={{ stroke: '#0F766E', strokeWidth: 1 }}
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [formatCurrency(value), name === 'revenue' ? 'Gross value' : 'Commission']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0F766E" strokeWidth={2.5} fill="url(#adminRevenueFill)" />
                  <Area type="monotone" dataKey="commission" stroke="#38BDF8" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Service distribution" subtitle="Share of bookings by care service" icon={ClipboardList} />
          <CardBody>
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <div dir="ltr" className="h-56 w-full sm:w-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={SERVICE_DISTRIBUTION}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={54}
                      outerRadius={86}
                      paddingAngle={2}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {SERVICE_DISTRIBUTION.map((service) => (
                        <Cell key={service.name} fill={service.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full flex-1 space-y-2.5">
                {SERVICE_DISTRIBUTION.map((service) => (
                  <div key={service.name} className="flex items-center gap-2.5 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: service.fill }} />
                    <span className="min-w-0 flex-1 truncate text-ink-soft">{service.name}</span>
                    <span className="font-semibold tabular-nums text-ink">
                      {Math.round((service.value / serviceTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="City distribution" subtitle="Bookings placed across the top cities" icon={Activity} />
          <CardBody>
            <div dir="ltr" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={CITY_DISTRIBUTION} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF2" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis
                    type="category"
                    dataKey="city"
                    tickLine={false}
                    axisLine={false}
                    width={92}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(15,118,110,0.06)' }}
                    contentStyle={tooltipStyle}
                    formatter={(value) => [formatNumber(value), 'Bookings']}
                  />
                  <Bar dataKey="bookings" fill="#0F766E" radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Recent bookings"
            subtitle="Latest activity across the platform"
            action={
              <Button to="/admin/bookings" variant="link" size="sm" iconRight={ArrowRight}>
                View all
              </Button>
            }
          />
          <CardBody className="divide-y divide-line p-0">
            {recentBookings.length ? (
              recentBookings.map((b) => (
                <Link
                  key={b.id}
                  to="/admin/bookings"
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-mint-50/60"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
                    <CalendarClock className="h-4.5 w-4.5" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      {b.id} · {b.service}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {getCustomerById(b.customerId)?.name || 'Customer'} · {formatDate(b.date)} · {b.startTime}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <StatusBadge status={b.status} size="sm" />
                    <p className="mt-1 text-[11px] text-faint">{relativeTime(b.createdAt)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-faint" />
                </Link>
              ))
            ) : (
              <EmptyState icon={ClipboardList} title="No bookings yet" description="New bookings will appear here." className="py-10" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent registrations"
            subtitle="Newest customers and caregivers"
            icon={UserPlus}
            action={
              <Button to="/admin/customers" variant="link" size="sm" iconRight={ArrowRight}>
                Directory
              </Button>
            }
          />
          <CardBody className="divide-y divide-line p-0">
            {recentRegistrations.map((r) => (
              <div key={`${r.kind}-${r.id}`} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar src={r.avatar} name={r.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{r.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{r.meta}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={
                      r.kind === 'Customer'
                        ? 'inline-flex items-center rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-bold text-accent-600'
                        : 'inline-flex items-center rounded-full bg-mint-100 px-2 py-0.5 text-[11px] font-bold text-primary-700'
                    }
                  >
                    {r.kind}
                  </span>
                  <p className="mt-1 text-[11px] text-faint">{formatDate(r.joinedOn)}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card className="border-line">
            <CardHeader
              title="Pending verifications"
              subtitle="Applications waiting on a decision"
              action={
                <Button to="/admin/verifications" variant="link" size="sm" iconRight={ArrowRight}>
                  Review
                </Button>
              }
            />
            <CardBody className="divide-y divide-line p-0">
              {stats.pendingVerifications.length ? (
                stats.pendingVerifications.slice(0, 4).map((v) => (
                  <Link
                    key={v.id}
                    to="/admin/verifications"
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-mint-50/60"
                  >
                    <Avatar src={v.avatar} name={v.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{v.name}</p>
                      <p className="truncate text-xs text-muted">
                        {v.qualification} · submitted {relativeTime(v.submittedOn)}
                      </p>
                    </div>
                    <StatusBadge status={v.status} size="sm" />
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={FileCheck2}
                  title="Verification queue is clear"
                  description="Every application has been reviewed."
                  className="py-8"
                />
              )}
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Active SOS incidents"
              subtitle="Escalations that need the ops desk"
              action={
                <Button to="/admin/sos-alerts" variant="link" size="sm" iconRight={ArrowRight}>
                  Open desk
                </Button>
              }
            />
            <CardBody className="space-y-3 p-4">
              {activeSos.length ? (
                activeSos.map((s) => (
                  <Link
                    key={s.id}
                    to="/admin/sos-alerts"
                    className="block rounded-xl border border-danger-100 border-l-4 border-l-danger-500 bg-danger-50/50 px-4 py-3 transition hover:bg-danger-50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-danger-600 shadow-card">
                        <Siren className="h-4.5 w-4.5" size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display text-sm font-bold text-ink">{s.id}</p>
                          <StatusBadge status={s.priority} size="sm" />
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{s.summary}</p>
                        <p className="mt-1.5 text-[11px] font-semibold text-danger-600">
                          {s.location?.label} · reported {relativeTime(s.reportedAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={Siren}
                  title="No active incidents"
                  description="Resolved alerts stay in the SOS archive."
                  className="py-8"
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Caregiver payouts"
              subtitle="Current settlement cycle"
              icon={HandCoins}
              action={
                <Button to="/admin/payouts" variant="link" size="sm" iconRight={ArrowRight}>
                  Payouts
                </Button>
              }
            />
            <CardBody className="space-y-3">
              <div className="rounded-xl border border-line px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-faint">Total payouts due</p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">
                  {formatCurrency(payoutSummary.due)}
                </p>
                <p className="mt-0.5 text-xs text-muted">Pending and processing across all caregivers</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-line px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Settled this month</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-success-700">
                    {formatCurrency(payoutSummary.settled)}
                  </p>
                </div>
                <div className="rounded-xl border border-line px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">In processing</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-accent-600">
                    {formatCurrency(payoutSummary.processing)}
                  </p>
                </div>
              </div>
              <Button to="/admin/payouts" variant="secondary" icon={HandCoins} className="w-full">
                Manage payouts
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
