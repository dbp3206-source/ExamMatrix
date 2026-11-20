import { cn } from '@/lib/utils'

export function Label({ className, ...props }) {
  return (
    <label
      data-slot="label"
      className={cn('block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5', className)}
      {...props}
    />
  )
}
