declare module '@/components/ui/alert' {
  import type { HTMLAttributes, ReactNode } from 'react'
  export function Alert(props: HTMLAttributes<HTMLDivElement> & { variant?: string; children?: ReactNode }): ReactNode
  export function AlertDescription(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): ReactNode
}

declare module '@/components/ui/badge' {
  import type { HTMLAttributes, ReactNode } from 'react'
  export function Badge(props: HTMLAttributes<HTMLSpanElement> & { variant?: string; tone?: string; children?: ReactNode }): ReactNode
}

declare module '@/components/ui/button' {
  import type { ButtonHTMLAttributes, ReactNode } from 'react'
  export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string; asChild?: boolean; children?: ReactNode }): ReactNode
}

declare module '@/components/ui/card' {
  import type { HTMLAttributes, ReactNode } from 'react'
  export function Card(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): ReactNode
  export function CardHeader(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): ReactNode
  export function CardTitle(props: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }): ReactNode
  export function CardDescription(props: HTMLAttributes<HTMLParagraphElement> & { children?: ReactNode }): ReactNode
  export function CardContent(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): ReactNode
}

declare module '@/components/ui/dialog' {
  import type { HTMLAttributes, ReactNode } from 'react'
  export function Dialog(props: { open?: boolean; onOpenChange?: (open: boolean) => void; children?: ReactNode }): ReactNode
  export function DialogContent(props: HTMLAttributes<HTMLDivElement> & { wide?: boolean; children?: ReactNode }): ReactNode
  export function DialogHeader(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): ReactNode
  export function DialogTitle(props: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }): ReactNode
  export function DialogFooter(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): ReactNode
}

declare module '@/components/ui/input' {
  import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
  export function Input(props: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }): ReactNode
}

declare module '@/components/ui/label' {
  import type { LabelHTMLAttributes, ReactNode } from 'react'
  export function Label(props: LabelHTMLAttributes<HTMLLabelElement> & { children?: ReactNode }): ReactNode
}

declare module '@/components/ui/select' {
  import type { SelectHTMLAttributes, ReactNode, Ref } from 'react'
  export function Select(props: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement>; children?: ReactNode }): ReactNode
}

declare module '@/components/ui/textarea' {
  import type { TextareaHTMLAttributes, ReactNode, Ref } from 'react'
  export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }): ReactNode
}

declare module '@/components/ui/tabs' {
  import type { HTMLAttributes, ReactNode } from 'react'
  export function Tabs(props: { value?: string; onValueChange?: (value: string) => void; className?: string; children?: ReactNode }): ReactNode
  export function TabsList(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): ReactNode
  export function TabsTrigger(props: HTMLAttributes<HTMLButtonElement> & { value: string; children?: ReactNode }): ReactNode
  export function TabsContent(props: HTMLAttributes<HTMLDivElement> & { value: string; children?: ReactNode }): ReactNode
}

declare module '@/components/ui/data-table' {
  import type { ReactNode } from 'react'
  export function DataTable<T = unknown>(props: {
    columns: unknown[]
    data: T[]
    onRowClick?: (row: T) => void
    selectedRowId?: string | number | null
    getRowId?: (row: T) => string
    emptyText?: string
    emptyMessage?: string
    containerClassName?: string
  }): ReactNode
}

declare module '@/components/common/StateFeedback' {
  import type { ReactNode } from 'react'
  export function LoadingState(props: { label?: string }): ReactNode
  export function ErrorState(props: { error?: unknown; onRetry?: () => void }): ReactNode
  export function EmptyState(props: { title?: string; description?: string; action?: ReactNode }): ReactNode
  export function FieldError(props: { children?: ReactNode }): ReactNode
  export function PageHeader(props: { accent?: string; eyebrow?: string; title: string; description?: string; action?: ReactNode }): ReactNode
  export function Pagination(props: { page: number; totalPages: number; onChange?: (page: number) => void; onPageChange?: (page: number) => void }): ReactNode
  export function ConfirmModal(props: {
    open?: boolean
    title?: string
    message?: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: string
    busy?: boolean
    loading?: boolean
    onConfirm?: () => void
    onCancel?: () => void
    onClose?: () => void
  }): ReactNode
  export function SubjectIcon(props: { codeOrName?: string; name?: string; size?: number; className?: string }): ReactNode
}
