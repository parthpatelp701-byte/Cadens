import { useCallback } from 'react'
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom'

/** Navigate with View Transitions API when available */
export function useViewTransitionNavigate() {
  const navigate = useNavigate()

  return useCallback(
    (to: To, options?: NavigateOptions) => {
      const go = () => navigate(to, options)

      if (typeof document !== 'undefined' && document.startViewTransition) {

        document.startViewTransition(() => {
          go()
        })
      } else {
        go()
      }
    },
    [navigate]
  )
}
