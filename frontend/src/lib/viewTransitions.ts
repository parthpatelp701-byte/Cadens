/**
 * View Transitions API helpers for Cadens v2.
 * Progressive enhancement — no-ops when unsupported.
 */

export function supportsViewTransitions(): boolean {
  return typeof document !== 'undefined' && 'startViewTransition' in document
}

/**
 * Navigate with a view transition when available.
 * Call from click handlers or after data is ready.
 */
export function withViewTransition(updateCallback: () => void | Promise<void>) {
  if (supportsViewTransitions()) {

    document.startViewTransition(async () => {
      await updateCallback()
    })
  } else {
    void updateCallback()
  }
}

/**
 * Optional CSS class helpers for named transitions.
 * Pair with styles in index.css, e.g.:
 *   ::view-transition-old(save-card) { ... }
 */
export function vtName(name: string): React.CSSProperties {
  return { viewTransitionName: name } as React.CSSProperties
}
