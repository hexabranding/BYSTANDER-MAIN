import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/utils/cn'

const tones = {
  primary: 'bg-mint-100 text-primary-700',
  accent: 'bg-accent-100 text-accent-600',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-600',
  info: 'bg-info-50 text-info-700',
}

export function StatCard({ label, value, icon: Icon, trend, tone = 'primary', hint, className, delay = 0 }) {
  const positive = typeof trend === 'number' && trend >= 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn('rounded-card border border-line bg-white p-4 shadow-card sm:p-5', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-faint">{label}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-ink tabular-nums">{value}</p>
        </div>
        {Icon ? (
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
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
