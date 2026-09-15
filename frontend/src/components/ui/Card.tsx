import type { ReactNode } from 'react'
import { clsx } from 'clsx'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
  interactive?: boolean
}

export function Card({ children, className, padding = true, interactive }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-[var(--radius)] bg-[var(--color-s1)] border-[1.5px] border-[var(--color-line2)]',
        'shadow-[var(--shadow-elevated)]',
        interactive &&
          'transition-colors hover:border-[var(--color-line)] hover:bg-[color-mix(in_srgb,var(--color-s1)_90%,var(--color-s2))]',
        padding && 'p-4',
        className
      )}
    >
      {children}
    </div>
  )
}
