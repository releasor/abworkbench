import type { Task } from '../types'
import { getTimeSpentTotal } from '../hooks/useTaskStore'

export interface EstimationAccuracyRow {
  taskId: string
  title: string
  estimatedMinutes: number
  actualMinutes: number
  varianceMinutes: number
  variancePercent: number
}

export interface EstimationAccuracySummary {
  rows: EstimationAccuracyRow[]
  totalEstimated: number
  totalActual: number
  overallVariancePercent: number
  averageAbsoluteError: number
  tendency: 'underestimate' | 'overestimate' | 'accurate'
  tendencyLabel: string
  accuracyScore: number // 0-100, higher = better
}

export function buildEstimationAccuracy(tasks: Task[]): EstimationAccuracySummary {
  const rows: EstimationAccuracyRow[] = []

  for (const task of tasks) {
    if (task.estimatedMinutes === null || task.estimatedMinutes <= 0) continue
    const actualSeconds = getTimeSpentTotal(task)
    if (actualSeconds <= 0) continue

    const actualMinutes = Math.round(actualSeconds / 60)
    const varianceMinutes = actualMinutes - task.estimatedMinutes
    const variancePercent = Math.round((varianceMinutes / task.estimatedMinutes) * 100)

    rows.push({
      taskId: task.id,
      title: task.title,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes,
      varianceMinutes,
      variancePercent,
    })
  }

  const totalEstimated = rows.reduce((sum, r) => sum + r.estimatedMinutes, 0)
  const totalActual = rows.reduce((sum, r) => sum + r.actualMinutes, 0)
  const overallVariancePercent = totalEstimated > 0 ? Math.round(((totalActual - totalEstimated) / totalEstimated) * 100) : 0
  const averageAbsoluteError = rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + Math.abs(r.varianceMinutes), 0) / rows.length) : 0

  let tendency: 'underestimate' | 'overestimate' | 'accurate' = 'accurate'
  let tendencyLabel = '预估准确'
  if (overallVariancePercent > 15) {
    tendency = 'underestimate'
    tendencyLabel = `平均低估 ${overallVariancePercent}%`
  } else if (overallVariancePercent < -15) {
    tendency = 'overestimate'
    tendencyLabel = `平均高估 ${Math.abs(overallVariancePercent)}%`
  }

  // Accuracy score: 100 = perfect, penalize absolute error
  const avgVarianceRatio = rows.length > 0
    ? rows.reduce((sum, r) => sum + Math.abs(r.variancePercent), 0) / rows.length / 100
    : 0
  const accuracyScore = Math.max(0, Math.round(100 * (1 - Math.min(avgVarianceRatio, 1))))

  // Sort by absolute variance descending (worst first)
  rows.sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent))

  return {
    rows: rows.slice(0, 10), // top 10 worst
    totalEstimated,
    totalActual,
    overallVariancePercent,
    averageAbsoluteError,
    tendency,
    tendencyLabel,
    accuracyScore,
  }
}
