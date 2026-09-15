import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Accessible title id — defaults to sheet-title */
  titleId?: string
  className?: string
}

/**
 * Shared bottom/center sheet used by Saves, Tasks, Plan composers.
 * Controlled: parent owns `open`.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  titleId = 'sheet-title',
  className,
}: SheetProps) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  // Capture before children commit their autoFocus, so closing returns to the opener.
  const previousFocus = useMemo(() => open && document.activeElement instanceof HTMLElement ? document.activeElement : null, [open])
  useEffect(() => {
    if (!open) return
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') || []).filter(el => el.getClientRects().length > 0)
    ;(focusable()[0] || panel.current)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current() }
      if (e.key === 'Tab') {
        const items = focusable(), first = items[0], last = items.at(-1)
        if (!first) { e.preventDefault(); panel.current?.focus(); return }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open, previousFocus])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        tabIndex={-1}
        className={clsx(
          'relative w-full sm:max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain sheet sm:rounded-[var(--radius-lg)] p-5 space-y-3.5 page-enter',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id={titleId} className="font-bold text-lg tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--color-s2)] text-[var(--color-dim)] min-h-11 min-w-11"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>, document.body
  )
}

export function SheetActions({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 pt-1">{children}</div>
}

