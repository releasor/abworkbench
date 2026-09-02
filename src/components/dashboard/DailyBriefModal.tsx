import { useMemo, useState } from 'react'
import { X, Zap, ClipboardPlus, Clock3, Target, CheckSquare } from 'lucide-react'
import { useStore } from '../../store'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { useToday } from '../../hooks/useToday'
import { useTick } from '../../hooks/useTick'
import { useSyncedLocalCollection } from '../../hooks/useSyncedLocalCollection'
import { type WorkspaceReminder, REMINDERS_KEY, snoozeReminderDueAt } from '../../utils/reminders'
import { beijingYMD } from '../../utils/beijingTime'
import { showToast } from '../../modules/taskflow/utils/toastEvent'

interface DailyBriefModalProps {
  isOpen: boolean
  mode?: 'morning' | 'evening'
  onClose: () => void
  onNavigate: (page: 'taskflow' | 'pomodoro' | 'habits' | 'reminders' | 'notes') => void
  onOpenQuickCapture: () => void
}

export default function DailyBriefModal({
  isOpen,
  mode = 'morning',
  onClose,
  onNavigate,
  onOpenQuickCapture,
}: DailyBriefModalProps) {
  const { todayStr, todayMidnightMs, tomorrowMidnightMs } = useToday()
  const tasks = useTaskStore((s) => s.tasks)
  const habits = useStore((s) => s.habits)
  const pomodoroSessions = useStore((s) => s.pomodoroSessions)
  const dailyPomodoroGoal = useStore((s) => s.dailyPomodoroGoal)
  const addNote = useStore((s) => s.addNote)
  const updateNote = useStore((s) => s.updateNote)
  const setActiveNote = useStore((s) => s.setActiveNote)
  const { items: reminders, setItems } = useSyncedLocalCollection<WorkspaceReminder>(REMINDERS_KEY, [])
  const [reviewText, setReviewText] = useState('')
  const nowMs = useTick(30_000).getTime()

  const model = useMemo(() => {
    const openTasks = tasks.filter((t) => !t.archived && t.status !== 'done')
    const overdue = openTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < todayStr).slice(0, 5)
    const dueToday = openTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) === todayStr).slice(0, 5)
    const incompleteHabits = habits.filter((h) => !h.completedDates.includes(todayStr))
    const todayPomodoros = pomodoroSessions.filter((s) => s.type === 'work' && s.completed && s.startedAt >= todayMidnightMs && s.startedAt < tomorrowMidnightMs).length
    const dueReminders = reminders.filter((r) => !r.done && Date.parse(r.dueAt) <= nowMs).slice(0, 5)
    const completedToday = tasks.filter((t) => t.status === 'done' && t.completedAt && Date.parse(t.completedAt) >= todayMidnightMs && Date.parse(t.completedAt) < tomorrowMidnightMs)
    return { overdue, dueToday, incompleteHabits, todayPomodoros, dueReminders, completedToday, firstTask: overdue[0] || dueToday[0] || openTasks[0] }
  }, [tasks, habits, pomodoroSessions, reminders, todayStr, todayMidnightMs, tomorrowMidnightMs, nowMs])

  if (!isOpen) return null

  const snoozeNonUrgent = () => {
    const next = snoozeReminderDueAt(60)
    setItems(reminders.map((r) => {
      if (r.done) return r
      const dueDay = beijingYMD(new Date(Date.parse(r.dueAt) || Date.now()))
      if (dueDay === todayStr || Date.parse(r.dueAt) < Date.now()) return { ...r, dueAt: next }
      return r
    }))
    showToast('已延后今日/逾期提醒 1 小时', 'info')
  }

  const saveEveningReview = () => {
    addNote()
    const note = useStore.getState().notes[0]
    if (!note) return
    const body = `# 每日复盘 ${todayStr}\n\n## 今天完成了什么\n${model.completedToday.map((t) => `- ${t.title}`).join('\n') || '- （无）'}\n\n## 哪里可以更好\n${reviewText || '- （待填写）'}\n\n## 明天最重要的一件事\n- \n`
    updateNote(note.id, { title: `复盘 ${todayStr}`, content: body })
    setActiveNote(note.id)
    onNavigate('notes')
    onClose()
    showToast('已生成复盘笔记', 'success')
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 modal-veil liquid-glass-veil" onClick={onClose} aria-label="关闭作战板" />
      <div className="liquid-glass-panel modal-panel-cinematic relative max-h-[88vh] w-full max-w-2xl overflow-auto p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-text">{mode === 'evening' ? '晚间复盘' : '今日作战板'}</h2>
            <p className="text-sm text-text-muted">{todayStr} · 北京时间</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-text-muted hover:bg-white/5"><X size={18} /></button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <section className="rounded-2xl liquid-glass-chip p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-text"><CheckSquare size={14} /> 今日 / 逾期任务</div>
            {[...model.overdue, ...model.dueToday].length === 0 ? (
              <p className="text-xs text-text-muted">暂无到期任务</p>
            ) : (
              <ul className="space-y-1">
                {[...model.overdue, ...model.dueToday].slice(0, 6).map((t) => (
                  <li key={t.id} className="truncate text-xs text-text">{t.title}</li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl liquid-glass-chip p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-text"><Clock3 size={14} /> 到期提醒</div>
            {model.dueReminders.length === 0 ? <p className="text-xs text-text-muted">无到期提醒</p> : (
              <ul className="space-y-1">{model.dueReminders.map((r) => <li key={r.id} className="truncate text-xs text-text">{r.title}</li>)}</ul>
            )}
          </section>
          <section className="rounded-2xl liquid-glass-chip p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-text"><Target size={14} /> 未完成习惯</div>
            {model.incompleteHabits.length === 0 ? <p className="text-xs text-text-muted">习惯都完成了</p> : (
              <ul className="space-y-1">{model.incompleteHabits.map((h) => <li key={h.id} className="truncate text-xs text-text">{h.name}</li>)}</ul>
            )}
          </section>
          <section className="rounded-2xl liquid-glass-chip p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-text"><Zap size={14} /> 番茄进度</div>
            <p className="text-2xl font-black text-text">{model.todayPomodoros}<span className="text-sm font-semibold text-text-muted"> / {dailyPomodoroGoal}</span></p>
          </section>
        </div>

        {mode === 'evening' ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl liquid-glass-chip p-3">
              <div className="mb-2 text-sm font-bold text-text">今日已完成 {model.completedToday.length} 项</div>
              <ul className="max-h-28 space-y-1 overflow-auto">
                {model.completedToday.slice(0, 12).map((t) => <li key={t.id} className="truncate text-xs text-text-muted">✓ {t.title}</li>)}
              </ul>
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="哪里可以更好？"
              className="min-h-[88px] w-full rounded-2xl liquid-glass-chip px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
            <button type="button" onClick={saveEveningReview} className="w-full rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">生成复盘笔记</button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-white"
              onClick={() => {
                if (model.firstTask) {
                  try { sessionStorage.setItem('taskflow-focus-task', model.firstTask.id) } catch { /* ignore */ }
                }
                onNavigate('taskflow')
                onClose()
              }}
            >
              <Zap size={14} /> 开始第一个任务
            </button>
            <button type="button" className="inline-flex items-center gap-1 rounded-2xl liquid-glass-chip px-3 py-2 text-sm font-semibold text-text" onClick={() => { onOpenQuickCapture(); onClose() }}>
              <ClipboardPlus size={14} /> 快速捕获
            </button>
            <button type="button" className="rounded-2xl liquid-glass-chip px-3 py-2 text-sm font-semibold text-text" onClick={snoozeNonUrgent}>延后提醒 1 小时</button>
            <button type="button" className="rounded-2xl liquid-glass-chip px-3 py-2 text-sm font-semibold text-text" onClick={() => { onNavigate('reminders'); onClose() }}>打开提醒中心</button>
            <button type="button" className="rounded-2xl liquid-glass-chip px-3 py-2 text-sm font-semibold text-text" onClick={() => { onNavigate('habits'); onClose() }}>去打卡</button>
          </div>
        )}
      </div>
    </div>
  )
}
