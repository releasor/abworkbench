import type { Habit, HabitSchedule } from '../../store'

export const DEFAULT_HABIT_SCHEDULE: HabitSchedule = {
  mode: 'once',
  targetCount: 1,
}

export function timestampToDateStr(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isTimestampInWindow(ts: number, startHour: number, endHour: number): boolean {
  const hour = new Date(ts).getHours()
  if (startHour <= endHour) return hour >= startHour && hour <= endHour
  return hour >= startHour || hour <= endHour
}

export function isNowInWindow(schedule: HabitSchedule, now = Date.now()): boolean {
  if (schedule.mode !== 'window') return true
  return isTimestampInWindow(now, schedule.windowStartHour ?? 0, schedule.windowEndHour ?? 23)
}

export function getCheckInsForDate(habit: Habit, dateStr: string): number[] {
  return (habit.checkIns ?? []).filter((ts) => timestampToDateStr(ts) === dateStr)
}

export function getEffectiveCheckIns(habit: Habit, dateStr: string): number[] {
  const dayCheckIns = getCheckInsForDate(habit, dateStr)
  if (habit.schedule.mode !== 'window') return dayCheckIns
  const start = habit.schedule.windowStartHour ?? 0
  const end = habit.schedule.windowEndHour ?? 23
  return dayCheckIns.filter((ts) => isTimestampInWindow(ts, start, end))
}

export function getHabitProgress(
  habit: Habit,
  dateStr: string,
  now = Date.now(),
): { count: number; target: number; met: boolean; canCheckIn: boolean } {
  const schedule = habit.schedule ?? DEFAULT_HABIT_SCHEDULE
  const target = Math.max(1, schedule.targetCount || 1)
  const count = getEffectiveCheckIns({ ...habit, schedule }, dateStr).length
  const met = count >= target

  if (schedule.mode === 'window') {
    const inWindow = isNowInWindow(schedule, now)
    return { count, target, met, canCheckIn: inWindow && dateStr === timestampToDateStr(now) }
  }

  if (schedule.mode === 'once') {
    return { count, target, met, canCheckIn: !met }
  }

  return { count, target, met, canCheckIn: dateStr === timestampToDateStr(now) }
}

export function isHabitGoalMetOnDate(habit: Habit, dateStr: string): boolean {
  return getHabitProgress(habit, dateStr).met
}

export function recomputeCompletedDates(habit: Habit): string[] {
  const dates = new Set<string>()
  for (const ts of habit.checkIns ?? []) {
    dates.add(timestampToDateStr(ts))
  }
  const completed: string[] = []
  for (const dateStr of dates) {
    if (isHabitGoalMetOnDate(habit, dateStr)) completed.push(dateStr)
  }
  return completed.sort()
}

export function normalizeHabit(habit: Habit): Habit {
  const schedule = habit.schedule ?? DEFAULT_HABIT_SCHEDULE
  let checkIns = habit.checkIns ?? []

  if (checkIns.length === 0 && habit.completedDates.length > 0) {
    checkIns = habit.completedDates.flatMap((date) => {
      const [y, m, d] = date.split('-').map(Number)
      const count = Math.max(1, schedule.targetCount || 1)
      return Array.from({ length: count }, (_, index) => (
        new Date(y, m - 1, d, 12, index, 0).getTime()
      ))
    })
  }

  const normalized: Habit = {
    ...habit,
    schedule,
    checkIns,
    completedDates: habit.completedDates,
  }

  return {
    ...normalized,
    completedDates: recomputeCompletedDates(normalized),
  }
}

export function getScheduleLabel(schedule: HabitSchedule): string {
  const target = Math.max(1, schedule.targetCount || 1)
  if (schedule.mode === 'once') return '每日 1 次'
  if (schedule.mode === 'multiple') return `每日 ${target} 次`
  const start = String(schedule.windowStartHour ?? 0).padStart(2, '0')
  const end = String(schedule.windowEndHour ?? 23).padStart(2, '0')
  return `${start}:00-${end}:59 · ${target} 次`
}

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}
