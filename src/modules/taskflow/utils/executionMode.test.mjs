import assert from 'node:assert/strict'
import test from 'node:test'

import { buildExecutionModeModel, buildCompletionReviewText } from './executionMode.ts'

const baseTask = {
  id: 't1',
  title: '上线工作台优化',
  description: '完成第二批优化',
  status: 'in-progress',
  priority: 'high',
  nextAction: '',
  estimatedMinutes: 90,
  energyLevel: 'high',
  subtasks: [],
  dependencies: [],
  timeEntries: [],
}

test('buildExecutionModeModel focuses the first incomplete subtask', () => {
  const model = buildExecutionModeModel({
    task: {
      ...baseTask,
      subtasks: [
        { id: 's1', title: '写测试', completed: true, createdAt: '2026-06-09' },
        { id: 's2', title: '接入界面', completed: false, createdAt: '2026-06-09' },
        { id: 's3', title: '跑类型检查', completed: false, createdAt: '2026-06-09' },
      ],
    },
    totalTimeSpentSeconds: 1800,
  })

  assert.equal(model.currentStep, '接入界面')
  assert.equal(model.nextStep, '跑类型检查')
  assert.equal(model.progressLabel, '1/3 子任务')
  assert.equal(model.focusHint, '继续当前未完成步骤')
})

test('buildExecutionModeModel uses nextAction when no subtasks exist', () => {
  const model = buildExecutionModeModel({
    task: { ...baseTask, nextAction: '先整理验收点', subtasks: [] },
    totalTimeSpentSeconds: 0,
  })

  assert.equal(model.currentStep, '先整理验收点')
  assert.equal(model.nextStep, '完成后记录结果')
  assert.equal(model.focusHint, '从下一步行动开始')
})

test('buildExecutionModeModel reports blockers and completion review text', () => {
  const model = buildExecutionModeModel({
    task: {
      ...baseTask,
      blockerReason: '等待接口联调',
      dependencies: [{ id: 'd1', taskId: 't1', dependsOnId: 't0', type: 'blocked-by' }],
    },
    totalTimeSpentSeconds: 5400,
  })

  assert.equal(model.blockerCount, 1)
  assert.equal(model.blockerPrompt, '阻塞原因：等待接口联调')
  assert.equal(buildCompletionReviewText(model), '完成了：上线工作台优化\n用时：90 分钟\n下一步：完成后记录结果')
})
