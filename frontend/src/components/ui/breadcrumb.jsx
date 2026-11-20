import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function Breadcrumb({ className, ...props }) {
  return <nav aria-label="Breadcrumb" data-slot="breadcrumb" className={cn('min-w-0', className)} {...props} />
}

export function BreadcrumbList({ className, ...props }) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn('flex flex-wrap items-center gap-1.5 text-sm text-slate-500', className)}
      {...props}
    />
  )
}

export function BreadcrumbItem({ className, ...props }) {
  return <li data-slot="breadcrumb-item" className={cn('inline-flex items-center gap-1.5 min-w-0', className)} {...props} />
}

export function BreadcrumbLink({ to, className, children, ...props }) {
  return (
    <Link
      to={to}
      data-slot="breadcrumb-link"
      className={cn('transition-colors hover:text-slate-900 truncate', className)}
      {...props}
    >
      {children}
    </Link>
  )
}

export function BreadcrumbPage({ className, ...props }) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn('font-semibold text-slate-900 truncate', className)}
      {...props}
    />
  )
}

export function BreadcrumbSeparator({ className, children }) {
  return (
    <li role="presentation" aria-hidden="true" className={cn('text-slate-400', className)}>
      {children || <ChevronRight className="h-3.5 w-3.5" />}
    </li>
  )
}
