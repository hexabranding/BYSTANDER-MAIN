import { AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Non-disruptive banner displayed when data is served via static fallback
 * due to network or backend server failure.
 */
export function FallbackNotice({ message, className }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-warning-200 bg-warning-50/90 px-3.5 py-2.5 text-xs font-medium text-warning-800 shadow-sm',
        className,
      )}
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-warning-600" />
      <span>
        {message ||
          'Offline Preview: Displaying local catalog data while the live server is unreachable. Sample profiles and rates are for preview purposes only.'}
      </span>
    </div>
  )
}

export default FallbackNotice
