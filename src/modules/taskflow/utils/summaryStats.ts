import type { Task } from '../types'

export interface TaskFlowSummaryStats {
  total: number
  active: number
  completed: number
  overdue: number
  todayCompleted: number
  weekCompleted: number
  completionRate: number
  completionStreak: number
  dailyAvg: string
  avgCompletionMin: number
}

const DAY_MS = 86400000

export function getTaskFlowSummaryStats(tasks: Task[], now = new Date()): TaskFlowSummaryStats {
  const todayStr = now.toISOString().slice(0, 10)
  const todayMs = new Date(todayStr).getTime()
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
  const weekStartMs = todayMs - (dayOfWeek - 1) * DAY_MS

  let total = 0
  let active = 0
  let completed = 0
  let overdue = 0
  let todayCompleted = 0
  let weekCompleted = 0
  let completionDurationSum = 0
  let completedWithTime = 0
  const completedDayNums = new Set<number>()

  for (const task of tasks) {
    if (task.archived) continue
    total++

    if (task.status !== 'done') {
      active++
      if (task.dueDate && task.dueDate < todayStr) overdue++
      continue
    }

    completed++
    if (!task.completedAt) continue

    // Use Date.parse instead of new Date().getTime() for better performance
    const completedMs = Date.parse(task.completedAt)
    const completedDate = task.completedAt.slice(0, 10)
    completedDayNums.add(Math.floor(completedMs / DAY_MS))

    if (completedDate === todayStr) todayCompleted++
    if (completedMs >= weekStartMs) weekCompleted++

    const createdMs = Date.parse(task.createdAt)
    completionDurationSum += (completedMs - createdMs) / 60000
    completedWithTime++
  }

  const todayDayNum = Math.floor(todayMs / DAY_MS)
  let completionStreak = 0
  for (let index = 0; index < 365; index++) {
    if (completedDayNums.has(todayDayNum - index)) {
      completionStreak++
    } else if (index > 0) {
      break
    }
  }

  return {
    total,
    active,
    completed,
    overdue,
    todayCompleted,
    weekCompleted,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    completionStreak,
    dailyAvg: weekCompleted > 0 ? (weekCompleted / dayOfWeek).toFixed(1) : '0',
    avgCompletionMin: completedWithTime > 0 ? Math.round(completionDurationSum / completedWithTime) : 0,
  }
}
