import { useState, useEffect } from 'react'
import { dayNumToDateStr } from '../utils/format'

const DAY = 86400000

export interface TodayInfo {
  todayStr: string
  todayMidnightMs: number
  tomorrowMidnightMs: number
  yesterdayMidnightMs: number
  yesterdayStr: string
}

function compute(): TodayInfo {
  const dayNum = Math.floor(Date.now() / DAY)
  const todayMidnightMs = dayNum * DAY
  return {
    todayStr: dayNumToDateStr(dayNum),
    todayMidnightMs,
    tomorrowMidnightMs: todayMidnightMs + DAY,
    yesterdayMidnightMs: todayMidnightMs - DAY,
    yesterdayStr: dayNumToDateStr(dayNum - 1),
  }
}

export function useToday(): TodayInfo {
  const [today, setToday] = useState(compute)

  useEffect(() => {
    const id = setInterval(() => setToday(compute()), 60_000)
    return () => clearInterval(id)
  }, [])

  return today
}
