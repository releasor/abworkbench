export interface FocusDndReminder {
  title: string
  dueAt: string
}

export interface FocusDndTask {
  title: string
  nextAction?: string
  estimatedMinutes?: number | null
}

export interface FocusDndState {
  enabled: boolean
  badge: string
  summary: string
}

export function shouldMuteReminder(input: { enabled: boolean; reminder: FocusDndReminder; now?: number }): boolean {
  if (!input.enabled) return false
  const now = input.now ?? Date.now()
  const due = Date.parse(input.reminder.dueAt)
  if (!Number.isNaN(due) && due <= now) return false
  if (/紧急|urgent|截止|到期|马上|立即/i.test(input.reminder.title)) return false
  return true
}

export function buildFocusDndState(input: { enabled: boolean; task?: FocusDndTask | null }): FocusDndState {
  if (!input.enabled) return { enabled: false, badge: '正常提醒', summary: '提醒和通知正常显示' }
  const task = input.task
  if (!task) return { enabled: true, badge: '防打扰中', summary: '已静默非关键提醒' }
  const parts = [task.title, task.nextAction, task.estimatedMinutes ? `${task.estimatedMinutes} 分钟` : null].filter(Boolean)
  return { enabled: true, badge: '防打扰中', summary: parts.join(' · ') }
}
