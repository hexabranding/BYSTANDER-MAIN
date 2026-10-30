import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Clock, Download, IndianRupee, Printer, Receipt, RotateCcw, SearchX } from 'lucide-react'
import { useDocumentTitle, useDebouncedValue } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { GST_RATE, PLATFORM_FEE } from '@/utils/constants'
import { downloadText, formatCurrency, formatDate } from '@/utils/format'
import { durationBasis, formatDuration } from '@/utils/duration'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Button } from '@/components/common/Button'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs, Chip } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { EmptyState } from '@/components/common/States'
import { Logo } from '@/components/common/Logo'
import { bookingService } from '@/services/bookingService'

const PRINT_CSS = `
@media print {
  html, body { height: auto !important; overflow: visible !important; }
  body * { visibility: hidden !important; }
  .print-invoice, .print-invoice * { visibility: visible !important; }
  .print-invoice {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    background: #fff;
  }
}
`

function invoiceTotals(b) {
  const subtotal = b.breakdown?.baseAmount ?? b.subtotal ?? (b.hourlyRate || 0) * (b.hours || 0)
  const platformFee = b.breakdown?.platformFee ?? b.platformFee ?? PLATFORM_FEE
  const tax = b.breakdown?.tax ?? b.tax ?? Math.round((subtotal + platformFee) * GST_RATE)
  const total = b.totalAmount ?? b.total ?? subtotal + platformFee + tax
  return { subtotal, platformFee, tax, total }
}

function InvoiceSheet({ booking, caregiverName, customer }) {
  const { subtotal, platformFee, tax, total } = invoiceTotals(booking)
  const patient = booking.patientDetails || booking.patient || {}
  const cust = customer || booking.customer || {}
  const cgName = caregiverName || booking.caregiverName || booking.caregiverUser?.fullName || 'Caregiver'

  const details = [
    { label: 'Service', value: booking.service || booking.serviceName },
    { label: 'Care type', value: booking.careType || 'Home Care' },
    { label: 'Caretaker', value: cgName },
    { label: 'Booking ID', value: booking.id },
    { label: 'Service date', value: formatDate(booking.date || booking.startDateTime, { long: true }) },
    { label: 'Duration', value: `${booking.startTime || '09:00'} · ${formatDuration(booking.hours, { short: true })}` },
    { label: 'Patient', value: `${patient.name || '—'} · ${patient.age || '—'} yrs · ${patient.relation || '—'}` },
    { label: 'Reference', value: booking.ref || '—' },
  ]

  const lineItems = [
    { label: 'Care charges', meta: `${durationBasis(booking.hours)} × ${formatCurrency(booking.hourlyRate)}/hr`, amount: subtotal },
    { label: 'Platform handling fee', meta: 'Booking, support and escrow handling', amount: platformFee },
    { label: `GST @ ${Math.round(GST_RATE * 100)}%`, meta: 'Applicable on platform services', amount: tax },
  ]

  return (
    <div className="rounded-card border border-line bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-primary-700 pb-5">
        <Logo to="/admin/invoices" />
        <div className="text-right text-[11px] leading-relaxed text-muted">
          <p className="font-display text-sm font-bold text-ink">Bystander Healthcare Technologies Pvt. Ltd.</p>
          <p>4th Floor, One BKC, Bandra East, Mumbai 400051</p>
          <p>GSTIN 27AAECC1234F1Z5 · support@bystander.care</p>
          <p>+91 22 4890 1122</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Tax invoice</p>
          <p className="mt-0.5 font-display text-xl font-extrabold text-ink">{booking.invoiceNo || booking.id}</p>
          <p className="mt-1 text-xs text-muted">
            Issued on {formatDate(booking.createdAt, { long: true })} · Booking {booking.id}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={booking.paymentStatus || 'Paid'} />
          <span className="text-[11px] text-faint">Due on receipt</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Billed to</p>
          <p className="mt-1.5 text-sm font-bold text-ink">{cust.name || cust.fullName || 'Customer'}</p>
          <p className="text-xs text-muted">{cust.email || '—'}</p>
          <p className="text-xs text-muted">{cust.phone || '—'}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{cust.address || booking.address || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Service location</p>
          <p className="mt-1.5 text-sm font-bold text-ink">{booking.city || '—'}</p>
          <p className="text-xs leading-relaxed text-muted">{booking.address || '—'}</p>
          <p className="mt-1 text-xs text-muted">Patient: {patient.name || '—'}</p>
        </div>
      </div>

      <p className="mt-6 text-[10px] font-bold uppercase tracking-wider text-faint">Booking details</p>
      <dl className="mt-2 grid gap-x-6 sm:grid-cols-2">
        {details.map((d) => (
          <div key={d.label} className="flex items-start justify-between gap-4 border-b border-line py-2.5">
            <dt className="text-xs font-semibold uppercase tracking-wider text-faint">{d.label}</dt>
            <dd className="text-right text-sm font-semibold text-ink">{d.value}</dd>
          </div>
        ))}
        <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 sm:col-span-2">
          <dt className="shrink-0 text-xs font-semibold uppercase tracking-wider text-faint">Address</dt>
          <dd className="max-w-md text-right text-sm font-semibold text-ink">{booking.address || '—'}</dd>
        </div>
      </dl>

      <p className="mt-6 text-[10px] font-bold uppercase tracking-wider text-faint">Line items</p>
      <div className="mt-2 overflow-hidden rounded-xl border border-line">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-slate-50">
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-faint">Description</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-faint">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lineItems.map((item) => (
              <tr key={item.label}>
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-muted">{item.meta}</p>
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-ink">
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1 text-xs text-muted">
          <p>Payment is held in escrow and released after the service is marked complete.</p>
          <p>Cancellations 6+ hours before the visit are refunded in 3–5 working days.</p>
          <p>GST is charged at 18% on platform services as applicable under Indian law.</p>
        </div>
        <div className="w-full rounded-xl bg-mint-100 px-4 py-3 sm:w-64">
          <div className="flex items-center justify-between text-xs text-primary-900">
            <span>Subtotal</span>
            <span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-primary-900">
            <span>Platform fee + GST</span>
            <span className="font-semibold tabular-nums">{formatCurrency(platformFee + tax)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-primary-200 pt-2">
            <span className="text-sm font-bold text-primary-900">Total payable</span>
            <span className="font-display text-lg font-extrabold tabular-nums text-primary-800">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-6 border-t border-dashed border-line pt-4 text-center text-[11px] font-medium text-faint">
        Digitally generated tax invoice under IT Act 2000 & Section 65B(44) of Finance Act. Platform escrow protected.
      </p>
    </div>
  )
}

function buildInvoiceText(b, caregiverName, customer) {
  const { subtotal, platformFee, tax, total } = invoiceTotals(b)
  const patient = b.patientDetails || b.patient || {}
  const cust = customer || b.customer || {}
  const customerName = cust.fullName || cust.name || b.customerName || '—'
  const customerEmail = cust.email || b.customer?.email || '—'
  const customerPhone = cust.phone || b.customer?.phone || '—'
  const customerAddress = cust.address || b.address || '—'
  const cgName = caregiverName || b.caregiverName || b.caregiverUser?.fullName || 'Caregiver'

  const pad = (label, value) => `${label.padEnd(22, '.')}${value}`
  return [
    'BYSTANDER — VERIFIED HEALTHCARE & HOME CARE',
    'Bystander Healthcare Technologies Pvt. Ltd. · One BKC, Bandra East, Mumbai 400051',
    'GSTIN 27AAECC1234F1Z5 · support@bystander.care · +91 22 4890 1122',
    '',
    'TAX INVOICE',
    '-'.repeat(56),
    pad('Invoice number', b.invoiceNo || b.id),
    pad('Invoice date', formatDate(b.createdAt, { long: true })),
    pad('Payment status', b.paymentStatus || 'Paid'),
    '',
    'BILLED TO',
    '-'.repeat(56),
    pad('Customer', customerName),
    pad('Email', customerEmail),
    pad('Phone', customerPhone),
    pad('Address', customerAddress),
    '',
    'BOOKING DETAILS',
    '-'.repeat(56),
    pad('Booking ID', b.id),
    pad('Reference', b.ref || '—'),
    pad('Service', b.service || b.serviceName),
    pad('Care type', b.careType || 'Home Care'),
    pad('Caretaker', cgName),
    pad('Patient', `${patient.name || '—'} (${patient.age || '—'} yrs, ${patient.relation || '—'})`),
    pad('Service date', formatDate(b.date || b.startDateTime, { long: true })),
    pad('Duration', `${b.startTime || '09:00'} · ${formatDuration(b.hours, { short: true })}`),
    pad('Address', b.address || customerAddress),
    '',
    'LINE ITEMS',
    '-'.repeat(56),
    pad(`Care charges (${durationBasis(b.hours)} x ${formatCurrency(b.hourlyRate)})`, formatCurrency(subtotal)),
    pad('Platform handling fee', formatCurrency(platformFee)),
    pad(`GST @ ${Math.round(GST_RATE * 100)}%`, formatCurrency(tax)),
    '-'.repeat(56),
    pad('TOTAL PAYABLE', formatCurrency(total)),
    '',
    'Digitally generated tax invoice under IT Act 2000. Valid without physical signature.',
  ].join('\n')
}

export function InvoicesPage() {
  useDocumentTitle('Invoices')

  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [selectedId, setSelectedId] = useState(null)
  const debouncedSearch = useDebouncedValue(search)

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    bookingService
      .getBookings({ limit: 50 })
      .then((res) => {
        if (!mounted) return
        if (Array.isArray(res?.bookings)) {
          setInvoices(res.bookings)
        }
      })
      .catch((err) => {
        console.warn('[Admin Invoices Fetch Warning]', err.message)
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const selected = invoices.find((b) => b.id === selectedId) || null

  const statusTabs = useMemo(() => {
    const seen = []
    invoices.forEach((b) => {
      if (b.paymentStatus && !seen.includes(b.paymentStatus)) seen.push(b.paymentStatus)
    })
    return ['All', ...seen]
  }, [invoices])

  const stats = useMemo(() => {
    const sum = (fn) => invoices.filter(fn).reduce((s, b) => s + (b.total || b.totalAmount || 0), 0)
    return {
      total: invoices.reduce((s, b) => s + (b.total || b.totalAmount || 0), 0),
      paid: sum((b) => b.paymentStatus === 'Paid'),
      refunded: sum((b) => b.paymentStatus === 'Refunded'),
      outstanding: sum((b) => b.paymentStatus !== 'Paid' && b.paymentStatus !== 'Refunded'),
      outstandingCount: invoices.filter((b) => b.paymentStatus !== 'Paid' && b.paymentStatus !== 'Refunded').length,
    }
  }, [invoices])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return invoices.filter((b) => {
      const customerName = b.customer?.fullName || b.customer?.name || b.customerName || ''
      const matchesStatus = status === 'All' || b.paymentStatus === status
      const matchesSearch =
        !q ||
        [b.invoiceNo, b.id, b.ref, b.service, customerName].join(' ').toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [invoices, debouncedSearch, status])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status])

  const handleDownload = (b) => {
    const content = buildInvoiceText(b, b.caregiverName, b.customer)
    downloadText(`${b.invoiceNo || b.id}.txt`, content, 'text/plain')
    toast.success('Invoice downloaded', { description: `${b.invoiceNo || b.id}.txt is ready.` })
  }

  const columns = [
    {
      key: 'invoiceNo',
      header: 'Invoice no',
      render: (b) => (
        <div>
          <p className="font-display text-sm font-bold text-ink">{b.invoiceNo || b.id}</p>
          <p className="text-xs text-faint">{b.ref}</p>
        </div>
      ),
    },
    { key: 'id', header: 'Booking', render: (b) => <span className="text-primary-700">{b.id}</span> },
    {
      key: 'customer',
      header: 'Customer',
      sortKey: 'customerName',
      render: (b) => b.customer?.fullName || b.customer?.name || b.customerName || '—',
    },
    { key: 'service', header: 'Service' },
    {
      key: 'date',
      header: 'Date',
      render: (b) => <span className="whitespace-nowrap font-medium text-ink">{formatDate(b.date || b.startDateTime, { long: true })}</span>,
    },
    {
      key: 'total',
      header: 'Amount',
      align: 'right',
      render: (b) => <span className="font-semibold tabular-nums text-ink">{formatCurrency(b.total || b.totalAmount)}</span>,
    },
    {
      key: 'paymentStatus',
      header: 'Payment status',
      render: (b) => <StatusBadge status={b.paymentStatus || 'Paid'} size="sm" />,
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (b) => (
        <Button
          size="xs"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedId(b.id)
          }}
        >
          View
        </Button>
      ),
    },
  ]

  if (!isLoading && !invoices.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoices" subtitle="Every GST invoice generated against a Bystander booking." />
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={Receipt}
            title="No invoices generated yet"
            description="Invoices are created automatically as soon as a booking is confirmed."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <style>{PRINT_CSS}</style>

      <PageHeader
        title="Invoices"
        subtitle="All invoiced bookings across the platform — view, print or download any copy."
        meta={
          <>
            <Chip>{`${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'}`}</Chip>
            <Chip>{`${formatCurrency(stats.total)} invoiced`}</Chip>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total invoiced"
          value={formatCurrency(stats.total)}
          icon={IndianRupee}
          tone="primary"
          hint={`${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'} generated`}
          delay={0}
        />
        <StatCard
          label="Paid"
          value={formatCurrency(stats.paid)}
          icon={CheckCircle2}
          tone="success"
          hint="Settled in full"
          delay={0.05}
        />
        <StatCard
          label="Refunded"
          value={formatCurrency(stats.refunded)}
          icon={RotateCcw}
          tone="warning"
          hint="Returned to customers"
          delay={0.1}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(stats.outstanding)}
          icon={Clock}
          tone="info"
          hint={`${stats.outstandingCount} invoices in escrow or due`}
          delay={0.15}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search invoice no, booking or customer…"
          className="sm:max-w-sm sm:flex-1"
        />
        <Tabs
          tabs={statusTabs.map((s) => ({
            id: s,
            label: s,
            count: s === 'All' ? invoices.length : invoices.filter((b) => b.paymentStatus === s).length,
          }))}
          active={status}
          onChange={setStatus}
          size="sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No invoices found"
            description="Try clearing the search or switching the payment status tab."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
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
            onRowClick={(row) => setSelectedId(row.id)}
            initialSort={{ key: 'date', dir: 'desc' }}
            emptyTitle="No invoices found"
            emptyIcon={Receipt}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      {selected ? (
        <div className="print-invoice hidden print:block">
          <InvoiceSheet
            booking={selected}
            caregiverName={selected.caregiverName}
            customer={selected.customer}
          />
        </div>
      ) : null}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? `Invoice ${selected.invoiceNo || selected.id}` : 'Invoice'}
        subtitle={selected ? `${selected.service} · ${formatDate(selected.date, { long: true })}` : ''}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setSelectedId(null)}>
              Close
            </Button>
            <Button variant="outline" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
            <Button icon={Download} onClick={() => selected && handleDownload(selected)}>
              Download
            </Button>
          </div>
        }
      >
        {selected ? (
          <InvoiceSheet
            booking={selected}
            caregiverName={selected.caregiverName}
            customer={selected.customer}
          />
        ) : null}
      </Modal>
    </div>
  )
}

export default InvoicesPage
