import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] transition-opacity',
        className
      )}
      {...props}
    />
  )
}

export function DialogContent({ className, children, wide = false, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        aria-describedby={undefined}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl focus:outline-none max-h-[90vh] overflow-y-auto',
          wide ? 'max-w-4xl' : 'max-w-lg',
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Đóng hộp thoại"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export function DialogHeader({ className, ...props }) {
  return <div data-slot="dialog-header" className={cn('flex flex-col space-y-1.5 pr-8 pb-4 border-b border-slate-100 mb-4', className)} {...props} />
}

export function DialogFooter({ className, ...props }) {
  return <div data-slot="dialog-footer" className={cn('flex flex-wrap items-center justify-end gap-2.5 pt-4 mt-5 border-t border-slate-100', className)} {...props} />
}

export function DialogTitle({ className, ...props }) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn('text-lg font-bold text-slate-900', className)} {...props} />
}

export function DialogDescription({ className, ...props }) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn('text-sm text-slate-600', className)} {...props} />
}
