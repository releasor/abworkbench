export type LifeInsightSeverity = 'low' | 'medium' | 'high'

export interface LifeInsight {
  id: string
  title: string
  detail: string
  action: string
  severity: LifeInsightSeverity
}

export interface LifeInsightInput {
  tasks: Array<{ id: string; title: string; status: string; dueDate?: string | null; priority?: string }>
  inboxOpen: number
  focusSessionsToday: number
  habits: Array<{ id: string; name: string; completedToday: boolean }>
  projectRisks: Array<{ projectName: string; riskLevel: string; reason: string }>
  now?: number
}

function isOverdue(task: LifeInsightInput['tasks'][number], now: number): boolean {
  if (!task.dueDate || task.status === 'done') return false
  const due = Date.parse(task.dueDate)
  return !Number.isNaN(due) && due < now
}

export function buildLifeInsights(input: LifeInsightInput): LifeInsight[] {
  const now = input.now ?? Date.now()
  const insights: LifeInsight[] = []
  const overdue = input.tasks.filter((task) => isOverdue(task, now))
  const urgent = input.tasks.filter((task) => task.status !== 'done' && (task.priority === 'urgent' || task.priority === 'high'))
  const missedHabits = input.habits.filter((habit) => !habit.completedToday)
  const highRiskProject = input.projectRisks.find((project) => project.riskLevel === 'high')

  if (overdue.length > 0) {
    insights.push({ id: 'overdue-tasks', title: '逾期任务需要收口', detail: `${overdue.length} 个任务已过期，优先处理 ${overdue[0].title}`, action: '打开任务流，先完成或改期最紧急的一项', severity: 'high' })
  }
  if (input.inboxOpen >= 5) {
    insights.push({ id: 'inbox-pile', title: '收件箱积压偏多', detail: `还有 ${input.inboxOpen} 条待处理采集`, action: '用智能收件箱先处理高优先和提醒类条目', severity: 'medium' })
  }
  if (input.focusSessionsToday === 0 && urgent.length > 0) {
    insights.push({ id: 'focus-empty', title: '今天还没有专注块', detail: `有 ${urgent.length} 个高优先任务，但今日专注为 0`, action: '立刻安排一个 25 分钟番茄钟', severity: 'medium' })
  }
  if (missedHabits.length > 0) {
    insights.push({ id: 'habit-gap', title: '习惯还没打卡', detail: `${missedHabits.slice(0, 2).map((habit) => habit.name).join('、')} 等待完成`, action: '先完成一个 2 分钟习惯，恢复连续性', severity: 'low' })
  }
  if (highRiskProject) {
    insights.push({ id: 'project-risk', title: `${highRiskProject.projectName} 项目有风险`, detail: highRiskProject.reason, action: '打开项目中枢，确认下一步和负责人', severity: 'high' })
  }

  return insights.sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.severity] - { high: 3, medium: 2, low: 1 }[a.severity])).slice(0, 5)
}
