interface ExecutionSubtask {
  id: string
  title: string
  completed: boolean
}

interface ExecutionDependency {
  id: string
  type: 'blocks' | 'blocked-by'
}

interface ExecutionTask {
  title: string
  nextAction?: string
  estimatedMinutes?: number | null
  energyLevel?: 'low' | 'medium' | 'high'
  blockerReason?: string
  subtasks?: ExecutionSubtask[]
  dependencies?: ExecutionDependency[]
}

export interface ExecutionModeModel {
  title: string
  currentStep: string
  nextStep: string
  focusHint: string
  progressLabel: string
  blockerCount: number
  blockerPrompt: string
  spentMinutes: number
  energyLabel: string
}

const ENERGY_LABELS = {
  low: '低精力',
  medium: '中精力',
  high: '高精力',
}

function minutesFromSeconds(seconds: number): number {
  return Math.max(0, Math.round(seconds / 60))
}

export function buildExecutionModeModel(input: { task: ExecutionTask; totalTimeSpentSeconds?: number }): ExecutionModeModel {
  const subtasks = input.task.subtasks || []
  const firstIncompleteIndex = subtasks.findIndex((subtask) => !subtask.completed)
  const completedCount = subtasks.filter((subtask) => subtask.completed).length
  const currentSubtask = firstIncompleteIndex >= 0 ? subtasks[firstIncompleteIndex] : null
  const nextSubtask = firstIncompleteIndex >= 0 ? subtasks.slice(firstIncompleteIndex + 1).find((subtask) => !subtask.completed) : null
  const nextAction = input.task.nextAction?.trim()
  const currentStep = currentSubtask?.title || nextAction || input.task.title
  const nextStep = nextSubtask?.title || '完成后记录结果'
  const blockerCount = (input.task.dependencies || []).filter((dependency) => dependency.type === 'blocked-by').length
  const blockerReason = input.task.blockerReason?.trim()

  return {
    title: input.task.title,
    currentStep,
    nextStep,
    focusHint: currentSubtask ? '继续当前未完成步骤' : nextAction ? '从下一步行动开始' : '先把任务推进到可执行状态',
    progressLabel: subtasks.length ? `${completedCount}/${subtasks.length} 子任务` : input.task.estimatedMinutes ? `预计 ${input.task.estimatedMinutes} 分钟` : '未设置估时',
    blockerCount,
    blockerPrompt: blockerReason
      ? `阻塞原因：${blockerReason}`
      : blockerCount > 0
        ? `有 ${blockerCount} 个阻塞关系，先确认依赖是否解除。`
        : '没有阻塞，适合直接推进。',
    spentMinutes: minutesFromSeconds(input.totalTimeSpentSeconds || 0),
    energyLabel: ENERGY_LABELS[input.task.energyLevel || 'medium'],
  }
}

export function buildCompletionReviewText(model: ExecutionModeModel): string {
  return `完成了：${model.title}\n用时：${model.spentMinutes} 分钟\n下一步：${model.nextStep}`
}
