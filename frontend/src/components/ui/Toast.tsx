import { useEffect, useState, createContext, useContext, useCallback, type ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { clsx } from 'clsx'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev.slice(-3), { id, message, type }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-viewport pointer-events-none">
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), 3200)
    return () => clearTimeout(t)
  }, [item.id, onDismiss])

  const Icon = item.type === 'success' ? CheckCircle2 : item.type === 'error' ? AlertCircle : Info

  return (
    <div
      role="status"
      className={clsx(
        'toast-enter pointer-events-auto flex items-start gap-2.5 px-3.5 py-3 rounded-2xl border shadow-lg backdrop-blur-xl',
        item.type === 'success' &&
          'border-[color-mix(in_srgb,var(--color-ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-ok)_14%,var(--color-s1))]',
        item.type === 'error' &&
          'border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_14%,var(--color-s1))]',
        item.type === 'info' && 'border-[var(--color-line2)] bg-[color-mix(in_srgb,var(--color-s1)_92%,transparent)]'
      )}
    >
      <Icon
        size={18}
        className={clsx(
          'shrink-0 mt-0.5',
          item.type === 'success' && 'text-[var(--color-ok)]',
          item.type === 'error' && 'text-[var(--color-danger)]',
          item.type === 'info' && 'text-[var(--color-acc)]'
        )}
        aria-hidden
      />
      <p className="flex-1 text-sm font-medium text-[var(--color-txt)] leading-snug">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="p-1 rounded-lg text-[var(--color-mute)] hover:bg-[var(--color-s2)] min-h-8 min-w-8"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
