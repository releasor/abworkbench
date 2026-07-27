import { useState, useEffect } from 'react'

/**
 * Shared hook that provides a ticking Date value at the given interval.
 * Replaces multiple duplicate `setInterval(() => setNow(new Date()), 1000)` patterns.
 *
 * @param intervalMs - Update interval in milliseconds (default: 1000)
 * @returns Current Date object, updated at the specified interval
 */
export function useTick(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
