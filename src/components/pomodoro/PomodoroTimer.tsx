import type { ReactNode } from 'react'
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { Play, Pause, RotateCcw, Coffee, Moon, Zap, Bell, BellOff, Volume2, History, Clock, SkipForward, FastForward, ChevronDown, Target, Flame, Gauge, CalendarDays, ListTodo } from 'lucide-react'
import { useStore } from '../../store'
import { eventMatchesShortcut, useShortcutStore } from '../../shortcuts'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { useToday } from '../../hooks/useToday'
import { getRelativeTimeShort, durationMinutes, fmtMin, dayNumToDateStr, fmtHHmm, dayNumToShortLabel, dayNumToYMD } from '../../utils/format'
import { playPomodoroCompleteSound } from '../../utils/audio'
import { setPomodoroTitleActive } from '../../utils/documentTitle'
import { showToast } from '../../modules/taskflow/utils/toastEvent'
import { clearActivePomodoro, writeActivePomodoro, ACTIVE_POMODORO_EVENT, getActiveRemainingSec, type ActivePomodoroState } from '../../utils/activePomodoro'
import AmbientSounds from '../common/AmbientSounds'
import PomodoroStats from './PomodoroStats'
import PanelSwitch from '../common/PanelSwitch'
import { Kbd } from '../common/Kbd'
import ErrorBoundary from '../common/ErrorBoundary'
import clsx from 'clsx'

type Mode = 'work' | 'shortBreak' | 'longBreak'

const QUICK_DURATIONS: Record<Mode, number[]> = {
  work: [15, 20, 25, 30, 45, 60],
  shortBreak: [3, 5, 10, 15],
  longBreak: [10, 15, 20, 30],
}

const MODE_STYLES = {
  work: { label: '专注', icon: Zap, color: 'from-primary to-primary-dark', ringStart: 'var(--color-primary)', ringEnd: 'var(--color-primary-light)' },
  shortBreak: { label: '短休息', icon: Coffee, color: 'from-success to-emerald-600', ringStart: 'var(--color-success)', ringEnd: '#34d399' },
  longBreak: { label: '长休息', icon: Moon, color: 'from-blue-500 to-blue-600', ringStart: '#3b82f6', ringEnd: '#60a5fa' },
}

const RING_SIZE = 220
const RING_STROKE_WIDTH = 8
const RING_RADIUS = (RING_SIZE - RING_STROKE_WIDTH) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function showBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/favicon.svg' })
    } catch {
      // Notification constructor can throw in restricted environments
    }
  }
}

export default function PomodoroTimer() {
  const pomodoroSessions = useStore((s) => s.pomodoroSessions)
  const addPomodoroSession = useStore((s) => s.addPomodoroSession)
  const dailyPomodoroGoal = useStore((s) => s.dailyPomodoroGoal)
  const pomodoroWorkDuration = useStore((s) => s.pomodoroWorkDuration)
  const pomodoroShortBreakDuration = useStore((s) => s.pomodoroShortBreakDuration)
  const pomodoroLongBreakDuration = useStore((s) => s.pomodoroLongBreakDuration)
  const setPomodoroDurations = useStore((s) => s.setPomodoroDurations)
  const pomodoroSoundEnabled = useStore((s) => s.pomodoroSoundEnabled)
  const setPomodoroSoundEnabled = useStore((s) => s.setPomodoroSoundEnabled)
  const pomodoroAutoStartBreaks = useStore((s) => s.pomodoroAutoStartBreaks)
  const setPomodoroAutoStartBreaks = useStore((s) => s.setPomodoroAutoStartBreaks)
  const pomodoroAutoStartWork = useStore((s) => s.pomodoroAutoStartWork)
  const setPomodoroAutoStartWork = useStore((s) => s.setPomodoroAutoStartWork)
  const [mode, setMode] = useState<Mode>('work')
  const shortcutOverrides = useShortcutStore((s) => s.overrides)
  const [timeLeft, setTimeLeft] = useState(pomodoroWorkDuration * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [completedPomodoros, setCompletedPomodoros] = useState(0)
  const soundEnabled = pomodoroSoundEnabled
  const setSoundEnabled = setPomodoroSoundEnabled
  const autoStartBreaks = pomodoroAutoStartBreaks
  const setAutoStartBreaks = setPomodoroAutoStartBreaks
  const autoStartWork = pomodoroAutoStartWork
  const setAutoStartWork = setPomodoroAutoStartWork
  const { todayMidnightMs: todayMidnightMsHook, tomorrowMidnightMs: tomorrowMidnightMsHook } = useToday()
  const todayCompletedFromStore = useMemo(
    () => pomodoroSessions.filter((s) => (
      s.type === 'work' &&
      s.completed &&
      s.startedAt >= todayMidnightMsHook &&
      s.startedAt < tomorrowMidnightMsHook
    )).length,
    [pomodoroSessions, todayMidnightMsHook, tomorrowMidnightMsHook],
  )
  useEffect(() => {
    queueMicrotask(() => {
      setCompletedPomodoros((prev) => Math.max(prev, todayCompletedFromStore))
    })
  }, [todayCompletedFromStore])
  const [ambientExpanded, setAmbientExpanded] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const allTasks = useTaskStore((s) => s.tasks)
  const activeTasks = useMemo(() => allTasks.filter((t) => t.status !== 'done' && !t.archived), [allTasks])
  const taskPickerRef = useRef<HTMLButtonElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const selectedTaskIdRef = useRef<string>(selectedTaskId)
  const modeRef = useRef<Mode>(mode)
  const completedRef = useRef(completedPomodoros)
  const timeLeftRef = useRef(timeLeft)
  const durationsRef = useRef({ work: pomodoroWorkDuration, shortBreak: pomodoroShortBreakDuration, longBreak: pomodoroLongBreakDuration })
  const isRunningRef = useRef(isRunning)
  const soundEnabledRef = useRef(soundEnabled)
  const autoStartBreaksRef = useRef(autoStartBreaks)
  const autoStartWorkRef = useRef(autoStartWork)
  const targetEndTimeRef = useRef<number>(0)
  const POMODORO_ACTIVE_KEY = 'abworkbench-pomodoro-active'

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = sessionStorage.getItem(POMODORO_ACTIVE_KEY)
        if (!raw) return
        const saved = JSON.parse(raw) as {
          mode?: Mode
          targetEnd?: number
          completed?: number
          selectedTaskId?: string
          isRunning?: boolean
        }
        if (!saved?.isRunning || !saved.targetEnd || saved.targetEnd <= Date.now()) {
          sessionStorage.removeItem(POMODORO_ACTIVE_KEY)
          return
        }
        const remaining = Math.max(1, Math.ceil((saved.targetEnd - Date.now()) / 1000))
        if (saved.mode === 'work' || saved.mode === 'shortBreak' || saved.mode === 'longBreak') {
          setMode(saved.mode)
        }
        setTimeLeft(remaining)
        targetEndTimeRef.current = saved.targetEnd
        if (typeof saved.completed === 'number') setCompletedPomodoros(saved.completed)
        if (typeof saved.selectedTaskId === 'string') setSelectedTaskId(saved.selectedTaskId)
        setIsRunning(true)
        startTimeRef.current = saved.targetEnd - remaining * 1000
      } catch {
        sessionStorage.removeItem(POMODORO_ACTIVE_KEY)
      }
    })
  }, [])

  useEffect(() => {
    try {
      if (!isRunning) {
        sessionStorage.removeItem(POMODORO_ACTIVE_KEY)
        return
      }
      sessionStorage.setItem(POMODORO_ACTIVE_KEY, JSON.stringify({
        mode,
        targetEnd: targetEndTimeRef.current,
        completed: completedPomodoros,
        selectedTaskId,
        isRunning: true,
      }))
    } catch {
      // ignore storage failures
    }
  }, [completedPomodoros, isRunning, mode, selectedTaskId, timeLeft])

  useEffect(() => {
    modeRef.current = mode
    completedRef.current = completedPomodoros
    timeLeftRef.current = timeLeft
    durationsRef.current = { work: pomodoroWorkDuration, shortBreak: pomodoroShortBreakDuration, longBreak: pomodoroLongBreakDuration }
    isRunningRef.current = isRunning
    soundEnabledRef.current = soundEnabled
    autoStartBreaksRef.current = autoStartBreaks
    autoStartWorkRef.current = autoStartWork
    selectedTaskIdRef.current = selectedTaskId
  }, [mode, completedPomodoros, timeLeft, pomodoroWorkDuration, pomodoroShortBreakDuration, pomodoroLongBreakDuration, isRunning, soundEnabled, autoStartBreaks, autoStartWork, selectedTaskId])

  const getDuration = (m: Mode) => {
    const d = durationsRef.current
    if (m === 'work') return d.work * 60
    if (m === 'shortBreak') return d.shortBreak * 60
    return d.longBreak * 60
  }

  const durationSecondsByMode = useMemo<Record<Mode, number>>(() => ({
    work: pomodoroWorkDuration * 60,
    shortBreak: pomodoroShortBreakDuration * 60,
    longBreak: pomodoroLongBreakDuration * 60,
  }), [pomodoroWorkDuration, pomodoroShortBreakDuration, pomodoroLongBreakDuration])

  const currentConfig = useMemo(() => {
    return { ...MODE_STYLES[mode], duration: durationSecondsByMode[mode] }
  }, [durationSecondsByMode, mode])
  const progress = 1 - timeLeft / currentConfig.duration
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  // Consolidated pomodoro stats — single pass over pomodoroSessions
  const pomodoroStats = useMemo(() => {
    const DAY = 86400000
    const todayMidnightMs = todayMidnightMsHook
    const tomorrowMidnightMs = tomorrowMidnightMsHook
    const yesterdayMidnightMs = todayMidnightMs - DAY
    const last7StartMs = todayMidnightMs - 6 * DAY
    const todayDayNum = Math.floor(todayMidnightMs / DAY)
    const todayDay = (todayDayNum + 4) % 7
    const dayOfMonth = dayNumToYMD(todayDayNum).d
    const weekStartMs = todayMidnightMs - ((todayDay === 0 ? 6 : todayDay - 1) * DAY)
    const lastWeekStartMs = weekStartMs - 7 * DAY
    const lastWeekEndMs = weekStartMs - 1
    const monthStartMs = todayMidnightMs - (dayOfMonth - 1) * DAY

    const todayWorkSessions: typeof pomodoroSessions = []
    const todayBreakSessions: typeof pomodoroSessions = []
    let totalFocusMinutes = 0
    let totalBreakMinutes = 0
    let todayGoalMet = 0
    let todayBestMin = 0
    let last7Count = 0
    let yesterdayWorkCount = 0
    let firstWorkStart = Infinity
    let lastWorkEnd = 0
    // Period stats
    let totalCount = 0; let weekMin = 0; let lastWeekMin = 0; let monthMin = 0
    const dayMap = new Map<string, number>()
    const daySet = new Set<string>()

    for (const s of pomodoroSessions) {
      const dateStr = dayNumToDateStr(Math.floor(s.startedAt / DAY))
      // Today stats
      if (s.type === 'work' && s.completed) {
        if (s.startedAt >= last7StartMs) last7Count++
        if (s.startedAt >= yesterdayMidnightMs && s.startedAt < todayMidnightMs) yesterdayWorkCount++
      }
      if (s.startedAt >= todayMidnightMs && s.startedAt < tomorrowMidnightMs) {
        if (s.type === 'work' && s.completed) {
          todayWorkSessions.push(s)
          const durMin = durationMinutes(s.startedAt, s.endedAt)
          totalFocusMinutes += durMin
          if (durMin / pomodoroWorkDuration >= 0.9) todayGoalMet++
          if (durMin > todayBestMin) todayBestMin = durMin
          if (s.startedAt < firstWorkStart) firstWorkStart = s.startedAt
          if (s.endedAt > lastWorkEnd) lastWorkEnd = s.endedAt
        } else if (s.type === 'break' && s.completed) {
          todayBreakSessions.push(s)
          totalBreakMinutes += durationMinutes(s.startedAt, s.endedAt)
        }
      }
      // Period stats (all work+completed sessions)
      if (s.type === 'work' && s.completed) {
        totalCount++
        const durMin = durationMinutes(s.startedAt, s.endedAt)
        dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1)
        daySet.add(dateStr)
        if (s.startedAt >= weekStartMs) weekMin += durMin
        if (s.startedAt >= lastWeekStartMs && s.startedAt <= lastWeekEndMs) lastWeekMin += durMin
        if (s.startedAt >= monthStartMs) monthMin += durMin
      }
    }

    const week7Avg = (last7Count / 7).toFixed(1)
    const elapsedMin = todayWorkSessions.length > 0 ? Math.max(1, durationMinutes(firstWorkStart, lastWorkEnd)) : 0
    const focusEfficiency = elapsedMin > 0 ? Math.min(Math.round((totalFocusMinutes / elapsedMin) * 100), 100) : 0

    let dailyAvg = 0; let pomodoroStreak = 0
    if (totalCount > 0) {
      dailyAvg = Math.round((totalCount / dayMap.size) * 10) / 10
      for (let i = 0; i < 30; i++) {
        if (daySet.has(dayNumToDateStr(todayDayNum - i))) pomodoroStreak++
        else if (i > 0) break
      }
    }

    return { todayWorkSessions, todayBreakSessions, totalFocusMinutes, totalBreakMinutes, todayGoalMet, todayBestMin, last7Count, week7Avg, yesterdayWorkCount, todayMidnightMs, focusEfficiency, dailyAvg, weekFocusMinutes: weekMin, lastWeekFocusMinutes: lastWeekMin, monthFocusMinutes: monthMin, pomodoroStreak, dayMap, weekStartMs }
  }, [pomodoroSessions, pomodoroWorkDuration, todayMidnightMsHook, tomorrowMidnightMsHook])
  const { todayWorkSessions, todayBreakSessions, totalFocusMinutes, todayBestMin, week7Avg, todayMidnightMs, focusEfficiency: todayFocusEfficiency, dailyAvg, weekFocusMinutes, lastWeekFocusMinutes, monthFocusMinutes, pomodoroStreak, dayMap, weekStartMs } = pomodoroStats

  const goalEstimate = useMemo(() => {
    if (todayWorkSessions.length === 0 || todayWorkSessions.length >= dailyPomodoroGoal) return null
    const remaining = dailyPomodoroGoal - todayWorkSessions.length
    const avgWorkMin = todayWorkSessions.length > 0 ? Math.round(totalFocusMinutes / todayWorkSessions.length) : pomodoroWorkDuration
    const estMin = remaining * (avgWorkMin + pomodoroShortBreakDuration)
    const timeStr = fmtHHmm(clockNow + estMin * 60000)
    const display = estMin >= 60 ? fmtMin(estMin) : `${estMin}分钟`
    return { display, timeStr }
  }, [todayWorkSessions, dailyPomodoroGoal, totalFocusMinutes, pomodoroWorkDuration, pomodoroShortBreakDuration, clockNow])

  const weekGoalDays = useMemo(() => {
    const DAY = 86400000
    const weekStartDayNum = Math.floor(weekStartMs / DAY)
    let goalDays = 0
    for (let i = 0; i < 7; i++) {
      const ms = weekStartMs + i * DAY
      if (ms > clockNow) break
      if ((dayMap.get(dayNumToDateStr(weekStartDayNum + i)) || 0) >= dailyPomodoroGoal) goalDays++
    }
    return goalDays
  }, [clockNow, dayMap, dailyPomodoroGoal, weekStartMs])

  const recentSessions = useMemo(() => {
    const top: typeof pomodoroSessions = []
    for (const s of pomodoroSessions) {
      if (top.length < 6) {
        top.push(s)
      } else if (s.startedAt > top[5].startedAt) {
        top[5] = s
      } else {
        continue
      }
      // Bubble the new entry into sorted position
      for (let i = top.length - 1; i > 0; i--) {
        if (top[i].startedAt > top[i - 1].startedAt) { const tmp = top[i]; top[i] = top[i - 1]; top[i - 1] = tmp }
        else break
      }
    }
    const todayDayNum = Math.floor(todayMidnightMs / 86400000)
    return top.map((s) => {
      const isToday = Math.floor(s.startedAt / 86400000) === todayDayNum
      return {
        ...s,
        durationMin: durationMinutes(s.startedAt, s.endedAt),
        timeDisplay: isToday ? fmtHHmm(s.startedAt) : `${dayNumToShortLabel(Math.floor(s.startedAt / 86400000))} ${fmtHHmm(s.startedAt)}`,
        relTime: getRelativeTimeShort(s.startedAt),
      }
    })
  }, [pomodoroSessions, todayMidnightMs])

  const recentSessionStats = useMemo(() => {
    const tomorrowMidnightMs = todayMidnightMs + 86400000
    const workSessions: typeof recentSessions = []
    let workMin = 0; let breakMin = 0; let metGoal = 0; let workDurSum = 0; let longestMin = 0
    const todayWorkSessions: typeof recentSessions = []
    const todayIds = new Set<string>()
    for (const s of recentSessions) {
      const isToday = s.startedAt >= todayMidnightMs && s.startedAt < tomorrowMidnightMs
      if (isToday) todayIds.add(s.id)
      if (s.type === 'work') {
        workSessions.push(s)
        workMin += s.durationMin
        workDurSum += s.endedAt - s.startedAt
        if (s.durationMin / pomodoroWorkDuration >= 0.9) metGoal++
        if (s.durationMin > longestMin) longestMin = s.durationMin
        if (s.completed && isToday) todayWorkSessions.push(s)
      } else {
        breakMin += s.durationMin
      }
    }
    const avgMin = workSessions.length > 0 ? Math.round(workDurSum / workSessions.length / 60000) : 0
    todayWorkSessions.reverse()
    const cumulativeMinMap = new Map<string, number>()
    let cumTotal = 0
    for (const s of todayWorkSessions) {
      cumTotal += s.durationMin
      cumulativeMinMap.set(s.id, cumTotal)
    }
    return { workSessions, workMin, breakMin, metGoal, avgMin, longestMin, todayWorkSessions, todayIds, cumulativeMinMap }
  }, [recentSessions, pomodoroWorkDuration, todayMidnightMs])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (!justCompleted) return
    const timer = setTimeout(() => setJustCompleted(false), 2000)
    return () => clearTimeout(timer)
  }, [justCompleted])

  useEffect(() => {
    if (!isRunning) return
    setPomodoroTitleActive(true)
    document.title = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} - ${currentConfig.label} | Abworkbench`
  }, [minutes, seconds, isRunning, currentConfig.label])

  useEffect(() => {
    if (isRunning) return
    setPomodoroTitleActive(false)
    // Hand title back to the shell when the timer is not driving it.
    window.dispatchEvent(new CustomEvent('abwb:restore-title'))
  }, [isRunning])

  useEffect(() => () => {
    setPomodoroTitleActive(false)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setClockNow(Date.now())
    }, isRunning ? 1000 : 60000)
    return () => clearInterval(interval)
  }, [isRunning])

  const toggleTimer = useCallback(() => {
    if (!isRunningRef.current) {
      startTimeRef.current = Date.now()
      targetEndTimeRef.current = Date.now() + timeLeftRef.current * 1000
      writeActivePomodoro({
        source: 'main',
        mode: modeRef.current === 'work' ? 'work' : modeRef.current === 'longBreak' ? 'longBreak' : 'shortBreak',
        targetEnd: targetEndTimeRef.current,
        remainingSec: timeLeftRef.current,
        taskId: selectedTaskIdRef.current || undefined,
        updatedAt: Date.now(),
      })
    } else {
      writeActivePomodoro({
        source: 'main',
        mode: modeRef.current === 'work' ? 'work' : modeRef.current === 'longBreak' ? 'longBreak' : 'shortBreak',
        targetEnd: null,
        remainingSec: timeLeftRef.current,
        taskId: selectedTaskIdRef.current || undefined,
        updatedAt: Date.now(),
      })
    }
    setIsRunning(!isRunningRef.current)
  }, [])

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsRunning(false)
    clearActivePomodoro('main')
  }, [])

  // Mutual exclusion: foreign claim pauses us; Header/Mini pause-resume syncs us.
  const suppressActiveWriteRef = useRef(false)
  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<ActivePomodoroState | null>).detail
      if (detail === undefined) return
      if (!detail) return
      if (detail.source !== 'main') {
        if (!isRunningRef.current) return
        suppressActiveWriteRef.current = true
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setIsRunning(false)
        const remaining = getActiveRemainingSec({
          ...detail,
          source: 'main',
          targetEnd: null,
          remainingSec: timeLeftRef.current,
        })
        // Keep our own remaining; foreign timer owns the shared slot.
        void remaining
        suppressActiveWriteRef.current = false
        showToast('番茄已由其它入口接管', 'info')
        return
      }
      const remaining = getActiveRemainingSec(detail)
      if (detail.targetEnd == null) {
        if (!isRunningRef.current) return
        suppressActiveWriteRef.current = true
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setTimeLeft(remaining || timeLeftRef.current)
        setIsRunning(false)
        suppressActiveWriteRef.current = false
      } else if (!isRunningRef.current) {
        suppressActiveWriteRef.current = true
        setTimeLeft(remaining)
        targetEndTimeRef.current = detail.targetEnd
        startTimeRef.current = detail.targetEnd - remaining * 1000
        setIsRunning(true)
        suppressActiveWriteRef.current = false
      }
    }
    window.addEventListener(ACTIVE_POMODORO_EVENT, onChange as EventListener)
    return () => window.removeEventListener(ACTIVE_POMODORO_EVENT, onChange as EventListener)
  }, [])

  const switchMode = useCallback(
    (newMode: Mode) => {
      stopTimer()
      setMode(newMode)
      setTimeLeft(getDuration(newMode))
    },
    [stopTimer]
  )

  const handleTimerComplete = useCallback(() => {
    stopTimer()
    setJustCompleted(true)

    const currentMode = modeRef.current
    try {
      addPomodoroSession({
        startedAt: startTimeRef.current,
        endedAt: Date.now(),
        type: currentMode === 'work' ? 'work' : 'break',
        completed: true,
        taskId: selectedTaskIdRef.current || undefined,
      })
    } catch (err) {
      console.error('Failed to save pomodoro session:', err)
      showToast('保存番茄钟记录失败', 'error')
    }

    if (soundEnabledRef.current) playPomodoroCompleteSound()

    if (currentMode === 'work') {
      const newCount = completedRef.current + 1
      const round = Math.floor(newCount / 4)
      const milestone = newCount === 1 ? '首个番茄！' : newCount % 4 === 0 ? `完成第 ${round} 轮！` : `第 ${newCount} 个`
      showBrowserNotification('专注完成！', `${milestone} 休息一下吧~`)
      setCompletedPomodoros(newCount)
      const breakMode = newCount % 4 === 0 ? 'longBreak' : 'shortBreak'
      setMode(breakMode)
      const breakDuration = getDuration(breakMode)
      setTimeLeft(breakDuration)
      if (autoStartBreaksRef.current) {
        setTimeout(() => {
          startTimeRef.current = Date.now()
          targetEndTimeRef.current = Date.now() + breakDuration * 1000
          setIsRunning(true)
        }, 2000)
      }
    } else {
      setMode('work')
      const workDuration = getDuration('work')
      setTimeLeft(workDuration)
      if (autoStartWorkRef.current) {
        setTimeout(() => {
          startTimeRef.current = Date.now()
          targetEndTimeRef.current = Date.now() + workDuration * 1000
          setIsRunning(true)
        }, 2000)
      }
    }
  }, [stopTimer, addPomodoroSession])

  useEffect(() => {
    if (!isRunning) return

    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - Date.now()) / 1000))
      if (remaining <= 0) {
        setTimeLeft(0)
        handleTimerComplete()
      } else {
        setTimeLeft(remaining)
      }
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, handleTimerComplete])

  const resetTimer = useCallback(() => {
    stopTimer()
    setTimeLeft(getDuration(modeRef.current))
  }, [stopTimer])

  const toggleSound = useCallback(() => setSoundEnabled(!soundEnabled), [setSoundEnabled, soundEnabled])
  const toggleAutoStartBreaks = useCallback(() => setAutoStartBreaks(!autoStartBreaks), [setAutoStartBreaks, autoStartBreaks])
  const toggleAutoStartWork = useCallback(() => setAutoStartWork(!autoStartWork), [setAutoStartWork, autoStartWork])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (eventMatchesShortcut('pomodoroToggle', e)) {
        e.preventDefault()
        toggleTimer()
      } else if (eventMatchesShortcut('pomodoroReset', e)) {
        e.preventDefault()
        resetTimer()
      } else if (eventMatchesShortcut('pomodoroSkipBreak', e) && modeRef.current !== 'work') {
        e.preventDefault()
        switchMode('work')
      } else if (eventMatchesShortcut('pomodoroAmbient', e)) {
        e.preventDefault()
        setAmbientExpanded((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleTimer, resetTimer, switchMode, shortcutOverrides])

  useEffect(() => {
    const start = () => {
      if (!isRunningRef.current) toggleTimer()
    }
    window.addEventListener('abworkbench:pomodoro-start', start)
    return () => window.removeEventListener('abworkbench:pomodoro-start', start)
  }, [toggleTimer])

  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress)
  const estimatedEndTime = timeLeft < currentConfig.duration ? fmtHHmm(clockNow + timeLeft * 1000) : null

  const nextBreakInfo = useMemo(() => {
    if (mode !== 'work') return null
    const nextBreak = (completedPomodoros + 1) % 4 === 0 ? 'longBreak' : 'shortBreak'
    const breakMin = durationSecondsByMode[nextBreak] / 60
    const totalTime = timeLeft + durationSecondsByMode[nextBreak]
    return { nextBreak, breakMin, endHHmm: fmtHHmm(clockNow + totalTime * 1000) }
  }, [clockNow, completedPomodoros, durationSecondsByMode, mode, timeLeft])

  return (
    <ErrorBoundary>
    <div className="pomo-stage grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] animate-fade-in">
      <section className="relative min-w-0 rounded-[38px] border border-border bg-surface/85 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(59,130,246,0.22),transparent_36%),radial-gradient(circle_at_100%_18%,rgba(245,158,11,0.16),transparent_32%)]" />
        </div>
        <div className="relative p-5 md:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Zap size={14} />
                专注控制台
              </div>
              <h2 className="mt-3 text-3xl font-semibold text-text">番茄钟</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MODE_STYLES) as Mode[]).map((m) => {
                const Icon = MODE_STYLES[m].icon
                const duration = durationSecondsByMode[m] / 60
                const count = m === 'work' ? todayWorkSessions.length : todayBreakSessions.length
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    aria-pressed={mode === m}
                    aria-label={`${MODE_STYLES[m].label}模式，${duration}分钟`}
                    className={clsx(
                      'pomo-btn pomo-mode-tab flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium',
                      mode === m
                        ? 'pomo-mode-tab--active'
                        : 'border-border bg-background/45 text-text-muted hover:border-primary/40 hover:text-text',
                    )}
                  >
                    <Icon size={16} />
                    {MODE_STYLES[m].label}
                    <span className={clsx('text-[10px]', mode === m ? 'opacity-90' : 'opacity-65')}>{duration}分</span>
                    {count > 0 && (
                      <span className={clsx(
                        'rounded-full px-1.5 py-0.5 text-[9px]',
                        mode === m ? 'bg-primary/15' : 'bg-surface-lighter',
                      )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <PanelSwitch panelKey={mode} className="pomo-mode-panel min-w-0">
          <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(140px,200px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(160px,220px)_minmax(0,1fr)_minmax(200px,260px)]">
            <div className="order-2 min-w-0 space-y-3 lg:order-1">
              <FocusCard icon={<Target size={18} />} label="今日目标" value={`${todayWorkSessions.length}/${dailyPomodoroGoal}`} sub={`${fmtMin(totalFocusMinutes)} 专注`} />
              <FocusCard icon={<Flame size={18} />} label="连续专注" value={`${pomodoroStreak} 天`} sub={`7日均 ${week7Avg} 个`} tone="text-orange-400" />
              <FocusCard icon={<Gauge size={18} />} label="今日效率" value={`${todayFocusEfficiency}%`} sub={todayBestMin > 0 ? `最长 ${todayBestMin} 分` : '等待第一轮'} tone={todayFocusEfficiency >= 70 ? 'text-success' : 'text-warning'} />
            </div>

            <div className="order-1 flex min-w-0 flex-col items-center lg:order-2">
              <div className={`relative h-[240px] w-[240px] transition-transform duration-300 md:h-[280px] md:w-[280px] ${justCompleted ? 'scale-105 pomo-ceremony' : ''}`}>
                <div className={clsx('absolute inset-3 rounded-full blur-2xl', isRunning ? 'bg-primary/20' : 'bg-white/5')} />
                <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className={`relative h-full w-full -rotate-90 ${isRunning && timeLeft <= 10 && timeLeft > 0 ? 'animate-pulse' : ''}`}>
                  <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" stroke="var(--color-surface-lighter)" strokeWidth={RING_STROKE_WIDTH} />
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    fill="none"
                    stroke="url(#pomodoro-gradient)"
                    strokeWidth={RING_STROKE_WIDTH}
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="pomodoro-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={isRunning && timeLeft <= 10 && timeLeft > 0 ? '#ef4444' : currentConfig.ringStart} />
                      <stop offset="100%" stopColor={isRunning && timeLeft <= 10 && timeLeft > 0 ? '#f97316' : currentConfig.ringEnd} />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center" aria-live="polite" aria-atomic="true">
                  <div className="mb-3 rounded-full border border-border bg-background/55 px-3 py-1 text-xs font-medium text-text-muted">{currentConfig.label}</div>
                  <div
                    className={clsx(
                      'font-mono text-5xl font-black tracking-[-0.06em] text-text transition-colors md:text-6xl',
                      isRunning && timeLeft <= 10 && timeLeft > 0 && 'text-warning animate-pulse',
                    )}
                    aria-label={`${minutes}分${seconds}秒`}
                  >
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                  </div>
                  <div className="mt-3 text-sm text-text-muted">{Math.round(progress * 100)}% · {isRunning ? '进行中' : timeLeft < currentConfig.duration ? '已暂停' : '待开始'}</div>
                </div>
              </div>

              <TimerHint>
                {isRunning ? (
                  <>
                    预计完成：{estimatedEndTime}
                    {nextBreakInfo && <span className="ml-2">· 之后{nextBreakInfo.nextBreak === 'longBreak' ? '长' : '短'}休息 {nextBreakInfo.breakMin} 分 · 全程约 {nextBreakInfo.endHHmm}</span>}
                  </>
                ) : timeLeft < currentConfig.duration ? (
                  <>已暂停 · 剩余 {minutes}分{seconds.toString().padStart(2, '0')}秒 · 完成约 {estimatedEndTime}</>
                ) : (
                  <>
                    {mode === 'work'
                      ? todayWorkSessions.length > 0
                        ? `今日已完成 ${todayWorkSessions.length} 个番茄 · ${fmtMin(totalFocusMinutes)}${todayWorkSessions.length < dailyPomodoroGoal ? `，还差 ${dailyPomodoroGoal - todayWorkSessions.length} 个达标` : '，目标已达成！'}`
                        : pomodoroStreak > 0
                          ? `连续专注 ${pomodoroStreak} 天，今天也别断`
                          : '准备好开始专注了吗？'
                      : '休息好了吗？'}
                  </>
                )}
              </TimerHint>

              {/* Task selector */}
              {mode === 'work' && (
                <div className="mt-4 flex justify-center">
                  <div className="relative">
                    <button
                      ref={taskPickerRef}
                      type="button"
                      onClick={() => setShowTaskPicker(!showTaskPicker)}
                      disabled={isRunning}
                      aria-haspopup="listbox"
                      aria-expanded={showTaskPicker}
                      aria-label={selectedTaskId ? `已选任务: ${activeTasks.find((t) => t.id === selectedTaskId)?.title || ''}` : '关联任务（可选）'}
                      className={clsx(
                        'pomo-btn inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium',
                        selectedTaskId
                          ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'border-border bg-background/60 text-text-muted hover:border-primary/30 hover:text-text',
                        isRunning && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <ListTodo size={14} />
                      <span className="max-w-[160px] truncate">
                        {selectedTaskId
                          ? activeTasks.find((t) => t.id === selectedTaskId)?.title || '已选任务'
                          : '关联任务（可选）'
                        }
                      </span>
                      <ChevronDown size={12} className={clsx('transition-transform', showTaskPicker && 'rotate-180')} />
                    </button>

                    {showTaskPicker && !isRunning && (
                      <div className="absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-2xl border border-border bg-surface p-2 shadow-xl" role="listbox" aria-label="选择关联任务" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowTaskPicker(false); taskPickerRef.current?.focus(); } }}>
                        <div className="max-h-48 overflow-y-auto">
                          <button
                            type="button"
                            role="option"
                            aria-selected={!selectedTaskId}
                            onClick={() => { setSelectedTaskId(''); setShowTaskPicker(false) }}
                            className={clsx(
                              'pomo-btn w-full rounded-xl px-3 py-2 text-left text-xs hover:bg-surface-lighter',
                              !selectedTaskId && 'bg-primary/10 text-primary'
                            )}
                          >
                            不关联任务
                          </button>
                          {activeTasks.slice(0, 20).map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              role="option"
                              aria-selected={selectedTaskId === task.id}
                              onClick={() => { setSelectedTaskId(task.id); setShowTaskPicker(false) }}
                              className={clsx(
                                'pomo-btn w-full rounded-xl px-3 py-2 text-left text-xs hover:bg-surface-lighter',
                                selectedTaskId === task.id && 'bg-primary/10 text-primary'
                              )}
                            >
                              <span className="block truncate font-medium">{task.title}</span>
                              {task.dueDate && (
                                <span className="text-[10px] text-text-muted">截止 {task.dueDate.slice(0, 10)}</span>
                              )}
                            </button>
                          ))}
                          {activeTasks.length === 0 && (
                            <p className="px-3 py-2 text-xs text-text-muted">暂无进行中的任务</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={toggleTimer}
                  className={clsx(
                    'pomo-btn pomo-btn--primary btn-primary h-14 rounded-2xl px-8 text-base shadow-xl shadow-primary/20',
                    isRunning && 'bg-gradient-to-r from-warning to-secondary shadow-warning/20',
                  )}
                  title="空格键"
                >
                  {isRunning ? <Pause size={22} /> : <Play size={22} />}
                  {isRunning ? '暂停' : '开始'}
                  <Kbd>Space</Kbd>
                </button>
                <button type="button" onClick={resetTimer} aria-label="重置计时器" className="pomo-btn flex h-14 items-center gap-2 rounded-2xl border border-border bg-background/50 px-4 text-text-muted hover:border-primary/30 hover:text-text" title="重置 (R)">
                  <RotateCcw size={20} />
                  <Kbd>R</Kbd>
                </button>
                {mode !== 'work' && (
                  <button type="button" onClick={() => switchMode('work')} className="pomo-btn flex h-14 items-center gap-2 rounded-2xl border border-border bg-background/50 px-4 text-text-muted hover:border-primary/30 hover:text-primary" title="跳过休息 (S)">
                    <SkipForward size={18} />
                    <span className="hidden text-sm sm:inline">跳过</span>
                    <Kbd>S</Kbd>
                  </button>
                )}
              </div>
            </div>

            <div className="order-3 min-w-0 space-y-3 lg:col-span-2 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0 2xl:col-span-1 2xl:block 2xl:space-y-3">
              <ToggleCard active={soundEnabled} icon={soundEnabled ? <Bell size={17} /> : <BellOff size={17} />} label="提示音" sub={soundEnabled ? '完成后响铃' : '保持静音'} onClick={toggleSound} />
              <ToggleCard active={autoStartBreaks} icon={<FastForward size={17} />} label="自动休息" sub={autoStartBreaks ? '专注后自动开始' : '手动开始休息'} onClick={toggleAutoStartBreaks} />
              <ToggleCard active={autoStartWork} icon={<Play size={17} />} label="自动专注" sub={autoStartWork ? '休息后自动继续' : '手动恢复专注'} onClick={toggleAutoStartWork} activeClassName="text-success border-success/35 bg-success/10" />
            </div>
          </div>

          {!isRunning && timeLeft === durationSecondsByMode[mode] && (
            <div className="mt-7 rounded-[26px] border border-border bg-background/35 p-4">
              <div className="mb-3 text-xs font-medium text-text-muted">快速设置 {MODE_STYLES[mode].label} 时长</div>
              <div className="flex flex-wrap gap-2">
                {QUICK_DURATIONS[mode].map((min) => {
                  const currentMin = durationSecondsByMode[mode] / 60
                  const isActive = currentMin === min
                  const isDefault = (mode === 'work' && min === 25) || (mode === 'shortBreak' && min === 5) || (mode === 'longBreak' && min === 15)
                  return (
                    <button
                      key={min}
                      type="button"
                      onClick={() => {
                        if (mode === 'work') setPomodoroDurations(min, pomodoroShortBreakDuration, pomodoroLongBreakDuration)
                        else if (mode === 'shortBreak') setPomodoroDurations(pomodoroWorkDuration, min, pomodoroLongBreakDuration)
                        else setPomodoroDurations(pomodoroWorkDuration, pomodoroShortBreakDuration, min)
                        setTimeLeft(min * 60)
                      }}
                      aria-label={`设置${MODE_STYLES[mode].label}时长为${min}分钟${isDefault ? '（默认）' : ''}`}
                      aria-pressed={isActive}
                      className={clsx(
                        'pomo-btn relative rounded-2xl border px-3 py-2 text-sm',
                        isActive ? 'border-primary/35 bg-primary/15 text-primary' : 'border-border bg-surface/70 text-text-muted hover:border-primary/30 hover:text-text',
                      )}
                    >
                      {min} 分
                      {isDefault && !isActive && <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary/50" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          </PanelSwitch>

          <div className="mt-7 rounded-[26px] border border-border bg-background/35 p-4 md:p-5">
            <PomodoroStats sessions={pomodoroSessions} dailyGoal={dailyPomodoroGoal} />
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-[32px] border border-border bg-surface/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text">今日目标</h3>
              <p className="mt-1 text-xs text-text-muted">{todayWorkSessions.length}/{dailyPomodoroGoal} 个番茄 · {fmtMin(totalFocusMinutes)}</p>
            </div>
            <span className={clsx('text-2xl font-semibold', todayWorkSessions.length >= dailyPomodoroGoal ? 'text-success' : 'text-primary')}>
              {Math.min(Math.round((todayWorkSessions.length / dailyPomodoroGoal) * 100), 100)}%
            </span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-surface-lighter">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((todayWorkSessions.length / dailyPomodoroGoal) * 100, 100)}%`,
                background: todayWorkSessions.length >= dailyPomodoroGoal ? 'linear-gradient(90deg, var(--color-success), #059669)' : 'linear-gradient(90deg, var(--color-primary), var(--color-primary-light))',
              }}
            />
          </div>
          <div className="mt-3 text-xs text-text-muted">
            {todayWorkSessions.length >= dailyPomodoroGoal
              ? <span className="text-success">恭喜达成今日目标！{todayWorkSessions.length > dailyPomodoroGoal && <span className="text-orange-400"> 超额 {todayWorkSessions.length - dailyPomodoroGoal} 个</span>}</span>
              : todayWorkSessions.length > 0
                ? <>还差 <span className="font-medium text-primary">{dailyPomodoroGoal - todayWorkSessions.length}</span> 个番茄达成目标{goalEstimate && <span> · 预计 {goalEstimate.display}（约 {goalEstimate.timeStr}）</span>}</>
                : '完成第一个番茄后，这里会显示目标进度。'}
          </div>
        </section>

        <section className="rounded-[32px] border border-border bg-surface/80 p-5 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays size={17} className="text-primary" />
            <h3 className="text-base font-semibold text-text">专注概览</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="今日番茄" value={todayWorkSessions.length} sub={`${todayWorkSessions.length}/${dailyPomodoroGoal} 目标`} />
            <MiniStat label="专注时间" value={fmtMin(totalFocusMinutes)} sub={`本周 ${fmtMin(weekFocusMinutes)}`} tone="text-success" />
            <MiniStat label="日均番茄" value={dailyAvg} sub={`本周达标 ${weekGoalDays} 天`} tone="text-warning" />
            <MiniStat label="本月专注" value={fmtMin(monthFocusMinutes)} sub={lastWeekFocusMinutes > 0 ? `上周 ${fmtMin(lastWeekFocusMinutes)}` : '持续积累'} tone="text-info" />
          </div>
        </section>

        <section className="rounded-[32px] border border-border bg-surface/80 p-5 shadow-xl shadow-black/10">
          <button type="button" onClick={() => setAmbientExpanded(!ambientExpanded)} className="pomo-btn flex w-full items-center gap-3 rounded-2xl p-1 text-left hover:bg-white/5" aria-expanded={ambientExpanded} aria-controls="ambient-sounds-panel">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Volume2 size={18} /></div>
            <div>
              <div className="text-sm font-semibold text-text">环境音</div>
              <div className="text-xs text-text-muted">专注时可播放 · <Kbd>A</Kbd></div>
            </div>
            <ChevronDown size={16} className={`ml-auto text-text-muted transition-transform duration-300 ${ambientExpanded ? 'rotate-180' : ''}`} />
          </button>
          {ambientExpanded && <div className="mt-4 panel-switch" id="ambient-sounds-panel"><AmbientSounds compact /></div>}
        </section>

        <section className="rounded-[32px] border border-border bg-surface/80 p-5 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-center gap-2">
            <History size={17} className="text-text-muted" />
            <h3 className="text-base font-semibold text-text">最近记录</h3>
            <span className="ml-auto text-xs text-text-muted">{recentSessions.length} 条</span>
          </div>
          {recentSessions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-background/35 p-6 text-center">
              <History size={28} className="mx-auto mb-2 text-text-muted opacity-35" />
              <p className="text-sm text-text-muted">还没有专注记录</p>
              <p className="mt-1 text-xs text-text-muted">完成一个番茄钟后，记录会显示在这里。</p>
            </div>
          ) : (
            <>
              {recentSessionStats.workMin + recentSessionStats.breakMin > 0 && (
                <div className="mb-4">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
                    <span>专注 {recentSessionStats.workMin}分</span>
                    <span>休息 {recentSessionStats.breakMin}分</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-surface-lighter">
                    <div className="h-full bg-primary" style={{ width: `${(recentSessionStats.workMin / (recentSessionStats.workMin + recentSessionStats.breakMin)) * 100}%` }} />
                    <div className="h-full bg-success" style={{ width: `${(recentSessionStats.breakMin / (recentSessionStats.workMin + recentSessionStats.breakMin)) * 100}%` }} />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {recentSessions.map((session) => {
                  const isToday = recentSessionStats.todayIds.has(session.id)
                  const goalRatio = session.type === 'work' ? session.durationMin / pomodoroWorkDuration : 0
                  const metGoal = session.type === 'work' && session.completed && goalRatio >= 0.9
                  const cumulativeMin = (session.type === 'work' && session.completed && isToday) ? (recentSessionStats.cumulativeMinMap.get(session.id) ?? 0) : 0
                  return (
                    <div key={session.id} className={clsx('flex items-center gap-3 rounded-2xl border border-border/70 bg-background/40 p-3', !session.completed && 'opacity-60')}>
                      <div className={clsx('flex h-9 w-9 items-center justify-center rounded-2xl text-sm', session.type === 'work' ? 'bg-primary/15 text-primary' : 'bg-success/15 text-success')}>
                        {session.type === 'work' ? '🍅' : '☕'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm text-text">
                          {session.type === 'work' ? '专注' : '休息'}
                          {!session.completed && <span className="text-xs text-danger">未完成</span>}
                          {metGoal && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">达标</span>}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-text-muted">
                          <Clock size={11} />
                          {session.timeDisplay}
                          {session.relTime && <span>{session.relTime}</span>}
                          {cumulativeMin > 0 && <span>累计 {cumulativeMin} 分</span>}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-primary">{session.durationMin}分</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>

        <div className="hidden items-center justify-center gap-3 text-[10px] text-text-muted/60 xl:flex">
          <span><Kbd>Space</Kbd>开始/暂停</span>
          <span><Kbd>R</Kbd>重置</span>
          <span><Kbd>S</Kbd>跳过休息</span>
          <span><Kbd>A</Kbd>环境音</span>
        </div>
      </aside>
    </div>
    </ErrorBoundary>
  )
}

const FocusCard = memo(function FocusCard({
  icon,
  label,
  value,
  sub,
  tone = 'text-primary',
}: {
  icon: ReactNode
  label: string
  value: string | number
  sub: string
  tone?: string
}) {
  return (
    <div className="min-w-0 rounded-[26px] border border-border bg-background/45 p-4 shadow-inner shadow-white/5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className={clsx('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-lighter', tone)}>{icon}</div>
        <span className="truncate text-[11px] text-text-muted">{label}</span>
      </div>
      <div className="truncate text-2xl font-semibold text-text">{value}</div>
      <div className="mt-1 truncate text-xs text-text-muted">{sub}</div>
    </div>
  )
})

const ToggleCard = memo(function ToggleCard({
  active,
  icon,
  label,
  sub,
  onClick,
  activeClassName = 'text-primary border-primary/35 bg-primary/10',
}: {
  active: boolean
  icon: ReactNode
  label: string
  sub: string
  onClick: () => void
  activeClassName?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'pomo-btn flex w-full min-w-0 items-center gap-2.5 rounded-[24px] border p-3 text-left sm:gap-3 sm:p-4',
        active ? activeClassName : 'border-border bg-background/45 text-text-muted hover:border-primary/25 hover:text-text',
      )}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-lighter sm:h-10 sm:w-10">{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{label}</div>
        <div className="mt-0.5 truncate text-xs opacity-70">{sub}</div>
      </div>
    </button>
  )
})

const MiniStat = memo(function MiniStat({
  label,
  value,
  sub,
  tone = 'text-primary',
}: {
  label: string
  value: string | number
  sub: string
  tone?: string
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/45 p-4">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className={clsx('mt-2 text-xl font-semibold', tone)}>{value}</div>
      <div className="mt-1 text-[11px] text-text-muted">{sub}</div>
    </div>
  )
})

const TimerHint = memo(function TimerHint({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 min-h-6 text-center text-xs leading-5 text-text-muted" aria-live="polite">
      {children}
    </div>
  )
})

