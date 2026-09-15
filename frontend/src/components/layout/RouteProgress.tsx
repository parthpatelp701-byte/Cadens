import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/** Thin top progress bar on route change — perceived speed */
export function RouteProgress() {
  const location = useLocation()
  const [active, setActive] = useState(false)
  const [done, setDone] = useState(true)

  useEffect(() => {
    setActive(true)
    setDone(false)
    const t1 = window.setTimeout(() => setDone(true), 280)
    const t2 = window.setTimeout(() => setActive(false), 420)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [location.pathname])

  if (!active && done) return null

  return (
    <div className="route-progress" aria-hidden>
      <div className={`route-progress-bar ${done ? 'route-progress-bar-done' : ''}`} />
    </div>
  )
}
