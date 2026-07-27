import type { Priority, Status } from '../types'

export interface SchedulableTask {
  id: string
  title: string
  status: Status | string
  priority: Priority
  pinned?: boolean
  archived?: boolean
  dueDate?: string | null
  estimatedMinutes?: number | null
  nextAction?: string
}

export interface TodayScheduleInput {
  today: string
  tasks: SchedulableTask[]
  startHour?: number
  endHour?: number
}

export interface TodayScheduleItem {
  taskId: string
  title: string
  nextAction: string
  slotLabel: string
  estimatedMinutes: number
  risk: 'overdue' | 'today' | 'normal'
}

export interface TodaySchedule {
  items: TodayScheduleItem[]
  totalMinutes: number
  headline: string
}

const PRIORITY_WEIGHT: Record<Priority, number> = { low: 1, medium: 2, high: 3, urgent: 4 }

function dueDay(task: SchedulableTask): string {
  return task.dueDate ? task.dueDate.slice(0, 10) : ''
}

function urgencyScore(task: SchedulableTask, today: string): number {
  let score = PRIORITY_WEIGHT[task.priority] * 20
  if (task.pinned) score += 200
  const due = dueDay(task)
  if (due && due < today) score += 90
  else if (due === today) score += 70
  return score
}

function slotLabel(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function buildTodaySchedule(input: TodayScheduleInput): TodaySchedule {
  const startHour = input.startHour ?? 9
  const endHour = input.endHour ?? 18
  let cursorMinutes = startHour * 60
  const endMinutes = endHour * 60

  const candidates = input.tasks
    .filter((task) => task.status !== 'done' && !task.archived)
    .filter((task) => task.pinned || dueDay(task) <= input.today || task.priority === 'urgent' || task.priority === 'high')
    .sort((a, b) => urgencyScore(b, input.today) - urgencyScore(a, input.today) || (a.estimatedMinutes || 45) - (b.estimatedMinutes || 45))
    .slice(0, 6)

  const items: TodayScheduleItem[] = []
  for (const task of candidates) {
    if (cursorMinutes >= endMinutes) break
    const estimatedMinutes = Math.max(15, Math.min(task.estimatedMinutes || 45, 120))
    const hour = Math.floor(cursorMinutes / 60)
    const minute = cursorMinutes % 60
    const due = dueDay(task)
    items.push({
      taskId: task.id,
      title: task.title,
      nextAction: task.nextAction?.trim() || task.title,
      slotLabel: slotLabel(hour, minute),
      estimatedMinutes,
      risk: due && due < input.today ? 'overdue' : due === input.today ? 'today' : 'normal',
    })
    cursorMinutes += estimatedMinutes + 10
  }

  const totalMinutes = items.reduce((sum, item) => sum + item.estimatedMinutes, 0)
  return {
    items,
    totalMinutes,
    headline: items.length > 0 ? `今天建议先推进 ${items.length} 个任务，预计 ${totalMinutes} 分钟。` : '今天没有必须排程的高优先任务。',
  }
}
