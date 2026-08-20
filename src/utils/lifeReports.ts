import { todayStr } from '../modules/taskflow/dateUtils.ts'

export type LifeReportPeriod = 'weekly' | 'monthly'

export interface LifeReportInput {
  period: LifeReportPeriod
  referenceDate?: string
  tasks: Array<{ id: string; title: string; status: string; completedAt?: string | null; dueDate?: string | null; priority?: string; category?: string }>
  habits: Array<{ id: string; name: string; completedDates: string[] }>
  pomodoroSessions: Array<{ completed: boolean; type: string; startedAt: number; duration?: number }>
  notes: Array<{ id: string; title: string; content: string; updatedAt: number }>
  projects: Array<{ id: string; name: string }>
}

export interface LifeReport {
  title: string
  markdown: string
  metrics: {
    completedTasks: number
    overdueTasks: number
    focusSessions: number
    habitChecks: number
    notesUpdated: number
  }
}

function parseDay(date: string): number {
  return Date.parse(`${date}T00:00:00+08:00`)
}

function inRangeDay(value: string | number | null | undefined, start: number, end: number): boolean {
  if (!value) return false
  const time = typeof value === 'number' ? value : Date.parse(value)
  return !Number.isNaN(time) && time >= start && time <= end
}

function monthStart(referenceDate: string): number {
  return parseDay(`${referenceDate.slice(0, 7)}-01`)
}

function rangeFor(period: LifeReportPeriod, referenceDate: string): { start: number; end: number; label: string; suggestionTitle: string; doneTitle: string } {
  const end = parseDay(referenceDate) + 24 * 60 * 60 * 1000 - 1
  if (period === 'monthly') {
    return { start: monthStart(referenceDate), end, label: referenceDate.slice(0, 7), suggestionTitle: '下月建议', doneTitle: '本月完成' }
  }
  return { start: parseDay(referenceDate) - 6 * 24 * 60 * 60 * 1000, end, label: referenceDate, suggestionTitle: '下周建议', doneTitle: '本周完成' }
}

function listLines(items: string[], empty: string): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`
}

export function buildLifeReport(input: LifeReportInput): LifeReport {
  const referenceDate = input.referenceDate || todayStr()
  const range = rangeFor(input.period, referenceDate)
  const completedTasks = input.tasks.filter((task) => task.status === 'done' && inRangeDay(task.completedAt, range.start, range.end))
  const overdueTasks = input.tasks.filter((task) => task.status !== 'done' && task.dueDate && Date.parse(task.dueDate) < range.end)
  const focusSessions = input.pomodoroSessions.filter((session) => session.completed && session.type === 'work' && inRangeDay(session.startedAt, range.start, range.end))
  const habitChecks = input.habits.reduce((sum, habit) => sum + habit.completedDates.filter((date) => inRangeDay(date, range.start, range.end)).length, 0)
  const notesUpdated = input.notes.filter((note) => inRangeDay(note.updatedAt, range.start, range.end))
  const activeProjects = input.projects.map((project) => ({
    project,
    total: input.tasks.filter((task) => task.category === project.id).length,
    open: input.tasks.filter((task) => task.category === project.id && task.status !== 'done').length,
  })).filter((item) => item.total > 0)
  const periodName = input.period === 'monthly' ? '月报' : '周报'
  const title = `${periodName} - ${range.label}`
  const suggestion = overdueTasks[0]?.title || completedTasks[0]?.title || '先选一个最重要项目推进 25 分钟'

  const markdown = `# ${title}

## 核心指标
- 完成任务：${completedTasks.length}
- 逾期任务：${overdueTasks.length}
- 专注番茄：${focusSessions.length}
- 习惯打卡：${habitChecks}
- 更新笔记：${notesUpdated.length}

## ${range.doneTitle}
${listLines(completedTasks.map((task) => task.title), '暂无完成任务')}

## 拖延 / 风险
${listLines(overdueTasks.map((task) => task.title), '暂无逾期任务')}

## 项目概览
${listLines(activeProjects.map((item) => `${item.project.name}：${item.total - item.open}/${item.total} 完成，剩余 ${item.open}`), '暂无活跃项目')}

## ${range.suggestionTitle}
- 优先处理：${suggestion}
- 保留一个 25 分钟专注块处理最小下一步。
`

  return {
    title,
    markdown,
    metrics: {
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      focusSessions: focusSessions.length,
      habitChecks,
      notesUpdated: notesUpdated.length,
    },
  }
}
