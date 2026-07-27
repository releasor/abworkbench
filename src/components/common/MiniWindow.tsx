import { useEffect, useMemo, useState, useCallback } from 'react'
import { Bell, ClipboardPlus, ExternalLink, Timer, Zap, Check } from 'lucide-react'
import { useStore } from '../../store'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { buildMiniWindowModel, type MiniReminder } from './miniWindowModel'
import { safeGet } from '../../utils/safeLocalStorage'

interface MiniWindowProps {
  onOpenQuickCapture: () => void
}

function readReminders(): MiniReminder[] {
  return safeGet<MiniReminder[]>('abworkbench-reminders', [])
}

export default function MiniWindow({ onOpenQuickCapture }: MiniWindowProps) {
  const tasks = useTaskStore((state) => state.tasks)
  const fetchTasks = useTaskStore((state) => state.fetchTasks)
  const updateTask = useTaskStore((state) => state.updateTask)

  const handleComplete = useCallback(async (taskId: string) => {
    try {
      await updateTask(taskId, { status: 'done', completedAt: new Date().toISOString() })
    } catch { /* ignore */ }
  }, [updateTask])
  const pomodoroSessions = useStore((state) => state.pomodoroSessions)
  const [reminders, setReminders] = useState<MiniReminder[]>(readReminders)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    const refresh = () => setReminders(readReminders())
    const id = setInterval(refresh, 30_000)
    window.addEventListener('storage', refresh)
    return () => {
      clearInterval(id)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const model = useMemo(() => buildMiniWindowModel({
    now,
    tasks,
    reminders,
    pomodoroSessions,
  }), [now, pomodoroSessions, reminders, tasks])

  return (
    <div className="min-h-screen bg-black p-4 text-white">
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-blue-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500 p-2">
              <Zap size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black">Abworkbench Mini</h1>
              <p className="text-xs text-slate-400">悬浮工作小窗</p>
            </div>
          </div>
          <button onClick={onOpenQuickCapture} className="rounded-xl bg-blue-500 px-3 py-2 text-sm font-semibold hover:bg-blue-600">
            <ClipboardPlus size={16} className="mr-1 inline" />
            捕获
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
            <Timer className="text-emerald-400" size={20} />
            <div className="mt-2 text-2xl font-black">{model.todayFocus}</div>
            <div className="text-xs text-slate-400">当前番茄 / 今日完成</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
            <Bell className="text-blue-400" size={20} />
            <div className="mt-2 truncate text-sm font-black">{model.nextReminder ? model.nextReminder.title : '无提醒'}</div>
            <div className="text-xs text-slate-400">下一提醒</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
          <div className="text-xs font-semibold text-emerald-300">当前专注</div>
          <div className="mt-1 line-clamp-2 text-sm font-black text-white">
            {model.activeTask ? model.activeTask.title : '暂无正在计时的任务'}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>今日三件事</span>
            <span className="text-xs text-slate-500">置顶 / 到期</span>
          </div>
          {model.topTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">
              今天没有置顶或到期任务。
            </div>
          ) : model.topTasks.map((task) => (
            <div key={task.id} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start gap-2">
                <button
                  onClick={() => handleComplete(task.id)}
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/40 text-emerald-400 transition hover:bg-emerald-500 hover:text-white"
                  title="标记完成"
                >
                  <Check size={12} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 font-semibold">{task.title}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{task.priority}</span>
                    <span>{task.dueDate || '置顶'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onOpenQuickCapture} className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.08]">
          <ClipboardPlus size={16} className="mr-2 inline" />
          快速捕获
        </button>

        <button onClick={() => window.electronAPI?.showMainWindow?.()} className="mt-4 w-full rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-300 hover:bg-blue-500/15">
          <ExternalLink size={16} className="mr-2 inline" />
          回到任务流
        </button>
      </div>
    </div>
  )
}
