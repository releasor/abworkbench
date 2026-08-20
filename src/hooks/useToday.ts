import { useState, useEffect } from 'react'
import { prevDateStr, todayStr as beijingTodayStr } from '../modules/taskflow/dateUtils'
import { beijingWallToMs } from '../utils/beijingTime'

const DAY = 86400000

export interface TodayInfo {
  todayStr: string
  todayMidnightMs: number
  tomorrowMidnightMs: number
  yesterdayMidnightMs: number
  yesterdayStr: string
}

function compute(now = new Date()): TodayInfo {
  const today = beijingTodayStr(now)
  const todayMidnightMs = beijingWallToMs(`${today}T00:00`)
  return {
    todayStr: today,
    todayMidnightMs,
    tomorrowMidnightMs: todayMidnightMs + DAY,
    yesterdayMidnightMs: todayMidnightMs - DAY,
    yesterdayStr: prevDateStr(today),
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
