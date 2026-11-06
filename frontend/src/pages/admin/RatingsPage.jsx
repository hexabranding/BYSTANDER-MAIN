import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ClipboardList,
  HeartHandshake,
  MessageSquare,
  Percent,
  SearchX,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { SearchBar } from '@/components/common/SearchBar'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RatingStars } from '@/components/common/RatingStars'
import { Modal } from '@/components/common/Modal'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/States'
import { FormField, Select } from '@/components/forms/FormField'
import { adminService, isMongoObjectId } from '@/services'

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #E6ECF2',
  boxShadow: '0 10px 28px -18px rgba(16,42,67,0.35)',
  fontSize: 12,
  color: '#172B3A',
}

export function RatingsPage() {
  useDocumentTitle('Ratings & Reviews')

  const [activeTab, setActiveTab] = useState('caregivers') // 'caregivers' | 'customers'
  const [serverData, setServerData] = useState(null)
  const [serverReviews, setServerReviews] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [city, setCity] = useState('All')
  const [status, setStatus] = useState('All')
  const [viewing, setViewing] = useState(null)
  const debouncedSearch = useDebouncedValue(search)

  const fetchRatings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await adminService.getAdminRatings()
      if (data) {
        setServerData(data)
      }
    } catch (err) {
      setError(err.message || 'Unable to load ratings from server')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRatings()
  }, [])

  // Fetch individual review dossiers when viewing modal is opened
  useEffect(() => {
    if (!viewing) {
      setServerReviews([])
      return
    }
    const targetId =
      activeTab === 'caregivers'
        ? viewing.caregiverProfileId || viewing.id || viewing.caregiverUserId
        : viewing.customerId || viewing.id

    if (isMongoObjectId(targetId)) {
      const fetcher =
        activeTab === 'caregivers'
          ? adminService.getAdminCaregiverReviews(targetId)
          : adminService.getAdminCustomerReviews(targetId)

      fetcher
        .then((revs) => setServerReviews(revs || []))
        .catch(() => setServerReviews([]))
    }
  }, [viewing, activeTab])

  // Isolate current active tab's dataset (caregivers or customers)
  const currentDataset = useMemo(() => {
    if (!serverData) return null
    if (activeTab === 'customers') {
      return serverData.customers || null
    }
    return serverData.caregivers || serverData
  }, [serverData, activeTab])

  const effectiveRows = useMemo(() => {
    return currentDataset?.rows || []
  }, [currentDataset])

  const cities = useMemo(() => {
    const seen = []
    effectiveRows.forEach((r) => {
      if (r.city && !seen.includes(r.city)) seen.push(r.city)
    })
    return ['All', ...seen]
  }, [effectiveRows])

  const statuses = useMemo(() => {
    const seen = []
    effectiveRows.forEach((r) => {
      if (r.status && !seen.includes(r.status)) seen.push(r.status)
    })
    return ['All', ...seen]
  }, [effectiveRows])

  const stats = useMemo(() => {
    if (currentDataset?.stats) {
      return currentDataset.stats
    }
    const totalReviews = effectiveRows.reduce((s, r) => s + (r.reviews || 0), 0)
    const weighted = effectiveRows.reduce((s, r) => s + (r.rating || 0) * (r.reviews || 0), 0)
    return {
      average: totalReviews ? (weighted / totalReviews).toFixed(2) : '5.00',
      totalReviews,
      fiveShare: 100,
      attention: effectiveRows.filter((r) => r.status === 'Needs attention').length,
    }
  }, [currentDataset, effectiveRows])

  const distribution = useMemo(() => {
    if (currentDataset?.distribution && currentDataset.distribution.length) {
      return currentDataset.distribution
    }
    return [
      { star: 5, count: 0, percentage: 0 },
      { star: 4, count: 0, percentage: 0 },
      { star: 3, count: 0, percentage: 0 },
      { star: 2, count: 0, percentage: 0 },
      { star: 1, count: 0, percentage: 0 },
    ]
  }, [currentDataset])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return effectiveRows.filter((r) => {
      const matchesCity = city === 'All' || r.city === city
      const matchesStatus = status === 'All' || r.status === status
      const entityName = r.caregiverName || r.customerName || r.name || ''
      const email = r.email || ''
      const matchesSearch =
        !q || [entityName, email, r.city, r.status].join(' ').toLowerCase().includes(q)
      return matchesCity && matchesStatus && matchesSearch
    })
  }, [effectiveRows, debouncedSearch, city, status])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, city, status, activeTab])

  // Caregiver detailed reviews (from customers)
  const caregiverReviews = useMemo(() => {
    if (!viewing || activeTab !== 'caregivers') return []
    return serverReviews.map((sr) => ({
      id: sr._id || sr.id,
      rating: sr.rating,
      customerName: sr.customer?.fullName || 'Customer',
      date: sr.createdAt ? new Date(sr.createdAt).toISOString().slice(0, 10) : 'Recent',
      comment: sr.comment,
      reply: sr.reply,
    }))
  }, [viewing, serverReviews, activeTab])

  // Customer detailed reviews (from caregivers)
  const customerReviews = useMemo(() => {
    if (!viewing || activeTab !== 'customers') return []
    return serverReviews.map((sr) => ({
      id: sr._id || sr.id,
      rating: sr.rating,
      caregiverName: sr.caregiverUser?.fullName || 'Caregiver',
      caregiverQualification: sr.caregiver?.qualification || 'Certified Caretaker',
      serviceName: sr.booking?.serviceName || 'Healthcare Shift',
      date: sr.createdAt ? new Date(sr.createdAt).toISOString().slice(0, 10) : 'Recent',
      comment: sr.comment,
      criteria: sr.criteria || {},
    }))
  }, [viewing, serverReviews, activeTab])

  const caregiverColumns = [
    {
      key: 'caregiverName',
      header: 'Caretaker',
      render: (r) => (
        <div>
          <p className="font-display text-sm font-bold text-ink">{r.caregiverName}</p>
          <p className="text-xs text-faint">{r.qualification || r.id}</p>
        </div>
      ),
    },
    { key: 'city', header: 'City' },
    {
      key: 'rating',
      header: 'Rating',
      render: (r) => <RatingStars value={r.rating} showValue count={r.reviews} />,
    },
    {
      key: 'reviews',
      header: 'Reviews',
      align: 'right',
      render: (r) => <span className="tabular-nums">{formatNumber(r.reviews)}</span>,
    },
    {
      key: 'positive',
      header: 'Positive %',
      align: 'right',
      render: (r) => <span className="tabular-nums">{r.positive}%</span>,
    },
    {
      key: 'trend',
      header: 'Trend',
      align: 'center',
      render: (r) => {
        const value = Number(r.trend)
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
              value > 0 ? 'text-success-600' : value < 0 ? 'text-danger-600' : 'text-muted',
            )}
          >
            {value > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : value < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : null}
            {r.trend}
          </span>
        )
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} size="sm" dot={false} /> },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (r) => (
        <Button
          size="xs"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            setViewing(r)
          }}
        >
          View reviews
        </Button>
      ),
    },
  ]

  const customerColumns = [
    {
      key: 'customerName',
      header: 'Customer / Patient',
      render: (r) => (
        <div>
          <p className="font-display text-sm font-bold text-ink">{r.customerName || r.name}</p>
          <p className="text-xs text-faint">{r.email || r.phone || r.id}</p>
        </div>
      ),
    },
    { key: 'city', header: 'City' },
    {
      key: 'rating',
      header: 'Rating',
      render: (r) => <RatingStars value={r.rating} showValue count={r.reviews} />,
    },
    {
      key: 'reviews',
      header: 'Reviews',
      align: 'right',
      render: (r) => <span className="tabular-nums">{formatNumber(r.reviews)}</span>,
    },
    {
      key: 'positive',
      header: 'Positive %',
      align: 'right',
      render: (r) => <span className="tabular-nums">{r.positive}%</span>,
    },
    {
      key: 'trend',
      header: 'Trend',
      align: 'center',
      render: (r) => {
        const value = Number(r.trend)
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
              value > 0 ? 'text-success-600' : value < 0 ? 'text-danger-600' : 'text-muted',
            )}
          >
            {value > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : value < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : null}
            {r.trend}
          </span>
        )
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} size="sm" dot={false} /> },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (r) => (
        <Button
          size="xs"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            setViewing(r)
          }}
        >
          View reviews
        </Button>
      ),
    },
  ]

  const columns = activeTab === 'caregivers' ? caregiverColumns : customerColumns

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ratings & Reviews"
        subtitle={
          activeTab === 'caregivers'
            ? 'Caretaker ratings across the platform — spot trends and intervene early.'
            : 'Customer & patient ratings evaluated by caretakers across completed shifts.'
        }
        action={
          activeTab === 'caregivers' ? (
            <Button
              variant="outline"
              icon={MessageSquare}
              onClick={() => toast.info('Review request queued for caretakers below 4.5')}
            >
              Request reviews
            </Button>
          ) : (
            <Button
              variant="outline"
              icon={MessageSquare}
              onClick={() => toast.info('Customer cooperation reminders queued for active shifts')}
            >
              Customer guidelines
            </Button>
          )
        }
      />

      {/* Modern Tab Bar: Tab 1 Caretakers, Tab 2 Customers */}
      <div className="flex items-center border-b border-line">
        <button
          type="button"
          onClick={() => {
            setActiveTab('caregivers')
            setSearch('')
            setCity('All')
            setStatus('All')
          }}
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors',
            activeTab === 'caregivers'
              ? 'border-primary-700 text-primary-800'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          <HeartHandshake className="h-4 w-4" />
          <span>Caretaker Reviews</span>
          <span
            className={cn(
              'ml-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
              activeTab === 'caregivers' ? 'bg-primary-100 text-primary-800' : 'bg-slate-100 text-slate-700',
            )}
          >
            {serverData?.caregivers?.rows?.length ?? (serverData?.rows?.length || 0)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('customers')
            setSearch('')
            setCity('All')
            setStatus('All')
          }}
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors',
            activeTab === 'customers'
              ? 'border-primary-700 text-primary-800'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          <Users className="h-4 w-4" />
          <span>Customer Reviews</span>
          <span
            className={cn(
              'ml-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
              activeTab === 'customers' ? 'bg-primary-100 text-primary-800' : 'bg-slate-100 text-slate-700',
            )}
          >
            {serverData?.customers?.rows?.length || 0}
          </span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label={activeTab === 'caregivers' ? 'Platform average rating' : 'Customer average rating'}
          value={stats.average}
          icon={Star}
          tone="primary"
          hint={`${formatNumber(stats.totalReviews)} ${activeTab === 'caregivers' ? 'lifetime reviews' : 'shift evaluations'}`}
          delay={0}
        />
        <StatCard
          label="Total reviews"
          value={formatNumber(stats.totalReviews)}
          icon={MessageSquare}
          tone="accent"
          hint={activeTab === 'caregivers' ? 'Across all caretakers' : 'Submitted by caretakers'}
          delay={0.05}
        />
        <StatCard
          label="5-star share"
          value={`${stats.fiveShare}%`}
          icon={Percent}
          tone="success"
          hint={activeTab === 'caregivers' ? 'Of caretaker reviews' : 'Of customer reviews'}
          delay={0.1}
        />
        <StatCard
          label="Needs attention"
          value={stats.attention}
          icon={TrendingDown}
          tone="warning"
          hint={activeTab === 'caregivers' ? 'Caretakers rated below 4.5' : 'Customers rated below 4.5'}
          delay={0.15}
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={activeTab === 'caregivers' ? 'Caretaker rating distribution' : 'Customer rating distribution'}
            subtitle="Share of reviews at each star level"
            icon={Star}
          />
          <CardBody className="space-y-3">
            {distribution.map((d) => {
              const star = d.star
              const count = d.count || 0
              const pct = d.percentage || 0
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="w-7 shrink-0 text-xs font-bold text-ink">{star}★</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        star >= 4 ? 'bg-primary-700' : star === 3 ? 'bg-warning-400' : 'bg-danger-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted">
                    {count} · {pct}%
                  </span>
                </div>
              )
            })}
            <p className="pt-1 text-xs leading-relaxed text-muted">
              {activeTab === 'caregivers'
                ? `Distribution is computed from ${stats.totalReviews} authenticated patient ratings.`
                : `Distribution is computed from ${stats.totalReviews} shift evaluations submitted by caretakers.`}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={activeTab === 'caregivers' ? 'Rating by caretaker' : 'Rating by customer'}
            subtitle={
              activeTab === 'caregivers'
                ? 'Platform average per caretaker, out of 5'
                : 'Platform average per customer, out of 5'
            }
            icon={TrendingUp}
          />
          <CardBody>
            <div dir="ltr" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={effectiveRows.slice(0, 10)} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF2" vertical={false} />
                  <XAxis
                    dataKey={activeTab === 'caregivers' ? 'caregiverName' : 'customerName'}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#94A3B8' }}
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis domain={[0, 5]} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(15,118,110,0.06)' }}
                    contentStyle={tooltipStyle}
                    formatter={(value, name, item) => [
                      `${value} ★`,
                      item?.payload?.caregiverName || item?.payload?.customerName || item?.payload?.name || 'Rating',
                    ]}
                  />
                  <Bar
                    dataKey="rating"
                    fill={activeTab === 'caregivers' ? '#0F766E' : '#0284C7'}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={34}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={activeTab === 'caregivers' ? 'Search caretaker or city…' : 'Search customer or city…'}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="City" htmlFor="rating-city">
            <Select id="rating-city" value={city} onChange={(e) => setCity(e.target.value)}>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? 'All cities' : c}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status" htmlFor="rating-status">
            <Select id="rating-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All statuses' : s}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </div>

      {/* Directory Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <ErrorState title="Failed to load ratings" description={error} onRetry={fetchRatings} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title={activeTab === 'caregivers' ? 'No caretakers match' : 'No customers match'}
            description="Clear the search, city or status filter to see everyone again."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setCity('All')
                  setStatus('All')
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageItems}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => setViewing(row)}
            initialSort={{ key: 'rating', dir: 'desc' }}
            emptyTitle={activeTab === 'caregivers' ? 'No caretaker ratings found' : 'No customer ratings found'}
            emptyIcon={Star}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      {/* Detailed Reviews Dossier Modal */}
      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={
          viewing
            ? activeTab === 'caregivers'
              ? `Reviews · ${viewing.caregiverName || viewing.name}`
              : `Caretaker Feedback · ${viewing.customerName || viewing.name}`
            : 'Reviews'
        }
        subtitle={
          viewing
            ? `${viewing.city} · ${viewing.rating} average from ${formatNumber(viewing.reviews)} ${
                activeTab === 'caregivers' ? 'reviews' : 'shift reviews'
              }`
            : ''
        }
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
            {activeTab === 'caregivers' ? (
              <Button
                onClick={() => {
                  toast.success('Improvement plan requested', {
                    description: `${viewing?.caregiverName || viewing?.name} will be asked to submit a 2-week improvement plan.`,
                  })
                  setViewing(null)
                }}
              >
                Request improvement plan
              </Button>
            ) : (
              <Button
                onClick={() => {
                  toast.success('Cooperation notice sent', {
                    description: `Caregiver expectation guidelines sent to ${viewing?.customerName || viewing?.name}.`,
                  })
                  setViewing(null)
                }}
              >
                Send cooperation notice
              </Button>
            )}
          </div>
        }
      >
        {viewing ? (
          activeTab === 'caregivers' ? (
            caregiverReviews.length ? (
              <ul className="space-y-3">
                {caregiverReviews.map((r) => (
                  <li key={r.id} className="rounded-card border border-line bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <RatingStars value={r.rating} size={15} />
                      <span className="text-xs text-faint">
                        {r.customerName} · {r.date}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.comment}</p>
                    {r.reply ? (
                      <div className="mt-3 rounded-xl bg-mint-50 px-3.5 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary-700">Caretaker reply</p>
                        <p className="mt-1 text-xs leading-relaxed text-primary-900">{r.reply}</p>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-faint">No reply yet.</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No written reviews yet"
                description="This caretaker has a rating average but no individual written reviews submitted yet."
                className="py-8"
              />
            )
          ) : customerReviews.length ? (
            <ul className="space-y-3">
              {customerReviews.map((r) => (
                <li key={r.id} className="rounded-card border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <RatingStars value={r.rating} size={15} />
                      {r.serviceName ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {r.serviceName}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-faint">
                      Evaluated by {r.caregiverName} ({r.caregiverQualification}) · {r.date}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {r.comment || 'No additional written comments provided.'}
                  </p>
                  {r.criteria && Object.keys(r.criteria).length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                      {r.criteria.cooperation !== undefined && (
                        <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-[11px] text-muted">
                          Cooperation: <strong className="text-ink">{r.criteria.cooperation}★</strong>
                        </span>
                      )}
                      {r.criteria.workingConditions !== undefined && (
                        <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-[11px] text-muted">
                          Working Conditions: <strong className="text-ink">{r.criteria.workingConditions}★</strong>
                        </span>
                      )}
                      {r.criteria.punctuality !== undefined && (
                        <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-[11px] text-muted">
                          Punctuality: <strong className="text-ink">{r.criteria.punctuality}★</strong>
                        </span>
                      )}
                      {r.criteria.clarity !== undefined && (
                        <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-[11px] text-muted">
                          Clarity: <strong className="text-ink">{r.criteria.clarity}★</strong>
                        </span>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="No shift evaluations yet"
              description="This customer does not have any individual shift reviews submitted by caretakers yet."
              className="py-8"
            />
          )
        ) : null}
      </Modal>
    </div>
  )
}

export default RatingsPage
