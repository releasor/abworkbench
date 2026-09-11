import { useState, useEffect } from 'react'

/**
 * Shared hook that provides a ticking Date value at the given interval.
 * Replaces multiple duplicate `setInterval(() => setNow(new Date()), 1000)` patterns.
 * Pauses while the document is hidden to avoid background re-render tax.
 *
 * @param intervalMs - Update interval in milliseconds (default: 1000)
 * @returns Current Date object, updated at the specified interval
 */
export function useTick(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const clear = () => {
      if (timer != null) {
        clearInterval(timer)
        timer = null
      }
    }

    const start = () => {
      if (timer != null || document.visibilityState === 'hidden') return
      timer = setInterval(() => setNow(new Date()), intervalMs)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') clear()
      else {
        setNow(new Date())
        start()
      }
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clear()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])

  return now
}
