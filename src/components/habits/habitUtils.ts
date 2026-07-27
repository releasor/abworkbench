import type { Habit } from '../../store'
import { getHabitStreak, dayNumToDateStr, WEEKDAY_NAMES } from '../../utils/format'
import { STREAK_MILESTONES } from './habitConstants'

export interface WeekGridDay {
  dateStr: string
  weekday: string
  day: string
  isToday: boolean
}

export interface MonthGridDay {
  dateStr: string
  day: number
  isCurrentMonth: boolean
}

export interface HabitBodyStats {
  totalCompletedToday: number
  completionRate: number
  totalStreak: number
  activeStreaks: number
  totalCompletions: number
}

export interface HabitComputedStats {
  bodyStats: HabitBodyStats
  streakMap: Map<string, number>
  weekCompletions: number
  perHabitStats: Map<string, { completedThisWeek: number }>
}

export function getWeekDayNums(todayDayNum: number): number[] {
  const todayWeekday = (todayDayNum + 4) % 7
  const daysFromMonday = todayWeekday === 0 ? 6 : todayWeekday - 1
  return Array.from({ length: 7 }, (_, index) => todayDayNum - daysFromMonday + index)
}

export function getWeekGridDays(weekDayNums: number[], todayDayNum: number): WeekGridDay[] {
  return weekDayNums.map((dayNum) => {
    const weekday = (dayNum + 4) % 7
    const dateStr = dayNumToDateStr(dayNum)
    return {
      dateStr,
      weekday: WEEKDAY_NAMES[weekday],
      day: String(Number(dateStr.slice(8))),
      isToday: dayNum === todayDayNum,
    }
  })
}

export function getMonthGridDays(year: number, month: number): MonthGridDay[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startWeekday = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  const days: MonthGridDay[] = []

  for (let offset = startWeekday; offset > 0; offset--) {
    const date = new Date(year, month, 1 - offset)
    days.push({
      dateStr: formatLocalDate(date),
      day: date.getDate(),
      isCurrentMonth: false,
    })
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day)
    days.push({
      dateStr: formatLocalDate(date),
      day,
      isCurrentMonth: true,
    })
  }

  const remaining = days.length % 7 === 0 ? 0 : 7 - (days.length % 7)
  for (let day = 1; day <= remaining; day++) {
    const date = new Date(year, month + 1, day)
    days.push({
      dateStr: formatLocalDate(date),
      day: date.getDate(),
      isCurrentMonth: false,
    })
  }

  return days
}

export function getHabitComputedStats(
  habits: Habit[],
  habitDateSets: Array<Set<string>>,
  todayStr: string,
  thisWeekDateStrs: string[],
): HabitComputedStats {
  if (habits.length === 0) {
    return {
      bodyStats: { totalCompletedToday: 0, completionRate: 0, totalStreak: 0, activeStreaks: 0, totalCompletions: 0 },
      streakMap: new Map<string, number>(),
      weekCompletions: 0,
      perHabitStats: new Map<string, { completedThisWeek: number }>(),
    }
  }

  let totalCompletedToday = 0
  let totalStreak = 0
  let activeStreaks = 0
  let totalCompletions = 0
  let weekCompletions = 0
  const streakMap = new Map<string, number>()
  const perHabitStats = new Map<string, { completedThisWeek: number }>()

  for (let index = 0; index < habits.length; index++) {
    const habit = habits[index]
    const dateSet = habitDateSets[index]
    if (dateSet.has(todayStr)) totalCompletedToday++
    const streak = getHabitStreak(dateSet, todayStr, '')
    streakMap.set(habit.id, streak)
    if (streak > totalStreak) totalStreak = streak
    if (streak > 0) activeStreaks++
    totalCompletions += habit.completedDates.length

    let completedThisWeek = 0
    for (const dateStr of thisWeekDateStrs) {
      if (dateSet.has(dateStr)) {
        completedThisWeek++
        weekCompletions++
      }
    }
    perHabitStats.set(habit.id, { completedThisWeek })
  }

  return {
    bodyStats: {
      totalCompletedToday,
      completionRate: Math.round((totalCompletedToday / habits.length) * 100),
      totalStreak,
      activeStreaks,
      totalCompletions,
    },
    streakMap,
    weekCompletions,
    perHabitStats,
  }
}

export function getStreakMilestone(streak: number): number | undefined {
  return STREAK_MILESTONES.find((milestone) => streak >= milestone)
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
