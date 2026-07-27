export type PlanningPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface PlanningTask {
  id: string
  title: string
  completed: boolean
  priority: PlanningPriority
  createdAt: number
  completedAt?: number
  dueDate?: string
}

export interface PlanningHabit {
  id: string
  name: string
  completedDates: string[]
}

export interface PlanningPomodoroSession {
  id: string
  startedAt: number
  endedAt: number
  type: 'work' | 'break'
  completed: boolean
}

export interface TodayPlanningInput {
  todayStr: string
  yesterdayStr: string
  todayMidnightMs: number
  tomorrowMidnightMs: number
  dailyPomodoroGoal: number
  tasks: PlanningTask[]
  habits: PlanningHabit[]
  pomodoroSessions: PlanningPomodoroSession[]
}

export type TodayPlanningMode = 'morning' | 'evening'
export type PlanningTone = 'danger' | 'warning' | 'success' | 'primary' | 'muted'

export interface PlanningItem {
  id: string
  text: string
  meta: string
  tone: PlanningTone
}

export interface PlanningSection {
  id: 'due' | 'carryover' | 'habits' | 'pomodoro' | 'completed' | 'delayed' | 'tomorrow'
  title: string
  items: PlanningItem[]
}

export interface TodayPlanningPanel {
  mode: TodayPlanningMode
  title: string
  headline: string
  sections: PlanningSection[]
}

const DAY = 86400000

const PRIORITY_WEIGHT: Record<PlanningPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
}

// Use pure arithmetic instead of Date objects for better performance
function addDays(dateStr: string, days: number): string {
  const [year, month, date] = dateStr.split('-').map(Number)
  const dayNum = Math.floor(Date.UTC(year, month - 1, date) / DAY) + days
  const d = new Date(dayNum * DAY)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function isTodayCompleted(task: PlanningTask, input: TodayPlanningInput): boolean {
  return Boolean(
    task.completed &&
    task.completedAt &&
    task.completedAt >= input.todayMidnightMs &&
    task.completedAt < input.tomorrowMidnightMs
  )
}

function isYesterdayCreated(task: PlanningTask, input: TodayPlanningInput): boolean {
  return task.createdAt >= input.todayMidnightMs - DAY && task.createdAt < input.todayMidnightMs
}

function getTodayWorkCount(input: TodayPlanningInput): number {
  let count = 0
  for (const session of input.pomodoroSessions) {
    if (
      session.type === 'work' &&
      session.completed &&
      session.startedAt >= input.todayMidnightMs &&
      session.startedAt < input.tomorrowMidnightMs
    ) {
      count++
    }
  }
  return count
}

function byPriorityThenNewest(a: PlanningTask, b: PlanningTask): number {
  const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
  if (priorityDiff !== 0) return priorityDiff
  return b.createdAt - a.createdAt
}

function byOldestDueThenPriority(a: PlanningTask, b: PlanningTask): number {
  const aDue = a.dueDate || '9999-12-31'
  const bDue = b.dueDate || '9999-12-31'
  if (aDue !== bDue) return aDue.localeCompare(bDue)
  const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
  if (priorityDiff !== 0) return priorityDiff
  return a.createdAt - b.createdAt
}

function dueLabel(dueDate: string, input: TodayPlanningInput): string {
  if (dueDate === input.todayStr) return '今天截止'
  if (dueDate === addDays(input.todayStr, 1)) return '明天截止'
  return `${dueDate.slice(5)} 截止`
}

function limitItems<T>(items: T[], max = 3): T[] {
  return items.slice(0, max)
}

export function buildMorningSuggestions(input: TodayPlanningInput): TodayPlanningPanel {
  const soonEnd = addDays(input.todayStr, 2)
  const dueTasks = limitItems(
    input.tasks
      .filter((task) => !task.completed && task.dueDate && task.dueDate >= input.todayStr && task.dueDate <= soonEnd)
      .sort(byPriorityThenNewest)
  )
  const carryoverTasks = limitItems(
    input.tasks
      .filter((task) => !task.completed && (isYesterdayCreated(task, input) || task.dueDate === input.yesterdayStr))
      .sort(byOldestDueThenPriority)
  )
  const pendingHabits = input.habits.filter((habit) => !habit.completedDates.includes(input.todayStr))
  const todayWorkCount = getTodayWorkCount(input)
  const pomodoroGap = Math.max(input.dailyPomodoroGoal - todayWorkCount, 0)
  const focusCount =
    (dueTasks.length > 0 ? 1 : 0) +
    (carryoverTasks.length > 0 ? 1 : 0) +
    (pendingHabits.length > 0 ? 1 : 0) +
    (pomodoroGap > 0 ? 1 : 0)

  return {
    mode: 'morning',
    title: '今日建议',
    headline: focusCount > 0 ? `发现 ${focusCount} 个重点，适合先排进今天。` : '今天很清爽，可以安排一个主动推进项。',
    sections: [
      {
        id: 'due',
        title: '临期任务',
        items: dueTasks.length > 0
          ? dueTasks.map((task) => ({
            id: task.id,
            text: `${task.title} · ${dueLabel(task.dueDate || input.todayStr, input)}`,
            meta: task.priority === 'urgent' ? '紧急优先' : task.priority === 'high' ? '高优先级' : '建议上午处理',
            tone: task.priority === 'urgent' || task.priority === 'high' ? 'danger' : 'warning',
          }))
          : [{ id: 'due-empty', text: '没有临期任务', meta: '可以留出整块时间推进重要事项', tone: 'muted' }],
      },
      {
        id: 'carryover',
        title: '昨天未完成',
        items: carryoverTasks.length > 0
          ? carryoverTasks.map((task) => ({
            id: task.id,
            text: `${task.title} · 建议先收尾`,
            meta: task.dueDate && task.dueDate < input.todayStr ? '已逾期' : '昨天留下',
            tone: task.dueDate && task.dueDate < input.todayStr ? 'danger' : 'warning',
          }))
          : [{ id: 'carryover-empty', text: '昨天没有遗留任务', meta: '开局干净', tone: 'success' }],
      },
      {
        id: 'habits',
        title: '今日习惯',
        items: pendingHabits.length > 0
          ? limitItems(pendingHabits).map((habit) => ({
            id: habit.id,
            text: `${habit.name} 还未打卡`,
            meta: '找一个 5 分钟窗口完成',
            tone: 'primary',
          }))
          : [{ id: 'habits-empty', text: '习惯已经全部完成', meta: '保持节奏', tone: 'success' }],
      },
      {
        id: 'pomodoro',
        title: '番茄目标',
        items: [{
          id: 'pomodoro-goal',
          text: pomodoroGap > 0 ? `还差 ${pomodoroGap} 个番茄达到今日目标` : '今日番茄目标已完成',
          meta: `已完成 ${todayWorkCount}/${input.dailyPomodoroGoal}`,
          tone: pomodoroGap > 0 ? 'primary' : 'success',
        }],
      },
    ],
  }
}

export function buildEveningReview(input: TodayPlanningInput): TodayPlanningPanel {
  const completedToday = limitItems(input.tasks.filter((task) => isTodayCompleted(task, input)).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)))
  const delayedTasks = limitItems(
    input.tasks
      .filter((task) => !task.completed && (task.dueDate ? task.dueDate < addDays(input.todayStr, 1) : task.createdAt < input.todayMidnightMs))
      .sort(byOldestDueThenPriority)
  )
  const tomorrowFirst = delayedTasks[0] || input.tasks.filter((task) => !task.completed).sort(byPriorityThenNewest)[0]
  const todayWorkCount = getTodayWorkCount(input)
  const completedCount = input.tasks.filter((task) => isTodayCompleted(task, input)).length

  return {
    mode: 'evening',
    title: '晚间复盘',
    headline: `今天完成 ${completedCount} 项任务，完成 ${todayWorkCount}/${input.dailyPomodoroGoal} 个番茄。`,
    sections: [
      {
        id: 'completed',
        title: '完成了什么',
        items: completedToday.length > 0
          ? completedToday.map((task) => ({
            id: task.id,
            text: task.title,
            meta: '今天已完成',
            tone: 'success',
          }))
          : [{ id: 'completed-empty', text: '今天还没有完成的任务记录', meta: '可以先补一个小收尾', tone: 'muted' }],
      },
      {
        id: 'delayed',
        title: '拖延了什么',
        items: delayedTasks.length > 0
          ? delayedTasks.map((task) => ({
            id: task.id,
            text: `${task.title} · 仍未完成`,
            meta: task.dueDate && task.dueDate < input.todayStr ? '已逾期' : '今天应处理',
            tone: task.dueDate && task.dueDate < input.todayStr ? 'danger' : 'warning',
          }))
          : [{ id: 'delayed-empty', text: '没有明显拖延项', meta: '今晚可以安心收束', tone: 'success' }],
      },
      {
        id: 'tomorrow',
        title: '明天建议',
        items: [{
          id: tomorrowFirst ? `tomorrow-${tomorrowFirst.id}` : 'tomorrow-empty',
          text: tomorrowFirst ? `明天先处理：${tomorrowFirst.title}` : '明天先安排一个最重要任务',
          meta: tomorrowFirst?.dueDate && tomorrowFirst.dueDate < input.todayStr ? '先清逾期' : '放到第一时间块',
          tone: tomorrowFirst ? 'primary' : 'muted',
        }],
      },
    ],
  }
}

export function buildTodayPlanning(input: TodayPlanningInput & { hour: number }): TodayPlanningPanel {
  return input.hour >= 18 ? buildEveningReview(input) : buildMorningSuggestions(input)
}

