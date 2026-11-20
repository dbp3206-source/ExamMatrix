import { cn } from '@/lib/utils'

export function Table({ className, containerClassName, ...props }) {
  return (
    <div data-slot="table-container" className={cn('relative w-full overflow-x-auto rounded-xl border border-slate-200 bg-white', containerClassName)}>
      <table data-slot="table" className={cn('w-full caption-bottom text-sm text-left', className)} {...props} />
    </div>
  )
}

export function TableHeader({ className, ...props }) {
  return <thead data-slot="table-header" className={cn('bg-slate-50/90 border-b border-slate-200 [&_tr]:border-b-0', className)} {...props} />
}

export function TableBody({ className, ...props }) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableRow({ className, ...props }) {
  return (
    <tr
      data-slot="table-row"
      className={cn('border-b border-slate-100 transition-colors hover:bg-slate-50/70 data-[selected=true]:bg-indigo-50/60', className)}
      {...props}
    />
  )
}

export function TableHead({ className, ...props }) {
  return (
    <th
      data-slot="table-head"
      className={cn('h-11 px-4 text-left align-middle text-xs font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap', className)}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }) {
  return <td data-slot="table-cell" className={cn('px-4 py-3 align-middle text-slate-800', className)} {...props} />
}
