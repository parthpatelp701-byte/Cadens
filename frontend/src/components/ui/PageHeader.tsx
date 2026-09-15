import type { ReactNode } from 'react'
import { clsx } from 'clsx'

/** Consistent screen header for Saves / Progress / People / You */
export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <header
      className={clsx(
        'flex items-start justify-between gap-3 mb-1',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[1.65rem] font-bold tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-[var(--color-dim)] mt-1 leading-snug">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </header>
  )
}
