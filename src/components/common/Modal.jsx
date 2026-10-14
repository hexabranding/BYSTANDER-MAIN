import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useLockBodyScroll } from '@/hooks/useUi'

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[min(96vw,72rem)]',
}

export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer, hideClose = false }) {
  useLockBodyScroll(open)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              className="fixed inset-0 bg-[#0B1F2C]/55 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className={cn(
                'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-white shadow-raised sm:rounded-2xl',
                sizes[size],
              )}
            >
              <div className="flex items-start justify-between gap-4 border-b border-line bg-gradient-to-r from-mint-50 to-white px-5 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
                  {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
                </div>
                {!hideClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
                    aria-label="Close dialog"
                  >
                    <X className="h-4.5 w-4.5" size={18} />
                  </button>
                ) : null}
              </div>
              <div className="thin-scrollbar flex-1 overflow-y-auto px-5 py-5">{children}</div>
              {footer ? <div className="border-t border-line bg-slate-50/70 px-5 py-4">{footer}</div> : null}
            </motion.div>
          </div>
      ) : null}
    </AnimatePresence>
  )
}

export default Modal
