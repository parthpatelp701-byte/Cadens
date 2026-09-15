import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, X } from 'lucide-react'
import { getStreak, listEntries } from '@/lib/journal'
import { streakRiskMessage } from '@/lib/retention'

/** One-line welcome when journal streak is at risk */
export function WelcomeBack() {
  const [msg, setMsg] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let ok = true
    ;(async () => {
      try {
        const key = `cadens-welcome-${new Date().toISOString().slice(0, 10)}`
        if (sessionStorage.getItem(key)) return
        const [st, entries] = await Promise.all([
          getStreak().catch(() => ({ current: 0 })),
          listEntries({ limit: 3 }).catch(() => []),
        ])
        if (!ok) return
        const today = new Date().toISOString().slice(0, 10)
        const wrote = entries.some((e: { entry_date?: string }) => e.entry_date === today)
        const risk = streakRiskMessage(st.current || 0, wrote)
        if (risk) {
          setMsg(risk)
          sessionStorage.setItem(key, '1')
        }
      } catch {
        /* optional */
      }
    })()
    return () => {
      ok = false
    }
  }, [])

  if (!msg || hidden) return null

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,var(--color-s1))] px-3.5 py-3">
      <Flame size={18} className="text-[var(--color-warn)] shrink-0" aria-hidden />
      <p className="flex-1 text-sm font-medium text-pretty">{msg}</p>
      <Link
        to="/journal"
        className="text-xs font-bold text-[var(--color-acc)] shrink-0 min-h-9 px-2 inline-flex items-center"
      >
        Journal
      </Link>
      <button
        type="button"
        className="p-1.5 rounded-lg text-[var(--color-mute)] hover:bg-[var(--color-s2)]"
        aria-label="Dismiss"
        onClick={() => setHidden(true)}
      >
        <X size={16} />
      </button>
    </div>
  )
}
