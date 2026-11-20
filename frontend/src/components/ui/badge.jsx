import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold leading-5 transition-colors',
  {
    variants: {
      variant: {
        neutral: 'border-slate-200 bg-slate-100 text-slate-700',
        indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
        teal: 'border-teal-200 bg-teal-50 text-teal-800',
        amber: 'border-amber-200 bg-amber-50 text-amber-900',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        warning: 'border-amber-200 bg-amber-50 text-amber-900',
        danger: 'border-rose-200 bg-rose-50 text-rose-800',
        info: 'border-sky-200 bg-sky-50 text-sky-800',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
)

export function Badge({ className, variant, tone, ...props }) {
  const mappedVariant = variant || tone || 'neutral'
  return <span data-slot="badge" className={cn(badgeVariants({ variant: mappedVariant }), className)} {...props} />
}

export { badgeVariants }
