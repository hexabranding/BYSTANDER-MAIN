import { useState } from 'react'
import { Camera, Check, CircleDashed, Eye, MapPin } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatCurrency, formatDate, formatTime } from '@/utils/format'
import { Modal } from '@/components/common/Modal'

export function BookingTimeline({ steps = [], className, onPay, payLoading = false }) {
  const [viewingSelfie, setViewingSelfie] = useState(null)

  return (
    <>
      <ol className={cn('relative space-y-0', className)}>
        {steps.map((step, i) => {
          const done = step.status === 'completed'
          const active = step.status === 'active'
          const last = i === steps.length - 1
          const isRealSelfie =
            typeof step.selfieUrl === 'string' &&
            (step.selfieUrl.startsWith('data:image/') ||
              step.selfieUrl.startsWith('http://') ||
              step.selfieUrl.startsWith('https://') ||
              step.selfieUrl.startsWith('/'))

          return (
            <li key={`${step.label}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
              {!last ? (
                <span
                  className={cn(
                    'absolute left-[13px] top-7 h-[calc(100%-16px)] w-px',
                    done ? 'bg-primary-300' : 'bg-line',
                  )}
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={cn(
                  'relative z-10 grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full border-2 bg-white',
                  done
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : active
                      ? 'border-amber-500 bg-amber-50 text-amber-600'
                      : 'border-line-strong text-faint',
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : active ? (
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                ) : (
                  <CircleDashed className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0 pt-0.5 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className={cn('text-sm font-semibold', done ? 'text-ink' : active ? 'text-amber-800 font-bold' : 'text-muted')}>
                    {step.label}
                  </p>
                  {step.needsPayment && onPay ? (
                    <button
                      type="button"
                      onClick={onPay}
                      disabled={payLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-primary-800 disabled:opacity-50 cursor-pointer"
                    >
                      💳 {payLoading ? 'Opening Razorpay…' : 'Pay Now via Razorpay'}
                    </button>
                  ) : null}
                </div>
                {step.at ? (
                  <p className="mt-0.5 text-xs text-faint">
                    {formatDate(step.at)} · {formatTime(step.at)}
                  </p>
                ) : (
                  <p className={cn('mt-0.5 text-xs', active ? 'text-amber-600 font-medium' : 'text-faint')}>
                    {step.needsPayment ? 'Shift completed — customer payment settlement required' : 'Pending'}
                  </p>
                )}
                {step.note ? <p className="mt-1 text-xs leading-relaxed text-muted">{step.note}</p> : null}

                {/* Real Verified Attendance Selfie Card */}
                {isRealSelfie ? (
                  <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-line bg-canvas/70 p-2.5 max-w-sm transition hover:border-primary-300">
                    <button
                      type="button"
                      onClick={() =>
                        setViewingSelfie({
                          url: step.selfieUrl,
                          title: step.label,
                          at: step.at,
                          location: step.location,
                        })
                      }
                      className="relative group shrink-0 overflow-hidden rounded-lg border border-line bg-slate-100 cursor-pointer"
                      title="Click to inspect full photo"
                    >
                      <img
                        src={step.selfieUrl}
                        alt={`${step.label} attendance selfie`}
                        className="h-12 w-12 object-cover rounded-md transition group-hover:scale-105"
                      />
                      <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <Eye className="h-4 w-4" />
                      </span>
                    </button>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          <Camera className="h-2.5 w-2.5 text-emerald-600" />
                          Attendance Selfie
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setViewingSelfie({
                            url: step.selfieUrl,
                            title: step.label,
                            at: step.at,
                            location: step.location,
                          })
                        }
                        className="mt-0.5 font-semibold text-primary-700 hover:underline cursor-pointer block text-left"
                      >
                        View captured selfie
                      </button>
                      {step.location ? (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted truncate">
                          <MapPin className="h-3 w-3 shrink-0 text-primary-600" />
                          <span className="truncate">{step.location}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Lightbox Modal for Full Attendance Selfie Inspection */}
      <Modal
        open={Boolean(viewingSelfie)}
        onClose={() => setViewingSelfie(null)}
        title={viewingSelfie?.title ? `${viewingSelfie.title} — Verified Selfie` : 'Attendance Selfie'}
        subtitle={
          viewingSelfie?.at
            ? `Captured & verified at ${formatDate(viewingSelfie.at)} · ${formatTime(viewingSelfie.at)}`
            : 'Live check-in / check-out verification photo'
        }
        size="md"
      >
        {viewingSelfie ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-line bg-black/5 shadow-inner flex items-center justify-center">
              <img
                src={viewingSelfie.url}
                alt="Captured attendance verification selfie"
                className="max-h-[60vh] w-full object-contain rounded-2xl"
              />
            </div>
            {viewingSelfie.location ? (
              <div className="flex items-start gap-2 rounded-xl border border-line bg-canvas p-3 text-xs text-muted">
                <MapPin className="h-4 w-4 shrink-0 text-primary-600 mt-0.5" />
                <div>
                  <span className="font-bold text-ink">Recorded Location:</span> {viewingSelfie.location}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  )
}

export function PriceBreakdown({
  items = [],
  subtotal,
  platformFee = 0,
  tax = 0,
  commission,
  total,
  currencyNote,
  className,
}) {
  const computedTotal = total ?? subtotal + platformFee + tax
  return (
    <div className={cn('rounded-card border border-line bg-white p-5', className)}>
      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-faint">Price breakdown</h3>

      {items.length ? (
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-start justify-between gap-4 text-sm">
              <span className="text-muted">
                {item.label}
                {item.meta ? <span className="block text-xs text-faint">{item.meta}</span> : null}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">{formatCurrency(item.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 space-y-2.5 border-t border-dashed border-line pt-4">
        <Row label="Care charges subtotal" value={formatCurrency(subtotal)} />
        <Row label="Platform charges" value={formatCurrency(platformFee)} />
        <Row label="GST (18%)" value={formatCurrency(tax)} />
        {commission !== undefined ? (
          <Row label="Platform commission (12%)" value={`− ${formatCurrency(commission)}`} muted />
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-mint-100 px-4 py-3">
        <span className="text-sm font-bold text-primary-900">Total payable</span>
        <span className="font-display text-lg font-extrabold tabular-nums text-primary-800">
          {formatCurrency(computedTotal)}
        </span>
      </div>
      {currencyNote ? <p className="mt-3 text-xs leading-relaxed text-muted">{currencyNote}</p> : null}
    </div>
  )
}

function Row({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn('font-semibold tabular-nums', muted ? 'text-muted' : 'text-ink')}>{value}</span>
    </div>
  )
}

export default BookingTimeline
