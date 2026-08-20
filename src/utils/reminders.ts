import { nextDateStr, nextDateStrN } from '../modules/taskflow/dateUtils.ts'
import { beijingDateTimeMinute, beijingParts, beijingWallToMs, beijingYMD } from './beijingTime.ts'
import { updateLocalCollection, readLocalCollection, writeLocalCollection } from './localData.ts'

export const REMINDERS_KEY = 'abworkbench-reminders'

export type ReminderRepeat = 'once' | 'daily' | 'weekly' | 'monthly' | 'weekdays'

export interface WorkspaceReminder {
  id: string
  title: string
  body?: string
  dueAt: string
  done?: boolean
  repeat?: ReminderRepeat | string
  projectId?: string
  taskId?: string
}

export type ReminderFilter = 'all' | 'overdue' | 'today' | 'upcoming' | 'done'

function padDue(date: Date): string {
  return beijingDateTimeMinute(date)
}

function addMonthsBeijing(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1 + months, 1))
  const dim = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate()
  const day = Math.min(d, dim)
  const yy = base.getUTCFullYear()
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Roll dueAt forward for repeating reminders (Beijing calendar). */
export function nextReminderDueAt(dueAt: string, repeat: ReminderRepeat | string | undefined): string | null {
  const r = (repeat || 'once') as ReminderRepeat
  if (r === 'once') return null
  const ms = beijingWallToMs(dueAt.includes('T') ? dueAt : `${dueAt}T09:00`)
  const base = Number.isFinite(ms) ? new Date(ms) : new Date()
  const parts = beijingParts(base)
  const ymd = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
  const hm = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`

  if (r === 'daily') return `${nextDateStr(ymd)}T${hm}`
  if (r === 'weekly') return `${nextDateStrN(ymd, 7)}T${hm}`
  if (r === 'monthly') return `${addMonthsBeijing(ymd, 1)}T${hm}`
  if (r === 'weekdays') {
    let next = nextDateStr(ymd)
    for (let i = 0; i < 8; i++) {
      const [yy, mm, dd] = next.split('-').map(Number)
      const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
      let y = yy
      if (mm < 3) y--
      const w = (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[mm - 1] + dd) % 7
      if (w !== 0 && w !== 6) return `${next}T${hm}`
      next = nextDateStr(next)
    }
    return `${next}T${hm}`
  }
  return null
}

export function completeReminder(reminder: WorkspaceReminder): Partial<WorkspaceReminder> {
  const nextDue = nextReminderDueAt(reminder.dueAt, reminder.repeat)
  if (nextDue) return { dueAt: nextDue, done: false }
  return { done: true }
}

export function snoozeReminderDueAt(minutes: number, from = new Date()): string {
  return padDue(new Date(from.getTime() + minutes * 60_000))
}

export function snoozeToTomorrowNine(): string {
  const today = beijingYMD()
  const tomorrow = nextDateStr(today)
  return `${tomorrow}T09:00`
}

export function applyCompleteReminder(id: string): WorkspaceReminder | undefined {
  const items = readLocalCollection<WorkspaceReminder>(REMINDERS_KEY, [])
  const target = items.find((r) => r.id === id)
  if (!target) return undefined
  const patch = completeReminder(target)
  updateLocalCollection<WorkspaceReminder>(REMINDERS_KEY, id, patch)
  return { ...target, ...patch }
}

export function applySnoozeReminder(id: string, mode: '30m' | '1h' | 'tomorrow9'): WorkspaceReminder | undefined {
  const dueAt = mode === '30m' ? snoozeReminderDueAt(30) : mode === '1h' ? snoozeReminderDueAt(60) : snoozeToTomorrowNine()
  updateLocalCollection<WorkspaceReminder>(REMINDERS_KEY, id, { dueAt, done: false })
  return readLocalCollection<WorkspaceReminder>(REMINDERS_KEY, []).find((r) => r.id === id)
}

export function filterReminders(items: WorkspaceReminder[], filter: ReminderFilter, now = Date.now()): WorkspaceReminder[] {
  const today = beijingYMD(new Date(now))
  return items.filter((r) => {
    const dueMs = beijingWallToMs(r.dueAt.includes('T') ? r.dueAt : `${r.dueAt}T00:00`)
    const dueDay = Number.isFinite(dueMs) ? beijingYMD(new Date(dueMs)) : ''
    if (filter === 'done') return !!r.done
    if (r.done) return false
    if (filter === 'all') return true
    if (!Number.isFinite(dueMs)) return filter === 'upcoming'
    if (filter === 'overdue') return dueMs < now
    if (filter === 'today') return dueDay === today
    if (filter === 'upcoming') return dueMs >= now && dueDay !== today
    return true
  }).sort((a, b) => {
    const am = beijingWallToMs(a.dueAt) || 0
    const bm = beijingWallToMs(b.dueAt) || 0
    return am - bm
  })
}

export function upsertReminder(reminder: WorkspaceReminder) {
  const items = readLocalCollection<WorkspaceReminder>(REMINDERS_KEY, [])
  const idx = items.findIndex((r) => r.id === reminder.id)
  if (idx >= 0) {
    const next = items.slice()
    next[idx] = reminder
    writeLocalCollection(REMINDERS_KEY, next)
  } else {
    writeLocalCollection(REMINDERS_KEY, [reminder, ...items])
  }
}
