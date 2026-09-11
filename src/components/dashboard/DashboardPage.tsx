import {
  CheckSquare,
  Timer,
  StickyNote,
  Clock,
  Zap,
  Target,
  ArrowRight,
  CircleCheck,
  Flame,
  BarChart3,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  Award,
  Banknote,
  BriefcaseBusiness,
  FolderKanban,
  Settings2,
  X,
} from 'lucide-react'
import { lazy, Suspense, useState, useMemo, useEffect, useCallback } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import type { Page } from '../layout/Sidebar'
import { useStore } from '../../store'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { useWorkbenchStore } from '../../modules/workbench/hooks/useWorkbenchStore'
import { buildWorkbenchProjectOverview } from './projectOverview'
import { useToday } from '../../hooks/useToday'
import { prevDateStr, nextDateStr } from '../../modules/taskflow/dateUtils'
import { useCurrentHour } from '../../hooks/useCurrentHour'
import { useTick } from '../../hooks/useTick'
import { getRelativeTime, WEEKDAY_NAMES, durationMinutes, fmtMin, getHabitStreak, dayNumToDateStr, getMonthLabel, dayNumToShortLabel, fmtHHmm, dayNumToFullLabel, dayNumToYMD } from '../../utils/format'
import { buildPomodoroByDateMap, buildCompletedByDateMap, buildCreatedDateMap, buildHabitsByDateMap } from '../../utils/stats'
import { buildAchievements } from '../../utils/achievements'
import { showToast } from '../../modules/taskflow/utils/toastEvent'
import { generateMockWeather } from '../weather/WeatherWidget'
import { useTranslation } from '../../i18n'
import { formatGreetingTitle } from './greetingTitle'
import { buildTodayPlanning, type PlanningTone } from './todayPlanning'
import { getHabitProgress } from '../habits/habitSchedule'
import DashboardReminders from './DashboardReminders'
import { buildWorkdayStatus, formatCountdown, formatCurrency, normalizeWorkdaySettings, readWorkdaySettings, WORKDAY_SETTINGS_KEY, type WorkdaySettings } from './workday'
import { getPeriod, stripMarkdown } from './notePreview'
import { safeSet } from '../../utils/safeLocalStorage'
import ErrorBoundary from '../common/ErrorBoundary'
import { GlassCard } from '../common/GlassSurface'
import BorderGlow from '../common/BorderGlow/BorderGlow'
import { useBorderGlowSurfaceColor, useBorderGlowTheme } from '../common/BorderGlow/borderGlowTheme'
const StatsPage = lazy(() => import('../stats/StatsPage'))

interface DashboardPageProps {
  onNavigate: (page: Page) => void
  onOpenClockPanel?: () => void
  onOpenDatePanel?: () => void
}

const WELCOME_ACTION_KEYS = [
  { page: 'taskflow' as Page, labelKey: 'dashboard.createFirstTask' as const, icon: CheckSquare },
  { page: 'pomodoro' as Page, labelKey: 'dashboard.startPomodoro' as const, icon: Timer },
  { page: 'habits' as Page, labelKey: 'dashboard.addHabit' as const, icon: Target },
  { page: 'notes' as Page, labelKey: 'dashboard.writeNote' as const, icon: StickyNote },
]

const PLANNING_TONE_STYLES: Record<PlanningTone, { dot: string; text: string; badge: string }> = {
  danger: { dot: 'bg-danger', text: 'text-danger', badge: 'bg-danger/10 text-danger' },
  warning: { dot: 'bg-warning', text: 'text-warning', badge: 'bg-warning/10 text-warning' },
  success: { dot: 'bg-success', text: 'text-success', badge: 'bg-success/10 text-success' },
  primary: { dot: 'bg-primary', text: 'text-primary', badge: 'bg-primary/10 text-primary' },
  muted: { dot: 'bg-text-muted/40', text: 'text-text-muted', badge: 'bg-surface-lighter text-text-muted' },
}

const CONDITION_ICONS = { sunny: Sun, cloudy: Cloud, rainy: CloudRain, snowy: CloudSnow } as const
const CONDITION_COLORS = { sunny: 'text-yellow-400', cloudy: 'text-gray-400', rainy: 'text-blue-400', snowy: 'text-white' } as const

function writeWorkdaySettings(settings: WorkdaySettings): WorkdaySettings {
  const normalized = normalizeWorkdaySettings(settings)
  safeSet(WORKDAY_SETTINGS_KEY, normalized)
  return normalized
}

function DashboardCardHeader({
  icon: Icon,
  title,
  trailing,
  subtitle,
  iconClassName = 'text-primary',
  className,
}: {
  icon?: LucideIcon
  title: string
  trailing?: ReactNode
  subtitle?: string
  iconClassName?: string
  className?: string
}) {
  return (
    <div className={clsx('dashboard-card-header', className)}>
      <div className="dashboard-card-header__main min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon size={15} className={clsx('shrink-0', iconClassName)} /> : null}
          <h3 className="truncate text-sm font-semibold text-text">{title}</h3>
          {subtitle ? (
            <span className="hidden min-w-0 truncate text-xs text-text-muted lg:inline">
              <span className="mx-1.5 text-text-muted/40">·</span>
              {subtitle}
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-text-muted lg:hidden">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="dashboard-card-header__trailing shrink-0">{trailing}</div> : null}
    </div>
  )
}

export default function DashboardPage({ onNavigate, onOpenClockPanel, onOpenDatePanel }: DashboardPageProps) {
  const taskFlowTasks = useTaskStore((s) => s.tasks)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const workbenchProjects = useWorkbenchStore((s) => s.projects)
  const workbenchTasks = useWorkbenchStore((s) => s.tasks)
  const hydrateWorkbench = useWorkbenchStore((s) => s.hydrate)
  const notes = useStore((s) => s.notes)
  const pomodoroSessions = useStore((s) => s.pomodoroSessions)
  const habits = useStore((s) => s.habits)
  const userName = useStore((s) => s.userName)
  const weatherCity = useStore((s) => s.weatherCity)
  const checkInHabit = useStore((s) => s.checkInHabit)
  const undoHabitCheckIn = useStore((s) => s.undoHabitCheckIn)
  const dailyPomodoroGoal = useStore((s) => s.dailyPomodoroGoal)
  const [togglingHabitId, setTogglingHabitId] = useState<string | null>(null)
  const [showAllTimeline, setShowAllTimeline] = useState(false)
  const [showDashboardStats, setShowDashboardStats] = useState(() => {
    try {
      const raw = localStorage.getItem('abworkbench-dashboard-stats-open')
      if (raw == null) return document.documentElement.dataset.workspaceMode === 'dashboard'
      return raw === '1'
    } catch {
      return false
    }
  })
  const now = useTick(1000)
  const glowTheme = useBorderGlowTheme()
  const surfaceColor = useBorderGlowSurfaceColor()
  const [showWorkdaySettings, setShowWorkdaySettings] = useState(false)
  const [workdaySettings, setWorkdaySettings] = useState<WorkdaySettings>(readWorkdaySettings)
  const [draftWorkdaySettings, setDraftWorkdaySettings] = useState<WorkdaySettings>(workdaySettings)
  const hour = useCurrentHour()
  const { t, tWith } = useTranslation()

  const weather = useMemo(() => generateMockWeather(weatherCity), [weatherCity])

  useEffect(() => {
    fetchTasks().catch((err) => {
      console.error('Failed to fetch tasks:', err)
      showToast('加载任务失败', 'error')
    })
    void hydrateWorkbench().catch((err) => {
      console.error('Failed to hydrate workbench:', err)
      showToast('加载工作台项目失败', 'error')
    })
  }, [fetchTasks, hydrateWorkbench])

  const { todayStr, todayMidnightMs, tomorrowMidnightMs, yesterdayStr } = useToday()
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const isSelectedToday = selectedDate === todayStr
  const prevDay = () => setSelectedDate((d) => prevDateStr(d))
  const nextDay = () => setSelectedDate((d) => nextDateStr(d))

  const todos = useMemo(() => taskFlowTasks.map((task) => ({
    id: task.id,
    title: task.title,
    text: task.title,
    completed: task.status === 'done',
    priority: task.priority,
    createdAt: Date.parse(task.createdAt),
    completedAt: task.completedAt ? Date.parse(task.completedAt) : undefined,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : undefined,
  })), [taskFlowTasks])

  const navigateFromCard = useCallback((page: Page, event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target
    if (target instanceof HTMLElement && target.closest('button,a,input,textarea,select')) {
      return
    }
    onNavigate(page)
  }, [onNavigate])

  const handleCardKeyDown = useCallback((page: Page, event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onNavigate(page)
  }, [onNavigate])

  const baseData = useMemo(() => {
    const todayDayNum = Math.floor(todayMidnightMs / 86400000)

    // Single pass over todos
    let completedTodos = 0
    let overdueTodos = 0
    let dueTodayTodos = 0
    for (const t of todos) {
      if (t.completed) { completedTodos++; continue }
      if (t.dueDate) {
        if (t.dueDate < todayStr) overdueTodos++
        else if (t.dueDate === todayStr) dueTodayTodos++
      }
    }

    // Single pass over pomodoroSessions
    const todaySessions: typeof pomodoroSessions = []
    const todayWorkSessions: typeof pomodoroSessions = []
    let todayFocusMinutes = 0
    for (const s of pomodoroSessions) {
      if (s.startedAt >= todayMidnightMs && s.startedAt < tomorrowMidnightMs) {
        todaySessions.push(s)
        if (s.type === 'work' && s.completed) {
          todayWorkSessions.push(s)
          todayFocusMinutes += durationMinutes(s.startedAt, s.endedAt)
        }
      }
    }

    // Single pass over habits
    let completedHabitsToday = 0
    let completedHabitsYesterday = 0
    let longestHabitStreak = 0
    const completedHabitIdsToday = new Set<string>()
    const habitStreakMap = new Map<string, number>()
    for (const h of habits) {
      const dateSet = new Set(h.completedDates)
      if (dateSet.has(todayStr)) { completedHabitsToday++; completedHabitIdsToday.add(h.id) }
      if (dateSet.has(yesterdayStr)) completedHabitsYesterday++
      const streak = getHabitStreak(dateSet, todayStr, yesterdayStr)
      habitStreakMap.set(h.id, streak)
      if (streak > longestHabitStreak) longestHabitStreak = streak
    }

    // Single pass over notes
    const monthStartMs = todayMidnightMs - (dayNumToYMD(todayDayNum).d - 1) * 86400000
    let todayNewNotes = 0
    let totalNoteChars = 0
    for (const n of notes) {
      totalNoteChars += n.content.length
      if (n.createdAt >= todayMidnightMs && n.createdAt < tomorrowMidnightMs) todayNewNotes++
    }

    return { completedTodos, overdueTodos, dueTodayTodos, todaySessions, todayWorkSessions, todayFocusMinutes, completedHabitsToday, todayNewNotes, completedHabitsYesterday, longestHabitStreak, totalNoteChars, completedHabitIdsToday, habitStreakMap, monthStartMs }
  }, [todos, pomodoroSessions, habits, notes, todayStr, todayMidnightMs, tomorrowMidnightMs, yesterdayStr])
  const { completedTodos, overdueTodos, dueTodayTodos, todaySessions, todayWorkSessions, todayFocusMinutes, completedHabitsToday, todayNewNotes, completedHabitsYesterday, longestHabitStreak, totalNoteChars, completedHabitIdsToday, habitStreakMap, monthStartMs } = baseData

  const derivedData = useMemo(() => {
    const DAY = 86400000
    const monthStartDayNum = Math.floor(monthStartMs / DAY)
    const monthStartStr = dayNumToDateStr(monthStartDayNum)
    const daysInMonth = Math.floor((todayMidnightMs - monthStartMs) / DAY) + 1

    // Pre-build date-keyed maps via shared utilities
    const pomodoroByDate = buildPomodoroByDateMap(pomodoroSessions)
    const todosCompletedByDate = buildCompletedByDateMap(todos)
    const todosCreatedByDate = buildCreatedDateMap(todos)
    const habitsByDate = buildHabitsByDateMap(habits)

    // Monthly aggregates derived from the maps
    let monthPomodoroTotal = 0; let monthFocusTotal = 0
    const pomodoroDayNums = new Set<number>()
    for (const [d, b] of pomodoroByDate) {
      const [y, m, dd] = d.split('-').map(Number)
      pomodoroDayNums.add(Math.floor(Date.UTC(y, m - 1, dd) / DAY))
      if (d >= monthStartStr) { monthPomodoroTotal += b.count; monthFocusTotal += b.minutes }
    }
    let monthTodos = 0
    for (const [d, c] of todosCompletedByDate) { if (d >= monthStartStr) monthTodos += c }
    let monthTotalTodos = 0
    for (const [d, c] of todosCreatedByDate) { if (d >= monthStartStr) monthTotalTodos += c }
    let monthHabitCount = 0
    for (const [d, c] of habitsByDate) { if (d >= monthStartStr) monthHabitCount += c }

    // Monthly stats
    const monthTodoRate = monthTotalTodos > 0 ? Math.round((monthTodos / monthTotalTodos) * 100) : -1
    const monthHabitRate = habits.length > 0 ? Math.round((monthHabitCount / (habits.length * daysInMonth)) * 100) : -1
    const monthlyGoal = dailyPomodoroGoal * daysInMonth
    const monthlyProgress = Math.min(Math.round((monthPomodoroTotal / monthlyGoal) * 100), 100)

    // Productivity score
    const pomodoroRate = Math.min(todayWorkSessions.length / dailyPomodoroGoal, 1)
    const taskRate = todos.length > 0 ? completedTodos / todos.length : -1
    const habitRate = habits.length > 0 ? completedHabitsToday / habits.length : -1
    let scoreSum = pomodoroRate; let scoreCount = 1
    if (taskRate >= 0) { scoreSum += taskRate; scoreCount++ }
    if (habitRate >= 0) { scoreSum += habitRate; scoreCount++ }
    const totalScore = Math.round((scoreSum / scoreCount) * 100)

    // Yesterday score
    const yesterdayPomodoro = pomodoroByDate.get(yesterdayStr)?.count || 0
    let yScoreSum = Math.min(yesterdayPomodoro / dailyPomodoroGoal, 1); let yScoreCount = 1
    if (todos.length > 0) { yScoreSum += (todosCompletedByDate.get(yesterdayStr) || 0) / todos.length; yScoreCount++ }
    if (habits.length > 0) { yScoreSum += completedHabitsYesterday / habits.length; yScoreCount++ }
    const yesterdayScore = Math.round((yScoreSum / yScoreCount) * 100)

    // Weekly scores using maps
    const todayDayNum = Math.floor(todayMidnightMs / DAY)
    const weekScores: number[] = []
    let sparkMax = 1
    for (let i = 0; i < 7; i++) {
      const d = dayNumToDateStr(todayDayNum - i)
      let sum = 0; let count = 0
      sum += Math.min((pomodoroByDate.get(d)?.count || 0) / dailyPomodoroGoal, 1); count++
      if (todos.length > 0) { sum += (todosCompletedByDate.get(d) || 0) / todos.length; count++ }
      if (habits.length > 0) { sum += (habitsByDate.get(d) || 0) / habits.length; count++ }
      const s = count > 0 ? Math.round((sum / count) * 100) : 0
      weekScores.push(s)
      if (s > sparkMax) sparkMax = s
    }
    const weekAvgScore = Math.round(weekScores.reduce((a, b) => a + b, 0) / 7)
    const scoreDiff = totalScore - yesterdayScore

    // Week/last-week completed todos using todosCompletedByDate map
    const todayDay = (todayDayNum + 4) % 7
    const weekStartMs = todayMidnightMs - ((todayDay === 0 ? 6 : todayDay - 1) * DAY)
    const weekStartDayNum = Math.floor(weekStartMs / DAY)
    const weekStartStr = dayNumToDateStr(weekStartDayNum)
    const lastWeekStartStr = dayNumToDateStr(weekStartDayNum - 7)
    const lastWeekEndStr = dayNumToDateStr(weekStartDayNum - 1)
    let weekCompleted = 0
    let lastWeekCompleted = 0
    for (const [d, count] of todosCompletedByDate) {
      if (d >= weekStartStr) weekCompleted += count
      if (d >= lastWeekStartStr && d <= lastWeekEndStr) lastWeekCompleted += count
    }

    // Habits weekly/monthly rates
    let habitWeekTotal = 0
    let validWeekDateCount = 0
    for (let i = 0; i < 7; i++) {
      const dateStr = dayNumToDateStr(weekStartDayNum + i)
      if (dateStr <= todayStr) {
        validWeekDateCount++
        habitWeekTotal += habitsByDate.get(dateStr) || 0
      }
    }
    const habitWeekRate = habits.length > 0 ? Math.round(habitWeekTotal / (habits.length * validWeekDateCount) * 100) : 0
    const habitMonthRate = habits.length > 0 ? Math.round(monthHabitCount / (habits.length * daysInMonth) * 100) : 0

    // Sparkline SVG data
    const scoreColor = totalScore >= 80 ? 'var(--color-success)' : totalScore >= 50 ? 'var(--color-warning)' : 'var(--color-primary)'
    const progressColor = totalScore >= 80 ? 'text-success' : totalScore >= 50 ? 'text-warning' : 'text-primary'
    const circumference = 2 * Math.PI * 36
    const ringOffset = circumference * (1 - totalScore / 100)
    const sparkW = 120; const sparkH = 24
    const sparkPts = weekScores.map((s, i) => {
      const x = (i / 6) * sparkW
      const y = sparkH - (s / sparkMax) * (sparkH - 4) - 2
      return `${x},${y}`
    })
    const sparkAreaPath = `M0,${sparkH} L${sparkPts.join(' L')} L${sparkW},${sparkH} Z`
    const sparkLinePath = `M${sparkPts.join(' L')}`
    const sparkLastPt = sparkPts[sparkPts.length - 1].split(',')

    // Pomodoro streak using day numbers (pure arithmetic, no format calls)
    let pomodoroStreak = 0
    for (let i = 0; i < 30; i++) {
      if (pomodoroDayNums.has(todayDayNum - i)) pomodoroStreak++
      else if (i > 0) break
    }

    return {
      monthPomodoro: monthPomodoroTotal, monthFocusMinutes: monthFocusTotal, monthTodos, monthTodoRate, daysInMonth, monthHabitCount, monthHabitRate, monthlyProgress,
      totalScore, scoreDiff, weekAvgScore, weekScores, pomodoroRate, taskRate, habitRate,
      weekCompleted, lastWeekCompleted,
      habitWeekRate, habitMonthRate,
      scoreColor, progressColor, circumference, ringOffset, sparkAreaPath, sparkLinePath, sparkLastPt,
      currentMonthLabel: getMonthLabel(monthStartMs),
      pomodoroStreak,
    }
  }, [pomodoroSessions, todos, habits, dailyPomodoroGoal, todayStr, yesterdayStr, todayWorkSessions.length, completedTodos, completedHabitsToday, completedHabitsYesterday, todayMidnightMs, monthStartMs])
  const { totalScore, scoreDiff, weekAvgScore, weekScores, pomodoroRate, taskRate, habitRate, weekCompleted, lastWeekCompleted, habitWeekRate, habitMonthRate, scoreColor, progressColor, circumference, ringOffset, sparkAreaPath, sparkLinePath, sparkLastPt, pomodoroStreak } = derivedData

  const greeting = useMemo(() => {
    const allHabitsDone = habits.length > 0 && completedHabitsToday === habits.length
    const goalReached = todayWorkSessions.length >= dailyPomodoroGoal
    const noPomodorosToday = todayWorkSessions.length === 0

    let text: string
    let sub: string

    if (hour < 6) {
      text = t('dashboard.greeting.night')
      sub = t('dashboard.greeting.nightSub')
    } else if (hour < 12) {
      text = t('dashboard.greeting.morning')
      sub = goalReached ? t('dashboard.greeting.morningGoal') : t('dashboard.greeting.morningSub')
    } else if (hour < 18) {
      text = t('dashboard.greeting.afternoon')
      sub = goalReached ? t('dashboard.greeting.afternoonGoal') : t('dashboard.greeting.afternoonSub')
    } else {
      text = t('dashboard.greeting.evening')
      sub = t('dashboard.greeting.eveningSub')
    }

    if (allHabitsDone && !goalReached) sub = t('dashboard.greeting.allHabitsNotGoal')
    if (allHabitsDone && goalReached) sub = t('dashboard.greeting.allDone')

    if (pomodoroStreak >= 30) {
      sub = tWith('dashboard.greeting.streak30', pomodoroStreak)
    } else if (pomodoroStreak >= 14) {
      sub = t('dashboard.greeting.streak14')
    } else if (pomodoroStreak >= 7) {
      if (noPomodorosToday && hour >= 20) {
        sub = tWith('dashboard.greeting.streakEnding', pomodoroStreak)
      } else if (noPomodorosToday && hour >= 16) {
        sub = tWith('dashboard.greeting.streakToday', pomodoroStreak)
      } else if (!goalReached) {
        sub = tWith('dashboard.greeting.streakKeep', pomodoroStreak)
      }
    } else if (pomodoroStreak >= 3 && noPomodorosToday && hour >= 18) {
      sub = tWith('dashboard.greeting.streakMaintain', pomodoroStreak)
    }

    return { text, sub }
  }, [hour, habits.length, completedHabitsToday, todayWorkSessions.length, dailyPomodoroGoal, pomodoroStreak, t, tWith])

  const completionRateSub = useMemo(() => {
    if (todos.length === 0) return t('dashboard.noTasks')
    const trend = lastWeekCompleted > 0 ? Math.round(((weekCompleted - lastWeekCompleted) / lastWeekCompleted) * 100) : weekCompleted > 0 ? 100 : 0
    return `${completedTodos}/${todos.length}${weekCompleted > 0 ? ` · ${tWith('dashboard.totalSessions', weekCompleted)}${trend !== 0 ? ` · ${trend > 0 ? '↑' : '↓'}${Math.abs(trend)}%` : ''}` : ''}`
  }, [todos.length, completedTodos, weekCompleted, lastWeekCompleted, t, tWith])

  const stats = useMemo(() => [
    {
      label: t('page.todo'),
      page: 'taskflow' as Page,
      value: todos.length,
      sub: `${completedTodos} ${t('todo.completed')}${overdueTodos > 0 ? ` · ${overdueTodos} ${t('dashboard.overdue')}` : dueTodayTodos > 0 ? ` · ${t('dashboard.dueToday')} ${dueTodayTodos}` : ''}`,
      icon: CheckSquare,
      color: 'from-primary to-primary-dark',
      iconBg: 'bg-primary/15',
      iconColor: 'text-primary',
      badge: completedTodos > 0 ? CircleCheck : null,
      badgeColor: 'text-success',
    },
    {
      label: t('page.pomodoro'),
      page: 'pomodoro' as Page,
      value: todayWorkSessions.length,
      sub: `${fmtMin(todayFocusMinutes)} · ${todayWorkSessions.length}/${dailyPomodoroGoal}`,
      icon: Timer,
      color: 'from-success to-emerald-600',
      iconBg: 'bg-success/15',
      iconColor: 'text-success',
      badge: todayWorkSessions.length > 0 ? Flame : null,
      badgeColor: 'text-orange-400',
      streak: pomodoroStreak > 1 ? pomodoroStreak : 0,
    },
    {
      label: t('page.notes'),
      page: 'notes' as Page,
      value: notes.length,
      sub: `${tWith('settings.words', totalNoteChars)}${todayNewNotes > 0 ? ` · ${tWith('dashboard.todayNotes', todayNewNotes)}` : notes.length > 0 ? ` · ${tWith('settings.avgWords', Math.round(totalNoteChars / notes.length))}` : ''}`,
      icon: StickyNote,
      color: 'from-warning to-secondary',
      iconBg: 'bg-warning/15',
      iconColor: 'text-warning',
      badge: null,
      badgeColor: '',
    },
    {
      label: t('stats.progress'),
      page: 'dashboard' as Page,
      value: todos.length > 0 ? `${Math.round((completedTodos / todos.length) * 100)}%` : '—',
      sub: completionRateSub,
      icon: Target,
      color: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-500/15',
      iconColor: 'text-purple-400',
      badge: null,
      badgeColor: '',
    },
  ], [todos.length, completedTodos, overdueTodos, dueTodayTodos, todayWorkSessions.length, todayFocusMinutes, dailyPomodoroGoal, pomodoroStreak, notes.length, totalNoteChars, todayNewNotes, completionRateSub, t, tWith])

  const todayDisplay = useMemo(() => {
    const dayNum = Math.floor(todayMidnightMs / 86400000)
    return `${dayNumToFullLabel(dayNum)}，${WEEKDAY_NAMES[(dayNum + 4) % 7]}`
  }, [todayMidnightMs])
  const currentTimeDisplay = useMemo(() => now.toLocaleTimeString('zh-CN', { hour12: false }), [now])
  const workdayStatus = useMemo(() => buildWorkdayStatus({ now, settings: workdaySettings }), [now, workdaySettings])
  const offWorkCountdown = useMemo(() => formatCountdown(workdayStatus.phase === 'done' ? 0 : workdayStatus.endAt.getTime() - now.getTime()), [now, workdayStatus])
  const workdayPhaseLabel = workdayStatus.phase === 'before' ? '尚未上班' : workdayStatus.phase === 'done' ? '今日已下班' : '距离下班'
  const saveWorkdaySettings = useCallback(() => {
    const saved = writeWorkdaySettings(draftWorkdaySettings)
    setWorkdaySettings(saved)
    setShowWorkdaySettings(false)
  }, [draftWorkdaySettings])

  const recentNotes = useMemo(() => {
    const isBetter = (a: typeof notes[0], b: typeof notes[0]) =>
      a.pinned !== b.pinned ? a.pinned : a.updatedAt > b.updatedAt
    const top: typeof notes = []
    for (const n of notes) {
      if (top.length < 3) {
        top.push(n)
      } else if (isBetter(n, top[2])) {
        top[2] = n
      } else {
        continue
      }
      for (let i = top.length - 1; i > 0; i--) {
        if (isBetter(top[i], top[i - 1])) { const tmp = top[i]; top[i] = top[i - 1]; top[i - 1] = tmp }
        else break
      }
    }
    return top.map((n) => ({ ...n, preview: n.content ? stripMarkdown(n.content) : '空白笔记', relativeTime: getRelativeTime(n.updatedAt) }))
  }, [notes])

  const projectOverview = useMemo(
    () => buildWorkbenchProjectOverview(workbenchProjects, workbenchTasks, 4),
    [workbenchProjects, workbenchTasks],
  )

  const weeklyChartData = useMemo(() => {
    // Build day labels and date strings for this week + last week using timestamps
    const DAY = 86400000
    const lastWeekStartMs = todayMidnightMs - 13 * DAY
    const thisWeekStartMs = todayMidnightMs - 6 * DAY
    const thisWeekStartDayNum = Math.floor(thisWeekStartMs / DAY)
    const thisWeekDates: string[] = []
    const dayLabels: Array<{ day: string; label: string; isToday: boolean }> = []
    for (let i = 0; i < 7; i++) {
      const dayNum = thisWeekStartDayNum + i
      thisWeekDates.push(dayNumToDateStr(dayNum))
      const weekday = (dayNum + 4) % 7 // dayNum 0 = 1970-01-01 Thursday -> (0+4)%7=4=getDay() Thursday
      dayLabels.push({ day: dayNumToShortLabel(dayNum), label: WEEKDAY_NAMES[weekday], isToday: i === 6 })
    }

    // Single pass: bucket work sessions by day using timestamp ranges
    const thisWeekDayBuckets: Array<{ count: number; minutes: number }> = Array.from({ length: 7 }, () => ({ count: 0, minutes: 0 }))
    let lastWeekCount = 0
    for (const s of pomodoroSessions) {
      if (s.type !== 'work' || !s.completed) continue
      if (s.startedAt < lastWeekStartMs) continue
      const min = durationMinutes(s.startedAt, s.endedAt)
      if (s.startedAt < thisWeekStartMs) { lastWeekCount++; continue }
      const dayOffset = Math.floor(s.startedAt / DAY) - thisWeekStartDayNum
      if (dayOffset >= 0 && dayOffset < 7) {
        thisWeekDayBuckets[dayOffset].count++
        thisWeekDayBuckets[dayOffset].minutes += min
      }
    }

    const days = thisWeekDates.map((_dateStr, i) => ({
      ...dayLabels[i],
      count: thisWeekDayBuckets[i].count,
      minutes: thisWeekDayBuckets[i].minutes,
    }))
    let thisWeek = 0; let weekFocusMin = 0; let maxDayCount = 0; let maxDayOccurrences = 0
    for (const d of days) {
      thisWeek += d.count; weekFocusMin += d.minutes
      if (d.count > maxDayCount) { maxDayCount = d.count; maxDayOccurrences = 1 }
      else if (d.count === maxDayCount) maxDayOccurrences++
    }
    const max = Math.max(maxDayCount, dailyPomodoroGoal, 1)
    const bestDayCount = max === maxDayCount ? maxDayOccurrences : days.filter((d) => d.count === max).length
    const trend = lastWeekCount > 0 ? Math.round(((thisWeek - lastWeekCount) / lastWeekCount) * 100) : thisWeek > 0 ? 100 : 0
    return { days, max, thisWeek, lastWeek: lastWeekCount, trend, weekFocusMin, bestDayCount }
  }, [pomodoroSessions, dailyPomodoroGoal, todayMidnightMs])

  const timelineEvents = useMemo(() => {
    const events: Array<{ id: string; time: number; label: string; color: string }> = []

    for (const s of todaySessions) {
      events.push({ id: s.id, time: s.startedAt, label: s.type === 'work' ? t('dashboard.completedPomodoro') : t('dashboard.tookBreak'), color: s.type === 'work' ? 'bg-primary' : 'bg-success' })
    }
    for (const todo of todos) {
      if (todo.completed && todo.completedAt && todo.completedAt >= todayMidnightMs && todo.completedAt < tomorrowMidnightMs) {
        events.push({ id: todo.id, time: todo.completedAt, label: tWith('dashboard.completedTask', todo.text), color: 'bg-success' })
      }
    }
    for (const h of habits) {
      if (completedHabitIdsToday.has(h.id)) {
        events.push({ id: `habit-${h.id}`, time: todayMidnightMs, label: tWith('dashboard.checkedHabit', h.icon, h.name), color: 'bg-warning' })
      }
    }
    for (const n of notes) {
      if (n.createdAt >= todayMidnightMs && n.createdAt < tomorrowMidnightMs) {
        events.push({ id: `note-${n.id}`, time: n.createdAt, label: tWith('dashboard.createdNote', n.title), color: 'bg-purple-500' })
      }
    }

    events.sort((a, b) => b.time - a.time)
    const items = events.map((e) => ({
      ...e,
      hhmm: fmtHHmm(e.time),
      relative: getRelativeTime(e.time),
      period: getPeriod(Math.floor(e.time / 3600000) % 24),
    }))
    return { items, total: events.length }
  }, [todaySessions, todos, habits, notes, todayMidnightMs, tomorrowMidnightMs, completedHabitIdsToday, t, tWith])

  const planningPanel = useMemo(() => buildTodayPlanning({
    hour,
    todayStr,
    yesterdayStr,
    todayMidnightMs,
    tomorrowMidnightMs,
    dailyPomodoroGoal,
    tasks: todos,
    habits,
    pomodoroSessions,
  }), [hour, todayStr, yesterdayStr, todayMidnightMs, tomorrowMidnightMs, dailyPomodoroGoal, todos, habits, pomodoroSessions])

  const achievements = useMemo(() => buildAchievements({
    todayStr,
    todayMidnightMs,
    tasks: todos,
    habits,
    notes,
    pomodoroSessions,
  }), [todayStr, todayMidnightMs, todos, habits, notes, pomodoroSessions])

  const navigateFromPlanning = useCallback((sectionId: string) => {
    if (sectionId === 'habits') {
      onNavigate('habits')
    } else if (sectionId === 'pomodoro') {
      onNavigate('pomodoro')
    } else {
      onNavigate('taskflow')
    }
  }, [onNavigate])

  return (
    <ErrorBoundary>
    <div className="dashboard-page flex flex-col gap-4 motion-stagger">
      {/* Today's overview + workday side-by-side */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:items-stretch">
      <BorderGlow
        {...glowTheme}
        borderRadius={34}
        backgroundColor={surfaceColor}
        glowMaskColor={surfaceColor}
        className="w-full min-w-0 border-glow-card--glass"
        innerClassName="dashboard-hero relative overflow-hidden p-4 md:p-5"
      >
        <div className="relative z-[2] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl min-w-0 flex-1">
            <div className="home-kicker mb-2 inline-flex items-center gap-2">
              <Zap size={12} />
              <button onClick={prevDay} className="rounded px-1 hover:bg-primary/20 transition" title="前一天" aria-label="前一天">←</button>
              <span>{isSelectedToday ? '今日概览' : `${selectedDate} 概览`}</span>
              <button onClick={nextDay} className="rounded px-1 hover:bg-primary/20 transition" title="后一天" aria-label="后一天">→</button>
              {!isSelectedToday && (
                <button onClick={() => setSelectedDate(todayStr)} className="rounded px-1.5 py-0.5 text-[10px] bg-primary/20 hover:bg-primary/30 transition normal-case tracking-normal" aria-label="回到今天">回到今天</button>
              )}
            </div>
            <h2 className="text-3xl font-black tracking-tight text-text md:text-4xl">{formatGreetingTitle(greeting.text, userName)}</h2>
            <div className="mt-2 space-y-1 text-sm text-text-muted">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <button onClick={() => onOpenDatePanel?.()} className="rounded-lg text-left transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30" aria-label="打开日期面板">
                  {todayDisplay}
                </button>
                <span>·</span>
                <button onClick={() => onOpenClockPanel?.()} className="rounded-lg font-numeric tabular-nums text-text transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30" aria-label="打开时钟面板">
                  {currentTimeDisplay}
                </button>
              </div>
              <p className="text-sm leading-snug text-text-muted">{greeting.sub}</p>
            </div>
            {pomodoroStreak > 1 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1">
                <Flame size={14} className={pomodoroStreak >= 30 ? 'text-purple-400' : pomodoroStreak >= 14 ? 'text-amber-400' : 'text-orange-400'} />
                <span className={`text-xs font-semibold ${pomodoroStreak >= 30 ? 'text-purple-400' : pomodoroStreak >= 14 ? 'text-amber-400' : 'text-orange-400'}`}>
                  {pomodoroStreak >= 30 ? tWith('dashboard.streak30Label', pomodoroStreak) : pomodoroStreak >= 14 ? tWith('dashboard.streak14Label', pomodoroStreak) : tWith('dashboard.streakLabel', pomodoroStreak)}
                </span>
              </div>
            )}
            <div className="home-wave-track home-wave-track--compact" aria-hidden>
              {Array.from({ length: 28 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    ['--h' as string]: `${4 + ((i * 17) % 22)}px`,
                    ['--d' as string]: `${(i % 9) * 0.12}s`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-row items-stretch gap-2 self-center">
              <button
                type="button"
                onClick={() => onNavigate('taskflow')}
                className="interactive-glass dashboard-hero-score relative grid h-[6.5rem] w-[6.5rem] place-items-center rounded-[26px] card-float-soft"
                aria-label={`效率分: ${totalScore}分，点击查看任务流`}
              >
                <svg viewBox="0 0 96 96" className="pointer-events-none absolute inset-3 -rotate-90">
                  <circle cx="48" cy="48" r="36" fill="none" stroke="var(--color-border)" strokeWidth="7" />
                  <circle cx="48" cy="48" r="36" fill="none" stroke={scoreColor} strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={ringOffset} className="transition-all duration-700" />
                </svg>
                <span className="relative text-center">
                  <span className="block text-3xl font-black text-text">{totalScore}</span>
                  <span className="block text-[11px] text-text-muted">效率分</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('weather')}
                className="interactive-glass dashboard-hero-weather no-motion relative flex h-[6.5rem] w-[6.5rem] flex-col items-center justify-center gap-1 rounded-[26px] px-2 py-2.5 text-center card-float-soft"
                aria-label={`天气：${weather.city} ${weather.temp}度 ${weather.description}`}
              >
                {(() => {
                  const Icon = CONDITION_ICONS[weather.condition]
                  return <Icon className={`h-6 w-6 shrink-0 ${CONDITION_COLORS[weather.condition]} opacity-90`} />
                })()}
                <div className="text-2xl font-black leading-none text-text">{weather.temp}°</div>
                <div className="text-[10px] leading-tight text-text-muted">{weather.description}</div>
                <div className="max-w-full truncate px-0.5 text-[9px] leading-tight text-text-muted">{weather.city}</div>
              </button>
            </div>
        </div>
        {/* Quick Stats */}
        <div className="relative z-[3] mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 md:grid-cols-5">
          {totalScore > 0 && (
              <button onClick={() => onNavigate('taskflow')} className="interactive-glass dashboard-quick-stat flex items-center gap-1.5 rounded-2xl px-3 py-2 text-left" aria-label={`效率分: ${totalScore}%`}>
                <span className={`text-xs font-medium ${progressColor}`}>{totalScore}%</span>
                <span className="text-xs text-text-muted">{t('dashboard.progress')}</span>
              </button>
          )}
          <button onClick={() => onNavigate('taskflow')} className="interactive-glass dashboard-quick-stat flex items-center gap-1.5 rounded-2xl px-3 py-2 text-left" aria-label={`任务: ${completedTodos}/${todos.length} 已完成`}>
            <CheckSquare size={12} className="text-primary" />
            <span className="text-xs text-text-muted">{tWith('dashboard.tasks', completedTodos, todos.length)}</span>
          </button>
          <button onClick={() => onNavigate('pomodoro')} className="interactive-glass dashboard-quick-stat flex items-center gap-1.5 rounded-2xl px-3 py-2 text-left" aria-label={`番茄钟: ${todayWorkSessions.length}/${dailyPomodoroGoal}`}>
            <Timer size={12} className="text-success" />
            <span className="text-xs text-text-muted">{tWith('dashboard.pomodoros', todayWorkSessions.length, dailyPomodoroGoal)}</span>
          </button>
          <button onClick={() => onNavigate('habits')} className="interactive-glass dashboard-quick-stat flex items-center gap-1.5 rounded-2xl px-3 py-2 text-left" aria-label={`习惯: ${completedHabitsToday}/${habits.length} 已完成`}>
            <Target size={12} className="text-warning" />
            <span className="text-xs text-text-muted">{tWith('dashboard.habits', completedHabitsToday, habits.length)}</span>
            {completedHabitsToday > completedHabitsYesterday && completedHabitsYesterday > 0 && (
              <span className="text-[10px] text-success">↑</span>
            )}
          </button>
          <button onClick={() => onNavigate('notes')} className="interactive-glass dashboard-quick-stat flex items-center gap-1.5 rounded-2xl px-3 py-2 text-left" aria-label={`笔记: ${notes.length} 篇${todayNewNotes > 0 ? `，今日新增 ${todayNewNotes} 篇` : ''}`}>
            <StickyNote size={12} className="text-purple-400" />
            <span className="text-xs text-text-muted">{tWith('dashboard.notesCount', notes.length)}{todayNewNotes > 0 && <span className="ml-0.5">· {tWith('dashboard.todayNotes', todayNewNotes)}</span>}</span>
          </button>
        </div>
        </BorderGlow>
      <BorderGlow
        {...glowTheme}
        borderRadius={34}
        backgroundColor={surfaceColor}
        glowMaskColor={surfaceColor}
        className="w-full border-glow-card--glass"
        innerClassName="dashboard-workday relative flex h-full flex-col overflow-hidden p-4"
      >
        <div className="flex h-full flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <BriefcaseBusiness size={14} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] leading-none text-text-muted">{workdayPhaseLabel}</div>
                    <button onClick={() => onOpenClockPanel?.()} className="font-numeric text-xl font-black tabular-nums leading-tight text-text transition hover:text-primary" aria-label={`下班倒计时: ${offWorkCountdown}`}>
                      {offWorkCountdown}
                    </button>
                  </div>
                </div>
                <button onClick={() => {
                  if (!showWorkdaySettings) setDraftWorkdaySettings(workdaySettings)
                  setShowWorkdaySettings((value) => !value)
                }} className="interactive-glass shrink-0 rounded-xl p-1.5 text-text-muted" aria-label="设置上下班和工资">
                  <Settings2 size={14} />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button onClick={() => onOpenClockPanel?.()} className="interactive-glass rounded-xl px-2.5 py-1.5 text-left" aria-label="打开时钟面板">
                  <div className="text-[10px] leading-none text-text-muted">当前时间</div>
                  <div className="mt-0.5 font-numeric text-xs font-bold tabular-nums text-text">{currentTimeDisplay}</div>
                </button>
                <button onClick={() => { setDraftWorkdaySettings(workdaySettings); setShowWorkdaySettings(true) }} className="interactive-glass rounded-xl px-2.5 py-1.5 text-left" aria-label="打开工资设置">
                  <div className="text-[10px] leading-none text-text-muted">今日已赚</div>
                  <div className="mt-0.5 text-xs font-bold text-success">{formatCurrency(workdayStatus.todayEarned)}</div>
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-lighter">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-500" style={{ width: `${workdayStatus.progress}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-text-muted">
                <span>{workdaySettings.startTime} 上班</span>
                <span>{workdaySettings.endTime} 下班</span>
              </div>
            </div>
        {showWorkdaySettings && (
          <div className="relative mt-3 rounded-2xl border border-border bg-background/80 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <Banknote size={16} className="text-success" />
                上下班与工资设置
              </div>
              <button onClick={() => setShowWorkdaySettings(false)} className="interactive-glass rounded-xl p-1.5 text-text-muted" aria-label="关闭工资设置">
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <label className="text-xs text-text-muted">
                上班时间
                <input type="time" value={draftWorkdaySettings.startTime} onChange={(event) => setDraftWorkdaySettings((value) => ({ ...value, startTime: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text" />
              </label>
              <label className="text-xs text-text-muted">
                下班时间
                <input type="time" value={draftWorkdaySettings.endTime} onChange={(event) => setDraftWorkdaySettings((value) => ({ ...value, endTime: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text" />
              </label>
              <label className="text-xs text-text-muted">
                月薪
                <input type="number" min="0" value={draftWorkdaySettings.monthlySalary} onChange={(event) => setDraftWorkdaySettings((value) => ({ ...value, monthlySalary: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text" />
              </label>
              <label className="text-xs text-text-muted">
                每月工作日
                <input type="number" min="1" value={draftWorkdaySettings.workdaysPerMonth} onChange={(event) => setDraftWorkdaySettings((value) => ({ ...value, workdaysPerMonth: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text" />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-text-muted">按月薪 / 每月工作日 / 当日工时计算，今日已赚每秒刷新。</p>
              <button onClick={saveWorkdaySettings} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-light">
                保存
              </button>
          </div>
        </div>
      )}
      </BorderGlow>
      </div>



      <DashboardReminders />

      {/* Selected day tasks */}
      {!isSelectedToday && (() => {
        const selectedDayTodos = todos.filter((t) => t.dueDate === selectedDate)
        return (
        <GlassCard className="dashboard-panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">{selectedDate} 的任务</h3>
            <span className="text-xs text-text-muted">{selectedDayTodos.length} 个任务</span>
          </div>
          <div className="space-y-2">
            {selectedDayTodos.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">这天没有到期任务</p>
            ) : (
              selectedDayTodos.map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-xl bg-background/50 px-3 py-2">
                  <span className={`h-2 w-2 rounded-full ${task.completed ? 'bg-success' : task.priority === 'urgent' ? 'bg-danger' : task.priority === 'high' ? 'bg-warning' : 'bg-primary'}`} />
                  <span className={`text-xs ${task.completed ? 'line-through text-text-muted' : 'text-text'}`}>{task.title}</span>
                  {task.completed && <span className="ml-auto text-[10px] text-success">已完成</span>}
                </div>
              ))
            )}
          </div>
        </GlassCard>
        )
      })()}

      <div className="dashboard-stack">
      {/* Today Plan + Project Overview — left 2/3, right 1/3 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <GlassCard className="dashboard-panel p-4">
        <DashboardCardHeader
          icon={planningPanel.mode === 'morning' ? Sun : CircleCheck}
          title={planningPanel.title}
          subtitle={planningPanel.headline}
          trailing={(
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-text-muted">
              <Clock size={12} />
              {planningPanel.mode === 'morning' ? '自动生成今日安排' : '自动生成今日总结'}
            </span>
          )}
        />
        <div className="dashboard-panel__body flex flex-col gap-3 pr-1">
          {planningPanel.sections.map((section) => (
            <div key={section.id} className="min-w-0 border-l border-border pl-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h4 className="truncate text-xs font-semibold text-text">{section.title}</h4>
                <button
                  onClick={() => navigateFromPlanning(section.id)}
                  className="interactive-glass dashboard-chip shrink-0 px-2 py-0.5 text-[11px] text-primary"
                >
                  处理
                </button>
              </div>
              <div className="space-y-1.5">
                {section.items.map((item) => {
                  const tone = PLANNING_TONE_STYLES[item.tone]
                  return (
                    <div key={item.id} className="flex min-w-0 items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
                      <p className="min-w-0 flex-1 truncate text-xs text-text">{item.text}</p>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${tone.badge}`}>
                        {item.meta}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard
        className="dashboard-panel flex h-full cursor-pointer flex-col p-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
        role="button"
        tabIndex={0}
        onClick={() => onNavigate('taskflow')}
        onKeyDown={(event) => handleCardKeyDown('taskflow', event)}
        aria-label="打开任务流查看全部项目"
      >
        <DashboardCardHeader
          icon={FolderKanban}
          title="项目概览"
          trailing={(
            <button
              onClick={(event) => { event.stopPropagation(); onNavigate('taskflow') }}
              className="interactive-glass dashboard-chip inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 text-[11px] text-primary"
            >
              全部 <ArrowRight size={12} />
            </button>
          )}
        />
        <div className="dashboard-panel__body flex min-h-0 flex-1 flex-col gap-2.5 isolate">
          {projectOverview.length === 0 ? (
            <p className="dashboard-panel__empty py-6 text-center">
              还没有工作台项目，去工作台建一个吧
            </p>
          ) : (
            projectOverview.map((row) => (
              <div
                key={row.id}
                className="interactive-glass rounded-xl p-2.5"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text">{row.name}</span>
                  <span className="shrink-0 whitespace-nowrap text-[10px] text-text-muted">{row.active} 活跃</span>
                </div>
                <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-surface-lighter">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${row.progress}%`, backgroundColor: row.color }}
                  />
                </div>
                <p className="truncate text-[10px] text-text-muted">
                  {row.nextTitle || '暂无待办'} · {row.progress}%
                </p>
              </div>
            ))
          )}
        </div>
      </GlassCard>
      </div>

      {/* Welcome Message for New Users */}
      {todos.length === 0 && pomodoroSessions.length === 0 && habits.length === 0 && notes.length === 0 && (
        <GlassCard className="p-6 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Zap size={24} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-text mb-1">{t('dashboard.welcome')}</h3>
              <p className="text-sm text-text-muted mb-3">
                {t('dashboard.welcomeDesc')}
              </p>
              <div className="flex flex-wrap gap-2">
                {WELCOME_ACTION_KEYS.map((action) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.page}
                      onClick={() => onNavigate(action.page)}
                      className="interactive-glass flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted"
                    >
                      <Icon size={14} />
                      {t(action.labelKey)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Daily Productivity Score */}
          <GlassCard className="dashboard-panel p-4">
            <DashboardCardHeader
              title={t('dashboard.todayEfficiency')}
              trailing={(
                <span className="whitespace-nowrap text-[11px] text-text-muted">
                  {totalScore >= 100 ? t('dashboard.scorePerfect') : totalScore >= 80 ? t('dashboard.scoreGreat') : totalScore >= 50 ? t('dashboard.scoreGood') : t('dashboard.scoreLow')}
                </span>
              )}
            />
            <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0">
              <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
                <circle cx="40" cy="40" r="36" fill="none" stroke="var(--color-border)" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="36" fill="none"
                  stroke={scoreColor}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-text">{totalScore}</span>
                {scoreDiff !== 0 && (
                  <span className={`text-[9px] font-medium ${scoreDiff > 0 ? 'text-success' : 'text-danger'}`}>
                    {scoreDiff > 0 ? '↑' : '↓'}{Math.abs(scoreDiff)}
                  </span>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted">
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  番茄 {Math.round(pomodoroRate * 100)}%
                </span>
                {taskRate >= 0 && (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                    任务 {Math.round(taskRate * 100)}%
                  </span>
                )}
                {habitRate >= 0 && (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    打卡 {Math.round(habitRate * 100)}%
                  </span>
                )}
                {weekAvgScore > 0 && (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-text-muted/40" />
                    {tWith('dashboard.weekAvg', weekAvgScore)}
                  </span>
                )}
              </div>
              {weekScores.some((s) => s > 0) && (
                  <div className="mt-2 flex items-center gap-2">
                    <svg width={100} height={20} className="overflow-visible">
                      <path d={sparkAreaPath} fill="var(--color-primary)" opacity="0.1" />
                      <path d={sparkLinePath} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx={sparkLastPt[0]} cy={sparkLastPt[1]} r="2.5" fill="var(--color-primary)" />
                    </svg>
                    <span className="text-[9px] text-text-muted/50">{t('dashboard.weekTrend')}</span>
                  </div>
              )}
            </div>
            </div>
          </GlassCard>

      {/* Achievements */}
      <GlassCard className="dashboard-panel dashboard-achievements p-4">
        <DashboardCardHeader
          icon={Award}
          iconClassName="text-warning"
          title="连续记录"
          trailing={(
            <span className="whitespace-nowrap text-[11px] font-medium text-text-muted">
              {achievements.badges.filter((badge) => badge.unlocked).length}/{achievements.badges.length} 已达成
            </span>
          )}
        />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {achievements.badges.map((badge) => (
            <GlassCard
              key={badge.id}
              borderRadius={18}
              className={`dashboard-panel dashboard-achievement-card flex min-h-[6.5rem] flex-col p-3 transition-colors ${
                badge.unlocked
                  ? 'border-warning/35 bg-warning/10'
                  : ''
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-tight text-text">{badge.title}</span>
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.unlocked ? 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.55)]' : 'bg-text-muted/35'}`}
                  aria-hidden
                />
              </div>
              <div
                className={`whitespace-nowrap text-xl font-black tabular-nums leading-none ${
                  badge.unlocked ? 'text-warning' : 'text-text'
                }`}
              >
                {badge.value}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-text-muted">
                {badge.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </GlassCard>
      </div>

      {/* Stats Grid */}
      <div className="dashboard-stat-grid grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const Badge = stat.badge
          return (
            <GlassCard
              key={stat.label}
              role="button"
              tabIndex={0}
              onClick={() => onNavigate(stat.page)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onNavigate(stat.page)
                }
              }}
              className="dashboard-panel dashboard-stat-tile group relative cursor-pointer overflow-hidden p-3.5 text-left focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label={`打开${stat.label}模块`}
            >
              <div className={`pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-gradient-to-br ${stat.color} opacity-10 blur-2xl transition-opacity group-hover:opacity-20`} />
              <div className="relative mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${stat.iconBg}`}>
                    <Icon size={16} className={stat.iconColor} />
                  </div>
                  <span className="truncate text-xs text-text-muted">{stat.label}</span>
                </div>
                {Badge ? <Badge size={14} className={stat.badgeColor} /> : null}
              </div>
              <div className="relative flex min-w-0 items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight text-text">{stat.value}</span>
                <span className="min-w-0 truncate text-[11px] text-text-muted">{stat.sub}</span>
              </div>
              {'streak' in stat && stat.streak && stat.streak > 0 && (
                <div className="relative mt-1 flex items-center gap-1">
                  <Flame size={10} className="text-orange-400" />
                  <span className="text-[10px] text-orange-400">{tWith('dashboard.streakDays', stat.streak)}</span>
                </div>
              )}
            </GlassCard>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Weekly Focus Chart */}
      <GlassCard
        className="dashboard-panel cursor-pointer p-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
        role="button"
        tabIndex={0}
        onClick={(event) => navigateFromCard('pomodoro', event)}
        onKeyDown={(event) => handleCardKeyDown('pomodoro', event)}
        aria-label="打开番茄钟模块"
      >
        <DashboardCardHeader
          icon={BarChart3}
          title={t('dashboard.weeklyFocus')}
          trailing={(
            <span className="whitespace-nowrap text-[11px] text-text-muted">
              {tWith('dashboard.totalSessions', weeklyChartData.thisWeek)}
              <span className="mx-1">·</span>
              {fmtMin(weeklyChartData.weekFocusMin)}
              <span className="mx-1">·</span>
              {tWith('dashboard.dailyAvgSessions', (weeklyChartData.thisWeek / 7).toFixed(1))}
              {weeklyChartData.trend !== 0 && (
                <>
                  <span className="mx-1">·</span>
                  <span className={weeklyChartData.trend > 0 ? 'text-success' : 'text-danger'}>
                    {tWith('dashboard.vsLastWeek', weeklyChartData.trend)}
                  </span>
                </>
              )}
            </span>
          )}
        />
        {weeklyChartData.thisWeek === 0 && weeklyChartData.lastWeek === 0 ? (
          <p className="dashboard-panel__empty">
            {t('dashboard.noFocusThisWeek')}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNavigate('pomodoro') }}
              className="ml-2 text-primary hover:text-primary-light transition-colors"
            >
              {t('dashboard.startFirstPomodoro')} →
            </button>
          </p>
        ) : (
        <div className="relative flex items-end gap-2 h-24">
          {/* Goal target line */}
          {dailyPomodoroGoal > 0 && (
            <div
              className="absolute left-0 right-0 border-t border-dashed border-text-muted/25 z-10 pointer-events-none"
              style={{ bottom: `${(dailyPomodoroGoal / Math.max(weeklyChartData.max, dailyPomodoroGoal)) * 60}px` }}
            >
              <span className="absolute right-0 -top-3.5 text-[9px] text-text-muted/50">{tWith('dashboard.goalLabel', dailyPomodoroGoal)}</span>
            </div>
          )}
          {weeklyChartData.days.map((d) => {
            const isBestDay = d.count > 0 && d.count === weeklyChartData.max && weeklyChartData.bestDayCount === 1
            const metGoal = d.count >= dailyPomodoroGoal
            return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1 relative z-20">
              {d.isToday && d.count === 0 && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" title={t('weather.today')} />
              )}
              <span className={`text-[10px] font-medium ${isBestDay ? 'text-orange-400' : metGoal ? 'text-success' : 'text-text-muted'}`}>{d.count > 0 ? d.count : ''}</span>
              <div className="w-full flex items-end justify-center" style={{ height: '60px' }}>
                <div
                  title={`${d.day}: ${d.count} ${t('pomodoro.title')}${d.minutes > 0 ? ` (${fmtMin(d.minutes)})` : ''}${isBestDay ? ` · ${t('dashboard.best')}` : ''}${metGoal ? ` · ${t('dashboard.reached')}` : ''}`}
                  className={`w-full max-w-[28px] rounded-t-md transition-all duration-500 ${
                    isBestDay ? 'bg-gradient-to-t from-orange-400 to-amber-300' :
                    d.isToday ? 'bg-gradient-to-t from-primary to-primary-light' :
                    metGoal ? 'bg-gradient-to-t from-success to-emerald-400' :
                    d.count > 0 ? 'bg-primary/40' : 'bg-surface-lighter'
                  }`}
                  style={{ height: d.count > 0 ? `${Math.max((d.count / Math.max(weeklyChartData.max, dailyPomodoroGoal)) * 100, 8)}%` : '4px' }}
                />
              </div>
              <span className={`text-[10px] ${d.isToday ? 'text-primary font-medium' : isBestDay ? 'text-orange-400 font-medium' : metGoal ? 'text-success' : 'text-text-muted'}`}>{d.isToday ? t('weather.today') : d.label}</span>
              {d.minutes > 0 && (
                <span className="text-[8px] text-text-muted/50">{d.minutes >= 60 ? `${Math.floor(d.minutes / 60)}h${d.minutes % 60}m` : `${d.minutes}m`}</span>
              )}
            </div>
          )})}
        </div>
        )}
      </GlassCard>

      {/* Recent Notes */}
      <GlassCard
          className="dashboard-panel cursor-pointer p-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
          role="button"
          tabIndex={0}
          onClick={(event) => navigateFromCard('notes', event)}
          onKeyDown={(event) => handleCardKeyDown('notes', event)}
          aria-label="打开笔记模块"
        >
          <DashboardCardHeader
            icon={StickyNote}
            iconClassName="text-warning"
            title={t('dashboard.recentNotes')}
            trailing={(
              <button
                onClick={() => onNavigate('notes')}
                className="interactive-glass dashboard-chip inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 text-[11px] text-primary"
              >
                {t('dashboard.viewAll')} <ArrowRight size={12} />
              </button>
            )}
          />
          {recentNotes.length === 0 ? (
            <p className="dashboard-panel__empty">
              {t('dashboard.noNotes')}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNavigate('notes') }}
                className="ml-2 text-primary hover:text-primary-light transition-colors"
              >
                {t('dashboard.goCreateNote')} →
              </button>
            </p>
          ) : (
            <div className="space-y-1.5">
              {recentNotes.map((note) => (
                <div
                  key={note.id}
                  className="interactive-glass rounded-lg px-1.5 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: note.color }}
                    />
                    <span className="min-w-0 truncate text-xs font-medium text-text">{note.title}</span>
                    {note.pinned && (
                      <span className="shrink-0 rounded bg-primary/15 px-1 py-0.5 text-[9px] text-primary">{t('dashboard.pinned')}</span>
                    )}
                    {note.content.length > 0 && (
                      <span className="hidden shrink-0 text-[10px] text-text-muted/60 sm:inline">
                        {tWith('dashboard.charCount', note.content.length)} · {tWith('dashboard.readTime', Math.max(1, Math.ceil(note.content.length / 400)))}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[10px] text-text-muted">{note.relativeTime}</span>
                  </div>
                  <p className="mt-0.5 truncate pl-4 text-[11px] text-text-muted">
                    {note.preview}
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Daily Check-in Summary */}
      <GlassCard
        className="dashboard-panel cursor-pointer p-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
        role="button"
        tabIndex={0}
        onClick={(event) => navigateFromCard('habits', event)}
        onKeyDown={(event) => handleCardKeyDown('habits', event)}
        aria-label="打开每日打卡模块"
      >
        <DashboardCardHeader
          icon={Target}
          iconClassName="text-success"
          title={t('dashboard.todayHabits')}
          trailing={(
            <div className="flex items-center gap-2">
              {habits.length > 0 && (
                <span className="whitespace-nowrap text-[11px] text-text-muted">
                  {completedHabitsToday}/{habits.length} {t('dashboard.completed')}
                  {longestHabitStreak > 1 && <span className="ml-1 text-orange-400">🔥{longestHabitStreak}</span>}
                  {habitWeekRate > 0 && <span className="ml-1">周{habitWeekRate}%</span>}
                  {habitMonthRate > 0 && <span className="ml-1">月{habitMonthRate}%</span>}
                </span>
              )}
              <button
                onClick={() => onNavigate('habits')}
                className="interactive-glass dashboard-chip inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 text-[11px] text-primary"
              >
                {t('dashboard.manage')} <ArrowRight size={12} />
              </button>
            </div>
          )}
        />
          <div className="mb-2 flex flex-wrap gap-1.5">
            {habits.length === 0 ? (
              <p className="dashboard-panel__empty w-full">
                {t('dashboard.noHabits')}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onNavigate('habits') }}
                  className="ml-2 text-primary hover:text-primary-light transition-colors"
                >
                  {t('dashboard.goAddHabit')} →
                </button>
              </p>
            ) : (
              habits.map((habit) => {
                const isCompleted = completedHabitIdsToday.has(habit.id)
                const streak = habitStreakMap.get(habit.id) || 0
                return (
                  <button
                    key={habit.id}
                    onClick={() => {
                      const progress = getHabitProgress(habit, todayStr)
                      if (progress.met) undoHabitCheckIn(habit.id, todayStr)
                      else if (progress.canCheckIn) checkInHabit(habit.id)
                      setTogglingHabitId(habit.id)
                      setTimeout(() => setTogglingHabitId((prev) => prev === habit.id ? null : prev), 300)
                    }}
                    aria-label={`${habit.name}，${isCompleted ? '已完成' : '未完成'}${streak > 1 ? `，连续${streak}天打卡` : ''}`}
                    className={`interactive-glass inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
                      isCompleted ? 'ring-1 ring-success/30' : ''
                    } ${togglingHabitId === habit.id ? 'scale-105' : ''}`}
                  >
                    <span>{habit.icon}</span>
                    <span className={`whitespace-nowrap ${isCompleted ? 'text-success' : 'text-text-muted'}`}>
                      {habit.name}
                    </span>
                    {streak > 1 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-400">
                        <Flame size={10} />{streak}
                      </span>
                    )}
                    {isCompleted && <span className="text-success text-[10px]">✓</span>}
                  </button>
                )
              })
            )}
          </div>
          {habits.length > 0 && (
            <>
              <div className="h-1.5 bg-surface-lighter rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-success to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${(completedHabitsToday / habits.length) * 100}%` }}
                />
              </div>
              {completedHabitsToday === habits.length ? (
                <div className="mt-1.5 text-center text-[11px] font-medium text-success">
                  {t('dashboard.habitsAllDone')}
                </div>
              ) : completedHabitsToday > 0 ? (
                <div className="mt-1.5 text-center text-[11px] text-text-muted">
                  {tWith('dashboard.habitsRemaining', habits.length - completedHabitsToday)}
                </div>
              ) : null}
            </>
          )}
        </GlassCard>

      {/* Timeline */}
      <GlassCard className="dashboard-panel p-4">
        <DashboardCardHeader
          icon={Clock}
          iconClassName="text-text-muted"
          title={t('dashboard.todayTimeline')}
          trailing={timelineEvents.total > 0 ? (
            <span className="whitespace-nowrap text-[11px] text-text-muted">{tWith('dashboard.activities', timelineEvents.total)}</span>
          ) : undefined}
        />
        <div className="relative space-y-3 border-l-2 border-border pl-5">
          {timelineEvents.items.length === 0 ? (
            <p className="dashboard-panel__empty">
              {t('dashboard.noActivity')}
              <button
                type="button"
                onClick={() => onNavigate('pomodoro')}
                className="ml-2 text-primary hover:text-primary-light transition-colors"
              >
                {t('dashboard.startPomodoroHint')} →
              </button>
            </p>
          ) : (
            <>
              {(showAllTimeline ? timelineEvents.items : timelineEvents.items.slice(0, 8)).map((event, i, arr) => {
                const nextEvent = i < arr.length - 1 ? arr[i + 1] : null
                const gapMin = nextEvent ? Math.floor((event.time - nextEvent.time) / 60000) : 0
                const showGap = gapMin >= 30
                const prevEvent = i > 0 ? arr[i - 1] : null
                const showPeriodHeader = event.period !== prevEvent?.period
                return (
                <div key={event.id}>
                  {showPeriodHeader && (
                    <div className="text-[10px] text-text-muted/60 font-medium mb-2 -ml-6">{event.period}</div>
                  )}
                  <div className="relative">
                    <div className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ${event.color} border-2 border-surface`} />
                    <div className="flex min-w-0 items-baseline gap-2 text-xs">
                      <span className="min-w-0 truncate font-medium text-text">{event.label}</span>
                      <span className="shrink-0 whitespace-nowrap text-text-muted">{event.hhmm} · {event.relative}</span>
                    </div>
                  </div>
                  {showGap && (
                    <div className="relative mt-2 mb-1">
                      <div className="absolute -left-[19px] w-[1px] h-4 bg-text-muted/20" />
                      <span className="text-[10px] text-text-muted/40 italic">
                        {tWith('dashboard.freeTime', gapMin)}
                      </span>
                    </div>
                  )}
                </div>
                )
              })}
              {timelineEvents.total > 8 && (
                <button
                  onClick={() => setShowAllTimeline(!showAllTimeline)}
                  aria-expanded={showAllTimeline}
                  className="interactive-glass dashboard-chip mt-2 px-2 py-1 text-xs text-primary"
                >
                  {showAllTimeline ? t('dashboard.collapse') : tWith('dashboard.viewAllTimeline', timelineEvents.total)}
                </button>
              )}
            </>
          )}
        </div>
      </GlassCard>
      </div>

      </div>

      {/* Dashboard Stats — collapsed by default to reduce density */}
      <div className="dashboard-stats-section">
        <GlassCard
          role="button"
          tabIndex={0}
          onClick={() => {
            setShowDashboardStats((prev) => {
              const next = !prev
              try { localStorage.setItem('abworkbench-dashboard-stats-open', next ? '1' : '0') } catch { /* ignore */ }
              return next
            })
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setShowDashboardStats((prev) => {
                const next = !prev
                try { localStorage.setItem('abworkbench-dashboard-stats-open', next ? '1' : '0') } catch { /* ignore */ }
                return next
              })
            }
          }}
          className="dashboard-panel flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
          aria-expanded={showDashboardStats}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-text">
            <BarChart3 size={16} className="text-primary" />
            统计总览
          </span>
          <span className="text-xs text-text-muted">{showDashboardStats ? '收起' : '展开详情'}</span>
        </GlassCard>
        {showDashboardStats && (
          <div className="mt-4">
            <Suspense fallback={<GlassCard className="dashboard-panel h-56 animate-pulse" />}>
              <StatsPage embedded />
            </Suspense>
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  )
}
