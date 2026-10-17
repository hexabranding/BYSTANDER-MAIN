import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/utils/cn'

const tones = {
  primary: 'bg-gradient-to-br from-mint-100 to-mint-300 text-primary-700',
  accent: 'bg-gradient-to-br from-accent-100 to-accent-200 text-accent-600',
  success: 'bg-gradient-to-br from-success-50 to-success-100 text-success-700',
  warning: 'bg-gradient-to-br from-warning-50 to-warning-100 text-warning-700',
  danger: 'bg-gradient-to-br from-danger-50 to-danger-100 text-danger-600',
  info: 'bg-gradient-to-br from-info-50 to-info-100 text-info-700',
}

/** Hairline that lights up along the top edge on hover. */
const accents = {
  primary: 'from-primary-500 to-primary-700',
  accent: 'from-accent-400 to-accent-600',
  success: 'from-success-500 to-success-700',
  warning: 'from-warning-400 to-warning-500',
  danger: 'from-danger-500 to-danger-700',
  info: 'from-info-500 to-info-700',
}

export function StatCard({ label, value, icon: Icon, trend, tone = 'primary', hint, className, delay = 0 }) {
  const positive = typeof trend === 'number' && trend >= 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn(
        'group relative overflow-hidden rounded-card border border-line bg-white p-4 shadow-card transition duration-300',
        'hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-raised sm:p-5',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100',
          accents[tone],
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-faint">{label}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-ink tabular-nums">{value}</p>
        </div>
        {Icon ? (
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-105',
              tones[tone],
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      {trend !== undefined || hint ? (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend !== undefined ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold',
                positive ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-600',
              )}
            >
              {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend)}%
            </span>
          ) : null}
          {hint ? <span className="truncate text-muted">{hint}</span> : null}
        </div>
      ) : null}
    </motion.div>
  )
}

export default StatCard
