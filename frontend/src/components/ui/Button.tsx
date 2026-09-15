import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  leftIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  leftIcon,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-150',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-acc)]',
        {
          'bg-[var(--color-acc)] text-[var(--color-ink)] border-2 border-[var(--color-ink)] shadow-[4px_4px_0_var(--color-ink)] hover:bg-[var(--color-acc-h)] hover:-translate-y-0.5':
            variant === 'primary',
          'bg-[var(--color-s3)] hover:bg-[var(--color-s4)] text-[var(--color-txt)] border border-[var(--color-line)]':
            variant === 'secondary',
          'bg-transparent hover:bg-[var(--color-s2)] text-[var(--color-dim)]':
            variant === 'ghost',
          'bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_22%,transparent)]':
            variant === 'danger',
          'min-h-9 px-3.5 text-xs': size === 'sm',
          'min-h-11 px-5 text-sm': size === 'md',
          'min-h-12 px-6 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {leftIcon}
      {children}
    </button>
  )
}
