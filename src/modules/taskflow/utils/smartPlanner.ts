import type { EnergyLevel, Subtask } from '../types'

export interface SmartTaskPlanInput {
  title: string
  description?: string
}

export interface SmartTaskPlan {
  nextAction: string
  estimatedMinutes: number
  energyLevel: EnergyLevel
  subtasks: string[]
}

export interface SmartTaskMergeTarget {
  nextAction?: string
  estimatedMinutes?: number | null
  energyLevel?: EnergyLevel
  subtasks?: Subtask[]
}

const COMPLEX_HINTS = ['实现', '开发', '设计', '规划', '整理', '迁移', '复盘', '优化', '增强', '重构', '上线', '发布']
const HIGH_ENERGY_HINTS = ['实现', '开发', '重构', '上线', '发布', '架构', '排查', '修复']
const LOW_ENERGY_HINTS = ['整理', '归档', '记录', '阅读', '检查', '复盘']

function compactText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function splitRequirements(text: string): string[] {
  return text
    .split(/[，,、；;。\n]/)
    .map(compactText)
    .filter((part) => part.length >= 2)
    .slice(0, 4)
}

function inferEnergy(text: string): EnergyLevel {
  if (HIGH_ENERGY_HINTS.some((hint) => text.includes(hint))) return 'high'
  if (LOW_ENERGY_HINTS.some((hint) => text.includes(hint))) return 'low'
  return 'medium'
}

function inferEstimate(subtaskCount: number, energyLevel: EnergyLevel): number {
  const base = subtaskCount * 25
  if (energyLevel === 'high') return Math.max(90, base + 30)
  if (energyLevel === 'low') return Math.max(30, base)
  return Math.max(60, base + 15)
}

function buildSubtasks(title: string, description: string): string[] {
  const sourceParts = splitRequirements(description)
  const subtasks = [
    `明确「${title}」的完成标准`,
    ...sourceParts.map((part) => part.replace(/^(需要|支持|完成|实现)/, '').trim()).filter(Boolean).map((part) => `处理：${part}`),
    '补齐验证并整理收尾',
  ]

  const unique = [...new Set(subtasks)]
  if (unique.length >= 3) return unique.slice(0, 5)

  return [
    `明确「${title}」的完成标准`,
    '列出可执行步骤和依赖',
    '完成第一轮实现',
    '检查结果并收尾',
  ]
}

function buildNextAction(title: string, subtasks: string[]): string {
  const first = subtasks[0] || `明确「${title}」的完成标准`
  if (/明确|整理|打开|列出/.test(first)) return first
  return `列出「${title}」的第一步`
}

export function buildSmartTaskPlan(input: SmartTaskPlanInput): SmartTaskPlan {
  const title = compactText(input.title) || '未命名任务'
  const description = compactText(input.description || '')
  const fullText = `${title} ${description}`
  const hasComplexHint = COMPLEX_HINTS.some((hint) => fullText.includes(hint))
  const subtasks = hasComplexHint || description ? buildSubtasks(title, description) : [
    `明确「${title}」的完成标准`,
    '完成主要动作',
    '检查并标记完成',
  ]
  const energyLevel = inferEnergy(fullText)

  return {
    nextAction: buildNextAction(title, subtasks),
    estimatedMinutes: inferEstimate(subtasks.length, energyLevel),
    energyLevel,
    subtasks,
  }
}

export function mergeSmartPlanIntoTask<T extends SmartTaskMergeTarget>(task: T, plan: SmartTaskPlan, nowIso = new Date().toISOString()): T {
  const existing = task.subtasks || []
  const existingTitles = new Set(existing.map((subtask) => subtask.title))
  const plannedSubtasks: Subtask[] = plan.subtasks
    .filter((title) => !existingTitles.has(title))
    .map((title, index) => ({
      id: `smart-${Date.now().toString(36)}-${index}`,
      title,
      completed: false,
      createdAt: nowIso,
    }))

  return {
    ...task,
    nextAction: plan.nextAction,
    estimatedMinutes: plan.estimatedMinutes,
    energyLevel: plan.energyLevel,
    subtasks: [...existing, ...plannedSubtasks],
  }
}
