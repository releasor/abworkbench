import {
  CheckSquare,
  Timer,
  StickyNote,
  Clock,
  Zap,
  Target,
  ArrowRight,
  Calendar,
  CircleCheck,
  Flame,
  Plus,
  BarChart3,
  Check,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  MapPin,
  Award,
  Banknote,
  BriefcaseBusiness,
  FolderKanban,
  Settings2,
  X,
} from 'lucide-react'
import { lazy, Suspense, useState, useRef, useMemo, useEffect, useCallback } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { Page } from '../layout/Sidebar'
import { useStore } from '../../store'
import { eventMatchesShortcut, useShortcutStore } from '../../shortcuts'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { useToday } from '../../hooks/useToday'
import { prevDateStr, nextDateStr } from '../../modules/taskflow/dateUtils'
import { useCurrentHour } from '../../hooks/useCurrentHour'
import { useTick } from '../../hooks/useTick'
import { getRelativeTime, WEEKDAY_NAMES, durationMinutes, fmtMin, getHabitStreak, dayNumToDateStr, getMonthLabel, dayNumToShortLabel, fmtHHmm, dayNumToFullLabel, dayNumToYMD } from '../../utils/format'
import { buildPomodoroByDateMap, buildCompletedByDateMap, buildCreatedDateMap, buildHabitsByDateMap } from '../../utils/stats'
import { buildAchievements } from '../../utils/achievements'
import { parseQuickCreateInput, buildQuickCreateDueAt, buildQuickCreateSubtasks } from '../../modules/taskflow/utils/quickCreateParser'
import { showToast } from '../../modules/taskflow/utils/toastEvent'
import { generateMockWeather } from '../weather/WeatherWidget'
import { useTranslation } from '../../i18n'
import { formatGreetingTitle } from './greetingTitle'
import { buildTodayPlanning, type PlanningTone } from './todayPlanning'
import { buildTodayTimeBlocks } from './timeBlocks'
import { getHabitProgress } from '../habits/habitSchedule'
import DashboardReminders from './DashboardReminders'
import { buildWorkdayStatus, DEFAULT_WORKDAY_SETTINGS, formatCountdown, formatCurrency, normalizeWorkdaySettings, type WorkdaySettings } from './workday'
import { getPeriod, stripMarkdown } from './notePreview'
import { safeGet, safeSet } from '../../utils/safeLocalStorage'
import ErrorBoundary from '../common/ErrorBoundary'
import { LOCAL_DATA_CHANGE_EVENT } from '../../utils/localData'
import {
  TIME_BLOCK_SCHEDULE_KEY,
  getDayTaskHours,
  readTimeBlockSchedule,
  setTaskScheduledHour,
} from '../../utils/timeBlockSchedule'

const StatsPage = lazy(() => import('../stats/StatsPage'))
const ClockWidget = lazy(() => import('./ClockWidget'))
const CalendarWidget = lazy(() => import('./CalendarWidget'))

interface DashboardPageProps {
  onNavigate: (page: Page) => void
  onOpenDailyBrief?: (mode?: 'morning' | 'evening') => void
  onOpenQuickCapture?: () => void
}

const PRIORITY_COLORS: Record<string, string> = { urgent: 'bg-danger', high: 'bg-danger', medium: 'bg-warning', low: 'bg-success' }
const WORKDAY_SETTINGS_KEY = 'abworkbench-workday-settings'

const WELCOME_ACTION_KEYS = [
  { page: 'taskflow' as Page, labelKey: 'dashboard.createFirstTask' as const, icon: CheckSquare },
  { page: 'pomodoro' as Page, labelKey: 'dashboard.startPomodoro' as const, icon: Timer },
  { page: 'habits' as Page, labelKey: 'dashboard.addHabit' as const, icon: Target },
  { page: 'notes' as Page, labelKey: 'dashboard.writeNote' as const, icon: StickyNote },
]

const QUICK_ACTION_KEYS = [
  { page: 'taskflow' as Page, labelKey: 'dashboard.addTask' as const, icon: CheckSquare, color: 'from-primary to-primary-dark' },
  { page: 'pomodoro' as Page, labelKey: 'dashboard.startFocus' as const, icon: Timer, color: 'from-success to-emerald-600' },
  { page: 'habits' as Page, labelKey: 'dashboard.checkHabit' as const, icon: Target, color: 'from-warning to-secondary' },
  { page: 'notes' as Page, labelKey: 'dashboard.writeNoteAction' as const, icon: StickyNote, color: 'from-purple-500 to-purple-600' },
]

const PRIORITY_BTN_KEYS = [
  { key: 'high' as const, color: 'bg-danger', titleKey: 'dashboard.highPriority' as const },
  { key: 'medium' as const, color: 'bg-warning', titleKey: 'dashboard.mediumPriority' as const },
  { key: 'low' as const, color: 'bg-success', titleKey: 'dashboard.lowPriority' as const },
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

function readWorkdaySettings(): WorkdaySettings {
  return normalizeWorkdaySettings(safeGet(WORKDAY_SETTINGS_KEY, DEFAULT_WORKDAY_SETTINGS))
}

function writeWorkdaySettings(settings: WorkdaySettings): WorkdaySettings {
  const normalized = normalizeWorkdaySettings(settings)
  safeSet(WORKDAY_SETTINGS_KEY, normalized)
  return normalized
}

export default function DashboardPage({ onNavigate, onOpenDailyBrief, onOpenQuickCapture }: DashboardPageProps) {
  const taskFlowTasks = useTaskStore((s) => s.tasks)
  const categories = useTaskStore((s) => s.categories)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const fetchCategories = useTaskStore((s) => s.fetchCategories)
  const createTask = useTaskStore((s) => s.createTask)
  const notes = useStore((s) => s.notes)
  const pomodoroSessions = useStore((s) => s.pomodoroSessions)
  const habits = useStore((s) => s.habits)
  const userName = useStore((s) => s.userName)
  const weatherCity = useStore((s) => s.weatherCity)
  const checkInHabit = useStore((s) => s.checkInHabit)
  const undoHabitCheckIn = useStore((s) => s.undoHabitCheckIn)
  const dailyPomodoroGoal = useStore((s) => s.dailyPomodoroGoal)
  const [quickTodo, setQuickTodo] = useState('')
  const [quickPriority, setQuickPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [quickDueDate, setQuickDueDate] = useState('')
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
  const [showClockPanel, setShowClockPanel] = useState(false)
  const [showDatePanel, setShowDatePanel] = useState(false)
  const [showWorkdaySettings, setShowWorkdaySettings] = useState(false)
  const [workdaySettings, setWorkdaySettings] = useState<WorkdaySettings>(readWorkdaySettings)
  const [draftWorkdaySettings, setDraftWorkdaySettings] = useState<WorkdaySettings>(workdaySettings)
  const [scheduleRevision, setScheduleRevision] = useState(0)
  const hour = useCurrentHour()
  const quickTodoRef = useRef<HTMLInputElement>(null)
  const shortcutOverrides = useShortcutStore((s) => s.overrides)
  const { t, tWith, language } = useTranslation()
  const dateInputLocale = language === 'zh' ? 'zh-CN' : 'en-US'

  useEffect(() => {
    const onLocal = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key
      if (key === TIME_BLOCK_SCHEDULE_KEY) setScheduleRevision((n) => n + 1)
    }
    window.addEventListener(LOCAL_DATA_CHANGE_EVENT, onLocal as EventListener)
    return () => window.removeEventListener(LOCAL_DATA_CHANGE_EVENT, onLocal as EventListener)
  }, [])

  const weather = useMemo(() => generateMockWeather(weatherCity), [weatherCity])

  useEffect(() => {
    fetchTasks().catch((err) => {
      console.error('Failed to fetch tasks:', err)
      showToast('加载任务失败', 'error')
    })
    fetchCategories().catch((err) => {
      console.error('Failed to fetch categories:', err)
      showToast('加载分类失败', 'error')
    })
  }, [fetchTasks, fetchCategories])

  // 'n' to focus quick add input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (eventMatchesShortcut('dashboardQuickAdd', e)) {
        e.preventDefault()
        quickTodoRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcutOverrides])

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

  const handleQuickAddTask = useCallback(async () => {
    const title = quickTodo.trim()
    if (!title) return
    try {
      const parsed = parseQuickCreateInput(title, { projects: categories })
      const dueFromText = buildQuickCreateDueAt(parsed)
      await createTask({
        title: parsed.title || title,
        description: parsed.raw !== (parsed.title || title) ? parsed.raw : undefined,
        priority: parsed.raw.includes('紧急') || parsed.raw.includes('高优先') ? 'high' : quickPriority,
        category: parsed.projectId || categories[0]?.id || 'cat-work',
        tags: parsed.tags,
        dueDate: dueFromText || (quickDueDate ? `${quickDueDate}T00:00:00.000Z` : null),
        subtasks: buildQuickCreateSubtasks(parsed),
        status: 'todo',
      })
      setQuickTodo('')
      setQuickDueDate('')
      quickTodoRef.current?.focus()
      showToast('已添加任务', 'success')
    } catch (err) {
      console.error('创建任务失败:', err);
      showToast('创建任务失败', 'error');
    }
  }, [categories, createTask, quickDueDate, quickPriority, quickTodo])

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
    let monthNewNotes = 0
    for (const n of notes) {
      totalNoteChars += n.content.length
      if (n.createdAt >= todayMidnightMs && n.createdAt < tomorrowMidnightMs) todayNewNotes++
      if (n.createdAt >= monthStartMs) monthNewNotes++
    }

    return { completedTodos, overdueTodos, dueTodayTodos, todaySessions, todayWorkSessions, todayFocusMinutes, completedHabitsToday, todayNewNotes, completedHabitsYesterday, longestHabitStreak, totalNoteChars, monthNewNotes, completedHabitIdsToday, habitStreakMap, monthStartMs }
  }, [todos, pomodoroSessions, habits, notes, todayStr, todayMidnightMs, tomorrowMidnightMs, yesterdayStr])
  const { completedTodos, overdueTodos, dueTodayTodos, todaySessions, todayWorkSessions, todayFocusMinutes, completedHabitsToday, todayNewNotes, completedHabitsYesterday, longestHabitStreak, totalNoteChars, monthNewNotes, completedHabitIdsToday, habitStreakMap, monthStartMs } = baseData

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

    // Quick todo stats
    const todayAdded = todosCreatedByDate.get(todayStr) || 0
    const todayDone = todosCompletedByDate.get(todayStr) || 0

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
    const habitProgressRing = habits.length > 0 ? (() => {
      const pct = Math.round((completedHabitsToday / habits.length) * 100)
      const r = 8
      const c = 2 * Math.PI * r
      const o = c * (1 - pct / 100)
      const color = pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-primary)'
      return { r, c, o, color }
    })() : null
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
      todayAdded, todayDone, weekCompleted, lastWeekCompleted,
      habitWeekRate, habitMonthRate,
      scoreColor, progressColor, circumference, ringOffset, sparkAreaPath, sparkLinePath, sparkLastPt, habitProgressRing,
      currentMonthLabel: getMonthLabel(monthStartMs),
      pomodoroStreak,
    }
  }, [pomodoroSessions, todos, habits, dailyPomodoroGoal, todayStr, yesterdayStr, todayWorkSessions.length, completedTodos, completedHabitsToday, completedHabitsYesterday, todayMidnightMs, monthStartMs])
  const { monthPomodoro, monthFocusMinutes, monthTodos, monthTodoRate, daysInMonth, monthHabitCount, monthHabitRate, monthlyProgress, totalScore, scoreDiff, weekAvgScore, weekScores, pomodoroRate, taskRate, habitRate, todayAdded, todayDone, weekCompleted, lastWeekCompleted, habitWeekRate, habitMonthRate, scoreColor, progressColor, circumference, ringOffset, sparkAreaPath, sparkLinePath, sparkLastPt, habitProgressRing, currentMonthLabel, pomodoroStreak } = derivedData

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
  const currentDateDisplay = useMemo(() => now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' }), [now])
  const workdayStatus = useMemo(() => buildWorkdayStatus({ now, settings: workdaySettings }), [now, workdaySettings])
  const offWorkCountdown = useMemo(() => formatCountdown(workdayStatus.phase === 'done' ? 0 : workdayStatus.endAt.getTime() - now.getTime()), [now, workdayStatus])
  const workdayPhaseLabel = workdayStatus.phase === 'before' ? '尚未上班' : workdayStatus.phase === 'done' ? '今日已下班' : '距离下班'
  const saveWorkdaySettings = useCallback(() => {
    const saved = writeWorkdaySettings(draftWorkdaySettings)
    setWorkdaySettings(saved)
    setShowWorkdaySettings(false)
  }, [draftWorkdaySettings])

  const recentTodos = useMemo(() => {
    const todayDay = Math.floor(todayMidnightMs / 86400000)
    // Pre-compute day-diff per unique dueDate (avoids Date allocation per sort comparison)
    const diffByDue = new Map<string, number>()
    const getDiff = (dueDate: string) => {
      let d = diffByDue.get(dueDate)
      if (d === undefined) {
        const [y, m, d2] = dueDate.split('-').map(Number)
        d = Math.floor(Date.UTC(y, m - 1, d2) / 86400000) - todayDay
        diffByDue.set(dueDate, d)
      }
      return d
    }
    const score = (t: typeof todos[0]) => {
      if (t.completed) return 1000 + (t.completedAt || 0)
      let s = 0
      if (t.dueDate) {
        const diff = getDiff(t.dueDate)
        if (diff < 0) s = -300 + diff       // overdue: most urgent
        else if (diff === 0) s = -200        // due today
        else if (diff <= 3) s = -100 + diff  // due soon
      }
      if (t.priority === 'high') s -= 50
      else if (t.priority === 'medium') s -= 25
      return s - (t.createdAt / 1e12)       // newer tasks break ties
    }
    // Top-5 selection (single pass, no full sort)
    const top: Array<{ todo: typeof todos[0]; s: number }> = []
    for (const todo of todos) {
      const s = score(todo)
      if (top.length < 5) {
        top.push({ todo, s })
      } else if (s < top[4].s) {
        top[4] = { todo, s }
      } else {
        continue
      }
      for (let i = top.length - 1; i > 0; i--) {
        if (top[i].s < top[i - 1].s) { const tmp = top[i]; top[i] = top[i - 1]; top[i - 1] = tmp }
        else break
      }
    }
    return top.map(({ todo }) => {
      let dueStatus: { label: string; color: string; bg: string } | null = null

      if (todo.dueDate && !todo.completed) {
        const diff = getDiff(todo.dueDate)

        if (diff < 0) {
          dueStatus = { label: '逾期', color: 'text-danger', bg: 'bg-danger/15' }
        } else if (diff === 0) {
          dueStatus = { label: t('dashboard.dueToday'), color: 'text-orange-400', bg: 'bg-orange-500/15' }
        } else {
          const dueParts = todo.dueDate.split('-')
          dueStatus = { label: `${dueParts[1]}/${dueParts[2]}`, color: 'text-text-muted', bg: 'bg-surface-lighter' }
        }
      }

      const dateDisplay = todo.completed && todo.completedAt
        ? dayNumToShortLabel(Math.floor(todo.completedAt / 86400000))
        : dayNumToShortLabel(Math.floor(todo.createdAt / 86400000))

      return { ...todo, dueStatus, dateDisplay }
    })
  }, [todos, todayMidnightMs, t])
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

  const projectOverview = useMemo(() => {
    const rows = categories.map((category) => {
      const projectTasks: typeof taskFlowTasks = []
      let doneCount = 0
      for (const t of taskFlowTasks) {
        if ((t.category || 'uncategorized') === category.id && !t.archived) {
          projectTasks.push(t)
          if (t.status === 'done') doneCount++
        }
      }
      const active = projectTasks.filter((t) => t.status !== 'done')
      const progress = projectTasks.length > 0 ? Math.round((doneCount / projectTasks.length) * 100) : 0
      const next = active.slice().sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return 0
      })[0]
      return { category, total: projectTasks.length, active: active.length, progress, nextTitle: next?.title || null }
    }).filter((r) => r.total > 0).sort((a, b) => b.active - a.active).slice(0, 4)
    return rows
  }, [categories, taskFlowTasks])

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

  const timeBlockOverrides = useMemo(() => {
    void scheduleRevision
    return getDayTaskHours(todayStr, readTimeBlockSchedule())
  }, [todayStr, scheduleRevision])
  const timeBlockPlan = useMemo(() => buildTodayTimeBlocks({
    todayStr,
    todayMidnightMs,
    tomorrowMidnightMs,
    tasks: todos,
    habits,
    pomodoroSessions,
    hourOverrides: timeBlockOverrides,
  }), [todayStr, todayMidnightMs, tomorrowMidnightMs, todos, habits, pomodoroSessions, timeBlockOverrides])

  const onDropTaskToHour = useCallback((hour: number, taskId: string) => {
    setTaskScheduledHour(todayStr, taskId, hour)
    setScheduleRevision((n) => n + 1)
    showToast(`已排到 ${String(hour).padStart(2, '0')}:00`, 'success')
  }, [todayStr])

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
    <div className="space-y-6 motion-stagger">
      {/* Greeting — cinematic hero */}
      <div className="dashboard-hero relative overflow-hidden rounded-[34px] border border-primary/25 p-6 md:p-8 shadow-2xl shadow-primary/10">
        <div className="relative z-[2] flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="home-kicker mb-3 inline-flex items-center gap-2">
              <Zap size={12} />
              <button onClick={prevDay} className="rounded px-1 hover:bg-primary/20 transition" title="前一天" aria-label="前一天">←</button>
              <span>{isSelectedToday ? '今日工作台' : `${selectedDate} 工作台`}</span>
              <button onClick={nextDay} className="rounded px-1 hover:bg-primary/20 transition" title="后一天" aria-label="后一天">→</button>
              {!isSelectedToday && (
                <button onClick={() => setSelectedDate(todayStr)} className="rounded px-1.5 py-0.5 text-[10px] bg-primary/20 hover:bg-primary/30 transition normal-case tracking-normal" aria-label="回到今天">回到今天</button>
              )}
            </div>
            <h2 className="text-4xl font-black tracking-tight text-text md:text-5xl">{formatGreetingTitle(greeting.text, userName)}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
              <button onClick={() => setShowDatePanel(true)} className="rounded-lg text-left transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30" aria-label="打开日期面板">
                {todayDisplay}
              </button>
              <span>·</span>
              <button onClick={() => setShowClockPanel(true)} className="rounded-lg font-mono tabular-nums text-text transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30" aria-label="打开时钟面板">
                {currentTimeDisplay}
              </button>
              <span>·</span>
              <span>{greeting.sub}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => onOpenDailyBrief?.('morning')} className="rounded-xl bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25">今日作战板</button>
              <button type="button" onClick={() => onOpenDailyBrief?.('evening')} className="rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-white/10">晚间复盘</button>
              <button type="button" onClick={() => onOpenQuickCapture?.()} className="rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-white/10">快速捕获</button>
              <button type="button" onClick={() => onNavigate('reminders')} className="rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-white/10">提醒中心</button>
            </div>
            {pomodoroStreak > 1 && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1">
                <Flame size={14} className={pomodoroStreak >= 30 ? 'text-purple-400' : pomodoroStreak >= 14 ? 'text-amber-400' : 'text-orange-400'} />
                <span className={`text-xs font-semibold ${pomodoroStreak >= 30 ? 'text-purple-400' : pomodoroStreak >= 14 ? 'text-amber-400' : 'text-orange-400'}`}>
                  {pomodoroStreak >= 30 ? tWith('dashboard.streak30Label', pomodoroStreak) : pomodoroStreak >= 14 ? tWith('dashboard.streak14Label', pomodoroStreak) : tWith('dashboard.streakLabel', pomodoroStreak)}
                </span>
              </div>
            )}
            <div className="home-wave-track" aria-hidden>
              {Array.from({ length: 28 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    ['--h' as string]: `${6 + ((i * 17) % 34)}px`,
                    ['--d' as string]: `${(i % 9) * 0.12}s`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(250px,340px)_112px] sm:items-stretch">
            <div className="rounded-[28px] border border-primary/20 bg-background/55 p-4 shadow-xl shadow-black/10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <BriefcaseBusiness size={16} />
                  </span>
                  <div>
                    <div className="text-xs text-text-muted">{workdayPhaseLabel}</div>
                    <button onClick={() => setShowClockPanel(true)} className="font-mono text-2xl font-black tabular-nums text-text transition hover:text-primary" aria-label={`下班倒计时: ${offWorkCountdown}`}>
                      {offWorkCountdown}
                    </button>
                  </div>
                </div>
                <button onClick={() => {
                  if (!showWorkdaySettings) setDraftWorkdaySettings(workdaySettings)
                  setShowWorkdaySettings((value) => !value)
                }} className="rounded-xl border border-border bg-surface/80 p-2 text-text-muted transition hover:border-primary/40 hover:text-primary" aria-label="设置上下班和工资">
                  <Settings2 size={15} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setShowClockPanel(true)} className="rounded-2xl bg-surface/70 px-3 py-2 text-left transition hover:bg-surface-lighter" aria-label="打开时钟面板">
                  <div className="text-[10px] text-text-muted">当前时间</div>
                  <div className="mt-1 font-mono text-sm font-bold tabular-nums text-text">{currentTimeDisplay}</div>
                </button>
                <button onClick={() => { setDraftWorkdaySettings(workdaySettings); setShowWorkdaySettings(true) }} className="rounded-2xl bg-surface/70 px-3 py-2 text-left transition hover:bg-surface-lighter" aria-label="打开工资设置">
                  <div className="text-[10px] text-text-muted">今日已赚</div>
                  <div className="mt-1 text-sm font-bold text-success">{formatCurrency(workdayStatus.todayEarned)}</div>
                </button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-lighter">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-500" style={{ width: `${workdayStatus.progress}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted">
                <span>{workdaySettings.startTime} 上班</span>
                <span>{workdaySettings.endTime} 下班</span>
              </div>
            </div>
            <div className="relative grid h-28 w-28 place-items-center rounded-[28px] border border-primary/25 bg-primary/10 shadow-2xl shadow-primary/10 card-float-soft">
              <svg viewBox="0 0 96 96" className="absolute inset-3 -rotate-90">
                <circle cx="48" cy="48" r="36" fill="none" stroke="var(--color-border)" strokeWidth="7" />
                <circle cx="48" cy="48" r="36" fill="none" stroke={scoreColor} strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={ringOffset} className="transition-all duration-700" />
              </svg>
              <button onClick={() => onNavigate('taskflow')} className="relative text-center" aria-label={`效率分: ${totalScore}分，点击查看任务流`}>
                <div className="text-3xl font-black text-text">{totalScore}</div>
                <div className="text-[10px] text-text-muted">效率分</div>
              </button>
            </div>
          </div>
        </div>
        {/* Quick Stats */}
        <div className="relative z-[3] mt-5 grid grid-cols-2 gap-2 border-t border-border pt-4 md:grid-cols-5">
          {totalScore > 0 && (
              <button onClick={() => onNavigate('taskflow')} className="flex items-center gap-1.5 rounded-2xl bg-background/50 px-3 py-2 text-left transition hover:bg-surface-lighter" aria-label={`效率分: ${totalScore}%`}>
                <span className={`text-xs font-medium ${progressColor}`}>{totalScore}%</span>
                <span className="text-xs text-text-muted">{t('dashboard.progress')}</span>
              </button>
          )}
          <button onClick={() => onNavigate('taskflow')} className="flex items-center gap-1.5 rounded-2xl bg-background/50 px-3 py-2 text-left transition hover:bg-surface-lighter" aria-label={`任务: ${completedTodos}/${todos.length} 已完成`}>
            <CheckSquare size={12} className="text-primary" />
            <span className="text-xs text-text-muted">{tWith('dashboard.tasks', completedTodos, todos.length)}</span>
          </button>
          <button onClick={() => onNavigate('pomodoro')} className="flex items-center gap-1.5 rounded-2xl bg-background/50 px-3 py-2 text-left transition hover:bg-surface-lighter" aria-label={`番茄钟: ${todayWorkSessions.length}/${dailyPomodoroGoal}`}>
            <Timer size={12} className="text-success" />
            <span className="text-xs text-text-muted">{tWith('dashboard.pomodoros', todayWorkSessions.length, dailyPomodoroGoal)}</span>
          </button>
          <button onClick={() => onNavigate('habits')} className="flex items-center gap-1.5 rounded-2xl bg-background/50 px-3 py-2 text-left transition hover:bg-surface-lighter" aria-label={`习惯: ${completedHabitsToday}/${habits.length} 已完成`}>
            <Target size={12} className="text-warning" />
            <span className="text-xs text-text-muted">{tWith('dashboard.habits', completedHabitsToday, habits.length)}</span>
            {completedHabitsToday > completedHabitsYesterday && completedHabitsYesterday > 0 && (
              <span className="text-[10px] text-success">↑</span>
            )}
          </button>
          <button onClick={() => onNavigate('notes')} className="flex items-center gap-1.5 rounded-2xl bg-background/50 px-3 py-2 text-left transition hover:bg-surface-lighter" aria-label={`笔记: ${notes.length} 篇${todayNewNotes > 0 ? `，今日新增 ${todayNewNotes} 篇` : ''}`}>
            <StickyNote size={12} className="text-purple-400" />
            <span className="text-xs text-text-muted">{tWith('dashboard.notesCount', notes.length)}{todayNewNotes > 0 && <span className="ml-0.5">· {tWith('dashboard.todayNotes', todayNewNotes)}</span>}</span>
          </button>
        </div>
        {showWorkdaySettings && (
          <div className="relative mt-4 rounded-3xl border border-border bg-background/80 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <Banknote size={16} className="text-success" />
                上下班与工资设置
              </div>
              <button onClick={() => setShowWorkdaySettings(false)} className="rounded-xl p-1.5 text-text-muted hover:bg-surface-lighter hover:text-text" aria-label="关闭工资设置">
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
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
      </div>

      <DashboardReminders />

      {/* Selected day tasks */}
      {!isSelectedToday && (() => {
        const selectedDayTodos = todos.filter((t) => t.dueDate === selectedDate)
        return (
        <div className="rounded-3xl border border-border bg-surface/85 p-5 shadow-lg shadow-black/5">
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
        </div>
        )
      })()}

      {(showClockPanel || showDatePanel) && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={showClockPanel ? '时钟面板' : '日期面板'}>
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowClockPanel(false); setShowDatePanel(false) }} aria-label="关闭时间日期弹窗" />
          <div className="relative w-full max-w-xl">
            <button
              onClick={() => { setShowClockPanel(false); setShowDatePanel(false) }}
              className="absolute -right-2 -top-2 z-10 rounded-full border border-border bg-surface p-2 text-text-muted shadow-lg transition hover:text-text"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
            <Suspense fallback={<div className="glass-card p-6 text-sm text-text-muted">加载中...</div>}>
              {showClockPanel ? <ClockWidget /> : (
                <div className="rounded-[34px] border border-border bg-surface p-5 shadow-2xl shadow-black/20">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-text">
                    <Calendar size={16} className="text-primary" />
                    {currentDateDisplay}
                  </div>
                  <CalendarWidget />
                </div>
              )}
            </Suspense>
          </div>
        </div>
      )}

      {/* Today Plan / Evening Review */}
      <div className="glass-card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              {planningPanel.mode === 'morning' ? <Sun size={18} /> : <CircleCheck size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">{planningPanel.title}</h3>
              <p className="mt-1 text-xs text-text-muted">{planningPanel.headline}</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-lighter px-3 py-1 text-[11px] text-text-muted">
            <Clock size={12} />
            {planningPanel.mode === 'morning' ? '自动生成今日安排' : '自动生成今日总结'}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {planningPanel.sections.map((section) => (
            <div key={section.id} className="min-w-0 border-l border-border pl-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="truncate text-xs font-semibold text-text">{section.title}</h4>
                <button
                  onClick={() => navigateFromPlanning(section.id)}
                  className="text-[11px] text-primary transition-colors hover:text-primary-light"
                >
                  处理
                </button>
              </div>
              <div className="space-y-2">
                {section.items.map((item) => {
                  const tone = PLANNING_TONE_STYLES[item.tone]
                  return (
                    <div key={item.id} className="min-w-0">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${tone.dot}`} />
                        <p className="min-w-0 flex-1 break-words text-xs leading-relaxed text-text">{item.text}</p>
                      </div>
                      <div className="mt-1 ml-3.5">
                        <span className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-[10px] ${tone.badge}`}>
                          {item.meta}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weather Card */}
      <button
        onClick={() => onNavigate('weather')}
        className="glass-card p-4 flex items-center gap-4 hover:border-primary/50 hover:scale-[1.01] transition-all text-left w-full"
      >
        {(() => {
          const Icon = CONDITION_ICONS[weather.condition]
          return <Icon className={`w-10 h-10 ${CONDITION_COLORS[weather.condition]} opacity-80`} />
        })()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-text">{weather.temp}°</span>
            <span className="text-sm text-text-muted">{weather.description}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
            <MapPin size={12} />
            <span>{weather.city}</span>
            <span className="mx-1">·</span>
            <span>体感 {weather.feelsLike}°</span>
            <span className="mx-1">·</span>
            <span>{weather.windDirection}风 {weather.windSpeed}km/h</span>
          </div>
        </div>
        <ArrowRight size={16} className="text-text-muted" />
      </button>

      {/* Today Time Blocks */}
      <div className="glass-card p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-text">今日时间块</h3>
              <p className="text-xs text-text-muted">拖拽任务到时段即可排程 · 08:00-21:00</p>
            </div>
          </div>
          <span className="text-xs text-text-muted">{timeBlockPlan.scheduledCount} 项已排入今天</span>
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {timeBlockPlan.blocks.map((block) => {
            const isCurrentHour = block.hour === hour
            return (
              <div
                key={block.hour}
                className={`grid grid-cols-[54px_1fr] gap-3 rounded-lg px-2 py-2 transition-colors ${isCurrentHour ? 'bg-primary/10' : 'hover:bg-surface-lighter/50'}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const taskId = e.dataTransfer.getData('text/task-id') || e.dataTransfer.getData('text/plain')
                  if (!taskId) return
                  onDropTaskToHour(block.hour, taskId)
                }}
              >
                <div className={`pt-1 text-xs font-mono ${isCurrentHour ? 'text-primary' : 'text-text-muted'}`}>{block.label}</div>
                <div className="min-w-0 border-l border-border pl-3">
                  {block.items.length === 0 ? (
                    <div className="text-xs text-text-muted/50">空档 · 可拖入任务</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {block.items.map((item) => {
                        const tone = PLANNING_TONE_STYLES[item.tone]
                        const taskId = item.type === 'task' && item.id.startsWith('task-') ? item.id.slice(5) : null
                        return (
                          <button
                            key={item.id}
                            type="button"
                            draggable={!!taskId}
                            onDragStart={(e) => {
                              if (!taskId) return
                              e.dataTransfer.setData('text/task-id', taskId)
                              e.dataTransfer.setData('text/plain', taskId)
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onClick={() => {
                              if (item.type === 'pomodoro') onNavigate('pomodoro')
                              else if (item.type === 'habit') onNavigate('habits')
                              else onNavigate('taskflow')
                            }}
                            className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-left text-[11px] transition-transform hover:scale-[1.02] ${tone.badge} ${taskId ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            title={taskId ? `${item.title} · 拖拽到其它时段` : `${item.title} · ${item.meta}`}
                          >
                            {item.type === 'pomodoro' ? <Timer size={12} /> : item.type === 'habit' ? <Target size={12} /> : <CheckSquare size={12} />}
                            <span className="truncate">{item.title}</span>
                            <span className="text-[10px] opacity-70">{item.meta}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Welcome Message for New Users */}
      {todos.length === 0 && pomodoroSessions.length === 0 && habits.length === 0 && notes.length === 0 && (
        <div className="glass-card p-6 border-primary/20">
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
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-lighter hover:bg-surface-lighter/80 text-sm text-text-muted hover:text-text transition-all"
                    >
                      <Icon size={14} />
                      {t(action.labelKey)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions — Mineradio home-card grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_ACTION_KEYS.map((action, index) => {
          const Icon = action.icon
          const tones = ['mix', 'local', 'library', 'mix'] as const
          const labels = ['FOCUS', 'FLOW', 'RITUAL', 'NOTES']
          return (
            <button
              key={action.page}
              type="button"
              onClick={() => onNavigate(action.page)}
              className="home-card"
              data-home-tone={tones[index % tones.length]}
            >
              <div className="home-card-label">{labels[index]}</div>
              <div className="home-card-title flex items-center gap-2">
                <Icon size={18} />
                {t(action.labelKey)}
              </div>
              <div className="home-card-sub">快速进入</div>
            </button>
          )
        })}
      </div>

      {/* Monthly Mini Stats */}
      {monthPomodoro > 0 || monthTodos > 0 || monthHabitCount > 0 || monthNewNotes > 0 ? (
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} className="text-text-muted" />
              <span className="text-xs text-text-muted">{tWith('dashboard.monthlyStats', currentMonthLabel, daysInMonth)}</span>
              {monthPomodoro > 0 && (
                <span className="ml-auto text-[10px] text-text-muted">{tWith('dashboard.monthGoal', monthlyProgress)}</span>
              )}
            </div>
            {monthPomodoro > 0 && (
              <div className="h-1.5 bg-surface-lighter rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${monthlyProgress}%`,
                    background: monthlyProgress >= 100
                      ? 'linear-gradient(135deg, var(--color-success), #059669)'
                      : monthlyProgress >= 75
                      ? 'linear-gradient(135deg, var(--color-primary), var(--color-success))'
                      : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
                  }}
                />
              </div>
            )}
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <div className="flex items-center gap-1.5">
                <Timer size={12} className="text-primary" />
                <span className="text-text-muted">{t('dashboard.pomodoroLabel')} <span className="text-text font-medium">{monthPomodoro}</span></span>
                <span className="text-text-muted/50">({tWith('dashboard.dailyAvg', (monthPomodoro / daysInMonth).toFixed(1))})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-cyan-400" />
                <span className="text-text-muted">{t('dashboard.focusLabel')} <span className="text-text font-medium">{fmtMin(monthFocusMinutes)}</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckSquare size={12} className="text-success" />
                <span className="text-text-muted">{t('dashboard.taskLabel')} <span className="text-text font-medium">{monthTodos}</span></span>
                {monthTodoRate >= 0 && <span className="text-text-muted/50">({monthTodoRate}%)</span>}
              </div>
              {monthHabitCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Target size={12} className="text-warning" />
                  <span className="text-text-muted">{t('dashboard.checkinLabel')} <span className="text-text font-medium">{monthHabitCount}</span></span>
                  {monthHabitRate >= 0 && <span className="text-text-muted/50">({monthHabitRate}%)</span>}
                </div>
              )}
              {monthNewNotes > 0 && (
                <div className="flex items-center gap-1.5">
                  <StickyNote size={12} className="text-purple-400" />
                  <span className="text-text-muted">{t('dashboard.noteLabel')} <span className="text-text font-medium">{monthNewNotes}</span></span>
                </div>
              )}
            </div>
          </div>
        ) : null}

      {/* Daily Productivity Score */}
          <div className="glass-card p-5 flex items-center gap-5">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
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
                <span className="text-xl font-bold text-text">{totalScore}</span>
                {scoreDiff !== 0 && (
                  <span className={`text-[9px] font-medium ${scoreDiff > 0 ? 'text-success' : 'text-danger'}`}>
                    {scoreDiff > 0 ? '↑' : '↓'}{Math.abs(scoreDiff)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text mb-1">{t('dashboard.todayEfficiency')}</div>
              <div className="text-xs text-text-muted mb-2">
                {totalScore >= 100 ? t('dashboard.scorePerfect') : totalScore >= 80 ? t('dashboard.scoreGreat') : totalScore >= 50 ? t('dashboard.scoreGood') : t('dashboard.scoreLow')}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  番茄 {Math.round(pomodoroRate * 100)}%
                </span>
                {taskRate >= 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                    任务 {Math.round(taskRate * 100)}%
                  </span>
                )}
                {habitRate >= 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    打卡 {Math.round(habitRate * 100)}%
                  </span>
                )}
                {weekAvgScore > 0 && (
                  <span className="flex items-center gap-1 ml-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40" />
                    {tWith('dashboard.weekAvg', weekAvgScore)}
                  </span>
                )}
              </div>
              {/* 7-day sparkline */}
              {weekScores.some((s) => s > 0) && (
                  <div className="mt-2 flex items-center gap-2">
                    <svg width={120} height={24} className="overflow-visible">
                      <path d={sparkAreaPath} fill="var(--color-primary)" opacity="0.1" />
                      <path d={sparkLinePath} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx={sparkLastPt[0]} cy={sparkLastPt[1]} r="2.5" fill="var(--color-primary)" />
                    </svg>
                    <span className="text-[9px] text-text-muted/50">{t('dashboard.weekTrend')}</span>
                  </div>
              )}
            </div>
          </div>

      {/* Achievements */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-warning" />
            <h3 className="text-sm font-semibold text-text">连续记录</h3>
          </div>
          <span className="text-xs text-text-muted">
            {achievements.badges.filter((badge) => badge.unlocked).length}/{achievements.badges.length} 已达成
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {achievements.badges.map((badge) => (
            <div
              key={badge.id}
              className={`rounded-xl border p-3 transition-colors ${
                badge.unlocked
                  ? 'border-warning/30 bg-warning/10'
                  : 'border-border bg-background/35'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-text">{badge.title}</span>
                <span className={`h-2 w-2 rounded-full ${badge.unlocked ? 'bg-warning' : 'bg-text-muted/30'}`} />
              </div>
              <div className={badge.unlocked ? 'text-lg font-black text-warning' : 'text-lg font-black text-text-muted'}>
                {badge.value}
              </div>
              <p className="mt-1 text-[11px] leading-4 text-text-muted">{badge.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Add Todo */}
      <div className="rounded-[30px] border border-border bg-surface/80 p-4 shadow-xl shadow-black/5">
        {todayAdded > 0 || todayDone > 0 ? (
          <div className="mb-3 flex items-center gap-2 text-[11px] text-text-muted">
            {todayAdded > 0 && <span>{tWith('dashboard.todayAdded', todayAdded)}</span>}
            {todayAdded > 0 && todayDone > 0 && <span> · </span>}
            {todayDone > 0 && <span className="text-success">{tWith('dashboard.todayDone', todayDone)}</span>}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            ref={quickTodoRef}
            type="text"
            value={quickTodo}
            onChange={(e) => setQuickTodo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && quickTodo.trim()) {
                void handleQuickAddTask()
              }
            }}
            placeholder={t('dashboard.quickAdd')}
            aria-label="快速添加任务"
            className="h-14 flex-1 rounded-2xl border border-border bg-background/60 px-5 text-sm text-text outline-none transition-all placeholder:text-text-muted focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          />
          <div className="relative lg:w-44">
            <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              key={`quick-due-${dateInputLocale}`}
              lang={dateInputLocale}
              type="date"
              value={quickDueDate}
              onChange={(e) => setQuickDueDate(e.target.value)}
              className="h-14 w-full rounded-2xl border border-border bg-background/60 pl-10 pr-3 text-center text-xs text-text outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              aria-label="截止日期"
              title={t('dashboard.dueDate')}
            />
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-border bg-background/60 p-2">
            {PRIORITY_BTN_KEYS.map((p) => (
              <button
                key={p.key}
                onClick={() => setQuickPriority(p.key)}
                title={t(p.titleKey)}
                aria-label={t(p.titleKey)}
                className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
                  quickPriority === p.key
                    ? `${p.color} ring-2 ring-white/20 scale-105`
                    : 'bg-surface-lighter hover:bg-surface-lighter/80'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${quickPriority === p.key ? 'bg-white' : p.color}`} />
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (quickTodo.trim()) {
                void handleQuickAddTask()
              }
            }}
            className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary-dark"
            aria-label="添加任务"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const Badge = stat.badge
          return (
            <button
              key={stat.label}
              type="button"
              onClick={() => onNavigate(stat.page)}
              className="group relative overflow-hidden rounded-[30px] border border-border bg-surface/80 p-5 text-left shadow-xl shadow-black/5 transition-all hover:-translate-y-1 hover:border-primary/35 hover:shadow-2xl hover:shadow-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label={`打开${stat.label}模块`}
            >
              <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${stat.color} opacity-10 blur-2xl transition-opacity group-hover:opacity-25`} />
              <div className="flex items-start justify-between mb-3">
                <div className={`relative w-11 h-11 rounded-2xl ${stat.iconBg} flex items-center justify-center shadow-lg shadow-black/5`}>
                  <Icon size={20} className={stat.iconColor} />
                </div>
                {Badge && <Badge size={14} className={stat.badgeColor} />}
              </div>
              <div className="relative text-3xl font-black tracking-tight text-text">{stat.value}</div>
              <div className="text-xs text-text-muted mt-1">{stat.label}</div>
              <div className={`h-1 mt-3 rounded-full bg-gradient-to-r ${stat.color}`} />
              <div className="text-xs text-text-muted mt-2">{stat.sub}</div>
              {'streak' in stat && stat.streak && stat.streak > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <Flame size={10} className="text-orange-400" />
                  <span className="text-[10px] text-orange-400">{tWith('dashboard.streakDays', stat.streak)}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Weekly Focus Chart */}
      <div
        className="glass-card p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
        role="button"
        tabIndex={0}
        onClick={(event) => navigateFromCard('pomodoro', event)}
        onKeyDown={(event) => handleCardKeyDown('pomodoro', event)}
        aria-label="打开番茄钟模块"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-primary" />
            <h3 className="text-sm font-semibold text-text">{t('dashboard.weeklyFocus')}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>{tWith('dashboard.totalSessions', weeklyChartData.thisWeek)}</span>
            <span>·</span>
            <span>{fmtMin(weeklyChartData.weekFocusMin)}</span>
            <span>·</span>
            <span>{tWith('dashboard.dailyAvgSessions', (weeklyChartData.thisWeek / 7).toFixed(1))}</span>
            {weeklyChartData.trend !== 0 && (
              <>
                <span>·</span>
                <span className={weeklyChartData.trend > 0 ? 'text-success' : 'text-danger'}>
                  {tWith('dashboard.vsLastWeek', weeklyChartData.trend)}
                </span>
              </>
            )}
          </div>
        </div>
        {weeklyChartData.thisWeek === 0 && weeklyChartData.lastWeek === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-text-muted">
            <div className="text-center">
              <BarChart3 size={24} className="mx-auto mb-2 opacity-30" />
              <p>{t('dashboard.noFocusThisWeek')}</p>
              <button
                onClick={() => onNavigate('pomodoro')}
                className="text-xs text-primary hover:text-primary-light mt-1 transition-colors"
              >
                {t('dashboard.startFirstPomodoro')}
              </button>
            </div>
          </div>
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
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <div
          className="glass-card p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
          role="button"
          tabIndex={0}
          onClick={(event) => navigateFromCard('taskflow', event)}
          onKeyDown={(event) => handleCardKeyDown('taskflow', event)}
          aria-label="打开任务流模块"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckSquare size={18} className="text-primary" />
              <h3 className="text-sm font-semibold text-text">{t('dashboard.todoPriority')}</h3>
            </div>
            <button
              onClick={() => onNavigate('taskflow')}
              className="text-xs text-primary hover:text-primary-light transition-colors flex items-center gap-1"
            >
              {t('dashboard.viewAll')} <ArrowRight size={12} />
            </button>
          </div>
          {recentTodos.length === 0 ? (
            <div className="text-center py-6">
              <CheckSquare size={32} className="mx-auto mb-2 text-text-muted opacity-30" />
              <p className="text-sm text-text-muted">{t('dashboard.noTasks')}</p>
              <button
                onClick={() => onNavigate('taskflow')}
                className="text-xs text-primary hover:text-primary-light mt-1 transition-colors"
              >
                {t('dashboard.goAddTask')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTodos.map((todo) => {
                return (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-lighter transition-colors"
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      todo.completed ? 'bg-success border-success' : 'border-border'
                    }`}
                  >
                    {todo.completed && <Check size={8} className="text-white" />}
                  </div>
                  <span
                    className={`text-sm flex-1 ${
                      todo.completed ? 'line-through text-text-muted' : 'text-text'
                    }`}
                  >
                    {todo.text}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[todo.priority]}`} />
                  {todo.dueStatus && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${todo.dueStatus.bg} ${todo.dueStatus.color}`}>
                      {todo.dueStatus.label}
                    </span>
                  )}
                  {todo.completed && todo.completedAt && todo.completedAt >= todayMidnightMs && todo.completedAt < tomorrowMidnightMs ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success">{t('dashboard.completedToday')}</span>
                  ) : (
                    <span className="text-xs text-text-muted">
                      {todo.dateDisplay}
                    </span>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Notes */}
        <div
          className="glass-card p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
          role="button"
          tabIndex={0}
          onClick={(event) => navigateFromCard('notes', event)}
          onKeyDown={(event) => handleCardKeyDown('notes', event)}
          aria-label="打开笔记模块"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <StickyNote size={18} className="text-warning" />
              <h3 className="text-sm font-semibold text-text">{t('dashboard.recentNotes')}</h3>
            </div>
            <button
              onClick={() => onNavigate('notes')}
              className="text-xs text-primary hover:text-primary-light transition-colors flex items-center gap-1"
            >
              {t('dashboard.viewAll')} <ArrowRight size={12} />
            </button>
          </div>
          {recentNotes.length === 0 ? (
            <div className="text-center py-6">
              <StickyNote size={32} className="mx-auto mb-2 text-text-muted opacity-30" />
              <p className="text-sm text-text-muted">{t('dashboard.noNotes')}</p>
              <button
                onClick={() => onNavigate('notes')}
                className="text-xs text-primary hover:text-primary-light mt-1 transition-colors"
              >
                {t('dashboard.goCreateNote')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg hover:bg-surface-lighter transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: note.color }}
                    />
                    <span className="text-sm font-medium text-text">{note.title}</span>
                    {note.pinned && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-primary/15 text-primary">{t('dashboard.pinned')}</span>
                    )}
                    {note.content.length > 0 && (
                      <span className="text-[10px] text-text-muted/60">{tWith('dashboard.charCount', note.content.length)} · {tWith('dashboard.readTime', Math.max(1, Math.ceil(note.content.length / 400)))}</span>
                    )}
                    <span className="text-[10px] text-text-muted ml-auto">{note.relativeTime}</span>
                  </div>
                  <p className="text-xs text-text-muted line-clamp-2 ml-4">
                    {note.preview}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project Overview */}
      {projectOverview.length > 0 && (
        <div
          className="glass-card p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('taskflow')}
          onKeyDown={(event) => handleCardKeyDown('taskflow', event)}
          aria-label="打开任务流查看全部项目"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderKanban size={18} className="text-primary" />
              <h3 className="text-sm font-semibold text-text">项目概览</h3>
            </div>
            <button
              onClick={(event) => { event.stopPropagation(); onNavigate('taskflow') }}
              className="text-xs text-primary hover:text-primary-light transition-colors flex items-center gap-1"
            >
              查看全部 <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {projectOverview.map((row) => (
              <div
                key={row.category.id}
                className="rounded-2xl border border-border bg-background/45 p-3 transition hover:border-primary/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.category.color }} />
                  <span className="text-sm font-semibold text-text truncate">{row.category.name}</span>
                  <span className="ml-auto text-[10px] text-text-muted">{row.active} 活跃</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-lighter mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${row.progress}%`, backgroundColor: row.category.color }}
                  />
                </div>
                <p className="text-[11px] text-text-muted truncate">
                  {row.nextTitle || '暂无待办'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Check-in Summary */}
      <div
        className="glass-card p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
        role="button"
        tabIndex={0}
        onClick={(event) => navigateFromCard('habits', event)}
        onKeyDown={(event) => handleCardKeyDown('habits', event)}
        aria-label="打开每日打卡模块"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-success" />
            <h3 className="text-sm font-semibold text-text">{t('dashboard.todayHabits')}</h3>
            {habitProgressRing && (
                <div className="relative w-5 h-5">
                  <svg viewBox="0 0 20 20" className="w-full h-full -rotate-90">
                    <circle cx="10" cy="10" r={habitProgressRing.r} fill="none" stroke="var(--color-border)" strokeWidth="2" />
                    <circle cx="10" cy="10" r={habitProgressRing.r} fill="none" stroke={habitProgressRing.color} strokeWidth="2" strokeDasharray={habitProgressRing.c} strokeDashoffset={habitProgressRing.o} strokeLinecap="round" className="transition-all duration-500" />
                  </svg>
                </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {habits.length > 0 && (
              <>
                <span className="text-xs text-text-muted">
                  {completedHabitsToday}/{habits.length} {t('dashboard.completed')}
                </span>
                {longestHabitStreak > 1 && (
                  <span className="text-[10px] text-orange-400">🔥 {longestHabitStreak}天连续</span>
                )}
                {habitWeekRate > 0 && <span className="text-[10px] text-text-muted">本周 {habitWeekRate}%</span>}
                {habitMonthRate > 0 && <span className="text-[10px] text-text-muted ml-1">本月 {habitMonthRate}%</span>}
              </>
            )}
            <button
              onClick={() => onNavigate('habits')}
              className="text-xs text-primary hover:text-primary-light transition-colors flex items-center gap-1"
            >
              {t('dashboard.manage')} <ArrowRight size={12} />
            </button>
          </div>
        </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {habits.length === 0 ? (
              <div className="w-full text-center py-4">
                <Target size={32} className="mx-auto mb-2 text-text-muted opacity-30" />
                <p className="text-sm text-text-muted mb-2">{t('dashboard.noHabits')}</p>
                <button
                  onClick={() => onNavigate('habits')}
                  className="text-xs text-primary hover:text-primary-light transition-colors"
                >
                  {t('dashboard.goAddHabit')}
                </button>
              </div>
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:scale-[1.02] ${
                      isCompleted ? 'bg-success/10' : 'bg-surface-lighter hover:bg-surface-lighter/80'
                    } ${togglingHabitId === habit.id ? 'scale-110' : ''}`}
                  >
                    <span>{habit.icon}</span>
                    <span className={`text-sm ${isCompleted ? 'text-success' : 'text-text-muted'}`}>
                      {habit.name}
                    </span>
                    {streak > 1 && (
                      <span className="text-[10px] text-orange-400 flex items-center gap-0.5">
                        <Flame size={10} />{streak}
                      </span>
                    )}
                    {isCompleted && <span className="text-success text-xs">✓</span>}
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
                <div className="text-xs text-success mt-2 text-center font-medium">
                  {t('dashboard.habitsAllDone')}
                </div>
              ) : completedHabitsToday > 0 ? (
                <div className="text-xs text-text-muted mt-2 text-center">
                  {tWith('dashboard.habitsRemaining', habits.length - completedHabitsToday)}
                </div>
              ) : null}
            </>
          )}
        </div>

      {/* Timeline */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <Clock size={18} className="text-text-muted" />
            {t('dashboard.todayTimeline')}
          </h3>
          {timelineEvents.total > 0 && (
            <span className="text-xs text-text-muted">{tWith('dashboard.activities', timelineEvents.total)}</span>
          )}
        </div>
        <div className="relative pl-6 border-l-2 border-border space-y-4">
          {timelineEvents.items.length === 0 ? (
            <div className="text-center py-2">
              <p className="text-sm text-text-muted mb-2">{t('dashboard.noActivity')}</p>
              <button
                onClick={() => onNavigate('pomodoro')}
                className="text-xs text-primary hover:text-primary-light transition-colors"
              >
                {t('dashboard.startPomodoroHint')}
              </button>
            </div>
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
                    <div className={`absolute -left-[25px] w-3 h-3 rounded-full ${event.color} border-2 border-surface`} />
                    <div className="text-sm text-text">{event.label}</div>
                    <div className="text-xs text-text-muted">{event.hhmm} · {event.relative}</div>
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
                  className="text-xs text-primary hover:text-primary-light transition-colors mt-2"
                >
                  {showAllTimeline ? t('dashboard.collapse') : tWith('dashboard.viewAllTimeline', timelineEvents.total)}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dashboard Stats — collapsed by default to reduce density */}
      <div className="dashboard-stats-section">
        <button
          type="button"
          onClick={() => {
            setShowDashboardStats((prev) => {
              const next = !prev
              try { localStorage.setItem('abworkbench-dashboard-stats-open', next ? '1' : '0') } catch { /* ignore */ }
              return next
            })
          }}
          className="mb-3 flex w-full items-center justify-between rounded-panel border border-border bg-surface/70 px-4 py-3 text-left hover:border-primary/30"
          aria-expanded={showDashboardStats}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-text">
            <BarChart3 size={16} className="text-primary" />
            统计总览
          </span>
          <span className="text-xs text-text-muted">{showDashboardStats ? '收起' : '展开详情'}</span>
        </button>
        {showDashboardStats && (
          <Suspense fallback={<div className="glass-card h-56 animate-pulse" />}>
            <StatsPage embedded />
          </Suspense>
        )}
      </div>
    </div>
    </ErrorBoundary>
  )
}
