import type { PlanningHabit, PlanningPomodoroSession, PlanningTask, PlanningTone } from './todayPlanning'

export type TimeBlockItemType = 'task' | 'pomodoro' | 'habit' | 'free'

export interface TimeBlockItem {
  id: string
  type: TimeBlockItemType
  title: string
  meta: string
  tone: PlanningTone
}

export interface TimeBlock {
  hour: number
  label: string
  items: TimeBlockItem[]
}

export interface TodayTimeBlocksInput {
  todayStr: string
  todayMidnightMs: number
  tomorrowMidnightMs: number
  tasks: PlanningTask[]
  habits: PlanningHabit[]
  pomodoroSessions: PlanningPomodoroSession[]
  /** Manual hour placements keyed by task id (8–21). */
  hourOverrides?: Record<string, number>
}

export interface TodayTimeBlocks {
  blocks: TimeBlock[]
  scheduledCount: number
}

const PRIORITY_WEIGHT = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
}

function labelHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

function hourFromTimestamp(timestamp: number, todayMidnightMs: number): number {
  return Math.floor((timestamp - todayMidnightMs) / 3600000)
}

function pushIntoHour(blocks: TimeBlock[], hour: number, item: TimeBlockItem): boolean {
  const block = blocks.find((entry) => entry.hour === hour)
  if (!block) return false
  block.items.push(item)
  return true
}

function findLightestWorkHour(blocks: TimeBlock[], startHour: number, endHour: number): number {
  let bestHour = startHour
  let bestCount = Number.POSITIVE_INFINITY
  for (const block of blocks) {
    if (block.hour < startHour || block.hour > endHour) continue
    const count = block.items.length
    if (count < bestCount) {
      bestCount = count
      bestHour = block.hour
    }
  }
  return bestHour
}

export function buildTodayTimeBlocks(input: TodayTimeBlocksInput): TodayTimeBlocks {
  const blocks: TimeBlock[] = Array.from({ length: 14 }, (_, index) => {
    const hour = index + 8
    return { hour, label: labelHour(hour), items: [] }
  })

  for (const session of input.pomodoroSessions) {
    if (
      session.type === 'work' &&
      session.completed &&
      session.startedAt >= input.todayMidnightMs &&
      session.startedAt < input.tomorrowMidnightMs
    ) {
      const hour = hourFromTimestamp(session.startedAt, input.todayMidnightMs)
      pushIntoHour(blocks, hour, {
        id: `pomodoro-${session.id}`,
        type: 'pomodoro',
        title: '已完成番茄钟',
        meta: '专注记录',
        tone: 'success',
      })
    }
  }

  const scheduleTasks = input.tasks
    .filter((task) => !task.completed && task.dueDate && task.dueDate <= input.todayStr)
    .sort((a, b) => {
      const dueDiff = (a.dueDate || '').localeCompare(b.dueDate || '')
      if (dueDiff !== 0) return dueDiff
      return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
    })
    .slice(0, 6)

  for (const task of scheduleTasks) {
    const overrideHour = input.hourOverrides?.[task.id]
    const hour =
      typeof overrideHour === 'number'
        ? Math.min(21, Math.max(8, Math.round(overrideHour)))
        : findLightestWorkHour(blocks, 9, 16)
    pushIntoHour(blocks, hour, {
      id: `task-${task.id}`,
      type: 'task',
      title: task.title,
      meta:
        typeof overrideHour === 'number'
          ? '已手动排程'
          : task.dueDate && task.dueDate < input.todayStr
            ? '逾期任务'
            : '今日任务',
      tone: task.priority === 'urgent' || task.priority === 'high' ? 'danger' : 'primary',
    })
  }

  const pendingHabits = input.habits.filter((habit) => !habit.completedDates.includes(input.todayStr)).slice(0, 4)
  for (const habit of pendingHabits) {
    pushIntoHour(blocks, 18, {
      id: `habit-${habit.id}`,
      type: 'habit',
      title: habit.name,
      meta: '习惯打卡',
      tone: 'warning',
    })
  }

  const scheduledCount = blocks.reduce((sum, block) => sum + block.items.length, 0)
  return { blocks, scheduledCount }
}

