import { useState, useRef, useMemo, useEffect } from 'react'
import {
  Download,
  Upload,
  Trash2,
  BarChart3,
  HardDrive,
  CheckSquare,
  Timer,
  StickyNote,
  Target,
  AlertTriangle,
  Info,
  Palette,
  RotateCcw,
  MapPin,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Keyboard,
  UserCircle,
  FileText,
  Rocket,
  BookOpen,
} from 'lucide-react'
import { useStore } from '../../store'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { useTranslation } from '../../i18n'
import { generateWeeklyReport, generateMonthlyReport, downloadReport } from '../../utils/reportExport'
import { durationMinutes, fmtMin, dayNumToDateStr } from '../../utils/format'
import { useToday } from '../../hooks/useToday'
import { createDesktopBackup, downloadJsonBackup, getLegacyOrCurrentData, restoreTaskFlowBackup } from '../../utils/desktopBackup'
import { buildDataHealthReport } from '../../utils/dataHealth'
import { WORKSPACE_MODE_OPTIONS, type WorkspaceMode } from '../../utils/workspaceModes'
import BackupCenter from './BackupCenter'
import LauncherSettings from './LauncherSettings'
import ReaderSettings from './ReaderSettings'
import ShortcutRecorder from './ShortcutRecorder'
import { SHORTCUT_BY_ID, SHORTCUT_GROUPS, useShortcutStore } from '../../shortcuts'

const ACCENT_COLORS = [
  { color: '#3b82f6', name: '蓝色' },
  { color: '#06b6d4', name: '青色' },
  { color: '#10b981', name: '翡翠' },
  { color: '#f59e0b', name: '琥珀' },
  { color: '#ef4444', name: '红色' },
  { color: '#ec4899', name: '粉红' },
  { color: '#8b5cf6', name: '紫罗兰' },
  { color: '#6366f1', name: '靛蓝' },
]

const DURATION_PRESETS = [15, 20, 25, 30, 35, 45, 60]
const DAILY_GOAL_PRESETS = [4, 6, 8, 10, 12]
const FEATURE_LIST = ['任务流', '番茄钟', '每日打卡', '笔记', '天气', '全局搜索', '翻译', '最近应用', '仪表盘统计']

const TIMER_DURATION_KEYS = [
  { key: 'work' as const, labelKey: 'settings.focusDuration' as const, color: 'text-primary' },
  { key: 'shortBreak' as const, labelKey: 'settings.shortBreakDuration' as const, color: 'text-success' },
  { key: 'longBreak' as const, labelKey: 'settings.longBreakDuration' as const, color: 'text-blue-400' },
]

const SETTINGS_TABS = [
  { id: 'general' as const, label: '通用', icon: UserCircle },
  { id: 'launcher' as const, label: '启动器', icon: Rocket },
  { id: 'reader' as const, labelKey: 'settings.tab.reader' as const, label: '阅读', icon: BookOpen },
  { id: 'appearance' as const, label: '外观', icon: Sparkles },
  { id: 'pomodoro' as const, label: '番茄钟', icon: Timer },
  { id: 'data' as const, label: '数据与安全', icon: ShieldCheck },
  { id: 'shortcuts' as const, label: '快捷键', icon: Keyboard },
]

type SettingsTabId = (typeof SETTINGS_TABS)[number]['id']

export default function SettingsPage() {
  const todos = useStore((s) => s.todos)
  const notes = useStore((s) => s.notes)
  const pomodoroSessions = useStore((s) => s.pomodoroSessions)
  const habits = useStore((s) => s.habits)
  const userName = useStore((s) => s.userName)
  const setUserName = useStore((s) => s.setUserName)
  const accentColor = useStore((s) => s.accentColor)
  const setAccentColor = useStore((s) => s.setAccentColor)
  const themeMode = useStore((s) => s.themeMode)
  const setThemeMode = useStore((s) => s.setThemeMode)
  const workspaceMode = useStore((s) => s.workspaceMode)
  const setWorkspaceMode = useStore((s) => s.setWorkspaceMode)
  const dailyPomodoroGoal = useStore((s) => s.dailyPomodoroGoal)
  const setDailyPomodoroGoal = useStore((s) => s.setDailyPomodoroGoal)
  const pomodoroWorkDuration = useStore((s) => s.pomodoroWorkDuration)
  const pomodoroShortBreakDuration = useStore((s) => s.pomodoroShortBreakDuration)
  const pomodoroLongBreakDuration = useStore((s) => s.pomodoroLongBreakDuration)
  const setPomodoroDurations = useStore((s) => s.setPomodoroDurations)
  const pomodoroSoundEnabled = useStore((s) => s.pomodoroSoundEnabled)
  const pomodoroAutoStartBreaks = useStore((s) => s.pomodoroAutoStartBreaks)
  const pomodoroAutoStartWork = useStore((s) => s.pomodoroAutoStartWork)
  const weatherAutoLocate = useStore((s) => s.weatherAutoLocate)
  const setWeatherAutoLocate = useStore((s) => s.setWeatherAutoLocate)
  const taskFlowTasks = useTaskStore((s) => s.tasks)
  const fetchTaskFlowTasks = useTaskStore((s) => s.fetchTasks)
  const { t, tWith } = useTranslation()
  const { todayMidnightMs } = useToday()
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general')
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [recordingShortcutId, setRecordingShortcutId] = useState<string | null>(null)
  const getAccelerator = useShortcutStore((s) => s.getAccelerator)
  const setAccelerator = useShortcutStore((s) => s.setAccelerator)
  const resetAllShortcuts = useShortcutStore((s) => s.resetAll)
  const findConflicts = useShortcutStore((s) => s.findConflicts)
  const shortcutOverrides = useShortcutStore((s) => s.overrides)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    void fetchTaskFlowTasks()
  }, [fetchTaskFlowTasks])

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  const stats = useMemo(() => {
    let completedTodos = 0; let firstTodoAt = Infinity
    for (const t of todos) {
      if (t.completed) completedTodos++
      if (t.createdAt < firstTodoAt) firstTodoAt = t.createdAt
    }

    let totalWords = 0; let firstNoteAt = Infinity
    for (const n of notes) {
      totalWords += n.content.length
      if (n.createdAt < firstNoteAt) firstNoteAt = n.createdAt
    }

    let workSessionCount = 0; let totalFocusMinutes = 0; let firstSessionAt = Infinity
    for (const s of pomodoroSessions) {
      if (s.type === 'work' && s.completed) {
        workSessionCount++
        totalFocusMinutes += durationMinutes(s.startedAt, s.endedAt)
      }
      if (s.startedAt < firstSessionAt) firstSessionAt = s.startedAt
    }

    let completedHabitCount = 0; let firstHabitAt = Infinity
    for (const h of habits) {
      completedHabitCount += h.completedDates.length
      for (const d of h.completedDates) {
        const [y, m, day] = d.split('-').map(Number)
        const t = Date.UTC(y, m - 1, day)
        if (t < firstHabitAt) firstHabitAt = t
      }
    }

    // Single serialization pass per data type (UTF-8 byte sizes via TextEncoder)
    const enc = new TextEncoder()
    const todoSize = enc.encode(JSON.stringify(todos)).byteLength
    const noteSize = enc.encode(JSON.stringify(notes)).byteLength
    const pomodoroSize = enc.encode(JSON.stringify(pomodoroSessions)).byteLength
    const habitSize = enc.encode(JSON.stringify(habits)).byteLength
    const totalSize = todoSize + noteSize + pomodoroSize + habitSize
    const storageKB = (totalSize / 1024).toFixed(1)

    const firstEntry = Math.min(firstTodoAt, firstNoteAt, firstSessionAt, firstHabitAt)
    const accountDays = firstEntry < Infinity ? Math.max(1, Math.floor((todayMidnightMs - firstEntry) / 86400000) + 1) : 1
    const storageSegments = totalSize > 0 ? [
      { size: todoSize, pct: (todoSize / totalSize) * 100, color: 'var(--color-primary)', label: '任务' },
      { size: noteSize, pct: (noteSize / totalSize) * 100, color: 'var(--color-warning)', label: '笔记' },
      { size: pomodoroSize, pct: (pomodoroSize / totalSize) * 100, color: 'var(--color-success)', label: '番茄' },
      { size: habitSize, pct: (habitSize / totalSize) * 100, color: '#8b5cf6', label: '打卡' },
    ] : []

    return { completedTodos, totalWords, workSessionCount, totalFocusMinutes, completedHabitCount, storageKB, accountDays, todoSize, noteSize, pomodoroSize, habitSize, storageSegments }
  }, [todos, notes, pomodoroSessions, habits, todayMidnightMs])

  const handleExport = () => {
    const backup = createDesktopBackup({
      todos,
      notes,
      pomodoroSessions,
      habits,
      userName,
      accentColor,
      themeMode,
      workspaceMode,
      dailyPomodoroGoal,
      pomodoroWorkDuration,
      pomodoroShortBreakDuration,
      pomodoroLongBreakDuration,
      pomodoroSoundEnabled,
      pomodoroAutoStartBreaks,
      pomodoroAutoStartWork,
      weatherAutoLocate,
    })
    downloadJsonBackup(backup, `abworkbench-backup-${dayNumToDateStr(Math.floor(Date.now() / 86400000))}.json`)
    showToast('备份文件已下载', 'success')
  }

  const handleExportWeeklyReport = () => {
    const report = generateWeeklyReport({ tasks: taskFlowTasks, pomodoroSessions, habits, notes })
    downloadReport(report, `abworkbench-weekly-${new Date().toISOString().slice(0, 10)}.md`)
    showToast('周报已下载', 'success')
  }

  const handleExportMonthlyReport = () => {
    const report = generateMonthlyReport({ tasks: taskFlowTasks, pomodoroSessions, habits, notes })
    downloadReport(report, `abworkbench-monthly-${new Date().toISOString().slice(0, 10)}.md`)
    showToast('月报已下载', 'success')
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)
        const d = getLegacyOrCurrentData(json)
        if (Object.keys(d).length > 0) {
          const patch: Record<string, unknown> = {}
          if (Array.isArray(d.todos)) patch.todos = d.todos
          if (Array.isArray(d.notes)) patch.notes = d.notes
          if (Array.isArray(d.pomodoroSessions)) patch.pomodoroSessions = d.pomodoroSessions
          if (Array.isArray(d.habits)) patch.habits = d.habits
          if (typeof d.userName === 'string') patch.userName = d.userName
          if (typeof d.accentColor === 'string') patch.accentColor = d.accentColor
          if (d.themeMode === 'dark' || d.themeMode === 'light' || d.themeMode === 'system') patch.themeMode = d.themeMode
          if (d.workspaceMode === 'focus' || d.workspaceMode === 'night' || d.workspaceMode === 'minimal' || d.workspaceMode === 'dashboard') patch.workspaceMode = d.workspaceMode
          if (typeof d.dailyPomodoroGoal === 'number' && d.dailyPomodoroGoal > 0) patch.dailyPomodoroGoal = d.dailyPomodoroGoal
          if (typeof d.pomodoroWorkDuration === 'number' && d.pomodoroWorkDuration > 0) {
            patch.pomodoroWorkDuration = d.pomodoroWorkDuration
            patch.pomodoroShortBreakDuration = typeof d.pomodoroShortBreakDuration === 'number' ? d.pomodoroShortBreakDuration : 5
            patch.pomodoroLongBreakDuration = typeof d.pomodoroLongBreakDuration === 'number' ? d.pomodoroLongBreakDuration : 15
          }
          if (typeof d.pomodoroSoundEnabled === 'boolean') patch.pomodoroSoundEnabled = d.pomodoroSoundEnabled
          if (typeof d.pomodoroAutoStartBreaks === 'boolean') patch.pomodoroAutoStartBreaks = d.pomodoroAutoStartBreaks
          if (typeof d.pomodoroAutoStartWork === 'boolean') patch.pomodoroAutoStartWork = d.pomodoroAutoStartWork
          if (typeof d.weatherAutoLocate === 'boolean') patch.weatherAutoLocate = d.weatherAutoLocate
          if (Object.keys(patch).length > 0) {
            useStore.setState(patch)
          }
          restoreTaskFlowBackup(json)
          showToast('备份数据已导入', 'success')
        } else {
          showToast('无效的备份文件', 'error')
        }
      } catch {
        showToast('文件解析失败', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleClearAll = () => {
    useStore.setState({
      todos: [],
      notes: [],
      pomodoroSessions: [],
      habits: [],
      activeNoteId: null,
    })
    setShowConfirmClear(false)
    showToast('所有数据已清除', 'info')
  }

  const statsList = useMemo(() => [
    { icon: CheckSquare, label: t('page.todo'), value: tWith('settings.completed', stats.completedTodos, todos.length), color: 'text-primary' },
    { icon: StickyNote, label: t('page.notes'), value: `${notes.length} · ${tWith('settings.words', stats.totalWords)}`, color: 'text-warning' },
    { icon: Timer, label: t('page.pomodoro'), value: tWith('settings.sessions', stats.workSessionCount, fmtMin(stats.totalFocusMinutes)) + (stats.workSessionCount > 0 ? tWith('settings.avgSession', Math.round(stats.totalFocusMinutes / stats.workSessionCount)) : ''), color: 'text-success' },
    { icon: Target, label: t('page.habits'), value: tWith('settings.habitCheckins', stats.completedHabitCount), color: 'text-purple-400' },
    { icon: HardDrive, label: t('settings.data'), value: tWith('settings.storage', stats.storageKB), color: 'text-cyan-400', storagePct: Math.round((Number(stats.storageKB) / 5120) * 100) },
    { icon: BarChart3, label: tWith('settings.dayN', stats.accountDays), value: tWith('settings.dayN', stats.accountDays), color: 'text-orange-400' },
  ], [stats, todos.length, notes.length, t, tWith])

  const taskFlowBackups = useMemo(() => {
    try {
      const raw = localStorage.getItem('taskflow-offline-backups')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed as Array<{ modified?: string }> : []
    } catch {
      return []
    }
  }, [])

  const dataHealth = useMemo(() => buildDataHealthReport({
    todos,
    notes,
    pomodoroSessions,
    habits,
    taskFlowTasks,
    backups: taskFlowBackups,
  }), [habits, notes, pomodoroSessions, taskFlowBackups, taskFlowTasks, todos])

  const clearEmptyNotes = () => {
    const nextNotes = notes.filter((note) => note.content.trim())
    useStore.setState((state) => ({
      notes: nextNotes,
      activeNoteId: nextNotes.some((note) => note.id === state.activeNoteId) ? state.activeNoteId : null,
    }))
    showToast('已清理空笔记', 'success')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-[36px] border border-border bg-surface/85 p-6 shadow-2xl shadow-black/10 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <SlidersHorizontal size={14} />
              设置中枢
            </div>
            <h2 className="text-3xl font-black tracking-tight text-text">把工作台调成你的节奏</h2>
            <p className="mt-2 text-sm text-text-muted">管理外观、专注参数、天气定位、数据备份与快捷键。</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
              <Sparkles size={16} className="mb-2 text-primary" />
              <div className="text-lg font-black text-text">{themeMode === 'dark' ? '深色' : themeMode === 'light' ? '浅色' : '跟随系统'}</div>
              <div className="text-[11px] text-text-muted">当前主题</div>
            </div>
            <div className="rounded-2xl border border-success/20 bg-success/10 p-3">
              <Timer size={16} className="mb-2 text-success" />
              <div className="text-lg font-black text-text">{dailyPomodoroGoal}</div>
              <div className="text-[11px] text-text-muted">每日目标</div>
            </div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3">
              <HardDrive size={16} className="mb-2 text-cyan-400" />
              <div className="text-lg font-black text-text">{stats.storageKB}KB</div>
              <div className="text-[11px] text-text-muted">本地数据</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-2xl border border-border bg-surface/80 p-1.5" role="tablist" aria-label="设置分类">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tab-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'text-text-muted hover:bg-surface-lighter hover:text-text'
              }`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{'labelKey' in tab && tab.labelKey ? t(tab.labelKey) : tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab: General */}
      {activeTab === 'general' && (
        <div className="space-y-6 animate-fade-in">
          {/* User Profile */}
          <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">{t('settings.personal')}</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">{t('settings.nickname')}</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={t('settings.nicknamePlaceholder')}
                  className="h-12 w-full rounded-2xl border border-border bg-background/60 px-4 text-sm text-text outline-none transition-all placeholder:text-text-muted focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                />
                <p className="text-xs text-text-muted mt-1">{t('settings.nicknameDesc')}</p>
              </div>
            </div>
          </div>

          {/* Weather Settings */}
          <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">{t('settings.weatherSettings')}</h2>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-background/50 p-4">
              <div>
                <label className="text-sm text-text">{t('settings.autoLocate')}</label>
                <p className="text-xs text-text-muted mt-0.5">{t('settings.autoLocateDesc')}</p>
              </div>
              <button
                onClick={() => setWeatherAutoLocate(!weatherAutoLocate)}
                className={`relative h-8 w-14 rounded-full transition-colors ${
                  weatherAutoLocate ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-surface-lighter'
                }`}
                role="switch"
                aria-checked={weatherAutoLocate}
                aria-label={t('settings.autoLocate')}
              >
                <div
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    weatherAutoLocate ? 'translate-x-[30px]' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* About */}
          <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
            <div className="mb-3 flex items-center gap-2">
              <Info size={20} className="text-cyan-400" />
              <h2 className="text-lg font-semibold text-text">{t('settings.about')}</h2>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              {t('settings.aboutDesc')}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {FEATURE_LIST.map((feature) => (
                <span key={feature} className="text-[10px] px-2 py-1 rounded-full bg-surface-lighter text-text-muted">
                  {feature}
                </span>
              ))}
            </div>
            <div className="mt-3 text-xs text-text-muted">
              {tWith('settings.version', '1.0.0')} · React 19 + TypeScript + Tailwind CSS v4 + Zustand
            </div>
          </div>
        </div>
      )}

      {/* Tab: Appearance */}
      {activeTab === 'appearance' && (
        <div className="space-y-6 animate-fade-in">
          {/* Appearance Mode */}
          <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">外观模式</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { mode: 'dark' as const, title: '深色模式', desc: '默认黑色工作台，适合长时间专注。' },
                { mode: 'light' as const, title: '浅色模式', desc: '更明亮的阅读和整理环境。' },
              ].map((option) => (
                <button
                  key={option.mode}
                  onClick={() => setThemeMode(option.mode)}
                  aria-pressed={themeMode === option.mode}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    themeMode === option.mode
                      ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/10'
                      : 'border-border bg-background/50 hover:border-primary/25 hover:bg-surface-lighter/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-text">{option.title}</span>
                    <span className={`h-3 w-3 rounded-full ${themeMode === option.mode ? 'bg-primary' : 'bg-text-muted/30'}`} />
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Workspace Mode */}
          <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
            <div className="mb-4 flex items-center gap-2">
              <Palette size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">工作台个性化</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {WORKSPACE_MODE_OPTIONS.map((option) => (
                <button
                  key={option.mode}
                  onClick={() => setWorkspaceMode(option.mode as WorkspaceMode)}
                  aria-pressed={workspaceMode === option.mode}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    workspaceMode === option.mode
                      ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/10'
                      : 'border-border bg-background/50 hover:border-primary/25 hover:bg-surface-lighter/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-text">{option.label}</span>
                    <span className={`h-3 w-3 rounded-full ${workspaceMode === option.mode ? 'bg-primary' : 'bg-text-muted/30'}`} />
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
            <div className="flex items-center gap-2 mb-4">
              <Palette size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">{t('settings.themeColor')}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {ACCENT_COLORS.map((item) => (
                <button
                  key={item.color}
                  onClick={() => setAccentColor(item.color)}
                  aria-pressed={accentColor === item.color}
                  aria-label={`主题色：${item.name}`}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-3 transition-all ${
                    accentColor === item.color
                      ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/10'
                      : 'border-border bg-background/50 hover:border-primary/25 hover:bg-surface-lighter'
                  }`}
                >
                  <div
                    className="h-6 w-6 rounded-full shadow-inner"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-text">{item.name}</span>
                </button>
              ))}
              <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-border bg-background/50 px-3 py-3 transition-all hover:border-primary/25 hover:bg-surface-lighter">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded-full border-none bg-transparent"
                  aria-label="自定义主题色"
                />
                <span className="text-sm text-text">{t('settings.custom')}</span>
              </label>
              {accentColor !== '#3b82f6' && (
                <button
                  onClick={() => setAccentColor('#3b82f6')}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-background/50 px-3 py-3 text-text-muted transition-all hover:border-primary/25 hover:bg-surface-lighter hover:text-text"
                >
                  <RotateCcw size={14} />
                  <span className="text-sm">{t('settings.resetDefault')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Pomodoro */}
      {activeTab === 'pomodoro' && (
        <div className="space-y-6 animate-fade-in">
          {/* Pomodoro Goal */}
          <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
            <div className="flex items-center gap-2 mb-4">
              <Timer size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">{t('settings.pomodoroGoal')}</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted mb-2 block">{t('settings.dailyGoal')}</label>
                <div className="grid grid-cols-5 gap-2">
                  {DAILY_GOAL_PRESETS.map((goal) => (
                    <button
                      key={goal}
                      onClick={() => setDailyPomodoroGoal(goal)}
                      aria-pressed={dailyPomodoroGoal === goal}
                      aria-label={`每日目标 ${goal} 个番茄钟`}
                      className={`h-12 rounded-2xl text-sm font-black transition-all ${
                        dailyPomodoroGoal === goal
                          ? 'bg-primary text-white shadow-lg shadow-primary/25'
                          : 'bg-background/60 text-text-muted ring-1 ring-border hover:text-text hover:ring-primary/30'
                      }`}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-2">{tWith('settings.currentGoal', dailyPomodoroGoal)}</p>
              </div>
            </div>
          </div>

          {/* Pomodoro Durations */}
          <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
            <div className="flex items-center gap-2 mb-4">
              <Timer size={20} className="text-success" />
              <h2 className="text-lg font-semibold text-text">{t('settings.pomodoroDuration')}</h2>
            </div>
            <div className="space-y-4">
              {TIMER_DURATION_KEYS.map((item) => {
                const value = item.key === 'work' ? pomodoroWorkDuration : item.key === 'shortBreak' ? pomodoroShortBreakDuration : pomodoroLongBreakDuration
                return (
                <div key={item.key} className="rounded-2xl border border-border bg-background/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm font-semibold text-text">{t(item.labelKey)}</label>
                    <span className={`text-xs font-bold ${item.color}`}>{value} {t('settings.minutes')}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {DURATION_PRESETS.filter(v =>
                      item.key === 'work' ? v >= 15 : v >= 5
                    ).map((min) => (
                      <button
                        key={min}
                        onClick={() => {
                          if (item.key === 'work') setPomodoroDurations(min, pomodoroShortBreakDuration, pomodoroLongBreakDuration)
                          else if (item.key === 'shortBreak') setPomodoroDurations(pomodoroWorkDuration, min, pomodoroLongBreakDuration)
                          else setPomodoroDurations(pomodoroWorkDuration, pomodoroShortBreakDuration, min)
                        }}
                        aria-pressed={value === min}
                        aria-label={`${t(item.labelKey)} ${min} 分钟`}
                        className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                          value === min
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'bg-surface-lighter text-text-muted hover:text-text hover:bg-surface-lighter/80'
                        }`}
                      >
                        {min}
                      </button>
                    ))}
                  </div>
                </div>
              )})}
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted">{tWith('settings.currentDuration', pomodoroWorkDuration, pomodoroShortBreakDuration, pomodoroLongBreakDuration)}</p>
                {(pomodoroWorkDuration !== 25 || pomodoroShortBreakDuration !== 5 || pomodoroLongBreakDuration !== 15) && (
                  <button
                    onClick={() => setPomodoroDurations(25, 5, 15)}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors"
                  >
                    <RotateCcw size={12} />
                    {t('settings.resetDefault')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Data & Security */}
      {activeTab === 'data' && (
        <div className="space-y-6 animate-fade-in">
          {/* Statistics */}
          <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">{t('settings.dataStats')}</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {statsList.map((stat) => {
                const Icon = stat.icon
                const pct = 'storagePct' in stat ? stat.storagePct : undefined
                const barColor = pct !== undefined ? (pct >= 80 ? 'var(--color-danger)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-success)') : ''
                return (
                  <div key={stat.label} className={`rounded-2xl border border-border bg-background/50 p-4 ${pct !== undefined ? 'space-y-2 lg:col-span-2' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={stat.color} />
                        <span className="text-sm text-text">{stat.label}</span>
                      </div>
                      <span className="text-sm text-text-muted">{stat.value}</span>
                    </div>
                    {pct !== undefined && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface-lighter rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                          />
                        </div>
                        <span className="text-[10px] font-medium min-w-[32px] text-right" style={{ color: barColor }}>
                          {pct}%
                        </span>
                      </div>
                    )}
                    {pct !== undefined && pct >= 80 && (
                      <p className="text-[10px] text-danger/80">{t('settings.storageFull')}</p>
                    )}
                  </div>
                )
              })}
              {Number(stats.storageKB) > 0 && (
                <div className="p-3 rounded-lg bg-surface-lighter/50">
                  <div className="text-xs text-text-muted mb-2">{t('settings.storageDist')}</div>
                  <div className="h-2 bg-surface-lighter rounded-full overflow-hidden flex">
                    {stats.storageSegments.map((s) => (
                      <div
                        key={s.label}
                        className="h-full"
                        style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                        title={`${s.label}: ${(s.size / 1024).toFixed(1)} KB`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {stats.storageSegments.map((s) => (
                      <span key={s.label} className="flex items-center gap-1 text-[10px] text-text-muted">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label} {(s.size / 1024).toFixed(1)}KB
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Data Management */}
          <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={20} className="text-success" />
              <h2 className="text-lg font-semibold text-text">{t('settings.dataManagement')}</h2>
            </div>

            <div className="mb-4 rounded-2xl border border-success/20 bg-success/10 p-4 text-xs text-text-muted">
              备份文件只保存在本地导出的 JSON 中，导入前会校验格式；清空数据不可撤销。
            </div>

            <div className="mb-4 rounded-[26px] border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-cyan-500/15 p-2 text-cyan-300">
                    <HardDrive size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text">数据健康中心</h3>
                    <p className="text-xs text-text-muted">本地数据大小、备份状态和异常数据检测。</p>
                  </div>
                </div>
                <span className="rounded-full bg-background/60 px-3 py-1 text-xs text-text-muted">{dataHealth.totalSizeLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-border bg-background/45 p-3">
                  <div className="text-xs text-text-muted">备份状态</div>
                  <div className={dataHealth.backupStatus === 'ok' ? 'mt-1 text-sm font-bold text-success' : 'mt-1 text-sm font-bold text-warning'}>
                    {dataHealth.backupStatus === 'ok' ? '正常' : '暂无备份'}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-text-muted">{dataHealth.lastBackupLabel}</div>
                </div>
                <div className="rounded-2xl border border-border bg-background/45 p-3">
                  <div className="text-xs text-text-muted">重复任务</div>
                  <div className="mt-1 text-sm font-bold text-text">{dataHealth.duplicateTaskCount} 组</div>
                  <div className="mt-1 text-[10px] text-text-muted">按标题检测</div>
                </div>
                <div className="rounded-2xl border border-border bg-background/45 p-3">
                  <div className="text-xs text-text-muted">空笔记</div>
                  <div className="mt-1 text-sm font-bold text-text">{dataHealth.emptyNoteCount} 篇</div>
                  <button
                    onClick={clearEmptyNotes}
                    disabled={dataHealth.emptyNoteCount === 0}
                    className="mt-2 rounded-xl bg-primary/15 px-2 py-1 text-[10px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    清理
                  </button>
                </div>
                <div className="rounded-2xl border border-border bg-background/45 p-3">
                  <div className="text-xs text-text-muted">异常项</div>
                  <div className="mt-1 text-sm font-bold text-text">{dataHealth.issues.length} 项</div>
                  <div className="mt-1 text-[10px] text-text-muted">建议定期检查</div>
                </div>
              </div>
              {dataHealth.issues.length > 0 && (
                <div className="mt-3 space-y-2">
                  {dataHealth.issues.map((issue) => (
                    <div key={issue.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/35 px-3 py-2 text-xs">
                      <span className={issue.severity === 'danger' ? 'text-danger' : issue.severity === 'warning' ? 'text-warning' : 'text-text'}>
                        {issue.title}
                      </span>
                      <span className="text-text-muted">{issue.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <button onClick={handleExport} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background/60 text-sm font-semibold text-text-muted transition-all hover:border-primary/30 hover:bg-surface-lighter hover:text-text">
                <Download size={16} />
                {t('settings.exportBackup')}
              </button>

              <button onClick={() => fileInputRef.current?.click()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background/60 text-sm font-semibold text-text-muted transition-all hover:border-primary/30 hover:bg-surface-lighter hover:text-text">
                <Upload size={16} />
                {t('settings.importBackup')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />

              <div className="md:col-span-2">
                <BackupCenter />
              </div>

              {/* Report exports */}
              <button onClick={handleExportWeeklyReport} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background/60 text-sm font-semibold text-text-muted transition-all hover:border-primary/30 hover:bg-surface-lighter hover:text-text">
                <FileText size={16} />
                导出周报
              </button>
              <button onClick={handleExportMonthlyReport} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background/60 text-sm font-semibold text-text-muted transition-all hover:border-primary/30 hover:bg-surface-lighter hover:text-text">
                <FileText size={16} />
                导出月报
              </button>

              <div className="border-t border-border pt-3 md:col-span-2">
                <button
                  onClick={() => setShowConfirmClear(true)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-danger/15 text-sm font-semibold text-danger transition-all hover:bg-danger/25"
                >
                  <Trash2 size={16} />
                  {t('settings.clearAll')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Shortcuts */}
      {activeTab === 'shortcuts' && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Keyboard size={20} className="text-cyan-400" />
                <div>
                  <h2 className="text-lg font-semibold text-text">{t('settings.shortcuts')}</h2>
                  <p className="text-xs text-text-muted">点击右侧组合键进行录制；Esc 取消。启动器默认 Alt+Space，主窗口默认 Ctrl+Alt+Space。</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetAllShortcuts()
                  setRecordingShortcutId(null)
                  showToast('已恢复全部默认快捷键', 'success')
                }}
                className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm"
              >
                <RotateCcw size={14} />
                恢复默认
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.label} className="rounded-2xl border border-border bg-background/50 p-3">
                  <div className="mb-2 px-1 text-xs font-bold text-text">{group.label}</div>
                  {group.shortcuts.map((shortcut) => {
                    const value = getAccelerator(shortcut.id)
                    // Re-read when overrides change
                    void shortcutOverrides
                    const conflicts = findConflicts(shortcut.id, value)
                      .map((id) => SHORTCUT_BY_ID[id]?.label)
                      .filter(Boolean)
                    return (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between gap-3 rounded-xl p-2 transition-colors hover:bg-surface-lighter/50"
                      >
                        <span className="text-sm text-text-muted">{shortcut.label}</span>
                        <ShortcutRecorder
                          value={value}
                          recording={recordingShortcutId === shortcut.id}
                          conflictLabel={conflicts[0]}
                          onStartRecording={() => setRecordingShortcutId(shortcut.id)}
                          onCancel={() => setRecordingShortcutId(null)}
                          onChange={(next) => {
                            setAccelerator(shortcut.id, next)
                            setRecordingShortcutId(null)
                            showToast(`已更新：${shortcut.label}`, 'success')
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Launcher (uTools-style) */}
      {activeTab === 'launcher' && <LauncherSettings onToast={showToast} />}
      {activeTab === 'reader' && <ReaderSettings onToast={showToast} />}

      {/* Confirm Dialog */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowConfirmClear(false)} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative glass-card p-6 max-w-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center">
                <AlertTriangle size={20} className="text-danger" />
              </div>
              <h3 id="confirm-dialog-title" className="text-lg font-semibold text-text">{t('settings.clearConfirmTitle')}</h3>
            </div>
            <p className="text-sm text-text-muted mb-6">
              {t('settings.clearConfirmDesc')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmClear(false)} className="btn-secondary flex-1 justify-center">
                {t('settings.cancel')}
              </button>
              <button onClick={handleClearAll} className="btn-danger flex-1 justify-center">
                {t('settings.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
