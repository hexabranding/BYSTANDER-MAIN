import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

/**
 * Page-width gutter container. Single source of truth for the
 * `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` rhythm used across the app.
 *
 * `relative` is built in so decorative backgrounds (blurred blobs,
 * grid patterns) positioned against the section always stay behind
 * the content — callers don't need to ask for it.
 */
const widths = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  full: 'max-w-[100rem]',
}

export const Container = forwardRef(function Container(
  { as: Tag = 'div', size = 'lg', className, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cn('relative mx-auto w-full px-4 sm:px-6 lg:px-8', widths[size], className)}
      {...props}
    />
  )
})

export default Container
