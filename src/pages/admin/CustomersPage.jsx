import { useEffect, useMemo, useState } from 'react'
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
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { CUSTOMERS } from '@/data/bookings'
import { formatDate, formatCurrency, maskEmail, maskPhone } from '@/utils/format'
import { formatDuration } from '@/utils/duration'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { EmptyState } from '@/components/common/States'
import { Select } from '@/components/forms/FormField'

const STATUS_TABS = ['All', 'Active', 'Inactive']

export function CustomersPage() {
  useDocumentTitle('Customers')

  const { bookings } = useData()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [city, setCity] = useState('All')
  const [viewingId, setViewingId] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [suspendTarget, setSuspendTarget] = useState(null)

  const debouncedSearch = useDebouncedValue(search)

  const customers = useMemo(() => CUSTOMERS.map((c) => ({ ...c, status: overrides[c.id] ?? c.status })), [overrides])

  const cities = useMemo(() => [...new Set(CUSTOMERS.map((c) => c.city))].sort(), [])

  const stats = useMemo(() => {
    const active = customers.filter((c) => c.status === 'Active').length
    const lifetime = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0)
    return { total: customers.length, active, inactive: customers.length - active, lifetime }
  }, [customers])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return customers.filter((c) => {
      const matchesStatus = status === 'All' || c.status === status
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

  const selectedBookings = useMemo(
    () =>
      selected
        ? bookings.filter((b) => b.customerId === selected.id).sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [bookings, selected],
  )

  const selectedSpend = selectedBookings
    .filter((b) => b.status !== 'Cancelled')
    .reduce((sum, b) => sum + (b.total || 0), 0)

  const handleSuspend = () => {
    if (!suspendTarget) return
    const next = suspendTarget.status === 'Active' ? 'Inactive' : 'Active'
    setOverrides((prev) => ({ ...prev, [suspendTarget.id]: next }))
    toast[next === 'Active' ? 'success' : 'error'](
      next === 'Active'
        ? `${suspendTarget.name}'s account reactivated`
        : `${suspendTarget.name}'s account suspended`,
      { description: next === 'Active' ? 'They can book and message caretakers again.' : 'New bookings are blocked until you reactivate.' },
    )
    setSuspendTarget(null)
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
            <p className="truncate text-xs text-faint">{c.area}</p>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (c) => <span className="tabular-nums">{maskEmail(c.email)}</span> },
    { key: 'phone', header: 'Phone', render: (c) => <span className="tabular-nums">{maskPhone(c.phone)}</span> },
    { key: 'city', header: 'City' },
    { key: 'totalBookings', header: 'Bookings', align: 'right' },
    {
      key: 'totalSpent',
      header: 'Total spent',
      align: 'right',
      render: (c) => <span className="font-semibold tabular-nums text-ink">{formatCurrency(c.totalSpent)}</span>,
    },
    { key: 'joinedOn', header: 'Joined', render: (c) => <span className="whitespace-nowrap">{formatDate(c.joinedOn)}</span> },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} size="sm" /> },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (c) => (
        <Button
          size="xs"
          variant="outline"
          icon={Eye}
          onClick={(e) => {
            e.stopPropagation()
            setViewingId(c.id)
          }}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Every registered family — contact details, booking history and lifetime value."
        action={
          <Button to="/admin/bookings" variant="outline" icon={CalendarDays}>
            Booking ledger
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total customers" value={stats.total} icon={Users} tone="primary" hint="All registered accounts" delay={0} />
        <StatCard label="Active" value={stats.active} icon={UserRound} tone="success" trend={8} hint="Currently booking" delay={0.05} />
        <StatCard label="Inactive" value={stats.inactive} icon={Ban} tone="warning" hint="Dormant or suspended" delay={0.1} />
        <StatCard
          label="Lifetime value"
          value={formatCurrency(stats.lifetime)}
          icon={IndianRupee}
          tone="accent"
          trend={13}
          hint="Gross value across all customers"
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
            count: s === 'All' ? customers.length : customers.filter((c) => c.status === s).length,
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

      {filtered.length === 0 ? (
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

      <Modal
        open={Boolean(selected)}
        onClose={() => setViewingId(null)}
        title={selected?.name || 'Customer'}
        subtitle={selected ? `Customer since ${formatDate(selected.joinedOn, { long: true })}` : ''}
        size="xl"
        footer={
          selected ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="dangerGhost"
                icon={Ban}
                onClick={() => setSuspendTarget(selected)}
              >
                {selected.status === 'Active' ? 'Suspend account' : 'Reactivate account'}
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" icon={MessageSquare} onClick={() => toast.info(`Message thread opened with ${selected.name}`, { description: 'Replies land in the shared admin inbox.' })}>
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
                    <Mail className="h-3.5 w-3.5" /> {selected.email}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {selected.phone}
                  </span>
                </div>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted">
                  <MapPin className="h-3.5 w-3.5" /> {selected.address}
                </p>
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
                <CardHeader title="Patient information" subtitle="Care recipient on file" />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Patient name</span>
                    <span className="font-semibold text-ink">{selected.patientInfo?.name || '—'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Age</span>
                    <span className="font-semibold text-ink">{selected.patientInfo?.age ?? '—'} yrs</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Relation</span>
                    <span className="font-semibold text-ink">{selected.patientInfo?.relation || '—'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Condition</span>
                    <span className="max-w-[60%] text-right font-semibold text-ink">
                      {selected.patientInfo?.condition || '—'}
                    </span>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Address" subtitle="Service location" />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Street address</span>
                    <span className="max-w-[65%] text-right font-semibold text-ink">{selected.address}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Area</span>
                    <span className="font-semibold text-ink">{selected.area}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">City</span>
                    <span className="font-semibold text-ink">{selected.city}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Spend in context bookings</span>
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
                {selectedBookings.length ? (
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

      <ConfirmationDialog
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        onConfirm={handleSuspend}
        tone={suspendTarget?.status === 'Active' ? 'danger' : 'success'}
        title={suspendTarget?.status === 'Active' ? 'Suspend this account?' : 'Reactivate this account?'}
        message={
          suspendTarget?.status === 'Active'
            ? `${suspendTarget?.name} will not be able to book caretakers or start new conversations. Existing bookings stay unaffected and you can reactivate at any time.`
            : `${suspendTarget?.name} will be able to book caretakers and message the care team again.`
        }
        confirmLabel={suspendTarget?.status === 'Active' ? 'Suspend account' : 'Reactivate account'}
      />
    </div>
  )
}

export default CustomersPage
