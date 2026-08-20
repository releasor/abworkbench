import { useMemo, useCallback, useState, memo } from 'react'
import { BarChart3, Timer, CheckSquare, Target, Flame, Clock, Download, Copy } from 'lucide-react'
import { useStore } from '../../store'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { WEEKDAY_NAMES, durationMinutes, fmtMin, dayNumToDateStr, dayNumToShortLabel, getMonthLabel, fmtHHmm, fmtHHmmss, dayNumToYMD } from '../../utils/format'
import { buildCompletedByDateMap, buildHabitsByDateMap } from '../../utils/stats'
import { useToday } from '../../hooks/useToday'

const HEATMAP_PERCENTILES = [15, 35, 55, 80, 100]

function csvEscape(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

const PRIORITY_CARDS = [
  { label: '紧急', priority: 'urgent' as const, color: 'bg-danger', textColor: 'text-danger' },
  { label: '高优先级', priority: 'high' as const, color: 'bg-orange-500', textColor: 'text-orange-400' },
  { label: '中优先级', priority: 'medium' as const, color: 'bg-warning', textColor: 'text-warning' },
  { label: '低优先级', priority: 'low' as const, color: 'bg-success', textColor: 'text-success' },
]


const BarChart = memo(function BarChart({
  data,
  max,
  color,
  labelKey,
  valueKey,
  target,
}: {
  data: Array<Record<string, unknown>>
  max: number
  color: string
  labelKey: string
  valueKey: string
  target?: number
}) {
  const hasData = data.some((item) => (item[valueKey] as number) > 0)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-text-muted">
        暂无数据
      </div>
    )
  }

  const isToday = (i: number) => i === data.length - 1
  const effectiveMax = target ? Math.max(max, target) : max

  return (
    <div className="relative">
      {/* Target line */}
      {target && target <= effectiveMax && (
        <div
          className="absolute left-0 right-0 border-t border-dashed border-text-muted/30 z-10"
          style={{ bottom: `${(target / effectiveMax) * 100}px` }}
        >
          <span className="absolute right-0 -top-4 text-[10px] text-text-muted">目标 {target}</span>
        </div>
      )}
      <div className="flex items-end gap-2 h-32">
        {data.map((item, i) => {
          const value = item[valueKey] as number
          const height = effectiveMax > 0 ? (value / effectiveMax) * 100 : 0
          const today = isToday(i)
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
              <span className={`text-xs font-mono transition-all group-hover/bar:scale-110 group-hover/bar:font-medium ${today ? 'text-primary font-medium' : 'text-text-muted'}`}>{value}</span>
              <div className="w-full relative" style={{ height: '100px' }}>
                <div
                  className={`absolute bottom-0 w-full rounded-t-md transition-all duration-500 group-hover/bar:opacity-100 ${today ? 'ring-1 ring-white/20' : ''}`}
                  style={{
                    height: `${height}%`,
                    backgroundColor: color,
                  opacity: today ? 1 : 0.7,
                  transitionDelay: `${i * 80}ms`,
                }}
              />
            </div>
            <span className={`text-xs transition-colors ${today ? 'text-primary font-medium' : 'text-text-muted group-hover/bar:text-text'}`}>
              {today ? '今天' : item[labelKey] as string}
            </span>
          </div>
        )
      })}
      </div>
    </div>
  )
})

interface StatsPageProps {
  embedded?: boolean
}

export default function StatsPage({ embedded = false }: StatsPageProps) {
  const taskFlowTasks = useTaskStore((s) => s.tasks)
  const todos = useMemo(() => taskFlowTasks.filter((t) => !t.archived).map((task) => ({
    id: task.id,
    title: task.title,
    text: task.title,
    completed: task.status === 'done',
    priority: task.priority,
    createdAt: Date.parse(task.createdAt) || 0,
    completedAt: task.completedAt ? Date.parse(task.completedAt) : undefined,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : undefined,
  })), [taskFlowTasks])
  const pomodoroSessions = useStore((s) => s.pomodoroSessions)
  const habits = useStore((s) => s.habits)
  const notes = useStore((s) => s.notes)
  const dailyPomodoroGoal = useStore((s) => s.dailyPomodoroGoal)
  const { todayStr, todayMidnightMs, tomorrowMidnightMs } = useToday()

  const last7Days = useMemo(() => {
    const DAY = 86400000
    const todayDayNum = Math.floor(todayMidnightMs / DAY)
    return Array.from({ length: 7 }, (_, i) => {
      const dayNum = todayDayNum - (6 - i)
      return { label: dayNumToShortLabel(dayNum), full: dayNumToDateStr(dayNum) }
    })
  }, [todayMidnightMs])

  // Pomodoro stats + focus minutes per day (last 7 days) — single pass
  const { pomodoroByDay, focusByDay, maxPomodoro, maxFocus } = useMemo<{
    pomodoroByDay: Array<{ label: string; full: string; count: number }>
    focusByDay: Array<{ label: string; full: string; minutes: number }>
    maxPomodoro: number
    maxFocus: number
  }>(() => {
    const DAY = 86400000
    const pbd = last7Days.map((day) => ({ ...day, count: 0 }))
    const fbd = last7Days.map((day) => ({ ...day, minutes: 0 }))
    const todayDayNum = Math.floor(todayMidnightMs / DAY)
    const dayNumToIdx = new Map<number, number>()
    for (let i = 0; i < 7; i++) dayNumToIdx.set(todayDayNum - 6 + i, i)
    let maxP = 0; let maxF = 0
    for (const s of pomodoroSessions) {
      if (s.type !== 'work' || !s.completed) continue
      const idx = dayNumToIdx.get(Math.floor(s.startedAt / DAY))
      if (idx !== undefined) {
        pbd[idx].count++
        fbd[idx].minutes += durationMinutes(s.startedAt, s.endedAt)
        if (pbd[idx].count > maxP) maxP = pbd[idx].count
        if (fbd[idx].minutes > maxF) maxF = fbd[idx].minutes
      }
    }
    return {
      pomodoroByDay: pbd,
      focusByDay: fbd,
      maxPomodoro: Math.max(maxP, 1),
      maxFocus: Math.max(maxF, 1),
    }
  }, [pomodoroSessions, last7Days, todayMidnightMs])

  const todosCompletedByDate = useMemo(() => buildCompletedByDateMap(todos), [todos])
  const habitsCountByDate = useMemo(() => buildHabitsByDateMap(habits), [habits])

  // Todo completion per day (last 7 days)
  const { todosByDay, maxTodos } = useMemo(() => {
    let maxT = 0
    const byDay = last7Days.map((day) => { const c = todosCompletedByDate.get(day.full) || 0; if (c > maxT) maxT = c; return { ...day, completed: c } })
    return { todosByDay: byDay, maxTodos: Math.max(maxT, 1) }
  }, [last7Days, todosCompletedByDate])

  // Habit completion rate per day (last 7 days)
  const habitsByDay = useMemo(() => {
    if (habits.length === 0) return last7Days.map((day) => ({ ...day, rate: 0 }))
    return last7Days.map((day) => {
      const completed = habitsCountByDate.get(day.full) || 0
      return { ...day, rate: Math.round((completed / habits.length) * 100) }
    })
  }, [habits, last7Days, habitsCountByDate])

  // Pre-compute chart stats to avoid IIFEs in JSX
  const chartStats = useMemo((): {
    pomoTotal: number; pomoGoalDays: number; pomoDailyAvg: string
    pomoBestDay: { label: string; full: string; count: number }; pomoQuietestDay: { label: string; full: string; count: number } | null
    focusTotal: number; focusTotalDisplay: string; focusActiveDays: number; focusDailyAvg: number
    focusBestDay: { label: string; full: string; minutes: number }; focusBestPct: number
    todoTotal: number; todoActiveDays: number; todoDailyAvg: string
    todoBestDay: { label: string; full: string; completed: number }
    habitAvg: number; habitTrend: number
    habitBestDay: { label: string; full: string; rate: number }
    priorityStats: Map<string, { total: number; completed: number; completionRate: number; weekAdded: number }>
    highPct: number; medPct: number; lowPct: number
  } => {
    // Pomodoro chart stats — single pass
    let pomoTotal = 0; let pomoGoalDays = 0; let pomoActiveDayCount = 0
    let pomoBestDay = pomodoroByDay[0]!; let pomoQuietestDay: { label: string; full: string; count: number } | null = null
    for (const d of pomodoroByDay) {
      pomoTotal += d.count
      if (d.count >= dailyPomodoroGoal) pomoGoalDays++
      if (d.count > 0) {
        pomoActiveDayCount++
        if (!pomoQuietestDay || d.count < pomoQuietestDay.count) pomoQuietestDay = d
        if (d.count > pomoBestDay.count) pomoBestDay = d
      }
    }
    const pomoDailyAvg = (pomoTotal / 7).toFixed(1)
    if (pomoActiveDayCount <= 1) pomoQuietestDay = null

    // Focus chart stats — single pass
    let focusTotal = 0; let focusActiveDays = 0
    let focusBestDay = focusByDay[0]
    for (const d of focusByDay) {
      focusTotal += d.minutes
      if (d.minutes > 0) focusActiveDays++
      if (d.minutes > focusBestDay.minutes) focusBestDay = d
    }
    const focusTotalDisplay = fmtMin(focusTotal)
    const focusDailyAvg = focusActiveDays > 0 ? Math.round(focusTotal / focusActiveDays) : 0
    const focusBestPct = focusTotal > 0 ? Math.round(focusBestDay.minutes / focusTotal * 100) : 0

    // Todos chart stats — single pass
    let todoTotal = 0; let todoActiveDays = 0
    let todoBestDay = todosByDay[0]
    for (const d of todosByDay) {
      todoTotal += d.completed
      if (d.completed > 0) todoActiveDays++
      if (d.completed > todoBestDay.completed) todoBestDay = d
    }
    const todoDailyAvg = todoActiveDays > 0 ? (todoTotal / todoActiveDays).toFixed(1) : '0'

    // Habits chart stats — single pass
    let habitRateSum = 0; let habitFirstHalfSum = 0; let habitSecondHalfSum = 0; let habitSecondHalfCount = 0
    let habitBestDay = habitsByDay[0]
    for (let i = 0; i < habitsByDay.length; i++) {
      const d = habitsByDay[i]
      habitRateSum += d.rate
      if (i < 3) habitFirstHalfSum += d.rate
      else { habitSecondHalfSum += d.rate; habitSecondHalfCount++ }
      if (d.rate > habitBestDay.rate) habitBestDay = d
    }
    const habitAvg = habits.length > 0 ? Math.round(habitRateSum / habitsByDay.length) : 0
    const habitTrend = (habitSecondHalfCount > 0 ? habitSecondHalfSum / habitSecondHalfCount : 0) - habitFirstHalfSum / 3

    // Priority stats (single pass over todos)
    const weekStartMs = todayMidnightMs - 6 * 86400000
    const priorityMap = new Map<string, { total: number; completed: number; completionRate: number; weekAdded: number }>()
    for (const p of ['urgent', 'high', 'medium', 'low']) priorityMap.set(p, { total: 0, completed: 0, completionRate: 0, weekAdded: 0 })
    for (const t of todos) {
      const key = (t.priority || 'low') as string
      const pStats = priorityMap.get(key) || priorityMap.get('low')!
      pStats.total++
      if (t.completed) pStats.completed++
      if (t.createdAt >= weekStartMs) pStats.weekAdded++
    }
    for (const s of priorityMap.values()) { s.completionRate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0 }

    const totalTodos = [...priorityMap.values()].reduce((sum, s) => sum + s.total, 0)
    const highPct = totalTodos > 0 ? Math.round(((priorityMap.get('urgent')!.total + priorityMap.get('high')!.total) / totalTodos) * 100) : 0
    const medPct = totalTodos > 0 ? Math.round((priorityMap.get('medium')!.total / totalTodos) * 100) : 0
    const lowPct = 100 - highPct - medPct

    return {
      pomoTotal, pomoGoalDays, pomoDailyAvg, pomoBestDay, pomoQuietestDay,
      focusTotal, focusTotalDisplay, focusActiveDays, focusDailyAvg, focusBestDay, focusBestPct,
      todoTotal, todoActiveDays, todoDailyAvg, todoBestDay,
      habitAvg, habitTrend, habitBestDay,
      priorityStats: priorityMap, highPct, medPct, lowPct,
    }
  }, [pomodoroByDay, focusByDay, todosByDay, habitsByDay, dailyPomodoroGoal, habits, todos, todayMidnightMs])

  // Consolidated work sessions analysis — single pass over pomodoroSessions
  const workAnalysis = useMemo(() => {
    const workSessions: typeof pomodoroSessions = []
    const dayCounts = new Array(7).fill(0)
    const hourCounts = new Array(24).fill(0)
    const workDayNums = new Set<number>()
    const DAY = 86400000

    for (const s of pomodoroSessions) {
      if (s.type !== 'work' || !s.completed) continue
      workSessions.push(s)
      dayCounts[(Math.floor(s.startedAt / DAY) + 4) % 7]++
      hourCounts[Math.floor((Math.floor(s.startedAt / 1000) % 86400) / 3600)]++
      workDayNums.add(Math.floor(s.startedAt / DAY))
    }

    // Best day of week
    const maxDayIdx = dayCounts.indexOf(Math.max(...dayCounts))
    const bestDayOfWeek = dayCounts[maxDayIdx] > 0 ? { name: WEEKDAY_NAMES[maxDayIdx], count: dayCounts[maxDayIdx] } : null

    // Focus hours heatmap — single pass for max, peak, and top 3
    let maxHour = 1; let peakHour = 0
    const top3: Array<{ count: number; hour: number }> = []
    for (let hour = 0; hour < 24; hour++) {
      const count = hourCounts[hour]
      if (count > maxHour) { maxHour = count; peakHour = hour }
      if (top3.length < 3) {
        top3.push({ count, hour })
      } else if (count > top3[2].count) {
        top3[2] = { count, hour }
      } else { continue }
      for (let i = top3.length - 1; i > 0; i--) {
        if (top3[i].count > top3[i - 1].count) { const tmp = top3[i]; top3[i] = top3[i - 1]; top3[i - 1] = tmp }
        else break
      }
    }
    const peakLabel = `${String(peakHour).padStart(2, '0')}:00`
    const top3Filtered = top3.filter((h) => h.count > 0)
    const focusHoursHeatmap = { hourCounts, max: maxHour, peakHour, peakLabel, top3: top3Filtered }

    // Current streak (pure arithmetic, no format calls in loop)
    let streak = 0
    const todayDayNum = Math.floor(todayMidnightMs / DAY)
    for (let i = 0; i < 365; i++) {
      if (workDayNums.has(todayDayNum - i)) streak++
      else if (i > 0) break
    }
    const startDate = streak > 0 ? dayNumToDateStr(todayDayNum - (streak - 1)) : ''

    // Longest streak (pure arithmetic on sorted day numbers)
    const sortedNums = [...workDayNums].sort((a, b) => a - b)
    let longest = sortedNums.length > 0 ? 1 : 0
    let current = 1
    for (let i = 1; i < sortedNums.length; i++) {
      if (sortedNums[i] - sortedNums[i - 1] === 1) { current++; longest = Math.max(longest, current) }
      else current = 1
    }

    return {
      workSessions,
      bestDayOfWeek,
      focusHoursHeatmap,
      currentStreak: { count: streak, startDate },
      longestStreak: longest,
    }
  }, [pomodoroSessions, todayMidnightMs])
  const { workSessions, bestDayOfWeek, focusHoursHeatmap, currentStreak, longestStreak } = workAnalysis

  // Overall stats — single pass over pomodoroSessions and todos
  const overallStats = useMemo(() => {
    const DAY = 86400000
    const todayDayNum = Math.floor(todayMidnightMs / DAY)
    const { y, m, d } = dayNumToYMD(todayDayNum)
    const weekStartMs = todayMidnightMs - 6 * DAY
    const daysInMonth = d
    const monthStartMs = todayMidnightMs - (daysInMonth - 1) * DAY
    const monthStartDayNum = Math.floor(monthStartMs / DAY)
    const monthStartStr = dayNumToDateStr(monthStartDayNum)
    const lastMonthEndMs = monthStartMs - 1
    const lastMonthStartMs = m === 1 ? Date.UTC(y - 1, 11, 1) : Date.UTC(y, m - 2, 1)

    // Single pass over pomodoroSessions (overall + monthly)
    let totalPomodoro = 0
    let totalFocusMinutes = 0
    let totalBreakMinutes = 0
    let longestSession = 0
    let todayPomodoro = 0
    let todayFocusMin = 0
    let monthPomodoroCount = 0
    let monthFocusMinutes = 0
    let lastMonthPomodoroCount = 0
    let lastMonthFocusMinutes = 0
    const monthActiveDayNums = new Set<number>()
    for (const s of pomodoroSessions) {
      if (!s.completed) continue
      const durMin = durationMinutes(s.startedAt, s.endedAt)
      if (s.type === 'work') {
        totalPomodoro++
        totalFocusMinutes += durMin
        if (durMin > longestSession) longestSession = durMin
        if (s.startedAt >= todayMidnightMs && s.startedAt < tomorrowMidnightMs) { todayPomodoro++; todayFocusMin += durMin }
        if (s.startedAt >= monthStartMs) {
          monthPomodoroCount++
          monthFocusMinutes += durMin
          monthActiveDayNums.add(Math.floor(s.startedAt / DAY))
        } else if (s.startedAt >= lastMonthStartMs && s.startedAt <= lastMonthEndMs) {
          lastMonthPomodoroCount++
          lastMonthFocusMinutes += durMin
        }
      } else {
        totalBreakMinutes += durMin
      }
    }

    const focusDisplay = fmtMin(totalFocusMinutes)
    const avgSessionDuration = totalPomodoro > 0 ? Math.round(totalFocusMinutes / totalPomodoro) : 0
    const workBreakRatio = totalBreakMinutes > 0 ? (totalFocusMinutes / totalBreakMinutes).toFixed(1) : '—'

    // Single pass over todos (overall + monthly)
    let totalCompletedTodos = 0
    let todayCompletedTodos = 0
    let weekCompletedTodos = 0
    let monthTodos = 0
    let monthTotalTodos = 0
    for (const t of todos) {
      if (!t.completed) continue
      totalCompletedTodos++
      if (t.completedAt) {
        if (t.completedAt >= todayMidnightMs && t.completedAt < tomorrowMidnightMs) todayCompletedTodos++
        if (t.completedAt >= weekStartMs) weekCompletedTodos++
      }
      if (t.createdAt >= monthStartMs) {
        monthTotalTodos++
        if (t.completed && t.completedAt && t.completedAt >= monthStartMs) monthTodos++
      }
    }

    // Single pass over habitsCountByDate (overall + monthly)
    const todayHabits = habitsCountByDate.get(todayStr) || 0
    const todayHabitRate = habits.length > 0 ? Math.round((todayHabits / habits.length) * 100) : 0
    let totalHabitDays = 0
    let monthHabitCount = 0
    let lastMonthHabitCount = 0
    const lastMonthStartStr = dayNumToDateStr(Math.floor(lastMonthStartMs / DAY))
    const lastMonthEndStr = dayNumToDateStr(Math.floor(lastMonthEndMs / DAY))
    for (const [d, count] of habitsCountByDate) {
      totalHabitDays += count
      if (d >= monthStartStr) monthHabitCount += count
      if (d >= lastMonthStartStr && d <= lastMonthEndStr) lastMonthHabitCount += count
    }
    const monthRate = habits.length > 0 ? Math.round((monthHabitCount / (habits.length * daysInMonth)) * 100) : 0

    // Monthly summary derived values
    const avgPomodoroPerDay = daysInMonth > 0 ? (monthPomodoroCount / daysInMonth).toFixed(1) : '0'
    const monthFocusDisplay = fmtMin(monthFocusMinutes)
    const monthTodoRate = monthTotalTodos > 0 ? Math.round((monthTodos / monthTotalTodos) * 100) : -1
    const avgFocusPerDay = daysInMonth > 0 ? Math.round(monthFocusMinutes / daysInMonth) : 0
    const focusTrend = lastMonthFocusMinutes > 0 ? Math.round(((monthFocusMinutes - lastMonthFocusMinutes) / lastMonthFocusMinutes) * 100) : monthFocusMinutes > 0 ? 100 : 0
    const pomodoroTrend = lastMonthPomodoroCount > 0 ? Math.round(((monthPomodoroCount - lastMonthPomodoroCount) / lastMonthPomodoroCount) * 100) : monthPomodoroCount > 0 ? 100 : 0
    const habitTrend = lastMonthHabitCount > 0 ? Math.round(((monthHabitCount - lastMonthHabitCount) / lastMonthHabitCount) * 100) : monthHabitCount > 0 ? 100 : 0

    return {
      todayPomodoro, todayCompletedTodos, weekCompletedTodos, totalPomodoro, focusDisplay, totalCompletedTodos, totalHabitDays, longestSession, avgSessionDuration, workBreakRatio, todayFocusMin, todayHabits, todayHabitRate, monthRate,
      monthPomodoro: monthPomodoroCount, monthTodos, monthFocusDisplay, avgPomodoroPerDay, daysInMonth, monthHabitCount, monthTodoRate, avgFocusPerDay, monthActiveDays: monthActiveDayNums.size, focusTrend, pomodoroTrend, habitTrend, currentMonthLabel: getMonthLabel(todayMidnightMs),
    }
  }, [pomodoroSessions, todos, habits, habitsCountByDate, todayStr, todayMidnightMs, tomorrowMidnightMs])
  const { todayPomodoro, todayCompletedTodos, weekCompletedTodos, totalPomodoro, focusDisplay, totalCompletedTodos, totalHabitDays, longestSession, avgSessionDuration, workBreakRatio, todayFocusMin, todayHabits, todayHabitRate, monthRate, monthPomodoro, monthTodos, monthFocusDisplay, avgPomodoroPerDay, daysInMonth, monthHabitCount, monthTodoRate, avgFocusPerDay, monthActiveDays, focusTrend, pomodoroTrend, habitTrend, currentMonthLabel } = overallStats

  // Consolidated weekly summary + avgPomodoro + goalDays — single pass over pomodoroByDay
  const weeklySummary = useMemo(() => {
    let weekPomodoro = 0; let activeDays = 0; let goalDaysCount = 0
    for (const d of pomodoroByDay) { weekPomodoro += d.count; if (d.count > 0) activeDays++; if (d.count >= dailyPomodoroGoal) goalDaysCount++ }
    const avgPomodoro = activeDays > 0 ? (weekPomodoro / 7).toFixed(1) : '0'
    let weekTodos = 0; for (const d of todosByDay) { weekTodos += d.completed }
    let habitRateSum = 0; for (const d of habitsByDay) { habitRateSum += d.rate }
    const weekHabitAvg = habits.length > 0 ? Math.round(habitRateSum / habitsByDay.length) : 0

    // Pre-build last week date range + date strings (for habit lookup)
    const DAY = 86400000
    const lastWeekStartMs = todayMidnightMs - 13 * DAY
    const lastWeekEndMs = todayMidnightMs - 7 * DAY
    const lastWeekStartDayNum = Math.floor(lastWeekStartMs / 86400000)
    const last7Arr: string[] = []
    for (let i = 0; i < 7; i++) last7Arr.push(dayNumToDateStr(lastWeekStartDayNum + i))

    // Single pass: last week pomodoro + focus minutes
    let lastWeekPomodoro = 0
    const lastWeekDayNumCounts = new Map<number, number>()
    for (const s of pomodoroSessions) {
      if (s.type !== 'work' || !s.completed) continue
      if (s.startedAt >= lastWeekStartMs && s.startedAt < lastWeekEndMs) {
        lastWeekPomodoro++
        const dayNum = Math.floor(s.startedAt / DAY)
        lastWeekDayNumCounts.set(dayNum, (lastWeekDayNumCounts.get(dayNum) || 0) + 1)
      }
    }

    // This week focus from focusByDay
    let weekFocusMin = 0
    for (const d of focusByDay) { weekFocusMin += d.minutes }

    // Last week todos
    let lastWeekTodos = 0
    for (const t of todos) {
      if (t.completed && t.completedAt && t.completedAt >= lastWeekStartMs && t.completedAt < lastWeekEndMs) lastWeekTodos++
    }

    const pomodoroTrend = lastWeekPomodoro > 0 ? Math.round(((weekPomodoro - lastWeekPomodoro) / lastWeekPomodoro) * 100) : weekPomodoro > 0 ? 100 : 0
    const todoTrend = lastWeekTodos > 0 ? Math.round(((weekTodos - lastWeekTodos) / lastWeekTodos) * 100) : weekTodos > 0 ? 100 : 0

    // Habit trend
    let lastWeekHabitAvg = 0
    if (habits.length > 0) {
      let habitSum = 0
      for (const d of last7Arr) { habitSum += Math.round(((habitsCountByDate.get(d) || 0) / habits.length) * 100) }
      lastWeekHabitAvg = Math.round(habitSum / 7)
    }
    const habitTrend = lastWeekHabitAvg > 0 ? weekHabitAvg - lastWeekHabitAvg : weekHabitAvg > 0 ? 100 : 0

    // Last week active days & goal days
    const lastWeekActiveDays = lastWeekDayNumCounts.size
    let lastWeekGoalDays = 0
    for (const count of lastWeekDayNumCounts.values()) { if (count >= dailyPomodoroGoal) lastWeekGoalDays++ }

    // Weekly efficiency score
    const weekEfficiency = Math.round(((weekPomodoro / (dailyPomodoroGoal * 7)) + (activeDays / 7) + (weekHabitAvg / 100)) / 3 * 100)

    const avgFocusPerDay = activeDays > 0 ? Math.round(weekFocusMin / 7) : 0
    const avgTodoPerDay = weekTodos / 7

    return { weekPomodoro, weekTodos, weekHabitAvg, activeDays, weekFocusMinutes: weekFocusMin, pomodoroTrend, todoTrend, habitTrend, weekEfficiency: Math.min(weekEfficiency, 100), lastWeekActiveDays, lastWeekGoalDays, avgFocusPerDay, avgTodoPerDay, avgPomodoro, goalDays: goalDaysCount }
  }, [pomodoroByDay, focusByDay, todosByDay, habitsByDay, pomodoroSessions, todos, habits, dailyPomodoroGoal, habitsCountByDate, todayMidnightMs])

  const exportCSV = useCallback(() => {
    const rows = [['日期', '类型', '开始时间', '结束时间', '时长(分钟)', '完成']]
    const DAY = 86400000
    for (const s of pomodoroSessions) {
      rows.push([
        dayNumToDateStr(Math.floor(s.startedAt / DAY)),
        s.type === 'work' ? '专注' : '休息',
        fmtHHmmss(s.startedAt),
        fmtHHmmss(s.endedAt),
        String(durationMinutes(s.startedAt, s.endedAt)),
        s.completed ? '是' : '否',
      ])
    }
    const csv = '﻿' + rows.map((r) => r.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abworkbench-pomodoro-${dayNumToDateStr(Math.floor(Date.now() / DAY))}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [pomodoroSessions])

  const exportAllCSV = useCallback(() => {
    // Sheet 1: Todos
    const DAY = 86400000
    const todoRows = [['任务', '优先级', '状态', '创建时间', '完成时间', '截止日期']]
    for (const t of todos) {
      todoRows.push([
        t.text,
        t.priority === 'high' ? '高' : t.priority === 'medium' ? '中' : '低',
        t.completed ? '已完成' : '进行中',
        `${dayNumToDateStr(Math.floor(t.createdAt / DAY))} ${fmtHHmm(t.createdAt)}`,
        t.completedAt ? `${dayNumToDateStr(Math.floor(t.completedAt / DAY))} ${fmtHHmm(t.completedAt)}` : '',
        t.dueDate || '',
      ])
    }

    // Sheet 2: Habits
    const habitRows = [['打卡项', '打卡日期']]
    for (const h of habits) {
      for (const d of h.completedDates) {
        habitRows.push([`${h.icon} ${h.name}`, d])
      }
    }

    // Sheet 3: Notes
    const noteRows = [['标题', '内容', '创建时间', '更新时间', '置顶']]
    for (const n of notes) {
      noteRows.push([
        n.title,
        n.content.replace(/\n/g, ' '),
        `${dayNumToDateStr(Math.floor(n.createdAt / DAY))} ${fmtHHmm(n.createdAt)}`,
        `${dayNumToDateStr(Math.floor(n.updatedAt / DAY))} ${fmtHHmm(n.updatedAt)}`,
        n.pinned ? '是' : '否',
      ])
    }

    // Combine all sheets
    const bom = '﻿'
    const sections = [
      '=== 待办事项 ===',
      todoRows.map((r) => r.map(csvEscape).join(',')).join('\n'),
      '',
      '=== 每日打卡 ===',
      habitRows.map((r) => r.map(csvEscape).join(',')).join('\n'),
      '',
      '=== 笔记 ===',
      noteRows.map((r) => r.map(csvEscape).join(',')).join('\n'),
      '',
      '=== 番茄钟 ===',
      ...pomodoroSessions.map((s) => [
        dayNumToDateStr(Math.floor(s.startedAt / DAY)),
        s.type === 'work' ? '专注' : '休息',
        fmtHHmmss(s.startedAt),
        fmtHHmmss(s.endedAt),
        String(durationMinutes(s.startedAt, s.endedAt)),
        s.completed ? '是' : '否',
      ].map(csvEscape).join(',')),
    ]
    const csv = bom + sections.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abworkbench-all-data-${dayNumToDateStr(Math.floor(Date.now() / DAY))}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [todos, habits, notes, pomodoroSessions])

  const [copiedSummary, setCopiedSummary] = useState(false)
  const copyWeeklySummary = useCallback(() => {
    const trendEmoji = (v: number) => v > 0 ? '📈' : v < 0 ? '📉' : '➡️'
    const trendText = (v: number) => v > 0 ? `+${v}%` : v < 0 ? `${v}%` : '持平'
    const lines = [
      `📊 Abworkbench 周报 (${dayNumToShortLabel(Math.floor((Date.now() - 6 * 86400000) / 86400000))}-${dayNumToShortLabel(Math.floor(Date.now() / 86400000))})`,
      '',
      `🍅 番茄钟: ${weeklySummary.weekPomodoro}个 (${fmtMin(weeklySummary.weekFocusMinutes)}) ${trendEmoji(weeklySummary.pomodoroTrend)} ${trendText(weeklySummary.pomodoroTrend)}`,
      `✅ 完成任务: ${weeklySummary.weekTodos}个 ${trendEmoji(weeklySummary.todoTrend)} ${trendText(weeklySummary.todoTrend)}`,
      habits.length > 0 ? `🎯 打卡完成率: ${weeklySummary.weekHabitAvg}% ${trendEmoji(weeklySummary.habitTrend)} ${trendText(weeklySummary.habitTrend)}` : null,
      `📅 活跃天数: ${weeklySummary.activeDays}/7`,
      `🏆 达标天数: ${weeklySummary.goalDays}/7 (目标${dailyPomodoroGoal}个/天)`,
      `⚡ 周效率分: ${weeklySummary.weekEfficiency}%`,
      currentStreak.count > 0 ? `🔥 当前连续: ${currentStreak.count}天` : null,
      longestStreak > currentStreak.count ? `🏅 最长连续: ${longestStreak}天` : null,
      bestDayOfWeek ? `⭐ 最佳日: ${bestDayOfWeek.name} (${bestDayOfWeek.count}个)` : null,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(lines).then(() => {
      setCopiedSummary(true)
      setTimeout(() => setCopiedSummary(false), 2000)
    })
  }, [weeklySummary, dailyPomodoroGoal, currentStreak, longestStreak, bestDayOfWeek, habits.length])

  const overviewStats = useMemo(() => [
    {
      label: '总番茄数', value: totalPomodoro,
      sub: `今日 ${todayPomodoro} · 本周 ${weeklySummary.weekPomodoro} · 日均 ${weeklySummary.avgPomodoro}`,
      todayDelta: todayPomodoro - Math.round(Number(weeklySummary.avgPomodoro)),
      icon: Timer, color: 'text-primary', bg: 'bg-primary/15',
    },
    {
      label: '专注时间', value: focusDisplay,
      sub: `均${avgSessionDuration}分/次 · 最长${longestSession}分 · 本周${fmtMin(weeklySummary.weekFocusMinutes)}`,
      todayDelta: todayFocusMin - weeklySummary.avgFocusPerDay,
      icon: Flame, color: 'text-success', bg: 'bg-success/15',
    },
    {
      label: '完成任务', value: totalCompletedTodos,
      sub: `今日 ${todayCompletedTodos} · 本周 ${weekCompletedTodos}${todos.length > 0 ? ` · 完成率 ${Math.round((totalCompletedTodos / todos.length) * 100)}%` : ''}`,
      todayDelta: todayCompletedTodos - Math.round(weeklySummary.avgTodoPerDay),
      icon: CheckSquare, color: 'text-warning', bg: 'bg-warning/15',
    },
    {
      label: '打卡次数', value: totalHabitDays,
      sub: habits.length > 0 ? `${habits.length} 个打卡项${todayHabits > 0 ? ` · 今日 ${todayHabits}/${habits.length}` : ''} · 本周 ${weeklySummary.weekHabitAvg}% · 本月 ${monthRate}%` : undefined,
      todayDelta: todayHabitRate - weeklySummary.weekHabitAvg,
      icon: Target, color: 'text-purple-400', bg: 'bg-purple-500/15',
    },
  ], [totalPomodoro, todayPomodoro, weeklySummary, focusDisplay, avgSessionDuration, longestSession, todayFocusMin, totalCompletedTodos, todayCompletedTodos, weekCompletedTodos, todos.length, totalHabitDays, habits.length, todayHabits, monthRate, todayHabitRate])

  return (
    <section className={embedded ? 'space-y-6' : 'space-y-6 animate-fade-in'}>
      {embedded && (
        <div className="relative overflow-hidden rounded-[34px] border border-border bg-surface/85 p-6 shadow-2xl shadow-black/10 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <BarChart3 size={14} />
                数据分析
              </div>
              <h2 className="text-2xl font-black tracking-tight text-text">统计总览</h2>
              <p className="mt-1 text-sm text-text-muted">集中查看专注、任务、打卡和笔记的长期趋势。</p>
            </div>
            <div className="text-xs text-text-muted">已并入仪表盘底部</div>
          </div>
        </div>
      )}
      {/* Export Button */}
      {(pomodoroSessions.length > 0 || todos.length > 0 || habits.length > 0) && (
        <div className="flex justify-end gap-2">
          <button onClick={copyWeeklySummary} className="btn-secondary text-xs">
            <Copy size={14} />
            {copiedSummary ? '已复制' : '复制周报'}
          </button>
          {pomodoroSessions.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary text-xs">
              <Download size={14} />
              导出番茄数据
            </button>
          )}
          <button onClick={exportAllCSV} className="btn-secondary text-xs">
            <Download size={14} />
            导出全部数据
          </button>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {overviewStats.map((stat) => {
            const Icon = stat.icon
            const delta = stat.todayDelta
            return (
              <div key={stat.label} className="glass-card p-4">
                <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                  <Icon size={16} className={stat.color} />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-xl md:text-2xl font-bold text-text">{stat.value}</div>
                  {delta !== 0 && Math.abs(delta) >= 1 && (
                    <span className={`text-[10px] font-medium ${delta > 0 ? 'text-success' : 'text-danger'}`}>
                      {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted mt-1">{stat.label}</div>
                {'sub' in stat && stat.sub && (
                  <div className="text-[10px] text-text-muted mt-0.5">{stat.sub}</div>
                )}
              </div>
            )
          })}
      </div>

      {/* Weekly Summary */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={18} className="text-primary" />
          <h3 className="text-sm font-semibold text-text">本周总结</h3>
        </div>

        {/* Monthly mini stats */}
        <div className="flex items-center gap-4 mb-4 pb-3 border-b border-border text-xs text-text-muted">
          <span className="font-medium text-text">{currentMonthLabel}</span>
          <span>番茄 <span className="text-primary font-medium">{monthPomodoro}</span>{pomodoroTrend !== 0 && <span className={pomodoroTrend > 0 ? 'text-success ml-0.5' : 'text-danger ml-0.5'}>{pomodoroTrend > 0 ? '↑' : '↓'}{Math.abs(pomodoroTrend)}%</span>}</span>
          <span>任务 <span className="text-success font-medium">{monthTodos}</span>{monthTodoRate >= 0 && <span className="text-text-muted/60"> ({monthTodoRate}%)</span>}</span>
          <span>专注 <span className="text-warning font-medium">{monthFocusDisplay}</span>{focusTrend !== 0 && <span className={focusTrend > 0 ? 'text-success ml-0.5' : 'text-danger ml-0.5'}>{focusTrend > 0 ? '↑' : '↓'}{Math.abs(focusTrend)}%</span>}</span>
          <span>打卡 <span className="text-orange-400 font-medium">{monthHabitCount}</span> 次{habitTrend !== 0 && <span className={habitTrend > 0 ? 'text-success ml-0.5' : 'text-danger ml-0.5'}>{habitTrend > 0 ? '↑' : '↓'}{Math.abs(habitTrend)}%</span>}</span>
          <span>日均 <span className="text-purple-400 font-medium">{avgPomodoroPerDay}</span> 个番茄</span>
          <span>日均专注 <span className="text-cyan-400 font-medium">{avgFocusPerDay}</span> 分</span>
          <span>活跃 <span className="text-emerald-400 font-medium">{monthActiveDays}</span>/{daysInMonth} 天</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-surface-lighter/50 text-center">
            <div className="text-lg font-bold text-primary">{weeklySummary.weekPomodoro}</div>
            <div className="text-xs text-text-muted mt-1">番茄钟</div>
            <div className="text-[10px] text-text-muted flex items-center justify-center gap-1">
              {fmtMin(weeklySummary.weekFocusMinutes)}
              {weeklySummary.pomodoroTrend !== 0 && (
                <span className={weeklySummary.pomodoroTrend > 0 ? 'text-success' : 'text-danger'}>
                  {weeklySummary.pomodoroTrend > 0 ? '↑' : '↓'}{Math.abs(weeklySummary.pomodoroTrend)}%
                </span>
              )}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              日均 {(weeklySummary.weekPomodoro / 7).toFixed(1)} 个
              {weeklySummary.activeDays > 0 && <span> · 活跃日均 {Math.round(weeklySummary.weekPomodoro / weeklySummary.activeDays)} 个</span>}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-surface-lighter/50 text-center">
            <div className="text-lg font-bold text-success">{weeklySummary.weekTodos}</div>
            <div className="text-xs text-text-muted mt-1">完成任务</div>
            {weeklySummary.todoTrend !== 0 && (
              <div className={`text-[10px] ${weeklySummary.todoTrend > 0 ? 'text-success' : 'text-danger'}`}>
                {weeklySummary.todoTrend > 0 ? '↑' : '↓'}{Math.abs(weeklySummary.todoTrend)}% 较上周
              </div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-surface-lighter/50 text-center">
            <div className="text-lg font-bold text-warning">{weeklySummary.weekHabitAvg}%</div>
            <div className="text-xs text-text-muted mt-1">打卡完成率</div>
            {weeklySummary.habitTrend !== 0 && (
              <div className={`text-[10px] ${weeklySummary.habitTrend > 0 ? 'text-success' : 'text-danger'}`}>
                {weeklySummary.habitTrend > 0 ? '↑' : '↓'}{Math.abs(weeklySummary.habitTrend)}% 较上周
              </div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-surface-lighter/50 text-center">
            <div className="text-lg font-bold text-purple-400">{weeklySummary.activeDays}/7</div>
            <div className="text-xs text-text-muted mt-1">活跃天数</div>
            {weeklySummary.lastWeekActiveDays > 0 && weeklySummary.activeDays !== weeklySummary.lastWeekActiveDays && (
              <div className={`text-[10px] ${weeklySummary.activeDays > weeklySummary.lastWeekActiveDays ? 'text-success' : 'text-danger'}`}>
                {weeklySummary.activeDays > weeklySummary.lastWeekActiveDays ? '↑' : '↓'}上周 {weeklySummary.lastWeekActiveDays} 天
              </div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-surface-lighter/50 text-center">
            <div className={`text-lg font-bold ${weeklySummary.goalDays >= 5 ? 'text-success' : weeklySummary.goalDays >= 3 ? 'text-warning' : 'text-danger'}`}>{weeklySummary.goalDays}/7</div>
            <div className="text-xs text-text-muted mt-1">达标天数</div>
            <div className="h-1 mt-1.5 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(weeklySummary.goalDays / 7) * 100}%`,
                  backgroundColor: weeklySummary.goalDays >= 5 ? 'var(--color-success)' : weeklySummary.goalDays >= 3 ? 'var(--color-warning)' : 'var(--color-danger)',
                }}
              />
            </div>
            {weeklySummary.lastWeekGoalDays > 0 && weeklySummary.goalDays !== weeklySummary.lastWeekGoalDays ? (
              <div className={`text-[10px] mt-1 ${weeklySummary.goalDays > weeklySummary.lastWeekGoalDays ? 'text-success' : 'text-danger'}`}>
                {weeklySummary.goalDays > weeklySummary.lastWeekGoalDays ? '↑' : '↓'}上周 {weeklySummary.lastWeekGoalDays} 天
              </div>
            ) : (
              <div className="text-[10px] text-text-muted mt-1">目标 {dailyPomodoroGoal} 个/天</div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-surface-lighter/50 text-center">
            <div className={`text-lg font-bold ${weeklySummary.weekEfficiency >= 80 ? 'text-success' : weeklySummary.weekEfficiency >= 50 ? 'text-warning' : 'text-danger'}`}>{weeklySummary.weekEfficiency}%</div>
            <div className="text-xs text-text-muted mt-1">周效率分</div>
            <div className="h-1 mt-1.5 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${weeklySummary.weekEfficiency}%`,
                  background: weeklySummary.weekEfficiency >= 80
                    ? 'linear-gradient(90deg, var(--color-success), #059669)'
                    : weeklySummary.weekEfficiency >= 50
                    ? 'linear-gradient(90deg, var(--color-warning), #d97706)'
                    : 'linear-gradient(90deg, var(--color-danger), #dc2626)',
                }}
              />
            </div>
            <div className={`text-[10px] mt-1 ${weeklySummary.weekEfficiency >= 80 ? 'text-success' : weeklySummary.weekEfficiency >= 50 ? 'text-warning' : 'text-danger'}`}>
              {weeklySummary.weekEfficiency >= 80 ? '优秀' : weeklySummary.weekEfficiency >= 50 ? '良好' : '需努力'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-surface-lighter/50 text-center">
            <div className="text-lg font-bold text-cyan-400">{workBreakRatio}</div>
            <div className="text-xs text-text-muted mt-1">专注/休息比</div>
            <div className="text-[10px] text-text-muted">工作与休息</div>
          </div>
        </div>
      </div>

      {/* Best Day */}
      {bestDayOfWeek && (
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <BarChart3 size={20} className="text-purple-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-text">最高效的一天：{bestDayOfWeek.name}</div>
            <div className="text-xs text-text-muted">
              累计完成 {bestDayOfWeek.count} 个番茄钟
              {totalPomodoro > 0 && <span className="ml-1">(占 {Math.round(bestDayOfWeek.count / totalPomodoro * 100)}%)</span>}
            </div>
          </div>
        </div>
      )}

      {/* Streak */}
      {(currentStreak.count > 0 || longestStreak > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {currentStreak.count > 0 && (
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                <Flame size={20} className="text-orange-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-text">当前连续</div>
                <div className="text-xs text-text-muted">自 {currentStreak.startDate} 起</div>
              </div>
              <div className="ml-auto text-2xl font-bold text-orange-400">
                {currentStreak.count}<span className="text-xs text-text-muted ml-0.5">天</span>
              </div>
            </div>
          )}
          {longestStreak > 0 && (
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center">
                <Flame size={20} className="text-yellow-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-text">最长连续</div>
                <div className="text-xs text-text-muted">历史最佳记录</div>
              </div>
              <div className="ml-auto text-2xl font-bold text-yellow-400">
                {longestStreak}<span className="text-xs text-text-muted ml-0.5">天</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pomodoro Chart */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Timer size={18} className="text-primary" />
          <h3 className="text-sm font-semibold text-text">近7天番茄钟</h3>
          <span className="ml-auto text-xs text-text-muted">
            共 {chartStats.pomoTotal} 个 · 达标 {chartStats.pomoGoalDays} 天 · 日均 {chartStats.pomoDailyAvg}
          </span>
        </div>
        {chartStats.pomoBestDay.count > 0 && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-primary/5">
            <Flame size={14} className="text-primary" />
            <span className="text-xs text-text-muted">最佳: <span className="text-primary font-medium">{chartStats.pomoBestDay.label}</span> ({chartStats.pomoBestDay.count}个)</span>
            {chartStats.pomoQuietestDay && chartStats.pomoQuietestDay.count !== chartStats.pomoBestDay.count && (
              <span className="text-xs text-text-muted ml-2">最少: <span className="text-text-muted font-medium">{chartStats.pomoQuietestDay.label}</span> ({chartStats.pomoQuietestDay.count}个)</span>
            )}
          </div>
        )}
        <BarChart
          data={pomodoroByDay}
          max={maxPomodoro}
          color="var(--color-primary)"
          labelKey="label"
          valueKey="count"
          target={dailyPomodoroGoal}
        />
      </div>

      {/* Focus Time Chart */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Flame size={18} className="text-success" />
          <h3 className="text-sm font-semibold text-text">近7天专注时长</h3>
          <span className="ml-auto text-xs text-text-muted">
            共 {chartStats.focusTotalDisplay}
            {chartStats.focusActiveDays > 0 && ` · 日均 ${chartStats.focusDailyAvg}分`}
          </span>
        </div>
        {chartStats.focusBestDay.minutes > 0 && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-success/5">
            <Flame size={14} className="text-success" />
            <span className="text-xs text-text-muted">最佳: <span className="text-success font-medium">{chartStats.focusBestDay.label}</span> ({chartStats.focusBestDay.minutes}分{chartStats.focusTotal > 0 ? ` · 占 ${chartStats.focusBestPct}%` : ''})</span>
          </div>
        )}
        <BarChart
          data={focusByDay}
          max={maxFocus}
          color="var(--color-success)"
          labelKey="label"
          valueKey="minutes"
        />
      </div>

      {/* Todo Completion Chart */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckSquare size={18} className="text-success" />
          <h3 className="text-sm font-semibold text-text">近7天任务完成</h3>
          <span className="ml-auto text-xs text-text-muted">
            共 {chartStats.todoTotal} 个
            {chartStats.todoActiveDays > 0 && ` · 日均 ${chartStats.todoDailyAvg}`}
          </span>
        </div>
        {chartStats.todoBestDay.completed > 0 && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-success/5">
            <CheckSquare size={14} className="text-success" />
            <span className="text-xs text-text-muted">最佳: <span className="text-success font-medium">{chartStats.todoBestDay.label}</span> ({chartStats.todoBestDay.completed} 个任务)</span>
          </div>
        )}
        <BarChart
          data={todosByDay}
          max={maxTodos}
          color="var(--color-success)"
          labelKey="label"
          valueKey="completed"
        />
      </div>

      {/* Habit Completion Rate */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target size={18} className="text-warning" />
          <h3 className="text-sm font-semibold text-text">近7天打卡完成率</h3>
          {habits.length > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-text-muted">
              平均 {chartStats.habitAvg}%
              {chartStats.habitTrend > 5 && <span className="text-success">↑</span>}
              {chartStats.habitTrend < -5 && <span className="text-danger">↓</span>}
            </span>
          )}
        </div>
        {chartStats.habitBestDay.rate > 0 && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-warning/5">
            <Target size={14} className="text-warning" />
            <span className="text-xs text-text-muted">最佳: <span className="text-warning font-medium">{chartStats.habitBestDay.label}</span> ({chartStats.habitBestDay.rate}%)</span>
          </div>
        )}
        {habits.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-text-muted">
            添加每日打卡后即可查看完成率
          </div>
        ) : (
        <div className="space-y-3">
          {habitsByDay.map((day, i) => {
            const isToday = i === habitsByDay.length - 1
            return (
            <div key={i} className={`flex items-center gap-3 ${isToday ? 'bg-primary/5 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
              <span className={`text-xs w-10 ${isToday ? 'text-primary font-medium' : 'text-text-muted'}`}>{isToday ? '今天' : day.label}</span>
              <div className="flex-1 h-6 bg-surface-lighter rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${day.rate}%`,
                    backgroundColor: day.rate >= 80 ? 'var(--color-success)' : day.rate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
                    transitionDelay: `${i * 80}ms`,
                  }}
                />
              </div>
              <span className={`text-xs w-10 text-right ${isToday ? 'text-primary font-medium' : 'text-text-muted'}`}>{day.rate}%</span>
            </div>
            )
          })}
        </div>
        )}
      </div>

      {/* Focus Hours Heatmap */}
      {workSessions.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-text">专注时段分布</h3>
            {focusHoursHeatmap.top3.length > 0 && (
              <span className="ml-auto text-xs text-text-muted">
                高峰: <span className="text-cyan-400 font-medium">{focusHoursHeatmap.peakLabel}</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-12 gap-1">
            {focusHoursHeatmap.hourCounts.map((count, hour) => {
              const intensity = count / focusHoursHeatmap.max
              const isTop = focusHoursHeatmap.top3.some((h) => h.hour === hour)
              return (
                <div key={hour} className="flex flex-col items-center gap-0.5">
                  <div
                    className={`w-full aspect-square rounded-sm transition-all ${
                      count > 0 ? '' : 'bg-surface-lighter/50'
                    } ${isTop ? 'ring-1 ring-cyan-400/50' : ''}`}
                    style={{
                      backgroundColor: count > 0 ? `color-mix(in srgb, var(--color-primary) ${Math.max(intensity * 100, 15)}%, transparent)` : undefined,
                    }}
                    title={`${String(hour).padStart(2, '0')}:00 - ${count} 个番茄`}
                  />
                  <span className="text-[8px] text-text-muted/50">{hour % 6 === 0 || hour === 23 ? hour : ''}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-text-muted">
            <span>0:00</span>
            <span>6:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
          <div className="flex items-center justify-end gap-1 mt-2">
            <span className="text-[10px] text-text-muted">少</span>
            {HEATMAP_PERCENTILES.map((pct) => (
              <div
                key={pct}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: `color-mix(in srgb, var(--color-primary) ${pct}%, transparent)` }}
              />
            ))}
            <span className="text-[10px] text-text-muted">多</span>
          </div>
          {focusHoursHeatmap.top3.length > 0 && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border flex-wrap">
              <span className="text-xs text-text-muted">最佳时段:</span>
              {focusHoursHeatmap.top3.map((h) => (
                <span key={h.hour} className="text-xs px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400">
                  {String(h.hour).padStart(2, '0')}:00 ({h.count}个)
                </span>
              ))}
              <span className="text-[10px] text-text-muted ml-auto">
                占总专注 {Math.round(focusHoursHeatmap.top3.reduce((a, h) => a + h.count, 0) / workSessions.length * 100)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Priority Distribution */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-purple-400" />
          <h3 className="text-sm font-semibold text-text">任务优先级分布</h3>
        </div>
        {todos.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-3 bg-surface-lighter rounded-full overflow-hidden flex">
                {chartStats.highPct > 0 && <div className="h-full bg-danger" style={{ width: `${chartStats.highPct}%` }} />}
                {chartStats.medPct > 0 && <div className="h-full bg-warning" style={{ width: `${chartStats.medPct}%` }} />}
                {chartStats.lowPct > 0 && <div className="h-full bg-success" style={{ width: `${chartStats.lowPct}%` }} />}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-text-muted flex-shrink-0">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger" />高</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" />中</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" />低</span>
              </div>
            </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PRIORITY_CARDS.map((p) => {
            const pStats = chartStats.priorityStats.get(p.priority) || { total: 0, completed: 0, completionRate: 0, weekAdded: 0 }
            const pct = todos.length > 0 ? Math.round((pStats.total / todos.length) * 100) : 0
            return (
              <div key={p.label} className="text-center p-3 rounded-lg bg-surface-lighter/50">
                <div className={`text-2xl font-bold ${p.textColor}`}>{pStats.total}</div>
                <div className="text-xs text-text-muted mt-1">{p.label}</div>
                <div className="text-[10px] text-text-muted mt-1">{pct}% 占比{pStats.weekAdded > 0 && <span> · 本周 +{pStats.weekAdded}</span>}</div>
                <div className={`h-1 mt-2 rounded-full ${p.color} mx-auto`} style={{ width: `${Math.max(pct, 10)}%` }} />
                {pStats.total > 0 && (
                  <>
                    <div className="text-[10px] text-text-muted mt-1.5">
                      完成率 <span className={p.textColor}>{pStats.completionRate}%</span>
                    </div>
                    <div className="h-1 mt-1 bg-surface-lighter rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p.color}`}
                        style={{ width: `${pStats.completionRate}%`, opacity: 0.7 }}
                      />
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
