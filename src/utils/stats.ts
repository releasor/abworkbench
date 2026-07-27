import type { PomodoroSession, Habit } from '../store'
import { dayNumToDateStr, durationMinutes } from './format'

const DAY = 86400000

interface DatedCompletionItem {
  completed: boolean
  createdAt: number
  completedAt?: number
}

/** Build a map of date string → { count, minutes } from completed work sessions. */
export function buildPomodoroByDateMap(
  sessions: PomodoroSession[],
): Map<string, { count: number; minutes: number }> {
  const map = new Map<string, { count: number; minutes: number }>()
  for (const s of sessions) {
    if (s.type !== 'work' || !s.completed) continue
    const dateStr = dayNumToDateStr(Math.floor(s.startedAt / DAY))
    const bucket = map.get(dateStr) || { count: 0, minutes: 0 }
    bucket.count++
    bucket.minutes += durationMinutes(s.startedAt, s.endedAt)
    map.set(dateStr, bucket)
  }
  return map
}

/** Build a map of date string → count of todos completed on that date. */
export function buildCompletedByDateMap(todos: DatedCompletionItem[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of todos) {
    if (t.completed && t.completedAt) {
      const d = dayNumToDateStr(Math.floor(t.completedAt / DAY))
      map.set(d, (map.get(d) || 0) + 1)
    }
  }
  return map
}

/** Build a map of date string → count of habits completed on that date. */
export function buildHabitsByDateMap(habits: Habit[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const h of habits) {
    for (const d of h.completedDates) {
      map.set(d, (map.get(d) || 0) + 1)
    }
  }
  return map
}

/** Build a map of date string → count of todos created on that date. */
export function buildCreatedDateMap(todos: DatedCompletionItem[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of todos) {
    const d = dayNumToDateStr(Math.floor(t.createdAt / DAY))
    map.set(d, (map.get(d) || 0) + 1)
  }
  return map
}
