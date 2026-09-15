import { clsx } from 'clsx'

/** The heartbeat from the supplied landing page; draw once on entry. */
export function BrandMark({ size = 40, className, animated = false }: {
  size?: number; className?: string; animated?: boolean
}) {
  return <span aria-hidden className={clsx('brand-heartbeat', animated && 'brand-heartbeat-enter', className)}
    style={{ width: size, height: size, borderRadius: Math.round(size * .28) }}>
    <svg viewBox="0 0 20 20" width={size * .72} height={size * .72} fill="none">
      <path d="M2 11h3l1.5-4 2.5 8 2-6 1.5 2h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
    </svg>
  </span>
}

export function BrandWordmark({ className }: { className?: string }) {
  return <span className={clsx('inline-flex items-center gap-2.5', className)}>
    <BrandMark size={32} />
    <span className="font-display text-[1.05rem] font-extrabold tracking-tight leading-tight">cadens</span>
  </span>
}
