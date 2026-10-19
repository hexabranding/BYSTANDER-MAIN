import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarClock, Download, FileSpreadsheet, Inbox, Plus, SearchX, TrendingUp } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { REPORTS } from '@/data/verifications'
import { REVENUE_SPLIT } from '@/data/charts'
import { downloadText, formatNumber, formatDate, toCSV, uid } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Modal'
import { EmptyState } from '@/components/common/States'
import { FormField, Input, Select } from '@/components/forms/FormField'
import { adminService } from '@/services/adminService'

const RANGES = [
  { id: 'all', label: 'All time' },
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
]

const REPORT_TYPES = [
  'Monthly booking & revenue report',
  'Caretaker verification audit',
  'Complaint resolution SLA report',
  'SOS incident audit trail',
  'Caretaker payout reconciliation',
  'Service distribution by city',
]

const PERIODS = ['Oct 2026 (H1)', 'Sep 2026', 'Q3 2026', 'FY 2026–27']
const FORMATS = ['CSV', 'PDF']

const TODAY_ISO = '2026-10-10'

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #E6ECF2',
  boxShadow: '0 10px 28px -18px rgba(16,42,67,0.35)',
  fontSize: 12,
  color: '#172B3A',
}

const rupeeTick = (v) => `₹${(v / 1000).toFixed(0)}k`

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const REPORT_STATUS = {
  Ready: { chip: 'bg-success-50 text-success-700 ring-success-500/40', dot: 'bg-success-500' },
  Processing: { chip: 'bg-accent-50 text-accent-600 ring-accent-500/40', dot: 'bg-accent-400' },
}

function ReportStatus({ status }) {
  const tone = REPORT_STATUS[status] || { chip: 'bg-slate-100 text-slate-600 ring-slate-400/40', dot: 'bg-slate-400' }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        tone.chip,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden="true" />
      {status}
    </span>
  )
}

export function ReportsPage() {
  useDocumentTitle('Reports')

  const [generated, setGenerated] = useState([])
  const [scheduled, setScheduled] = useState(2)
  const [range, setRange] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reports = useMemo(() => [...generated, ...REPORTS], [generated])

  const filtered = useMemo(() => {
    if (range === 'all') return reports
    const days = Number(range)
    const cutoff = new Date(2026, 9, 10)
    cutoff.setDate(cutoff.getDate() - days)
    const iso = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(
      cutoff.getDate(),
    ).padStart(2, '0')}`
    return reports.filter((r) => r.generatedOn >= iso)
  }, [reports, range])

  const stats = useMemo(
    () => ({
      total: reports.length,
      rows: reports.reduce((s, r) => s + r.rows, 0),
      last: reports.map((r) => r.generatedOn).sort().slice(-1)[0],
      ready: reports.filter((r) => r.status === 'Ready').length,
    }),
    [reports],
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    mode: 'onTouched',
    defaultValues: { type: REPORT_TYPES[0], period: PERIODS[0], format: 'CSV' },
  })

  const closeCreate = () => {
    setCreateOpen(false)
    reset()
  }

  const onCreate = async (values) => {
    setIsSubmitting(true)
    try {
      const res = await adminService.generateAdminReport({
        type: values.type,
        period: values.period,
        format: values.format,
      })
      if (res && res.report) {
        const report = {
          ...res.report,
          csvData: res.csvContent,
        }
        setGenerated((prev) => [report, ...prev])
        toast.success('Report generated', {
          description: `${report.title} · ${report.period} · ${report.format} is ready to download.`,
        })
        closeCreate()
        return
      }
    } catch (err) {
      console.warn('[Report Generation API Warning]', err.message)
    } finally {
      setIsSubmitting(false)
    }

    const report = {
      id: uid('RP'),
      title: values.type,
      period: values.period,
      generatedOn: TODAY_ISO,
      rows: 120 + Math.floor(Math.random() * 900),
      size: values.format === 'CSV' ? `${180 + Math.floor(Math.random() * 400)} KB` : `1.${1 + Math.floor(Math.random() * 8)} MB`,
      status: 'Ready',
      format: values.format,
    }
    setGenerated((prev) => [report, ...prev])
    toast.success('Report generated', {
      description: `${report.title} · ${report.period} · ${report.format} is ready to download.`,
    })
    closeCreate()
  }

  const handleDownload = (report) => {
    if (report.csvData) {
      downloadText(`${slug(report.title)}.csv`, report.csvData)
      toast.success('Report downloaded', { description: `${slug(report.title)}.csv is ready.` })
      return
    }
    const meta = [
      ['Report', report.title],
      ['Report ID', report.id],
      ['Period', report.period],
      ['Generated on', formatDate(report.generatedOn, { long: true })],
      ['Rows', String(report.rows)],
      ['File size', report.size],
      ['Status', report.status],
    ]
    const csv = [
      meta.map(([k, v]) => `"${k}","${v}"`).join(','),
      '',
      'Sample data source (monthly revenue split)',
      toCSV(REVENUE_SPLIT),
    ].join('\n')
    downloadText(`${slug(report.title)}.csv`, csv)
    toast.success('Report downloaded', { description: `${slug(report.title)}.csv is ready.` })
  }

  const handleSchedule = (report) => {
    setScheduled((n) => n + 1)
    toast.info(`Report scheduled · ${report.title}`, {
      description: `${report.period} will be regenerated every month and emailed to the ops inbox.`,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Generate, schedule and download operational reports for the CareMate platform."
        action={
          <Button icon={Plus} onClick={() => setCreateOpen(true)}>
            Generate new report
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Reports generated" value={stats.total} icon={FileSpreadsheet} tone="primary" hint={`${stats.ready} ready to download`} delay={0} />
        <StatCard label="Scheduled" value={scheduled} icon={CalendarClock} tone="accent" hint="Recurring deliveries" delay={0.05} />
        <StatCard
          label="Total rows"
          value={formatNumber(stats.rows)}
          icon={Inbox}
          tone="info"
          hint="Across every report"
          delay={0.1}
        />
        <StatCard label="Last generated" value={formatDate(stats.last)} icon={TrendingUp} tone="success" hint="Most recent run" delay={0.15} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <FormField label="Generated within" htmlFor="report-range">
            <Select id="report-range" value={range} onChange={(e) => setRange(e.target.value)}>
              {RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <p className="text-xs text-muted">
          {filtered.length} of {reports.length} reports in the selected window
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No reports in this window"
            description="Widen the date range or generate a new report for this period."
            action={
              <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                Generate new report
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <Card key={r.id} hover className="flex flex-col">
              <CardBody className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
                    <FileSpreadsheet className="h-5 w-5" />
                  </span>
                  <ReportStatus status={r.status} />
                </div>
                <div>
                  <p className="font-display text-sm font-bold leading-snug text-ink">{r.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {r.period} · generated {formatDate(r.generatedOn, { long: true })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>{formatNumber(r.rows)} rows</span>
                  <span>{r.size}</span>
                  {r.format ? <span className="font-semibold text-primary-700">{r.format}</span> : null}
                </div>
                <div className="mt-auto flex gap-2 pt-1">
                  <Button size="sm" variant="outline" icon={Download} onClick={() => handleDownload(r)}>
                    Download
                  </Button>
                  <Button size="sm" variant="ghost" icon={CalendarClock} onClick={() => handleSchedule(r)}>
                    Schedule
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader
          title="Revenue report data source"
          subtitle="The monthly revenue split used by the Monthly booking & revenue report"
          icon={TrendingUp}
        />
        <CardBody>
          <div dir="ltr" className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_SPLIT} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportRevFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F766E" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="#0F766E" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF2" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tickLine={false} axisLine={false} width={54} tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={rupeeTick} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [
                    formatNumber(value),
                    name === 'revenue' ? 'Revenue' : name === 'commission' ? 'Commission' : 'Payout',
                  ]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0F766E" strokeWidth={2.5} fill="url(#reportRevFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Preview only — the downloadable CSV contains the full monthly split with revenue, commission and payout
            columns.
          </p>
        </CardBody>
      </Card>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Generate new report"
        subtitle="Pick a report type, period and file format."
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeCreate}>
              Cancel
            </Button>
            <Button type="submit" form="generate-report-form" icon={FileSpreadsheet} loading={isSubmitting}>
              Generate report
            </Button>
          </div>
        }
      >
        <form id="generate-report-form" onSubmit={handleSubmit(onCreate)} noValidate className="space-y-4">
          <FormField label="Report type" htmlFor="report-type" required error={errors.type?.message}>
            <Select id="report-type" error={errors.type?.message} {...register('type', { required: 'Choose a report type' })}>
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Period" htmlFor="report-period" required error={errors.period?.message}>
              <Select id="report-period" error={errors.period?.message} {...register('period', { required: 'Choose a period' })}>
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Format" htmlFor="report-format" required error={errors.format?.message}>
              <Select id="report-format" error={errors.format?.message} {...register('format', { required: 'Choose a format' })}>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Delivery email (optional)" htmlFor="report-email" hint="Leave blank to keep the report in this dashboard only.">
            <Input id="report-email" type="email" placeholder="ops@caremate.in" {...register('email')} />
          </FormField>

          <p className="rounded-xl bg-mint-50 px-3.5 py-3 text-xs leading-relaxed text-primary-900">
            Generated reports appear at the top of the grid and are ready to download immediately.
          </p>
        </form>
      </Modal>
    </div>
  )
}

export default ReportsPage
