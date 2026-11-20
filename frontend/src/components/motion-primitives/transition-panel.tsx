import { AnimatePresence, motion, useReducedMotion, type Transition, type Variants } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TransitionPanelProps {
  activeKey: string | number
  children: ReactNode
  className?: string
  transition?: Transition
  variants?: Variants
}

const defaultVariants: Variants = {
  enter: { opacity: 0, y: 6 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

export function TransitionPanel({
  activeKey,
  children,
  className,
  transition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  variants = defaultVariants,
}: TransitionPanelProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <div className={cn('relative', className)}>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={activeKey}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
