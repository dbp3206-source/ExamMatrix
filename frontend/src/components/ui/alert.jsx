import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed',
  {
    variants: {
      variant: {
        default: 'border-slate-200 bg-white text-slate-800',
        info: 'border-sky-200 bg-sky-50 text-sky-900',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        warning: 'border-amber-200 bg-amber-50 text-amber-900',
        destructive: 'border-rose-200 bg-rose-50 text-rose-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export function Alert({ className, variant, ...props }) {
  return <div role="alert" data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

export function AlertTitle({ className, ...props }) {
  return <div data-slot="alert-title" className={cn('font-semibold leading-tight', className)} {...props} />
}

export function AlertDescription({ className, ...props }) {
  return <div data-slot="alert-description" className={cn('text-sm opacity-95', className)} {...props} />
}
