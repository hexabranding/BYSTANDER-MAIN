import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { CalendarDays, CalendarOff, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { bookingsForCaregiver, getCustomerById } from '@/data/bookings'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'
import { formatDuration } from '@/utils/duration'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { StatusBadge } from '@/components/common/StatusBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Modal } from '@/components/common/Modal'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/States'
import { FormField, Input, Textarea } from '@/components/forms/FormField'
import {
  availabilityService,
  bookingService,
  adaptWeekAvailabilityToWeeklySchedule,
} from '@/services'

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const BLOCK_STYLES = {
  available: 'border-primary-200 bg-mint-50 text-primary-900',
  booked: 'border-accent-200 bg-accent-50 text-accent-600',
  blocked: 'border-line bg-slate-100 text-muted',
}

const LEGEND = [
  { status: 'available', label: 'Available', dot: 'bg-primary-600' },
  { status: 'booked', label: 'Booked', dot: 'bg-accent-400' },
  { status: 'blocked', label: 'Blocked', dot: 'bg-slate-400' },
]

export function SchedulePage() {
  useDocumentTitle('My Schedule')

  const { user } = useAuth()
  const { bookings, caregivers } = useData()

  const myId = user?.caregiverId || 'cg-101'
  const caregiver = caregivers.find((c) => c.id === myId) || caregivers[0]

  const [realAvailability, setRealAvailability] = useState(null)
  const [realBookings, setRealBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [weekOffset, setWeekOffset] = useState(0)
  const [timeOffOpen, setTimeOffOpen] = useState(false)

  const fetchAvailability = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await availabilityService.getCaregiverAvailability()
      setRealAvailability(data)
    } catch (err) {
      setError(err.message || 'Unable to load caregiver availability')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAvailability()
    bookingService
      .getBookings()
      .then((res) => {
        if (Array.isArray(res?.bookings)) {
          setRealBookings(res.bookings)
        }
      })
      .catch(() => {})
  }, [fetchAvailability])

  const myBookings = useMemo(() => {
    if (realBookings.length > 0) return realBookings
    const list = bookings.filter((b) => b.caregiverId === myId)
    return list.length ? list : bookingsForCaregiver(myId)
  }, [realBookings, bookings, myId])

  const weekAvailability = useMemo(() => {
    if (realAvailability?.weekAvailability) {
      return realAvailability.weekAvailability
    }
    return caregiver?.weekAvailability || []
  }, [realAvailability, caregiver])

  const days = useMemo(() => {
    const today = new Date()
    const monday = new Date(today)
    const dow = monday.getDay()
    monday.setDate(monday.getDate() + (dow === 0 ? -6 : 1 - dow) + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }, [weekOffset])

  const rangeLabel = `${formatDate(days[0])} – ${formatDate(days[6], { long: true })}`

  const weekStart = iso(days[0])
  const weekEnd = iso(days[6])

  const weekBookings = useMemo(
    () => myBookings.filter((b) => b.date >= weekStart && b.date <= weekEnd),
    [myBookings, weekStart, weekEnd],
  )

  const upcoming = useMemo(
    () =>
      myBookings
        .filter((b) => b.date >= iso(new Date()) && ['Pending', 'Confirmed', 'In Progress'].includes(b.status))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3),
    [myBookings],
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { from: iso(new Date()), to: iso(new Date()), reason: '' },
  })

  const onSubmitTimeOff = async (data) => {
    if (data.to < data.from) {
      toast.error('The return date must be after the start date')
      return
    }

    try {
      const newExceptions = []
      const [fY, fM, fD] = data.from.split('-').map(Number)
      const [tY, tM, tD] = data.to.split('-').map(Number)
      const curr = new Date(Date.UTC(fY, fM - 1, fD))
      const end = new Date(Date.UTC(tY, tM - 1, tD))

      while (curr <= end) {
        newExceptions.push({
          date: curr.toISOString().slice(0, 10),
          isAvailable: false,
          reason: data.reason.trim(),
          slots: [],
        })
        curr.setUTCDate(curr.getUTCDate() + 1)
      }

      const existing = realAvailability?.dateExceptions || []
      const existingMap = new Map(existing.map((e) => [e.date, e]))
      newExceptions.forEach((e) => existingMap.set(e.date, e))
      const mergedExceptions = Array.from(existingMap.values())

      const payload = {
        timezone: realAvailability?.timezone || 'Asia/Kolkata',
        availabilityStatus: realAvailability?.availabilityStatus || 'Available Now',
        weeklySchedule:
          realAvailability?.weeklySchedule?.length === 7
            ? realAvailability.weeklySchedule
            : adaptWeekAvailabilityToWeeklySchedule(weekAvailability),
        dateExceptions: mergedExceptions,
      }

      const updated = await availabilityService.updateCaregiverAvailability(payload)
      setRealAvailability(updated)
      toast.success('Time-off saved successfully', {
        description: `Blocked dates from ${data.from} to ${data.to}.`,
      })
      reset()
      setTimeOffOpen(false)
    } catch (err) {
      toast.error('Failed to submit time-off', {
        description: err.message || 'Server rejected availability update.',
      })
    }
  }


  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly schedule"
        subtitle="Your availability blocks and booked shifts for the week. Adjust time off whenever plans change."
        meta={<span className="text-sm text-muted">{weekBookings.length} shift{weekBookings.length === 1 ? '' : 's'} this week</span>}
        action={
          <Button variant="outline" icon={CalendarOff} onClick={() => setTimeOffOpen(true)}>
            Request time off
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white px-4 py-3 shadow-card">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
          ) : null}
        </div>
        <p className="font-display text-sm font-bold text-ink">{rangeLabel}</p>
      </div>

      <div className="thin-scrollbar overflow-x-auto pb-2">
        <div className="grid min-w-[1050px] grid-cols-7 gap-3">
          {days.map((day, i) => {
            const key = iso(day)
            const dayShort = day.toLocaleDateString('en-IN', { weekday: 'short' })
            const exception = (realAvailability?.dateExceptions || []).find((e) => e.date === key)
            const defaultAvail =
              weekAvailability.find((w) => w.day === dayShort) ||
              weekAvailability[i] ||
              { day: dayShort, status: 'blocked', slots: [] }
            const availability = exception
              ? {
                  day: dayShort,
                  status: exception.isAvailable ? 'available' : 'blocked',
                  slots: exception.slots || [],
                }
              : defaultAvail
            const dayBookings = weekBookings.filter((b) => b.date === key)
            const isToday = key === iso(new Date())
            return (
              <div key={key} className="flex flex-col gap-2">
                <div
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-center',
                    isToday ? 'border-primary-300 bg-mint-100' : 'border-line bg-slate-50',
                  )}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-faint">
                    {day.toLocaleDateString('en-IN', { weekday: 'short' })}
                  </p>
                  <p className={cn('font-display text-sm font-bold', isToday ? 'text-primary-800' : 'text-ink')}>
                    {formatDate(day)}
                  </p>
                </div>

                {dayBookings.map((b) => (
                  <div key={b.id} className="rounded-xl border border-line bg-white p-3 shadow-card">
                    <p className="text-[11px] font-bold tabular-nums text-primary-700">
                      {b.startTime} · {formatDuration(b.hours, { short: true })}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-ink">{b.service}</p>
                    <p className="truncate text-[11px] text-muted">{getCustomerById(b.customerId)?.name || 'Customer'}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <StatusBadge status={b.status} size="sm" />
                      <Button variant="link" size="xs" to="/caregiver/bookings">
                        View
                      </Button>
                    </div>
                  </div>
                ))}

                <div className={cn('flex-1 rounded-xl border p-3', BLOCK_STYLES[availability.status] || BLOCK_STYLES.blocked)}>
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">{availability.status}</p>
                  {availability.slots?.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {availability.slots.map((slot) => (
                        <li key={slot} className="rounded-lg bg-white/70 px-2 py-1 text-[11px] font-medium tabular-nums">
                          {slot}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] opacity-80">No open slots</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {LEGEND.map((l) => (
          <span key={l.status} className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
            <span className={cn('h-2.5 w-2.5 rounded-full', l.dot)} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming shifts" subtitle="Your next scheduled visits" icon={CalendarDays} />
          <CardBody>
            {upcoming.length ? (
              <ul className="space-y-3">
                {upcoming.map((b) => (
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
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(b.date, { long: true })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {b.startTime} · {formatDuration(b.hours, { short: true })}
                        </span>
                      </p>
                    </div>
                    <Button variant="outline" size="xs" to="/caregiver/bookings">
                      Details
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming shifts"
                description="Accept a job request and it will show up here with the exact date and time."
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
          <CardHeader title="Availability at a glance" subtitle="Default weekly pattern" icon={Clock} />
          <CardBody>
            <ul className="space-y-2.5">
              {weekAvailability.map((w) => (
                <li key={w.day} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5 transition hover:border-primary-200 hover:bg-mint-50/50">
                  <span className="text-sm font-semibold text-ink">{w.day}</span>
                  <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide', BLOCK_STYLES[w.status])}>
                    {w.status}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={timeOffOpen}
        onClose={() => setTimeOffOpen(false)}
        title="Request time off"
        subtitle="Block out dates you cannot take new shifts. Existing bookings are not cancelled automatically."
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmitTimeOff)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="From" htmlFor="timeoff-from" required error={errors.from?.message}>
              <Input id="timeoff-from" type="date" error={errors.from} {...register('from', { required: 'Start date is required' })} />
            </FormField>
            <FormField label="To" htmlFor="timeoff-to" required error={errors.to?.message}>
              <Input id="timeoff-to" type="date" error={errors.to} {...register('to', { required: 'Return date is required' })} />
            </FormField>
          </div>
          <FormField label="Reason" htmlFor="timeoff-reason" required error={errors.reason?.message} hint="Visible only to CareMate operations.">
            <Textarea
              id="timeoff-reason"
              rows={4}
              placeholder="Family function, travel, medical leave…"
              error={errors.reason}
              {...register('reason', {
                required: 'Please tell us the reason',
                minLength: { value: 10, message: 'Add a bit more detail (min 10 characters)' },
              })}
            />
          </FormField>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={() => setTimeOffOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Submit request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default SchedulePage
