/** Static Cadens radiant green scenery: no perpetual blur or animation work. */
export function AmbientBackground() {
  return <div className="ambient-bg" aria-hidden>
    <span className="ambient-word">Cadens</span>
    <svg className="ambient-heartbeat" viewBox="0 0 1000 220" preserveAspectRatio="none" fill="none">
      <path d="M0,110 L120,110 L150,60 L180,150 L210,110 L340,110 L365,20 L385,190 L405,110 L560,110 L585,75 L605,145 L625,110 L760,110 L790,10 L815,200 L840,110 L1000,110" />
    </svg>
  </div>
}
