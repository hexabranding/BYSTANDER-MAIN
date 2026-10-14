import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Briefcase, CalendarDays, Clock, MapPin, User } from 'lucide-react'
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
import { EmptyState } from '@/components/common/States'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Select } from '@/components/forms/FormField'

export function JobsPage() {
  useDocumentTitle('Jobs')

  const { user } = useAuth()
  const { jobs, caregivers, acceptJob, rejectJob } = useData()

  const myId = user?.caregiverId || 'cg-101'
  const caregiver = caregivers.find((c) => c.id === myId) || caregivers[0]

  const [tab, setTab] = useState('open')
  const [query, setQuery] = useState('')
  const [service, setService] = useState('All')
  const [urgency, setUrgency] = useState('All')
  const [sort, setSort] = useState('newest')
  const [dialog, setDialog] = useState(null)

  const myJobs = useMemo(() => jobs.filter((j) => j.status === 'Open' || j.caregiverId === myId), [jobs, myId])

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
    const unique = Array.from(new Set(myJobs.map((j) => j.service)))
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
    const byUrgency = urgency === 'All' ? byService : byService.filter((j) => j.urgency === urgency)
    const sorted = [...byUrgency]
    if (sort === 'newest') sorted.sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    if (sort === 'oldest') sorted.sort((a, b) => a.postedAt.localeCompare(b.postedAt))
    if (sort === 'payHigh') sorted.sort((a, b) => b.payment - a.payment)
    if (sort === 'payLow') sorted.sort((a, b) => a.payment - b.payment)
    return sorted
  }, [myJobs, tab, query, service, urgency, sort])

  const activeFilters = (service !== 'All' ? 1 : 0) + (urgency !== 'All' ? 1 : 0)

  const handleConfirm = () => {
    if (!dialog) return
    if (dialog.type === 'accept') {
      acceptJob(dialog.job.id, caregiver?.id)
      toast.success('Job accepted — added to your schedule')
    } else {
      rejectJob(dialog.job.id)
      toast.info('Job declined')
    }
    setDialog(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job requests"
        subtitle="Shifts matched to your profile. Accept the ones that fit your schedule — customers are waiting for a quick response."
        meta={<span className="text-sm text-muted">{counts.open} open · {counts.accepted} accepted</span>}
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
          <Select aria-label="Filter by urgency" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="All">Any urgency</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
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

      {filtered.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((job) => (
            <Card key={job.id} hover className="flex flex-col">
              <CardBody className="flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-primary-700">{job.id}</span>
                      <StatusBadge status={job.urgency} size="sm" />
                      {job.status !== 'Open' ? <StatusBadge status={job.status} size="sm" /> : null}
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

                <p className="line-clamp-2 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-muted">{job.requirements}</p>
              </CardBody>

              <CardFooter className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-faint">Posted {relativeTime(job.postedAt)}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="xs" to={`/caregiver/jobs/${job.id}`}>
                    Details
                  </Button>
                  {job.status === 'Open' ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setDialog({ type: 'reject', job })}>
                        Decline
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => setDialog({ type: 'accept', job })}>
                        Accept
                      </Button>
                    </>
                  ) : null}
                  {job.status === 'Accepted' ? (
                    <Button variant="secondary" size="sm" to="/caregiver/bookings">
                      View booking
                    </Button>
                  ) : null}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Briefcase}
            title={tab === 'open' ? 'No open jobs right now' : `No ${tab} jobs`}
            description={
              tab === 'open'
                ? 'New requests matching your qualification will appear here. Keep your availability up to date for the best matches.'
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
                <Button variant="primary" to="/caregiver/schedule">
                  Update availability
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
        title={dialog?.type === 'accept' ? 'Accept this job?' : 'Decline this job?'}
        message={
          dialog
            ? dialog.type === 'accept'
              ? `${dialog.job.service} on ${formatDate(dialog.job.date, { long: true })} · ${dialog.job.shift} in ${dialog.job.area}. The shift is added to your schedule and the customer is notified.`
              : `${dialog.job.service} on ${formatDate(dialog.job.date, { long: true })} will be released to other verified caretakers. This cannot be undone.`
            : ''
        }
        confirmLabel={dialog?.type === 'accept' ? 'Accept job' : 'Decline job'}
      />
    </div>
  )
}

export default JobsPage
