import { motion, useReducedMotion, useSpring, useTransform, type SpringOptions } from 'motion/react'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface AnimatedNumberProps {
  value: number
  className?: string
  springOptions?: SpringOptions
  format?: (value: number) => string
}

const defaultFormat = (val: number) => Math.round(val).toLocaleString('vi-VN')

export function AnimatedNumber({
  value,
  className,
  springOptions = { bounce: 0, duration: 280 },
  format = defaultFormat,
}: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion()
  const spring = useSpring(value, springOptions)
  const display = useTransform(spring, (current) => format(current))

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  if (prefersReducedMotion) {
    return <span className={cn('tabular-nums', className)}>{format(value)}</span>
  }

  return <motion.span className={cn('tabular-nums', className)}>{display}</motion.span>
}
