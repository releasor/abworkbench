import { Search, Bell, Menu, X, Moon, Sun } from 'lucide-react'
import { useState, useEffect, useMemo, useRef, memo, type CSSProperties } from 'react'
import { useStore } from '../../store'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { useTranslation } from '../../i18n'
import { useToday } from '../../hooks/useToday'
import { useTick } from '../../hooks/useTick'
import { durationMinutes, fmtMin, dayNumToFullLabel, fmtHHmm } from '../../utils/format'
import { useShortcutStore } from '../../shortcuts'
import WindowControls from './WindowControls'

const dragRegion = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegion = { WebkitAppRegion: 'no-drag' } as CSSProperties

const LiveClock = memo(function LiveClock() {
  const { t } = useTranslation()
  const time = useTick(1000)
  const dayNum = Math.floor(time.getTime() / 86400000)
  const weekdayNames = t('calendar.dayNames') as unknown as string[]
  const weekday = weekdayNames[(dayNum + 4) % 7]
  const dateLabel = dayNumToFullLabel(dayNum)
  const h = String(time.getHours()).padStart(2, '0')
  const m = String(time.getMinutes()).padStart(2, '0')
  const s = String(time.getSeconds()).padStart(2, '0')
  return (
    <>
      <div className="hidden md:block text-sm text-text-muted">
        {dateLabel} {weekday}
      </div>
      <div className="hidden md:block text-sm font-mono text-text-muted px-3 py-1.5 bg-surface rounded-lg">
        {h}:{m}:{s}
      </div>
    </>
  )
})

interface HeaderProps {
  title: string
  onOpenCommandPalette?: () => void
  onOpenMobileSidebar?: () => void
}

export default memo(function Header({ title, onOpenCommandPalette, onOpenMobileSidebar }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [seenCount, setSeenCount] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)
  const { t, tWith } = useTranslation()
  const themeMode = useStore((s) => s.themeMode)
  const toggleThemeMode = useStore((s) => s.toggleThemeMode)
  const pomodoroSessions = useStore((s) => s.pomodoroSessions)
  const taskFlowTasks = useTaskStore((s) => s.tasks)
  const habits = useStore((s) => s.habits)
  const dailyPomodoroGoal = useStore((s) => s.dailyPomodoroGoal)
  const commandPaletteHotkey = useShortcutStore((s) => s.getAccelerator('commandPalette'))
  const { todayStr, todayMidnightMs, tomorrowMidnightMs } = useToday()
  const tomorrowStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }, [])

  useEffect(() => {
    if (!showNotifications) return
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNotifications])

  const { items: notifications, todayWorkCount } = useMemo(() => {
    const items: Array<{ id: string; text: string; time: string; color: string }> = []

    // Single pass over TaskFlow tasks: overdue + today due + tomorrow due + today completed
    let overdueCount = 0
    let todayDueCount = 0
    let tomorrowDueCount = 0
    let todayCompletedCount = 0
    let lastCompletedAt = 0
    for (const task of taskFlowTasks) {
      if (task.archived) continue
      if (task.status !== 'done') {
        if (task.dueDate) {
          const due = task.dueDate.slice(0, 10)
          if (due < todayStr) overdueCount++
          else if (due === todayStr) todayDueCount++
          else if (due === tomorrowStr) tomorrowDueCount++
        }
      } else if (task.completedAt) {
        const completedAt = Date.parse(task.completedAt)
        if (completedAt < todayMidnightMs || completedAt >= tomorrowMidnightMs) continue
        todayCompletedCount++
        if (completedAt > lastCompletedAt) lastCompletedAt = completedAt
      }
    }
    if (overdueCount > 0) {
      items.push({ id: 'overdue', text: tWith('notification.overdueTasks', overdueCount), time: '', color: 'bg-danger' })
    }
    if (todayDueCount > 0) {
      items.push({ id: 'due-today', text: `${todayDueCount} 个任务今日到期`, time: '', color: 'bg-warning' })
    }
    if (tomorrowDueCount > 0) {
      items.push({ id: 'due-tomorrow', text: `${tomorrowDueCount} 个任务明日到期`, time: '', color: 'bg-blue-400' })
    }
    if (todayCompletedCount > 0) {
      items.push({ id: 'todos', text: tWith('notification.todayCompleted', todayCompletedCount), time: fmtHHmm(lastCompletedAt), color: 'bg-success' })
    }

    // Single pass over pomodoro sessions: today work
    let todayWorkCount = 0
    let totalWorkMin = 0
    let lastWorkEndedAt = 0
    for (const s of pomodoroSessions) {
      if (s.type === 'work' && s.completed && s.startedAt >= todayMidnightMs && s.startedAt < tomorrowMidnightMs) {
        todayWorkCount++
        totalWorkMin += durationMinutes(s.startedAt, s.endedAt)
        if (s.endedAt > lastWorkEndedAt) lastWorkEndedAt = s.endedAt
      }
    }
    if (todayWorkCount > 0) {
      items.push({
        id: 'pomodoro',
        text: tWith('notification.pomodoroDone', todayWorkCount, fmtMin(totalWorkMin)),
        time: fmtHHmm(lastWorkEndedAt),
        color: 'bg-primary',
      })
      if (todayWorkCount >= dailyPomodoroGoal) {
        items.push({ id: 'goal', text: tWith('notification.goalReached', todayWorkCount), time: '', color: 'bg-success' })
      }
    }

    // Habits
    let completedHabits = 0
    for (const h of habits) { if (h.completedDates.includes(todayStr)) completedHabits++ }
    if (completedHabits > 0) {
      items.push({ id: 'habits', text: tWith('notification.habitCheckin', completedHabits, habits.length), time: '', color: 'bg-warning' })
    }
    // Incomplete habits reminder
    const incompleteHabits = habits.length - completedHabits
    if (incompleteHabits > 0 && habits.length > 0) {
      items.push({ id: 'habits-reminder', text: `${incompleteHabits} 个习惯尚未完成`, time: '', color: 'bg-amber-400' })
    }

    return { items, todayWorkCount }
  }, [pomodoroSessions, taskFlowTasks, habits, dailyPomodoroGoal, todayStr, tomorrowStr, todayMidnightMs, tomorrowMidnightMs, tWith])

  const hasNotifications = notifications.length > 0
  const hasUnread = hasNotifications && notifications.length !== seenCount

  const progressRing = useMemo(() => {
    if (todayWorkCount <= 0) return null
    const progress = Math.min(todayWorkCount / dailyPomodoroGoal, 1)
    const r = 8
    const c = 2 * Math.PI * r
    const offset = c * (1 - progress)
    return { r, c, offset }
  }, [todayWorkCount, dailyPomodoroGoal])

  return (
    <header
      className="h-16 border-b border-border bg-surface-light/50 backdrop-blur-md flex items-center justify-between px-4 md:px-6 sticky top-0 z-10"
      style={dragRegion}
    >
      <div className="flex items-center gap-3" style={noDragRegion}>
        {/* Mobile menu button */}
        <button
          onClick={onOpenMobileSidebar}
          aria-label={t('header.openMenu')}
          className="p-2 rounded-lg hover:bg-surface-lighter text-text-muted hover:text-text transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>

        <h1 className="text-lg md:text-xl font-semibold text-text">{title}</h1>
      </div>

      <div className="flex items-center gap-2 md:gap-3" style={noDragRegion}>
        {/* Theme Toggle */}
        <button
          onClick={toggleThemeMode}
          aria-label={themeMode === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          title={themeMode === 'dark' ? '浅色主题' : '深色主题'}
          className="p-2 rounded-lg hover:bg-surface-lighter text-text-muted hover:text-text transition-colors"
        >
          {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Search / Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="relative hidden sm:flex items-center gap-2 input-field pl-9 pr-12 py-2 w-48 md:w-56 text-sm cursor-pointer hover:border-primary/50 transition-colors"
        >
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <span className="text-text-muted">{t('header.searchPlaceholder')}</span>
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] text-text-muted bg-surface rounded border border-border">
            {commandPaletteHotkey}
          </kbd>
        </button>

        {/* Mobile search button */}
        <button
          onClick={onOpenCommandPalette}
          aria-label={t('header.search')}
          className="p-2 rounded-lg hover:bg-surface-lighter text-text-muted hover:text-text transition-colors sm:hidden"
        >
          <Search size={18} />
        </button>

        {/* Today's Progress */}
        {progressRing && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-primary/10 rounded-lg">
              <div className="relative w-5 h-5">
                <svg viewBox="0 0 20 20" className="w-full h-full -rotate-90">
                  <circle cx="10" cy="10" r={progressRing.r} fill="none" stroke="var(--color-primary)" strokeWidth="2" opacity="0.2" />
                  <circle cx="10" cy="10" r={progressRing.r} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeDasharray={progressRing.c} strokeDashoffset={progressRing.offset} strokeLinecap="round" className="transition-all duration-500" />
                </svg>
              </div>
              <span className="text-xs font-medium text-primary">{todayWorkCount}/{dailyPomodoroGoal}</span>
            </div>
        )}

        {/* Time */}
        <LiveClock />

        {/* Notification */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              if (!showNotifications) setSeenCount(notifications.length)
            }}
            aria-expanded={showNotifications}
            aria-label={t('header.notifications')}
            className="p-2 rounded-lg hover:bg-surface-lighter text-text-muted hover:text-text transition-colors relative"
          >
            <Bell size={18} />
            {hasUnread && hasNotifications && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center px-1 text-[10px] font-bold text-white bg-danger rounded-full" aria-live="polite">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-64 glass-card p-3 shadow-xl z-50 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text">{t('header.notifications')}</span>
                <button
                  onClick={() => setShowNotifications(false)}
                  aria-label={t('header.closeNotifications')}
                  className="text-text-muted hover:text-text"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2">
                {notifications.length > 0 ? notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-2 p-2 rounded-lg bg-surface-lighter/50">
                    <div className={`w-2 h-2 rounded-full ${n.color} mt-1.5 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text">{n.text}</p>
                      {n.time && <p className="text-[10px] text-text-muted mt-0.5">{n.time}</p>}
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-text-muted text-center py-2">{t('header.noNotifications')}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Custom window controls (frameless window) */}
        <div className="ml-1 pl-2 border-l border-border/60">
          <WindowControls />
        </div>
      </div>
    </header>
  )
})
