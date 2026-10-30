import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
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
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { EASE } from '@/utils/motion'
import { formatCompactCurrency, formatCurrency, formatDate, formatNumber, relativeTime } from '@/utils/format'
import { StatCard } from '@/components/common/StatCard'
import { SectionLabel } from '@/components/common/SectionLabel'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Avatar } from '@/components/common/Avatar'
import { EmptyState } from '@/components/common/States'
import { adminService } from '@/services/adminService'

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

  const [liveMetrics, setLiveMetrics] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    adminService
      .getAdminMetrics()
      .then((data) => {
        if (mounted && data) {
          setLiveMetrics(data)
        }
      })
      .catch((err) => {
        console.warn('[Dashboard Metrics API Warning]', err.message)
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const stats = useMemo(() => {
    const s = liveMetrics?.stats
    return {
      customers: s?.customers ?? 0,
      caregivers: s?.caregivers ?? 0,
      pendingVerificationsCount: s?.pendingVerificationsCount ?? 0,
      active: s?.active ?? 0,
      completed: s?.completed ?? 0,
      cancelled: s?.cancelled ?? 0,
      liveCount: s?.liveCount ?? 0,
      gross: s?.gross ?? 0,
      revenue: s?.revenue ?? 0,
      avgValue: s?.avgValue ?? 0,
      completionRate: s?.completionRate ?? 100,
    }
  }, [liveMetrics])

  const pendingVerificationsList = useMemo(() => {
    return liveMetrics?.pendingVerifications || []
  }, [liveMetrics])

  const recentBookings = useMemo(() => {
    if (liveMetrics?.recentBookings?.length) {
      return liveMetrics.recentBookings.map((b) => ({
        id: b.id,
        service: b.service,
        date: b.date,
        startTime: b.date ? new Date(b.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM',
        customerName: b.customerName || 'Customer',
        status: b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1).replace('_', ' ') : 'Pending',
        createdAt: b.createdAt,
      }))
    }
    return []
  }, [liveMetrics])

  const recentRegistrations = useMemo(() => {
    return liveMetrics?.recentRegistrations || []
  }, [liveMetrics])

  const activeSos = useMemo(() => {
    return liveMetrics?.activeSos || []
  }, [liveMetrics])

  const payoutSummary = useMemo(() => {
    return liveMetrics?.payoutSummary || { due: 0, processing: 0, settled: 0 }
  }, [liveMetrics])

  const bookingActivityData = liveMetrics?.bookingActivity || []
  const revenueSplitData = liveMetrics?.revenueSplit || []
  const serviceDistributionData = liveMetrics?.serviceDistribution || []
  const cityDistributionData = liveMetrics?.cityDistribution || []
  const serviceTotal = serviceDistributionData.reduce((sum, s) => sum + s.value, 0)

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
              <Activity className="h-3.5 w-3.5" />
              Operations overview
            </span>
            <h1 className="mt-3 font-display text-2xl font-extrabold text-white sm:text-3xl">Admin dashboard</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/60">
              Bystander at a glance — demand, supply, verification queue, revenue and live incidents.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <Button to="/admin/verifications" variant="accent" icon={FileCheck2}>
              Review verifications
            </Button>
            <Button to="/admin/bookings" variant="secondary" icon={ClipboardList}>
              All bookings
            </Button>
          </div>
        </div>

        <div className="relative grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
          {[
            {
              label: 'Average booking value',
              value: formatCurrency(stats.avgValue),
              note: `across ${formatNumber(stats.liveCount)} non-cancelled bookings`,
            },
            {
              label: 'Completion rate',
              value: `${stats.completionRate}%`,
              note: `${formatNumber(stats.completed)} completed · ${formatNumber(stats.cancelled)} cancelled`,
            },
            {
              label: 'Payouts due',
              value: formatCurrency(payoutSummary.due),
              note: 'Pending and processing',
            },
            {
              label: 'Ambulances',
              value: '6',
              note: 'Verified in emergency network',
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


      <SectionLabel>Key metrics</SectionLabel>

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
          label="Total caretakers"
          value={formatNumber(stats.caregivers)}
          icon={Stethoscope}
          tone="accent"
          trend={6}
          hint="Verified and in review"
          delay={0.05}
        />
        <StatCard
          label="Pending verifications"
          value={stats.pendingVerificationsCount}
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

      <SectionLabel>Analytics</SectionLabel>

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
                <BarChart data={bookingActivityData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminBarRequested" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2DD4BF" />
                      <stop offset="100%" stopColor="#0F766E" />
                    </linearGradient>
                    <linearGradient id="adminBarCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7DD3FC" />
                      <stop offset="100%" stopColor="#0284C7" />
                    </linearGradient>
                    <linearGradient id="adminBarCancelled" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#CBD5E1" />
                      <stop offset="100%" stopColor="#94A3B8" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF2" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(15,118,110,0.06)' }}
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [formatNumber(value), name]}
                  />
                  <Bar dataKey="bookings" name="Requested" fill="url(#adminBarRequested)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="completed" name="Completed" fill="url(#adminBarCompleted)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="cancelled" name="Cancelled" fill="url(#adminBarCancelled)" radius={[4, 4, 0, 0]} maxBarSize={20} />
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
                <AreaChart data={revenueSplitData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
            {serviceDistributionData.length > 0 ? (
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <div dir="ltr" className="h-56 w-full sm:w-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={serviceDistributionData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={54}
                        outerRadius={86}
                        paddingAngle={2}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      >
                        {serviceDistributionData.map((service) => (
                          <Cell key={service.name} fill={service.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full flex-1 space-y-2.5">
                  {serviceDistributionData.map((service) => (
                    <div key={service.name} className="flex items-center gap-2.5 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: service.fill }} />
                      <span className="min-w-0 flex-1 truncate text-ink-soft">{service.name}</span>
                      <span className="font-semibold tabular-nums text-ink">
                        {Math.round((service.value / Math.max(1, serviceTotal)) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No service data"
                description="Service breakdown will display as bookings are placed."
                className="py-12"
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="City distribution" subtitle="Bookings placed across the top cities" icon={Activity} />
          <CardBody>
            {cityDistributionData.length > 0 ? (
              <div dir="ltr" className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityDistributionData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminCityBar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#0F766E" />
                        <stop offset="100%" stopColor="#38BDF8" />
                      </linearGradient>
                    </defs>
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
                    <Bar dataKey="bookings" fill="url(#adminCityBar)" radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={Activity}
                title="No city data"
                description="Geographic distribution will display as bookings are placed."
                className="py-16"
              />
            )}
          </CardBody>
        </Card>
      </div>

      <SectionLabel>Operations</SectionLabel>

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
                  className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-mint-50/60"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
                    <CalendarClock className="h-4.5 w-4.5" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      {b.id} · {b.service}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {b.customerName} · {formatDate(b.date)} · {b.startTime}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <StatusBadge status={b.status} size="sm" />
                    <p className="mt-1 text-[11px] text-faint">{relativeTime(b.createdAt)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-faint transition duration-300 group-hover:translate-x-0.5 group-hover:text-primary-600" />
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
            subtitle="Newest customers and caretakers"
            icon={UserPlus}
            action={
              <Button to="/admin/customers" variant="link" size="sm" iconRight={ArrowRight}>
                Directory
              </Button>
            }
          />
          <CardBody className="divide-y divide-line p-0">
            {recentRegistrations.length ? (
              recentRegistrations.map((r) => (
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
              ))
            ) : (
              <EmptyState
                icon={UserPlus}
                title="No registrations yet"
                description="Registered customers and caretakers will appear here."
                className="py-8"
              />
            )}
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
              {pendingVerificationsList.length ? (
                pendingVerificationsList.slice(0, 4).map((v) => (
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
              title="Emergency ambulances"
              subtitle="Quick emergency response fleet"
              action={
                <Button to="/admin/ambulances" variant="link" size="sm" iconRight={ArrowRight}>
                  View fleet
                </Button>
              }
            />
            <CardBody className="space-y-3 p-4">
              <div className="flex items-center gap-3 rounded-xl border border-line bg-slate-50 p-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-600">
                  <Siren className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">On-Call Ambulance Network</p>
                  <p className="text-xs text-muted">Direct 1-tap dispatch for families & bedside caretakers</p>
                </div>
                <Button to="/admin/ambulances" variant="secondary" size="xs">
                  Manage
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Caretaker payouts"
              subtitle="Current settlement cycle"
              icon={HandCoins}
              action={
                <Button to="/admin/payouts" variant="link" size="sm" iconRight={ArrowRight}>
                  Payouts
                </Button>
              }
            />
            <CardBody className="space-y-3">
              <div className="rounded-xl border border-primary-100 bg-gradient-to-br from-mint-50 to-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-faint">Total payouts due</p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">
                  {formatCurrency(payoutSummary.due)}
                </p>
                <p className="mt-0.5 text-xs text-muted">Pending and processing across all caretakers</p>
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
