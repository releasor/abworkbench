export interface MiniTask {
  id: string
  title: string
  status: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  pinned: boolean
  archived: boolean
  dueDate: string | null
  timeEntries?: Array<{ endTime: string | null }>
}

export interface MiniReminder {
  id: string
  title: string
  dueAt: string
  done: boolean
}

export interface MiniPomodoroSession {
  id: string
  startedAt: number
  type: 'work' | 'break'
  completed: boolean
}

export interface MiniWindowModelInput {
  now: number
  tasks: MiniTask[]
  reminders: MiniReminder[]
  pomodoroSessions: MiniPomodoroSession[]
}

const PRIORITY_WEIGHT = { low: 1, medium: 2, high: 3, urgent: 4 }

function todayStr(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

function isTodayDue(task: MiniTask, now: number): boolean {
  return Boolean(task.dueDate && task.dueDate.slice(0, 10) === todayStr(now))
}

export function buildMiniWindowModel(input: MiniWindowModelInput) {
  const dayStart = new Date(input.now)
  dayStart.setHours(0, 0, 0, 0)

  const topTasks = input.tasks
    .filter((task) => task.status !== 'done' && !task.archived && (task.pinned || isTodayDue(task, input.now)))
    .sort((a, b) => {
      const priority = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
      if (priority !== 0) return priority
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return (a.dueDate || '').localeCompare(b.dueDate || '')
    })
    .slice(0, 3)

  const nextReminder = input.reminders
    .filter((reminder) => !reminder.done && Date.parse(reminder.dueAt) >= input.now)
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))[0] || null

  const todayFocus = input.pomodoroSessions.filter((session) => (
    session.type === 'work' &&
    session.completed &&
    session.startedAt >= dayStart.getTime()
  )).length

  const activeTask = input.tasks.find((task) => task.timeEntries?.some((entry) => !entry.endTime)) || null

  return { topTasks, nextReminder, todayFocus, activeTask }
}
