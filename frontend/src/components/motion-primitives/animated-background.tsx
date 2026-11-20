import { AnimatePresence, motion, type Transition } from 'motion/react'
import { Children, cloneElement, isValidElement, useId, type ReactElement } from 'react'
import { cn } from '@/lib/utils'

export interface AnimatedBackgroundProps {
  children: ReactElement<{ 'data-id': string; className?: string; onClick?: () => void }>[]
  activeId: string
  className?: string
  transition?: Transition
}

export function AnimatedBackground({
  children,
  activeId,
  className,
  transition = { type: 'spring', bounce: 0.15, duration: 0.22 },
}: AnimatedBackgroundProps) {
  const uniqueId = useId()

  return (
    <>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child
        const id = child.props['data-id']
        const isActive = activeId === id

        return cloneElement(
          child,
          {
            key: id,
            className: cn('relative inline-flex items-center justify-center', child.props.className),
            'data-checked': isActive ? 'true' : 'false',
          } as Record<string, unknown>,
          <>
            <AnimatePresence initial={false}>
              {isActive && (
                <motion.div
                  layoutId={`animated-bg-${uniqueId}`}
                  className={cn('absolute inset-0 rounded-lg', className)}
                  transition={transition}
                  initial={{ opacity: 0.85 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </AnimatePresence>
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
              {(child.props as { children?: React.ReactNode }).children}
            </span>
          </>
        )
      })}
    </>
  )
}
