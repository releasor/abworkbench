import { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react'
import { AlertTriangle, CheckCircle2, ListChecks, Sparkles, Trophy } from 'lucide-react'
import { useTaskStore } from './hooks/useTaskStore'
import { useKeyboard } from './hooks/useKeyboard'
import { safeGetString, safeSetString } from '../../utils/safeLocalStorage'
import { FilterBar } from './components/FilterBar'
import { QuickAdd } from './components/QuickAdd'
import { ProgressBar } from './components/ProgressBar'
import { SortControl } from './components/SortControl'
import { ConfirmDialog } from './components/ConfirmDialog'
import { TaskFlowToolbar } from './components/TaskFlowToolbar'
import { TaskFlowView } from './components/TaskFlowView'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { Task, ViewMode, Status } from './types'
import { STATUS_CYCLE } from './types'
import { showToast } from './utils/toastEvent'
import { setSoundEnabled, isSoundEnabled } from './utils/sound'
import { migrateTodosIfNeeded } from './utils/migrateTodos'
import { getTaskFlowSummaryStats } from './utils/summaryStats'
import { buildTodaySchedule } from './utils/todaySchedule'
import { todayStr } from './dateUtils'

const REVERSE_CYCLE: Record<Status, Status> = { 'todo': 'done', 'in-progress': 'todo', 'review': 'in-progress', 'done': 'review' }

const TaskModal = lazy(() => import('./components/TaskModal').then(m => ({ default: m.TaskModal })))
const StatsPanel = lazy(() => import('./components/StatsPanel').then(m => ({ default: m.StatsPanel })))
const PomodoroTimer = lazy(() => import('./components/PomodoroTimer').then(m => ({ default: m.PomodoroTimer })))
const Celebration = lazy(() => import('./components/Celebration').then(m => ({ default: m.Celebration })))
const BatchToolbar = lazy(() => import('./components/BatchToolbar').then(m => ({ default: m.BatchToolbar })))
const KeyboardHelp = lazy(() => import('./components/KeyboardHelp').then(m => ({ default: m.KeyboardHelp })))
const ActivityTimeline = lazy(() => import('./components/ActivityTimeline').then(m => ({ default: m.ActivityTimeline })))
const FocusMode = lazy(() => import('./components/FocusMode').then(m => ({ default: m.FocusMode })))
const DailyReview = lazy(() => import('./components/DailyReview').then(m => ({ default: m.DailyReview })))
const WeeklyReport = lazy(() => import('./components/WeeklyReport').then(m => ({ default: m.WeeklyReport })))
const BulkTextImport = lazy(() => import('./components/BulkTextImport').then(m => ({ default: m.BulkTextImport })))

export default function TaskFlowPage() {
  const fetchTasks = useTaskStore((state) => state.fetchTasks)
  const fetchCategories = useTaskStore((state) => state.fetchCategories)
  const fetchStats = useTaskStore((state) => state.fetchStats)
  const error = useTaskStore((state) => state.error)
  const clearError = useTaskStore((state) => state.clearError)
  const undoDelete = useTaskStore((state) => state.undoDelete)
  const updateTask = useTaskStore((state) => state.updateTask)
  const selectAll = useTaskStore((state) => state.selectAll)
  const clearSelection = useTaskStore((state) => state.clearSelection)
  const batchDelete = useTaskStore((state) => state.batchDelete)
  const selectedIds = useTaskStore((state) => state.selectedIds)
  const tasks = useTaskStore((state) => state.tasks)
  const success = useCallback((message: string, action?: { label: string; onClick: () => void }) => {
    showToast(message, 'success', action)
  }, [])
  const showError = useCallback((message: string) => {
    showToast(message, 'error')
  }, [])
  const [showStats, setShowStats] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [focusedTask, setFocusedTask] = useState<Task | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pomodoroToggle, setPomodoroToggle] = useState(false)
  const [showDailyReview, setShowDailyReview] = useState(false)
  const [showWeeklyReport, setShowWeeklyReport] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (safeGetString('taskflow-viewMode', 'board') as ViewMode) || 'board'
  })

  useEffect(() => {
    migrateTodosIfNeeded()
    fetchTasks().catch((err) => {
      console.error('Failed to fetch tasks:', err)
      showError('加载任务失败')
    })
    fetchCategories().catch((err) => {
      console.error('Failed to fetch categories:', err)
      showError('加载分类失败')
    })
    fetchStats().catch((err) => {
      console.error('Failed to fetch stats:', err)
      showError('加载统计失败')
    })
  }, [fetchTasks, fetchCategories, fetchStats, showError])

  useEffect(() => {
    if (error) {
      showError(error)
      clearError()
    }
  }, [error, showError, clearError])

  // Listen for macro events from CommandPalette
  useEffect(() => {
    const handler = (e: Event) => {
      const macroId = (e as CustomEvent<{ id: string }>).detail?.id
      if (macroId === 'macro-daily-review') setShowDailyReview(true)
      else if (macroId === 'macro-weekly-report') setShowWeeklyReport(true)
      else if (macroId === 'macro-focus-mode') {
        const firstTask = tasks.find((t) => t.status !== 'done' && !t.archived)
        if (firstTask) setFocusedTask(firstTask)
      }
      else if (macroId === 'macro-bulk-import') setShowBulkImport(true)
    }
    window.addEventListener('abworkbench:macro', handler)
    return () => window.removeEventListener('abworkbench:macro', handler)
  }, [tasks])

  useEffect(() => {
    safeSetString('taskflow-viewMode', viewMode)
  }, [viewMode])

  const summaryStats = useMemo(() => getTaskFlowSummaryStats(tasks), [tasks])
  const today = todayStr()
  const todaySchedule = useMemo(() => buildTodaySchedule({
    today,
    tasks,
  }), [today, tasks])
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const taskFlowHealth = useMemo(() => summaryStats.overdue > 0 ? '需要处理逾期' : summaryStats.active > 0 ? '节奏稳定推进中' : '今天很清爽', [summaryStats])
  const heroStats = useMemo(() => [
    { label: '总任务', value: summaryStats.total, icon: ListChecks, tone: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { label: '进行中', value: summaryStats.active, icon: Sparkles, tone: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
    { label: '已完成', value: summaryStats.completed, icon: CheckCircle2, tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { label: '逾期', value: summaryStats.overdue, icon: AlertTriangle, tone: summaryStats.overdue > 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-zinc-400 bg-white/[0.03] border-white/10' },
  ], [summaryStats])

  const hasModal = editingTask !== null || showCreateModal || showKeyboardHelp || focusedTask !== null || showTimeline || showCompleted || showDailyReview || showWeeklyReport || showBulkImport

  useKeyboard({
    onNewTask: () => setShowCreateModal(true),
    onCloseModal: () => {
      setEditingTask(null)
      setShowCreateModal(false)
      setShowKeyboardHelp(false)
      setFocusedTask(null)
      setShowTimeline(false)
      setShowCompleted(false)
      setShowDailyReview(false)
      setShowWeeklyReport(false)
      setShowBulkImport(false)
    },
    onClearSelection: hasModal ? undefined : () => clearSelection(),
    onToggleStats: () => setShowStats(prev => !prev),
    onChangeViewMode: setViewMode,
    onToggleHelp: () => setShowKeyboardHelp(prev => !prev),
    onToggleTimeline: () => setShowTimeline(prev => !prev),
    onToggleSearch: () => {
      const searchInput = document.querySelector('input[placeholder*="搜索"]') as HTMLInputElement
      searchInput?.focus()
    },
    onToggleCompleted: () => setShowCompleted(prev => !prev),
    onSelectAll: () => selectAll(),
    onUndo: async () => {
      const items = useTaskStore.getState().lastDeletedTasks
      if (items.length > 0) {
        try {
          const count = items.length
          const title = items[0]?.title || ''
          await undoDelete()
          success(count > 1 ? `已恢复 ${count} 个任务` : `已恢复任务: ${title}`)
        } catch (err) { console.error('恢复任务失败:', err); showError('恢复任务失败') }
      }
    },
    onDeleteSelected: async () => {
      if (selectedIds.size > 0) setShowDeleteConfirm(true)
    },
    onFocusMode: () => {
      if (selectedIds.size > 0) {
        const firstSelectedId = selectedIds.values().next().value
        if (!firstSelectedId) return
        const task = taskById.get(firstSelectedId)
        if (task) setFocusedTask(task)
      }
    },
    onTogglePin: async () => {
      if (selectedIds.size > 0) {
        const firstSelectedId = selectedIds.values().next().value
        if (!firstSelectedId) return
        const task = taskById.get(firstSelectedId)
        if (task) {
          try {
            await updateTask(task.id, { pinned: !task.pinned })
            success(task.pinned ? '已取消置顶' : '已置顶任务')
          } catch (err) { console.error('置顶操作失败:', err); showError('置顶操作失败') }
        }
      }
    },
    onSnoozeSelected: async () => {
      if (selectedIds.size > 0) {
        try {
          const { batchSnooze } = useTaskStore.getState()
          await batchSnooze(1)
          success(`已将 ${selectedIds.size} 个任务推迟1天`)
        } catch (err) { console.error('推迟失败:', err); showError('推迟失败') }
      }
    },
    onTogglePomodoro: () => setPomodoroToggle(prev => !prev),
    onToggleSound: () => {
      const currentlyEnabled = isSoundEnabled()
      setSoundEnabled(!currentlyEnabled)
      success(currentlyEnabled ? '已关闭声音' : '已开启声音')
    },
    onToggleDailyReview: () => setShowDailyReview(prev => !prev),
    onToggleWeeklyReport: () => setShowWeeklyReport(prev => !prev),
    onMoveStatusForward: async () => {
      if (selectedIds.size === 0) return
      try {
        const { moveTask } = useTaskStore.getState()
        const promises: Promise<void>[] = []
        for (const id of selectedIds) {
          const task = taskById.get(id)
          if (task) promises.push(moveTask(task.id, STATUS_CYCLE[task.status]))
        }
        await Promise.all(promises)
        success(`已推进 ${selectedIds.size} 个任务`)
      } catch (err) { console.error('推进任务失败:', err); showError('推进任务失败') }
    },
    onMoveStatusBackward: async () => {
      if (selectedIds.size === 0) return
      try {
        const { moveTask } = useTaskStore.getState()
        const promises: Promise<void>[] = []
        for (const id of selectedIds) {
          const task = taskById.get(id)
          if (task) promises.push(moveTask(task.id, REVERSE_CYCLE[task.status]))
        }
        await Promise.all(promises)
        success(`已回退 ${selectedIds.size} 个任务`)
      } catch (err) { console.error('回退任务失败:', err); showError('回退任务失败') }
    },
  })

  const handleCelebrationComplete = useCallback(() => setShowCelebration(false), [])
  const handleCreateTaskForDate = useCallback((date: string) => { setPrefillDate(date); setShowCreateModal(true) }, [])
  const handleSuccessWithCelebration = useCallback((msg: string) => {
    success(msg)
    if (msg.includes('完成')) setShowCelebration(true)
  }, [success])

  return (
    <ErrorBoundary>
    <div className="space-y-5 animate-fade-in">
      <section className="relative overflow-hidden rounded-[34px] border border-border bg-surface/80 p-5 shadow-2xl shadow-black/10 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Trophy size={14} />
                TaskFlow 工作台
              </div>
              <h2 className="text-3xl font-black tracking-tight text-text">把任务推进到下一步</h2>
              <p className="mt-2 text-sm text-text-muted">
                {taskFlowHealth} · 今日完成 {summaryStats.todayCompleted} 个 · 本周完成 {summaryStats.weekCompleted} 个 · 完成率 {summaryStats.completionRate}%
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
              {heroStats.map((stat) => {
                const Icon = stat.icon
                return (
                  <div key={stat.label} className={`rounded-2xl border px-3 py-2.5 ${stat.tone}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium opacity-80">{stat.label}</span>
                      <Icon size={15} />
                    </div>
                    <div className="mt-1 text-2xl font-black text-text">{stat.value}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <TaskFlowToolbar
            viewMode={viewMode}
            showStats={showStats}
            showTimeline={showTimeline}
            showDailyReview={showDailyReview}
            showWeeklyReport={showWeeklyReport}
            onViewModeChange={setViewMode}
            onToggleStats={() => setShowStats(s => !s)}
            onToggleTimeline={() => setShowTimeline(s => !s)}
            onToggleDailyReview={() => setShowDailyReview(s => !s)}
            onToggleWeeklyReport={() => setShowWeeklyReport(s => !s)}
            onCreateTask={() => setShowCreateModal(true)}
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-surface/70 p-4 shadow-xl shadow-black/5 backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-bold text-text">今日自动排程</div>
            <p className="text-xs text-text-muted">{todaySchedule.headline}</p>
          </div>
          <button
            onClick={() => setViewMode('list')}
            className="rounded-2xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-text-muted transition hover:border-primary/40 hover:text-primary"
          >
            打开列表视图
          </button>
        </div>
        {todaySchedule.items.length > 0 && (
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {todaySchedule.items.slice(0, 3).map((item) => (
              <button
                key={item.taskId}
                onClick={() => {
                  const task = tasks.find((entry) => entry.id === item.taskId)
                  if (task) setEditingTask(task)
                }}
                className="rounded-2xl border border-border bg-background/45 p-3 text-left transition hover:border-primary/40 hover:bg-surface-lighter/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-primary">{item.slotLabel}</span>
                  <span className={item.risk === 'overdue' ? 'text-xs text-danger' : item.risk === 'today' ? 'text-xs text-warning' : 'text-xs text-text-muted'}>
                    {item.estimatedMinutes} 分钟
                  </span>
                </div>
                <div className="mt-2 line-clamp-1 text-sm font-semibold text-text">{item.title}</div>
                <div className="mt-1 line-clamp-1 text-xs text-text-muted">{item.nextAction}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Stats Panel (detailed) */}
      {showStats && (
        <Suspense fallback={<div className="card p-6 animate-pulse"><div className="h-40 bg-surface-lighter rounded" /></div>}>
          <StatsPanel />
        </Suspense>
      )}

      {/* Progress & Sort Bar */}
      {viewMode !== 'calendar' && (
        <div className="rounded-[28px] border border-border bg-surface/70 p-4 shadow-xl shadow-black/5 backdrop-blur-xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-text">任务推进轨道</div>
              <div className="text-xs text-text-muted">拖动卡片、筛选范围，保持看板流动。</div>
            </div>
            <SortControl />
          </div>
          <div>
            <ProgressBar />
          </div>
        </div>
      )}

      <section className="rounded-[28px] border border-border bg-surface/70 p-4 shadow-xl shadow-black/5 backdrop-blur-xl">
        <FilterBar />
      </section>

      {/* Quick Add */}
      {viewMode !== 'calendar' && (
        <section className="rounded-[28px] border border-dashed border-primary/25 bg-primary/[0.04] p-3 shadow-xl shadow-black/5">
          <QuickAdd onSuccess={msg => success(msg)} />
        </section>
      )}

      <TaskFlowView
        viewMode={viewMode}
        onEditTask={setEditingTask}
        onFocusTask={setFocusedTask}
        onCreateTaskForDate={handleCreateTaskForDate}
      />

      {/* Modals & Overlays */}
      {(editingTask || showCreateModal) && (
        <Suspense fallback={null}>
          <TaskModal
            key={editingTask?.id ?? prefillDate ?? 'new-task'}
            task={editingTask}
            prefillDate={prefillDate}
            onClose={() => { setEditingTask(null); setShowCreateModal(false); setPrefillDate(null) }}
            onSuccess={handleSuccessWithCelebration}
          />
        </Suspense>
      )}

      {showKeyboardHelp && (
        <Suspense fallback={null}>
          <KeyboardHelp onClose={() => setShowKeyboardHelp(false)} />
        </Suspense>
      )}

      {showTimeline && (
        <Suspense fallback={null}>
          <ActivityTimeline onClose={() => setShowTimeline(false)} onEditTask={setEditingTask} />
        </Suspense>
      )}

      {showDailyReview && (
        <Suspense fallback={null}>
          <DailyReview onClose={() => setShowDailyReview(false)} onEditTask={setEditingTask} />
        </Suspense>
      )}

      {showWeeklyReport && (
        <Suspense fallback={null}>
          <WeeklyReport onClose={() => setShowWeeklyReport(false)} />
        </Suspense>
      )}

      {showBulkImport && (
        <Suspense fallback={null}>
          <BulkTextImport onClose={() => setShowBulkImport(false)} onSuccess={msg => success(msg)} />
        </Suspense>
      )}

      {focusedTask && (
        <Suspense fallback={null}>
          <FocusMode taskId={focusedTask.id} onClose={() => setFocusedTask(null)} onSuccess={handleSuccessWithCelebration} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <PomodoroTimer externalToggle={pomodoroToggle} taskId={focusedTask?.id} />
      </Suspense>
      <Suspense fallback={null}>
        <Celebration show={showCelebration} onComplete={handleCelebrationComplete} />
      </Suspense>
      <Suspense fallback={null}>
        <BatchToolbar onSuccess={msg => success(msg)} />
      </Suspense>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="删除任务"
          message={`确定要删除选中的 ${selectedIds.size} 个任务吗？删除后可用 Ctrl+Z 撤销。`}
          confirmText="删除"
          variant="danger"
          onConfirm={async () => {
            try {
              const count = selectedIds.size
              await batchDelete()
              success(`已删除 ${count} 个任务`, {
                label: '撤销',
                onClick: async () => {
                  try {
                    await undoDelete()
                    success('已恢复删除的任务')
                  } catch (err) { console.error('恢复失败:', err); showError('恢复失败') }
                },
              })
              setShowDeleteConfirm(false)
            } catch (err) { console.error('删除失败:', err); showError('删除失败') }
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
    </ErrorBoundary>
  )
}
