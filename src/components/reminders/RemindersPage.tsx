import { useMemo, useState } from 'react'
import { Bell, Check, Clock3, Plus, Trash2 } from 'lucide-react'
import { useSyncedLocalCollection } from '../../hooks/useSyncedLocalCollection'
import { showToast } from '../../modules/taskflow/utils/toastEvent'
import { useTick } from '../../hooks/useTick'
import { formatLocalDateTimeMinute } from '../../modules/taskflow/dateUtils'
import {
  type ReminderFilter,
  type ReminderRepeat,
  type WorkspaceReminder,
  completeReminder,
  filterReminders,
  snoozeReminderDueAt,
  snoozeToTomorrowNine,
  REMINDERS_KEY,
} from '../../utils/reminders'
import { generateId } from '../../utils/id'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { useTranslation } from '../../i18n'
import EmptyState from '../common/EmptyState'

const FILTERS: Array<{ id: ReminderFilter; label: string }> = [
  { id: 'overdue', label: '逾期' },
  { id: 'today', label: '今日' },
  { id: 'upcoming', label: '即将' },
  { id: 'all', label: '未完成' },
  { id: 'done', label: '已完成' },
]

const REPEAT_OPTIONS: Array<{ id: ReminderRepeat; label: string }> = [
  { id: 'once', label: '一次' },
  { id: 'daily', label: '每日' },
  { id: 'weekdays', label: '工作日' },
  { id: 'weekly', label: '每周' },
  { id: 'monthly', label: '每月' },
]

function formatDue(dueAt: string): string {
  if (!dueAt) return '未设置'
  const [date, time] = dueAt.split('T')
  return time ? `${date} ${time}` : date
}

export default function RemindersPage() {
  const { t } = useTranslation()
  const { items, add, update, remove, setItems } = useSyncedLocalCollection<WorkspaceReminder>(REMINDERS_KEY, [])
  const createTask = useTaskStore((s) => s.createTask)
  const categories = useTaskStore((s) => s.categories)
  const now = useTick(30_000).getTime()
  const [filter, setFilter] = useState<ReminderFilter>('all')
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState(() => formatLocalDateTimeMinute(new Date(Date.now() + 60 * 60 * 1000)))
  const [repeat, setRepeat] = useState<ReminderRepeat>('once')

  const visible = useMemo(() => filterReminders(items, filter, now), [items, filter, now])

  const create = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    add({
      id: `reminder-${generateId()}`,
      title: trimmed,
      dueAt: dueAt || formatLocalDateTimeMinute(new Date(Date.now() + 60 * 60 * 1000)),
      repeat,
      done: false,
    })
    setTitle('')
    showToast('已创建提醒', 'success')
  }

  const onComplete = (reminder: WorkspaceReminder) => {
    const patch = completeReminder(reminder)
    update(reminder.id, patch)
    showToast(patch.done ? '提醒已完成' : '已滚到下一期', 'success', {
      label: '撤销',
      onClick: () => update(reminder.id, { dueAt: reminder.dueAt, done: reminder.done }),
    }, 8_000)
  }

  const bulkSnooze = (mode: '30m' | '1h' | 'tomorrow9') => {
    const open = items.filter((r) => !r.done)
    if (open.length === 0) {
      showToast('没有未完成提醒', 'info')
      return
    }
    const dueAtNext = mode === '30m' ? snoozeReminderDueAt(30) : mode === '1h' ? snoozeReminderDueAt(60) : snoozeToTomorrowNine()
    setItems(items.map((r) => (r.done ? r : { ...r, dueAt: dueAtNext, done: false })))
    showToast(`已延后 ${open.length} 条提醒`, 'info')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-text">
            <Bell className="text-amber-400" size={22} />
            {t('reminders.title')}
          </h1>
          <p className="mt-1 text-sm text-text-muted">{t('reminders.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-lighter" onClick={() => bulkSnooze('30m')}>全部 +30分</button>
          <button type="button" className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-lighter" onClick={() => bulkSnooze('1h')}>全部 +1小时</button>
          <button type="button" className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-lighter" onClick={() => bulkSnooze('tomorrow9')}>全部到明天 9:00</button>
        </div>
      </div>

      <section className="rounded-shell border border-amber-500/20 bg-amber-500/5 p-4 shadow-xl shadow-black/5 backdrop-blur-xl">
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create() }}
            placeholder={t('reminders.placeholder')}
            className="rounded-2xl border border-border bg-surface-light px-3 py-2 text-sm text-text outline-none focus:border-primary"
          />
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="rounded-2xl border border-border bg-surface-light px-3 py-2 text-sm text-text outline-none focus:border-primary"
          />
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}
            className="rounded-2xl border border-border bg-surface-light px-3 py-2 text-sm text-text outline-none focus:border-primary"
          >
            {REPEAT_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
          <button type="button" onClick={create} className="inline-flex items-center justify-center gap-1 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            <Plus size={16} /> {t('reminders.add')}
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === f.id ? 'bg-amber-500/20 text-amber-300' : 'bg-surface-lighter text-text-muted hover:bg-surface-light'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t('reminders.empty')}
            description={t('reminders.emptyHint')}
            actionLabel={t('reminders.add')}
            onAction={() => { document.querySelector<HTMLInputElement>('input[placeholder]')?.focus() }}
          />
        ) : visible.map((reminder) => {
          const dueMs = Date.parse(reminder.dueAt.includes('+') || reminder.dueAt.endsWith('Z') ? reminder.dueAt : reminder.dueAt)
          const overdue = !reminder.done && Number.isFinite(dueMs) && dueMs < now
          return (
            <div
              key={reminder.id}
              className={`flex flex-wrap items-center gap-2 rounded-panel border bg-surface/70 px-4 py-3 ${
                overdue ? 'border-danger/40' : 'border-border'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm font-semibold ${reminder.done ? 'text-text-muted line-through' : 'text-text'}`}>{reminder.title}</div>
                <div className={`mt-0.5 flex flex-wrap items-center gap-2 text-[11px] ${overdue ? 'text-danger' : 'text-text-muted'}`}>
                  <span className="inline-flex items-center gap-1"><Clock3 size={11} />{overdue ? '已逾期 · ' : ''}{formatDue(reminder.dueAt)}</span>
                  <span>{REPEAT_OPTIONS.find((r) => r.id === (reminder.repeat || 'once'))?.label || '一次'}</span>
                </div>
              </div>
              {!reminder.done && (
                <>
                  <button type="button" className="rounded-xl bg-surface-lighter px-2 py-1 text-[10px] font-semibold text-text-muted hover:bg-surface-light" onClick={() => update(reminder.id, { dueAt: snoozeReminderDueAt(30), done: false })}>+30分</button>
                  <button type="button" className="rounded-xl bg-surface-lighter px-2 py-1 text-[10px] font-semibold text-text-muted hover:bg-surface-light" onClick={() => update(reminder.id, { dueAt: snoozeToTomorrowNine(), done: false })}>明天9点</button>
                  <button
                    type="button"
                    className="rounded-xl bg-primary/15 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/25"
                    onClick={async () => {
                      await createTask({
                        title: reminder.title,
                        status: 'todo',
                        priority: 'medium',
                        category: reminder.projectId || categories[0]?.id || 'cat-work',
                        dueDate: reminder.dueAt.includes('T') ? `${reminder.dueAt}:00.000+08:00` : null,
                      })
                      update(reminder.id, { done: true })
                      showToast('已转为任务', 'success')
                    }}
                  >
                    转任务
                  </button>
                  <button type="button" className="rounded-xl bg-success/15 p-1.5 text-success hover:bg-success/25" title="完成" onClick={() => onComplete(reminder)}>
                    <Check size={14} />
                  </button>
                </>
              )}
              <button type="button" className="rounded-xl bg-surface-lighter p-1.5 text-text-muted hover:bg-danger/20 hover:text-danger" onClick={() => { remove(reminder.id); showToast('已删除提醒', 'info') }}>
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
