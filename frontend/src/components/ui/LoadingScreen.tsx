import { BrandMark } from '@/components/brand/BrandMark'
import { AmbientBackground } from '@/components/layout/AmbientBackground'

export function LoadingScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 bg-[var(--color-bg)] relative overflow-hidden safe-top safe-bottom">
      <AmbientBackground />
      <div className="relative z-[1] flex flex-col items-center gap-4">
        <BrandMark size={64} animated />
        <div className="flex flex-col items-center gap-2">
          <p className="text-base font-bold tracking-tight">Cadens</p>
          <div className="flex items-center gap-1.5" aria-label="Loading">
            <span className="load-dot" />
            <span className="load-dot load-dot-2" />
            <span className="load-dot load-dot-3" />
          </div>
        </div>
      </div>
    </div>
  )
}
