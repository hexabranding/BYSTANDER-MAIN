import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Ban,
  CalendarDays,
  Eye,
  IndianRupee,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  SearchX,
  UserRound,
  Users,
} from 'lucide-react'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { formatDate, formatCurrency, maskEmail, maskPhone } from '@/utils/format'
import { formatDuration } from '@/utils/duration'
import { adminService } from '@/services/adminService'
import { bookingService } from '@/services/bookingService'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/States'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'

const STATUS_TABS = ['All', 'Active', 'Inactive']
const DEFAULT_CITIES = ['All', 'Kochi, KL', 'Thiruvananthapuram, KL', 'Kozhikode, KL', 'Thrissur, KL', 'Kollam, KL', 'Alappuzha, KL', 'Kottayam, KL', 'Palakkad, KL', 'Kannur, KL', 'Malappuram, KL']

export function CustomersPage() {
  useDocumentTitle('Customers')

  const [customers, setCustomers] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, lifetime: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [city, setCity] = useState('All')
  const [viewingId, setViewingId] = useState(null)

  // Account status mutation dialog state
  const [suspendTarget, setSuspendTarget] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendReviewAfter, setSuspendReviewAfter] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const debouncedSearch = useDebouncedValue(search)

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const query = {
        search: debouncedSearch.trim() || undefined,
        status: status === 'All' ? undefined : (status === 'Active' ? 'active' : 'suspended'),
        city: city === 'All' ? undefined : city,
      }
      const result = await adminService.getCustomers(query)
      setCustomers(result.customers || [])
      setStats({
        total: result.stats?.total ?? result.customers.length,
        active: result.stats?.active ?? result.customers.filter((c) => c.status?.toLowerCase() === 'active').length,
        inactive: (result.stats?.suspended || 0) + (result.stats?.blocked || 0) || result.customers.filter((c) => c.status?.toLowerCase() !== 'active').length,
        lifetime: result.customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
      })
    } catch (err) {
      setError(err.message || 'Failed to retrieve registered customers from server.')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, status, city])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const cities = useMemo(() => {
    const fromData = customers.map((c) => c.city).filter((c) => c && c !== '—')
    return [...new Set([...DEFAULT_CITIES.slice(1), ...fromData])].sort()
  }, [customers])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return customers.filter((c) => {
      const isAct = c.status?.toLowerCase() === 'active'
      const matchesStatus =
        status === 'All' ||
        (status === 'Active' && isAct) ||
        (status === 'Inactive' && !isAct)
      const matchesCity = city === 'All' || c.city === city
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      return matchesStatus && matchesCity && matchesSearch
    })
  }, [customers, debouncedSearch, status, city])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)

  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, city])

  const selected = viewingId ? customers.find((c) => c.id === viewingId) : null

  const [selectedBookings, setSelectedBookings] = useState([])
  const [isLoadingBookings, setIsLoadingBookings] = useState(false)

  useEffect(() => {
    if (!selected) {
      setSelectedBookings([])
      return
    }
    let cancelled = false
    setIsLoadingBookings(true)
    bookingService
      .getBookings({ customerId: selected.id, limit: 20 })
      .then((res) => {
        if (!cancelled) {
          setSelectedBookings(res.bookings || [])
        }
      })
      .catch((err) => {
        console.error('Failed to load customer bookings:', err)
        if (!cancelled) setSelectedBookings([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBookings(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  const selectedSpend =
    selected?.totalSpent ||
    selectedBookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((sum, b) => sum + (b.total || 0), 0)

  const handleOpenSuspendModal = (targetCustomer) => {
    setSuspendTarget(targetCustomer)
    setSuspendReason('')
    setSuspendReviewAfter('')
    setReasonError('')
  }

  const handleSuspendSubmit = async () => {
    if (!suspendTarget) return
    const trimmedReason = suspendReason.trim()
    if (trimmedReason.length < 3) {
      setReasonError('An auditable reason of at least 3 characters is mandatory.')
      return
    }

    setIsUpdating(true)
    const isCurrentlyActive = suspendTarget.status?.toLowerCase() === 'active'
    const nextStatus = isCurrentlyActive ? 'suspended' : 'active'

    try {
      await adminService.updateUserStatus(suspendTarget.id, {
        status: nextStatus,
        reason: trimmedReason,
        reviewAfter: suspendReviewAfter || 'Permanent',
      })

      // Update local state with the server-confirmed result
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === suspendTarget.id
            ? {
                ...c,
                status: nextStatus === 'active' ? 'Active' : 'Suspended',
                accountStatus: nextStatus,
                statusReason: trimmedReason,
                statusUpdatedAt: new Date().toISOString(),
              }
            : c,
        ),
      )

      toast.success(
        nextStatus === 'active'
          ? `${suspendTarget.name}'s account reactivated`
          : `${suspendTarget.name}'s account suspended`,
        {
          description:
            nextStatus === 'active'
              ? 'They can book and message caretakers again.'
              : 'New bookings are blocked until you reactivate.',
        },
      )
      setSuspendTarget(null)
      setSuspendReason('')
    } catch (err) {
      toast.error(err.message || 'Failed to update account status', {
        description: 'Server rejected the status transition.',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Customer',
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar src={c.avatar} name={c.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{c.name}</p>
            <p className="truncate text-xs text-faint">{c.area || c.city}</p>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (c) => <span className="tabular-nums">{c.email ? maskEmail(c.email) : '—'}</span> },
    { key: 'phone', header: 'Phone', render: (c) => <span className="tabular-nums">{c.phone ? maskPhone(c.phone) : '—'}</span> },
    { key: 'city', header: 'City' },
    { key: 'totalBookings', header: 'Bookings', align: 'right' },
    {
      key: 'totalSpent',
      header: 'Total spent',
      align: 'right',
      render: (c) => <span className="font-semibold tabular-nums text-ink">{formatCurrency(c.totalSpent)}</span>,
    },
    { key: 'createdAt', header: 'Joined', render: (c) => <span className="whitespace-nowrap">{formatDate(c.createdAt)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (c) => {
        const s = (c.status || '').toLowerCase()
        if (s === 'blocked') return <StatusBadge status="Blacklisted" size="sm" />
        if (s === 'suspended') return <StatusBadge status="Suspended" size="sm" />
        return <StatusBadge status="Active" size="sm" />
      },
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (c) => {
        const isBanned = ['suspended', 'blocked'].includes((c.status || '').toLowerCase())
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              size="xs"
              variant="outline"
              icon={Eye}
              onClick={() => setViewingId(c.id)}
            >
              View
            </Button>
            <Button
              size="xs"
              variant={isBanned ? 'outline' : 'dangerGhost'}
              onClick={() => handleOpenSuspendModal(c)}
            >
              {isBanned ? 'Reinstate' : 'Suspend'}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Every registered family — contact details, live booking history and account status."
        action={
          <Button to="/admin/bookings" variant="outline" icon={CalendarDays}>
            Booking ledger
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total customers" value={stats.total} icon={Users} tone="primary" hint="All registered accounts" delay={0} />
        <StatCard label="Active" value={stats.active} icon={UserRound} tone="success" trend={8} hint="Currently booking" delay={0.05} />
        <StatCard label="Inactive / Suspended" value={stats.inactive} icon={Ban} tone="warning" hint="Dormant or suspended" delay={0.1} />
        <StatCard
          label="Lifetime value"
          value={formatCurrency(stats.lifetime)}
          icon={IndianRupee}
          tone="accent"
          trend={13}
          hint="Gross value across customers"
          delay={0.15}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email or city…"
          className="lg:max-w-sm lg:flex-1"
        />
        <Tabs
          tabs={STATUS_TABS.map((s) => ({
            id: s,
            label: s,
            count:
              s === 'All'
                ? customers.length
                : s === 'Active'
                  ? customers.filter((c) => c.status?.toLowerCase() === 'active').length
                  : customers.filter((c) => c.status?.toLowerCase() !== 'active').length,
          }))}
          active={status}
          onChange={setStatus}
          size="sm"
        />
        <div className="lg:ml-auto lg:w-52">
          <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city">
            <option value="All">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-card border border-line bg-white p-6 shadow-card">
          <TableSkeleton rows={6} cols={6} />
        </div>
      ) : error ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <ErrorState
            title="Unable to load customer directory"
            description={error}
            onRetry={fetchCustomers}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No customers found"
            description="Try a different search term or clear the filters."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setStatus('All')
                  setCity('All')
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
            onRowClick={(row) => setViewingId(row.id)}
            initialSort={{ key: 'name', dir: 'asc' }}
            emptyTitle="No customers found"
            emptyIcon={Users}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      {/* View Customer Dossier Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setViewingId(null)}
        title={selected?.name || 'Customer'}
        subtitle={selected ? `Customer since ${formatDate(selected.createdAt, { long: true })}` : ''}
        size="xl"
        footer={
          selected ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant={selected.status?.toLowerCase() === 'active' ? 'dangerGhost' : 'outline'}
                icon={Ban}
                onClick={() => handleOpenSuspendModal(selected)}
              >
                {selected.status?.toLowerCase() === 'active' ? 'Suspend account' : 'Reinstate account'}
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  icon={MessageSquare}
                  onClick={() =>
                    toast.info(`Message thread opened with ${selected.name}`, {
                      description: 'Administrative notification channel.',
                    })
                  }
                >
                  Message
                </Button>
                <Button onClick={() => setViewingId(null)}>Done</Button>
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar src={selected.avatar} name={selected.name} size="xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg font-bold text-ink">{selected.name}</p>
                  <StatusBadge status={selected.status} size="sm" />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> {selected.email || '—'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {selected.phone || '—'}
                  </span>
                </div>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted">
                  <MapPin className="h-3.5 w-3.5" /> {selected.defaultAddress?.addressLine || selected.area ? `${selected.defaultAddress?.addressLine || ''} ${selected.area}, ${selected.city}` : selected.city}
                </p>
                {selected.statusReason ? (
                  <p className="mt-2 text-xs italic text-amber-700">
                    Status Note: "{selected.statusReason}" {selected.statusUpdatedAt ? `(${formatDate(selected.statusUpdatedAt)})` : ''}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:shrink-0">
                <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white px-4 py-3 text-center">
                  <p className="font-display text-xl font-extrabold tabular-nums text-ink">{selected.totalBookings}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Bookings</p>
                </div>
                <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white px-4 py-3 text-center">
                  <p className="font-display text-xl font-extrabold tabular-nums text-primary-700">
                    {formatCurrency(selected.totalSpent)}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Lifetime spend</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader title="Patient Information" subtitle="Family members on file" />
                <CardBody className="space-y-3 text-sm">
                  {selected.patients && selected.patients.length > 0 ? (
                    selected.patients.map((pat, idx) => (
                      <div key={pat._id || idx} className="rounded-lg border border-line p-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-ink">{pat.name}</span>
                          <span className="text-xs text-muted">{pat.relation} · {pat.gender}</span>
                        </div>
                        {pat.age ? <p className="text-xs text-muted">Age: {pat.age} yrs</p> : null}
                        {pat.condition ? <p className="mt-1 text-xs text-ink-soft">Condition: {pat.condition}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted">No patient records on file.</p>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Emergency Contact & Address" subtitle="Service details" />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Emergency contact</span>
                    <span className="font-semibold text-ink">
                      {selected.emergencyContact?.name ? `${selected.emergencyContact.name} (${selected.emergencyContact.relation || 'Contact'})` : '—'}
                    </span>
                  </div>
                  {selected.emergencyContact?.phone ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted">Emergency phone</span>
                      <span className="tabular-nums font-semibold text-ink">{maskPhone(selected.emergencyContact.phone)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">City / Area</span>
                    <span className="font-semibold text-ink">{selected.city} · {selected.area || '—'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Spend in context</span>
                    <span className="font-semibold tabular-nums text-ink">{formatCurrency(selectedSpend)}</span>
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader
                title="Booking history"
                subtitle={`${selectedBookings.length} booking${selectedBookings.length === 1 ? '' : 's'} on CareMate`}
              />
              <CardBody className="divide-y divide-line p-0">
                {isLoadingBookings ? (
                  <div className="p-6 text-center text-sm text-muted">Loading live booking history...</div>
                ) : selectedBookings.length ? (
                  selectedBookings.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-mint-50/60">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
                        <CalendarDays className="h-4.5 w-4.5" size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">
                          {b.id} · {b.service}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDate(b.date, { long: true })} · {b.startTime} · {formatDuration(b.hours, { short: true })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-ink">{formatCurrency(b.total)}</p>
                        <StatusBadge status={b.status} size="sm" />
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="No bookings yet"
                    description="This customer has not booked a caretaker on CareMate."
                    className="py-8"
                  />
                )}
              </CardBody>
            </Card>
          </div>
        ) : null}
      </Modal>

      {/* Suspend / Reinstate Dialog with Mandatory Reason & Review Date */}
      <Modal
        open={Boolean(suspendTarget)}
        onClose={() => {
          if (!isUpdating) {
            setSuspendTarget(null)
            setSuspendReason('')
            setSuspendReviewAfter('')
            setReasonError('')
          }
        }}
        title={suspendTarget?.status?.toLowerCase() === 'active' ? 'Suspend Customer Account' : 'Reinstate Customer Account'}
        description={
          suspendTarget?.status?.toLowerCase() === 'active'
            ? `Suspend ${suspendTarget?.name}. They will be placed on the blacklist and cannot book services.`
            : `Reinstate ${suspendTarget?.name}'s account so they can resume normal access.`
        }
      >
        <div className="space-y-4">
          <FormField
            label="Reason for status change *"
            error={reasonError}
            hint="An auditable reason is required for administrative status transitions (min 3 characters)."
          >
            <Textarea
              value={suspendReason}
              onChange={(e) => {
                setSuspendReason(e.target.value)
                if (e.target.value.trim().length >= 3) setReasonError('')
              }}
              placeholder="e.g. Account suspended due to repeatedly cancelled bookings / Client requested temporary pause..."
              rows={3}
              disabled={isUpdating}
            />
          </FormField>

          {suspendTarget?.status?.toLowerCase() === 'active' && (
            <FormField
              label="Review after"
              htmlFor="customer-suspend-review"
              hint="Leave empty for a permanent ban."
            >
              <Input
                id="customer-suspend-review"
                type="date"
                value={suspendReviewAfter}
                onChange={(e) => setSuspendReviewAfter(e.target.value)}
                disabled={isUpdating}
              />
            </FormField>
          )}

          {suspendTarget?.status?.toLowerCase() === 'active' && (
            <p className="rounded-xl bg-mint-50 px-3.5 py-3 text-xs leading-relaxed text-primary-900">
              Blacklist actions are permanently recorded in MongoDB with your admin actor attribution and prevent login or job acceptance.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setSuspendTarget(null)
                setSuspendReason('')
                setSuspendReviewAfter('')
                setReasonError('')
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant={suspendTarget?.status?.toLowerCase() === 'active' ? 'danger' : 'primary'}
              onClick={handleSuspendSubmit}
              disabled={isUpdating || suspendReason.trim().length < 3}
            >
              {isUpdating
                ? 'Updating…'
                : suspendTarget?.status?.toLowerCase() === 'active'
                  ? 'Suspend Account'
                  : 'Reinstate Account'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CustomersPage
