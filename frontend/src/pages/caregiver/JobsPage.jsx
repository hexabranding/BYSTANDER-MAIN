import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Briefcase, CalendarDays, Clock, MapPin, User, RotateCw, Zap } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { PLATFORM_COMMISSION } from '@/utils/constants'
import { formatCurrency, formatDate, relativeTime } from '@/utils/format'
import { formatDuration } from '@/utils/duration'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardFooter } from '@/components/common/Card'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Tabs } from '@/components/common/Tabs'
import { SearchBar } from '@/components/common/SearchBar'
import { EmptyState, ErrorState } from '@/components/common/States'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Select } from '@/components/forms/FormField'
import {
  bookingService,
  adaptBookingToJob,
  isMongoObjectId,
  onBookingBroadcast,
  onBookingClaimed,
} from '@/services'

export function JobsPage() {
  useDocumentTitle('Jobs')

  const { user } = useAuth()
  const { caregivers, acceptJob, rejectJob } = useData()

  const myId = user?.caregiverId || 'cg-101'
  const caregiver = caregivers?.find((c) => c.id === myId) || caregivers?.[0]
  const caregiverGender = user?.gender || caregiver?.gender || 'Female'

  const [realBookings, setRealBookings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [tab, setTab] = useState('open')
  const [query, setQuery] = useState('')
  const [service, setService] = useState('All')
  const [urgency, setUrgency] = useState('All')
  const [sort, setSort] = useState('newest')
  const [dialog, setDialog] = useState(null)

  const fetchJobs = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const res = await bookingService.getBookings({ limit: 50 })
      setRealBookings(res.bookings || [])
    } catch (err) {
      setError(err.message || 'Unable to load jobs')
      setRealBookings([])
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs(true)
  }, [fetchJobs])

  // Real-time On-Demand Broadcast & Atomic CAS Claim Listener
  useEffect(() => {
    const unsubBroadcast = onBookingBroadcast((newBooking) => {
      if (!newBooking) return
      const pref = newBooking.preferredGender || 'Any'
      if (pref !== 'Any' && caregiverGender && caregiverGender.toLowerCase() !== pref.toLowerCase()) {
        return // Ignore broadcast when customer specifically requested the other gender
      }
      setRealBookings((prev) => {
        const id = newBooking._id || newBooking.id
        if (!prev) return [newBooking]
        if (prev.some((b) => (b._id || b.id) === id)) return prev
        return [newBooking, ...prev]
      })
      toast.info('New Caretaker Job Available!', {
        description: `${newBooking.serviceName || 'Patient Care'} in ${newBooking.location?.city || 'your area'}.`,
      })
    })

    const unsubClaimed = onBookingClaimed((claimData) => {
      if (!claimData?.bookingId) return
      setRealBookings((prev) => {
        if (!prev) return []
        const myCaregiverId = caregiver?._id || caregiver?.id
        // If claimed by another caretaker, remove it immediately from open list
        if (claimData.caregiverId && String(claimData.caregiverId) !== String(myCaregiverId)) {
          return prev.filter((b) => (b._id || b.id) !== claimData.bookingId)
        }
        return prev
      })
    })

    return () => {
      unsubBroadcast()
      unsubClaimed()
    }
  }, [caregiver, caregiverGender])

  const myJobs = useMemo(() => {
    if (!realBookings) return []
    return realBookings
      .map(adaptBookingToJob)
      .filter((job) => {
        // Confirmed / Declined / History jobs should remain visible in their tabs
        if (job.status !== 'Open') return true
        const pref = job.preferredGender || 'Any'
        if (!pref || pref === 'Any') return true
        if (!caregiverGender) return true
        return caregiverGender.toLowerCase() === pref.toLowerCase()
      })
  }, [realBookings, caregiverGender])

  const counts = useMemo(
    () => ({
      open: myJobs.filter((j) => j.status === 'Open').length,
      accepted: myJobs.filter((j) => j.status === 'Accepted').length,
      declined: myJobs.filter((j) => j.status === 'Declined').length,
      all: myJobs.length,
    }),
    [myJobs],
  )

  const serviceOptions = useMemo(() => {
    const unique = Array.from(new Set(myJobs.map((j) => j.service).filter(Boolean)))
    return ['All', ...unique]
  }, [myJobs])

  const filtered = useMemo(() => {
    const list = myJobs.filter((j) => (tab === 'all' ? true : j.status.toLowerCase() === tab))
    const q = query.trim().toLowerCase()
    const searched = q
      ? list.filter((j) =>
          [j.service, j.customerName, j.area, j.city, j.patient?.name, j.careType].join(' ').toLowerCase().includes(q),
        )
      : list
    const byService = service === 'All' ? searched : searched.filter((j) => j.service === service)
    const byUrgency =
      urgency === 'All'
        ? byService
        : urgency === 'Urgent'
          ? byService.filter((j) => j.isUrgent)
          : urgency === 'Standard'
            ? byService.filter((j) => !j.isUrgent)
            : byService.filter((j) => j.urgency === urgency)
    const sorted = [...byUrgency]
    if (sort === 'newest') sorted.sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''))
    if (sort === 'oldest') sorted.sort((a, b) => (a.postedAt || '').localeCompare(b.postedAt || ''))
    if (sort === 'payHigh') sorted.sort((a, b) => b.payment - a.payment)
    if (sort === 'payLow') sorted.sort((a, b) => a.payment - b.payment)
    return sorted
  }, [myJobs, tab, query, service, urgency, sort])

  const activeFilters = (service !== 'All' ? 1 : 0) + (urgency !== 'All' ? 1 : 0)

  const handleConfirm = async () => {
    if (!dialog) return
    const { type, job } = dialog
    setActionLoading(true)

    try {
      if (type === 'accept') {
        let updatedBooking = null
        if (isMongoObjectId(job.id)) {
          updatedBooking = await bookingService.acceptBooking(job.id)
        }
        if (acceptJob) {
          acceptJob(job.id, caregiver?.id)
        }
        if (updatedBooking) {
          setRealBookings((prev) =>
            (prev || []).map((b) => ((b._id || b.id) === (updatedBooking._id || updatedBooking.id) ? updatedBooking : b)),
          )
        } else {
          setRealBookings((prev) =>
            (prev || []).map((b) => (b.id === job.id ? { ...b, status: 'Confirmed', rawStatus: 'confirmed' } : b)),
          )
        }
        const isBroadcast = !job.caregiverId && !job.rawBooking?.caregiver
        if (isBroadcast) {
          toast.success('Offer submitted to customer!', {
            description: `Your profile and rate for ${job.service} have been sent to ${job.customerName}. You'll be notified once they make a choice.`,
          })
        } else {
          toast.success('Job accepted — added to your schedule', {
            description: `${job.service} for ${job.customerName} is confirmed.`,
          })
        }
      } else {
        if (isMongoObjectId(job.id)) {
          await bookingService.rejectBooking(job.id, 'Declined by caretaker')
        }
        if (rejectJob) {
          rejectJob(job.id)
        }
        setRealBookings((prev) =>
          (prev || []).map((b) => (b.id === job.id ? { ...b, status: 'Rejected', rawStatus: 'rejected' } : b)),
        )
        toast.info('Job declined', {
          description: `${job.service} has been declined.`,
        })
      }
      setDialog(null)
      fetchJobs(false)
    } catch (err) {
      toast.error(type === 'accept' ? 'Failed to accept job' : 'Failed to decline job', {
        description: err.message || 'Server rejected the request.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job requests"
        subtitle="Live booking requests matched to your profile. Accept the ones that fit your schedule — customers are waiting for a quick response."
        meta={<span className="text-sm text-muted">{counts.open} open · {counts.accepted} accepted</span>}
        action={
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCw}
            onClick={() => fetchJobs(true)}
            disabled={loading}
            className={loading ? 'animate-spin' : ''}
          >
            Refresh
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'open', label: 'Open', count: counts.open },
          { id: 'accepted', label: 'Accepted', count: counts.accepted },
          { id: 'declined', label: 'Declined', count: counts.declined },
          { id: 'all', label: 'All', count: counts.all },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchBar value={query} onChange={setQuery} placeholder="Search service, area or customer…" className="sm:col-span-2" />
        <Select aria-label="Filter by service" value={service} onChange={(e) => setService(e.target.value)}>
          {serviceOptions.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All services' : s}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select aria-label="Filter by request type" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="All">All requests</option>
            <option value="Urgent">⚡ Urgent only</option>
            <option value="Standard">Standard scheduled</option>
          </Select>
          <Select aria-label="Sort jobs" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="payHigh">Payment: high</option>
            <option value="payLow">Payment: low</option>
          </Select>
        </div>
      </div>

      {activeFilters > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-mint-50 px-4 py-2.5">
          <p className="text-sm text-primary-900">
            {activeFilters} filter{activeFilters > 1 ? 's' : ''} applied
          </p>
          <button
            type="button"
            onClick={() => {
              setService('All')
              setUrgency('All')
            }}
            className="text-xs font-semibold text-primary-700 underline-offset-4 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : null}

      {loading && realBookings === null ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <Card key={n} className="flex flex-col animate-pulse">
              <CardBody className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-24 rounded bg-slate-200" />
                    <div className="h-5 w-44 rounded bg-slate-200" />
                    <div className="h-4 w-32 rounded bg-slate-100" />
                  </div>
                  <div className="h-6 w-20 rounded bg-slate-200" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="h-4 w-32 rounded bg-slate-100" />
                  <div className="h-4 w-28 rounded bg-slate-100" />
                  <div className="h-4 w-24 rounded bg-slate-100" />
                  <div className="h-4 w-36 rounded bg-slate-100" />
                </div>
                <div className="h-12 rounded-xl bg-slate-100" />
              </CardBody>
              <CardFooter className="flex justify-between">
                <div className="h-4 w-20 rounded bg-slate-100" />
                <div className="h-8 w-32 rounded bg-slate-200" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : error && (!realBookings || realBookings.length === 0) ? (
        <Card>
          <ErrorState
            title="Unable to load job requests"
            description={error}
            onRetry={() => fetchJobs(true)}
          />
        </Card>
      ) : filtered.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((job) => {
            const myCaregiverId = caregiver?._id || caregiver?.id || user?.caregiverId || 'cg-101'
            const hasApplied = Boolean(
              job.applicants?.some(
                (a) => String(a.caregiverId || a.id || a.caregiver) === String(myCaregiverId)
              )
            )
            const preferredGender = job.preferredGender || 'Any'
            const caregiverGender = caregiver?.gender || user?.gender || 'Female'
            const isGenderMismatch =
              preferredGender !== 'Any' &&
              caregiverGender &&
              caregiverGender.toLowerCase() !== preferredGender.toLowerCase()

            return (
              <Card
                key={job.id}
                hover
                className={cn(
                  'relative flex flex-col overflow-hidden transition-all duration-200',
                  job.isUrgent && 'border-orange-300 ring-1 ring-orange-200/80 bg-gradient-to-b from-orange-50/20 via-white to-white shadow-sm hover:border-orange-400'
                )}
              >
                {job.isUrgent ? (
                  <div className="h-1 w-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-400" />
                ) : null}
                <CardBody className="flex flex-1 flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-primary-700">
                          {job.displayId || job.id}
                        </span>
                        {job.isUrgent ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-xs ring-1 ring-orange-300">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-80" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                            </span>
                            <Zap className="h-3 w-3 fill-current" />
                            Urgent Dispatch
                          </span>
                        ) : null}
                        {job.status !== 'Open' ? <StatusBadge status={job.status} size="sm" /> : null}
                        {preferredGender && preferredGender !== 'Any' ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border',
                              preferredGender === 'Male'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-pink-50 text-pink-700 border-pink-200'
                            )}
                          >
                            {preferredGender === 'Female' ? 'Female Preferred' : 'Male Preferred'}
                          </span>
                        ) : null}
                        {hasApplied ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                            ⏳ Offer Sent
                          </span>
                        ) : null}
                        {job.applicants && job.applicants.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {job.applicants.length} interested
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-1.5 font-display text-base font-bold text-ink">{job.service}</h3>
                      <p className="mt-0.5 text-sm text-muted">
                        {job.customerName} · {job.careType}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-extrabold tabular-nums text-ink">{formatCurrency(job.payment)}</p>
                      <p className="text-[11px] uppercase tracking-wide text-faint">
                        {formatDuration(job.hours, { short: true })} · net {formatCurrency(job.payment - Math.round(job.payment * PLATFORM_COMMISSION))}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-muted sm:grid-cols-2">
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-faint" />
                      <span className="truncate">
                        {job.area}, {job.city} · {job.distanceKm} km
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0 text-faint" />
                      {formatDate(job.date, { long: true })}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-faint" />
                      {job.shift}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <User className="h-4 w-4 shrink-0 text-faint" />
                      <span className="truncate">
                        {job.patient?.name}, {job.patient?.age} · {job.patient?.relation}
                      </span>
                    </span>
                  </div>

                  {job.isUrgent ? (
                    <div className="flex items-start gap-2.5 rounded-xl border border-orange-200 bg-orange-50/70 p-3 text-xs text-orange-950">
                      <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-orange-500 text-white shadow-xs">
                        <Zap className="h-3 w-3 fill-current" />
                      </div>
                      <div className="min-w-0 flex-1 leading-relaxed">
                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-orange-900 text-[11px]">
                          <span>Urgent Dispatch Request</span>
                          <span className="rounded bg-orange-200/90 px-1.5 py-0.2 text-[10px] text-orange-900">Immediate</span>
                        </div>
                        <p className="mt-0.5 text-xs text-orange-900/90 font-medium">
                          {job.requirements?.replace(/URGENT DISPATCH PROTOCOL\s*[·•]?\s*/gi, '') || 'Customer requires immediate caretaker bedside assistance.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="line-clamp-2 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-muted">{job.requirements}</p>
                  )}
                </CardBody>

                <CardFooter className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-faint">Posted {relativeTime(job.postedAt)}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="xs" to={`/caregiver/jobs/${job.id}`}>
                      Details
                    </Button>
                    {job.status === 'Open' ? (
                      hasApplied ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                          Offer Sent · Awaiting Customer Decision
                        </span>
                      ) : isGenderMismatch ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                          Requires {preferredGender} Caretaker
                        </span>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setDialog({ type: 'reject', job })}>
                            Decline
                          </Button>
                          <Button variant="primary" size="sm" onClick={() => setDialog({ type: 'accept', job })}>
                            Accept & Send Offer
                          </Button>
                        </>
                      )
                    ) : null}
                    {job.status === 'Accepted' ? (
                      <Button variant="secondary" size="sm" to="/caregiver/bookings">
                        View booking
                      </Button>
                    ) : null}
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Briefcase}
            title={tab === 'open' ? 'No open jobs right now' : `No ${tab} jobs`}
            description={
              tab === 'open'
                ? 'New broadcast requests will appear here in real time. When a customer submits a booking, it will show up for instant claim.'
                : 'Try a different tab or adjust your search and filters.'
            }
            action={
              activeFilters > 0 || query ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery('')
                    setService('All')
                    setUrgency('All')
                  }}
                >
                  Clear search & filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => fetchJobs(true)}>
                  Check for new jobs
                </Button>
              )
            }
          />
        </Card>
      )}

      <ConfirmationDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        onConfirm={handleConfirm}
        tone={dialog?.type === 'accept' ? 'success' : 'danger'}
        title={dialog?.type === 'accept' ? 'Accept job & send offer?' : 'Decline this job?'}
        message={
          dialog
            ? dialog.type === 'accept'
              ? `${dialog.job.service} on ${formatDate(dialog.job.date, { long: true })} · ${dialog.job.shift} in ${dialog.job.area}. Your profile and hourly rate will be submitted to ${dialog.job.customerName}. When selected by the customer, this booking is confirmed.`
              : `${dialog.job.service} on ${formatDate(dialog.job.date, { long: true })} will be released to other verified caretakers. This cannot be undone.`
            : ''
        }
        confirmLabel={dialog?.type === 'accept' ? (actionLoading ? 'Submitting offer…' : 'Send offer') : (actionLoading ? 'Declining…' : 'Decline job')}
      />
    </div>
  )
}

export default JobsPage

