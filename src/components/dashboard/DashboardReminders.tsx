import { Bell, Check, Clock3 } from 'lucide-react'
import { useState } from 'react'
import { useSyncedLocalCollection } from '../../hooks/useSyncedLocalCollection'
import { showToast } from '../../modules/taskflow/utils/toastEvent'
import { useTick } from '../../hooks/useTick'
import { formatLocalDateTimeMinute } from '../../modules/taskflow/dateUtils'
import {
  completeReminder,
  REMINDERS_KEY,
  type WorkspaceReminder,
} from '../../utils/reminders'

function formatDue(dueAt: string): string {
  const [date, time] = dueAt.split('T')
  return time ? `${date.slice(5)} ${time}` : dueAt
}

/** Compact open-reminder list for the dashboard (complete / snooze). */
export default function DashboardReminders() {
  const { items, update } = useSyncedLocalCollection<WorkspaceReminder>(REMINDERS_KEY, [])
  const [expanded, setExpanded] = useState(false)
  const now = useTick(60_000).getTime()
  const openAll = items
    .filter((item) => !item.done)
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
  const open = expanded ? openAll : openAll.slice(0, 5)

  if (openAll.length === 0) return null

  return (
    <section className="rounded-[28px] border border-amber-500/20 bg-amber-500/5 p-4 shadow-xl shadow-black/5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
        <Bell size={16} className="text-amber-400" />
        待办提醒
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          {openAll.length}
        </span>
        {openAll.length > 5 && (
          <button
            type="button"
            className="ml-auto text-[10px] font-medium text-amber-300/90 hover:text-amber-200"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '收起' : `展开全部 ${openAll.length} 条`}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {open.map((reminder) => {
          const dueMs = Date.parse(reminder.dueAt)
          const overdue = Number.isFinite(dueMs) && dueMs < now
          return (
            <div
              key={reminder.id}
              className="flex items-center gap-2 rounded-2xl border border-border bg-background/50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-text">{reminder.title}</div>
                <div className={`mt-0.5 flex items-center gap-1 text-[11px] ${overdue ? 'text-amber-400' : 'text-text-muted'}`}>
                  <Clock3 size={11} />
                  {overdue ? '已逾期 · ' : ''}{formatDue(reminder.dueAt)}
                </div>
              </div>
              <button
                type="button"
                className="rounded-xl bg-white/5 px-2 py-1 text-[10px] font-semibold text-text-muted hover:bg-white/10"
                onClick={() => {
                  const prevDueAt = reminder.dueAt
                  update(reminder.id, { dueAt: formatLocalDateTimeMinute(new Date(Date.now() + 30 * 60 * 1000)), done: false })
                  showToast('已延后 30 分钟', 'info', {
                    label: '撤销',
                    onClick: () => update(reminder.id, { dueAt: prevDueAt, done: false }),
                  }, 8_000)
                }}
              >
                +30分
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-500/15 p-1.5 text-emerald-400 hover:bg-emerald-500/25"
                title="完成提醒"
                onClick={() => {
                  const snapshot = { dueAt: reminder.dueAt, done: reminder.done }
                  update(reminder.id, completeReminder(reminder))
                  showToast('提醒已更新', 'success', {
                    label: '撤销',
                    onClick: () => update(reminder.id, snapshot),
                  }, 8_000)
                }}
              >
                <Check size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
