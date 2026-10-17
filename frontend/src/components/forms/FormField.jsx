import { forwardRef } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

export const inputClass = (error, size = 'md') =>
  cn(
    'w-full rounded-xl border bg-white text-sm text-ink placeholder:text-faint transition',
    'focus:outline-none focus:ring-4',
    size === 'sm' ? 'h-10 px-3' : 'h-11 px-3.5',
    error
      ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-100'
      : 'border-line-strong focus:border-primary-400 focus:ring-primary-100',
  )

export function FormField({ label, htmlFor, error, hint, required, children, className, addon }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-semibold text-ink-soft">
          {label}
          {required ? <span className="text-danger-500">*</span> : null}
          {addon}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-danger-600" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef(function Input({ error, className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClass(error), className)} aria-invalid={Boolean(error)} {...props} />
})

export const Textarea = forwardRef(function Textarea({ error, className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(inputClass(error), 'h-auto resize-y py-2.5 leading-relaxed', className)}
      aria-invalid={Boolean(error)}
      {...props}
    />
  )
})

export const Select = forwardRef(function Select({ error, className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(inputClass(error), 'appearance-none pr-10 cursor-pointer', className)}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
    </div>
  )
})

export default FormField
