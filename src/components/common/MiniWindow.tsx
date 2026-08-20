import { useEffect, useMemo, useState, useCallback } from 'react'
import { Bell, ClipboardPlus, ExternalLink, Timer, Zap, Check } from 'lucide-react'
import { useStore } from '../../store'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { buildMiniWindowModel, type MiniReminder } from './miniWindowModel'
import { useSyncedLocalCollection } from '../../hooks/useSyncedLocalCollection'
import { showToast } from '../../modules/taskflow/utils/toastEvent'
import { formatLocalDateTimeMinute } from '../../modules/taskflow/dateUtils'
import { ACTIVE_POMODORO_EVENT, getActiveRemainingSec, pauseActivePomodoro, readActivePomodoro, resumeActivePomodoro, type ActivePomodoroState } from '../../utils/activePomodoro'
import { completeReminder as rollCompleteReminder } from '../../utils/reminders'

interface MiniWindowProps {
  onOpenQuickCapture: () => void
}

export default function MiniWindow({ onOpenQuickCapture }: MiniWindowProps) {
  const tasks = useTaskStore((state) => state.tasks)
  const fetchTasks = useTaskStore((state) => state.fetchTasks)
  const updateTask = useTaskStore((state) => state.updateTask)

  const handleComplete = useCallback(async (taskId: string) => {
    try {
      await updateTask(taskId, { status: 'done', completedAt: new Date().toISOString() })
      showToast('任务已完成', 'success')
    } catch {
      showToast('完成失败', 'error')
    }
  }, [updateTask])
  const pomodoroSessions = useStore((state) => state.pomodoroSessions)
  const { items: reminders, update: updateReminder } = useSyncedLocalCollection<MiniReminder>('abworkbench-reminders', [])
  const [now, setNow] = useState(() => Date.now())
  const [activePomo, setActivePomo] = useState<ActivePomodoroState | null>(() => readActivePomodoro())

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<ActivePomodoroState | null> | undefined)?.detail
      setActivePomo(detail === undefined ? readActivePomodoro() : detail)
    }
    window.addEventListener(ACTIVE_POMODORO_EVENT, sync as EventListener)
    return () => window.removeEventListener(ACTIVE_POMODORO_EVENT, sync as EventListener)
  }, [])

  const model = useMemo(() => buildMiniWindowModel({
    now,
    tasks,
    reminders,
    pomodoroSessions,
  }), [now, pomodoroSessions, reminders, tasks])

  const activeRemaining = getActiveRemainingSec(activePomo, now)
  const activeLabel = activePomo
    ? `${Math.floor(activeRemaining / 60)}:${String(activeRemaining % 60).padStart(2, '0')}`
    : model.todayFocus

  const completeReminder = useCallback(() => {
    if (!model.nextReminder) return
    const snapshot = { id: model.nextReminder.id, dueAt: model.nextReminder.dueAt, done: model.nextReminder.done }
    const patch = rollCompleteReminder({
      id: model.nextReminder.id,
      title: model.nextReminder.title,
      dueAt: model.nextReminder.dueAt,
      done: model.nextReminder.done,
    })
    updateReminder(snapshot.id, patch)
    showToast('提醒已更新', 'success', {
      label: '撤销',
      onClick: () => updateReminder(snapshot.id, { dueAt: snapshot.dueAt, done: snapshot.done }),
    }, 8_000)
  }, [model.nextReminder, updateReminder])

  const snoozeReminder = useCallback(() => {
    if (!model.nextReminder) return
    const id = model.nextReminder.id
    const prevDueAt = model.nextReminder.dueAt
    updateReminder(id, {
      dueAt: formatLocalDateTimeMinute(new Date(Date.now() + 30 * 60 * 1000)),
      done: false,
    })
    showToast('已延后 30 分钟', 'info', {
      label: '撤销',
      onClick: () => updateReminder(id, { dueAt: prevDueAt, done: false }),
    }, 8_000)
  }, [model.nextReminder, updateReminder])

  return (
    <div className="min-h-screen bg-surface p-4 text-text">
      <div className="rounded-shell border border-border bg-surface-light/80 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-2 text-white">
              <Zap size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black">Abworkbench Mini</h1>
              <p className="text-xs text-text-muted">悬浮工作小窗</p>
            </div>
          </div>
          <button onClick={onOpenQuickCapture} className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            <ClipboardPlus size={16} className="mr-1 inline" />
            捕获
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-panel border border-border bg-surface/60 p-3">
            <Timer className="text-success" size={20} />
            <div className="mt-2 text-2xl font-black">{activePomo ? activeLabel : model.todayFocus}</div>
            <div className="text-xs text-text-muted">{activePomo ? (activePomo.targetEnd ? '进行中 · 剩余' : '已暂停') : '今日完成番茄'}</div>
            {activePomo && (
              <button
                type="button"
                className="mt-2 rounded-lg bg-surface-lighter px-2 py-1 text-[10px] font-semibold text-text hover:bg-surface-light"
                onClick={() => {
                  if (activePomo.targetEnd) pauseActivePomodoro(activePomo.source)
                  else {
                    resumeActivePomodoro(activePomo.source)
                    window.dispatchEvent(new CustomEvent('abworkbench:pomodoro-start'))
                  }
                }}
              >
                {activePomo.targetEnd ? '暂停' : '继续'}
              </button>
            )}
          </div>
          <div className="rounded-panel border border-border bg-surface/60 p-3">
            <Bell className={model.reminderOverdue ? 'text-amber-400' : 'text-primary'} size={20} />
            <div className="mt-2 truncate text-sm font-black">{model.nextReminder ? model.nextReminder.title : '无提醒'}</div>
            <div className="text-xs text-text-muted">{model.reminderOverdue ? '已逾期提醒' : '下一提醒'}</div>
            {model.nextReminder && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={completeReminder}
                  className="rounded-lg bg-success/20 px-2 py-1 text-[10px] font-semibold text-success hover:bg-success/30"
                >
                  完成
                </button>
                <button
                  type="button"
                  onClick={snoozeReminder}
                  className="rounded-lg bg-surface-lighter px-2 py-1 text-[10px] font-semibold text-text-muted hover:bg-surface-light"
                >
                  +30分
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-panel border border-success/20 bg-success/10 p-3">
          <div className="text-xs font-semibold text-success">当前专注</div>
          <div className="mt-1 line-clamp-2 text-sm font-black text-text">
            {model.activeTask ? model.activeTask.title : '暂无正在计时的任务'}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>今日三件事</span>
            <span className="text-xs text-text-muted">置顶 / 到期</span>
          </div>
          {model.topTasks.length === 0 ? (
            <div className="rounded-panel border border-dashed border-border p-5 text-center text-sm text-text-muted">
              今天没有置顶或到期任务。
            </div>
          ) : model.topTasks.map((task) => (
            <div key={task.id} className="group rounded-panel border border-border bg-surface/40 p-3">
              <div className="flex items-start gap-2">
                <button
                  onClick={() => handleComplete(task.id)}
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-success/40 text-success transition hover:bg-success hover:text-white"
                  title="标记完成"
                >
                  <Check size={12} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 font-semibold">{task.title}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
                    <span>{task.priority}</span>
                    <span>{task.dueDate || '置顶'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onOpenQuickCapture} className="mt-4 w-full rounded-panel border border-border bg-surface/50 px-4 py-3 text-sm font-semibold text-text hover:bg-surface-lighter">
          <ClipboardPlus size={16} className="mr-2 inline" />
          快速捕获
        </button>

        <button onClick={() => window.electronAPI?.showMainWindow?.()} className="mt-4 w-full rounded-panel border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/15">
          <ExternalLink size={16} className="mr-2 inline" />
          回到任务流
        </button>
      </div>
    </div>
  )
}
