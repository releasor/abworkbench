import { flushSync } from 'react-dom'

/** Prefer Chromium View Transitions; fall back to an instant state update. */
export function smoothNavigate(update: () => void): void {
  if (typeof document === 'undefined') {
    update()
    return
  }

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    update()
    return
  }

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> }
  }

  if (typeof doc.startViewTransition !== 'function') {
    update()
    return
  }

  try {
    doc.startViewTransition(() => {
      flushSync(update)
    })
  } catch {
    update()
  }
}
