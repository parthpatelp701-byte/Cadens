import { useEffect, useRef, useState } from 'react'

/** Pull-to-refresh on document scroll (mobile). */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const armed = useRef(false)
  const pullingRef = useRef(false)
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    pullingRef.current = pulling
  }, [pulling])
  useEffect(() => {
    refreshingRef.current = refreshing
  }, [refreshing])

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 4) return
      startY.current = e.touches[0].clientY
      armed.current = true
    }
    const onMove = (e: TouchEvent) => {
      if (!armed.current || refreshingRef.current) return
      const dy = e.touches[0].clientY - startY.current
      const next = dy > 70
      if (next !== pullingRef.current) setPulling(next)
    }
    const onEnd = async () => {
      if (!armed.current) return
      armed.current = false
      if (pullingRef.current && !refreshingRef.current) {
        setRefreshing(true)
        setPulling(false)
        try {
          await onRefreshRef.current()
        } finally {
          setRefreshing(false)
        }
      } else {
        setPulling(false)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])

  return { pulling, refreshing }
}
