import type { Task } from '../modules/taskflow/types'
import { dayKeyFromIso, prevDateStrN, todayStr } from '../modules/taskflow/dateUtils.ts'

export interface TrendDay {
  date: string
  completed: number
  created: number
  timeSpent: number
  score: number
}

function scoreDay(completed: number, created: number, timeSpentSec: number): number {
  const focusMin = timeSpentSec / 60
  const raw = completed * 18 + Math.min(created, 8) * 4 + Math.min(focusMin, 120) * 0.35
  return Math.max(0, Math.min(100, Math.round(raw)))
}

/** Build N days of productivity trends ending today (Beijing via todayStr). */
export function buildProductivityTrends(tasks: Task[], days = 7, now = new Date()): { days: number; trends: TrendDay[] } {
  const end = todayStr(now)
  const trends: TrendDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = prevDateStrN(end, i)
    let completed = 0
    let created = 0
    let timeSpent = 0
    for (const task of tasks) {
      if (task.archived) continue
      if (dayKeyFromIso(task.createdAt) === date) created++
      if (task.status === 'done' && dayKeyFromIso(task.completedAt) === date) completed++
      for (const entry of task.timeEntries || []) {
        if (dayKeyFromIso(entry.startTime) === date) timeSpent += entry.duration || 0
      }
    }
    trends.push({
      date,
      completed,
      created,
      timeSpent,
      score: scoreDay(completed, created, timeSpent),
    })
  }
  return { days, trends }
}
