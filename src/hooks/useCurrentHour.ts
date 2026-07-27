import { useState, useEffect } from 'react'

export function getSystemHour(date = new Date()): number {
  return date.getHours()
}

/** Returns the current hour (0-23), updating every 5 minutes. */
export function useCurrentHour(): number {
  const [hour, setHour] = useState(getSystemHour)
  useEffect(() => {
    const id = setInterval(() => setHour(getSystemHour()), 300_000)
    return () => clearInterval(id)
  }, [])
  return hour
}
