import type { ReactNode } from 'react'
import { clsx } from 'clsx'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center py-14 px-4 text-center',
        className
      )}
    >
      {icon && (
        <div className="w-[4.25rem] h-[4.25rem] rounded-[20px] mb-4 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-acc)_12%,var(--color-s2))] text-[var(--color-acc)] border border-[color-mix(in_srgb,var(--color-acc)_18%,transparent)]">
          {icon}
        </div>
      )}
      <h2 className="text-[1.05rem] font-bold tracking-tight mb-1.5">{title}</h2>
      {description && (
        <p className="text-sm text-[var(--color-dim)] max-w-[280px] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
