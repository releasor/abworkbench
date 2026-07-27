import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSmartTaskPlan, mergeSmartPlanIntoTask } from './smartPlanner.ts'

test('buildSmartTaskPlan splits a large task into actionable subtasks', () => {
  const plan = buildSmartTaskPlan({
    title: '完成工作台全局命令中心增强',
    description: '需要支持新建任务、搜索笔记、启动番茄钟、切换主题。',
  })

  assert.equal(plan.subtasks.length >= 3, true)
  assert.equal(plan.subtasks.length <= 5, true)
  assert.match(plan.nextAction, /明确|整理|打开|列出/)
  assert.equal(typeof plan.estimatedMinutes, 'number')
  assert.equal(['low', 'medium', 'high'].includes(plan.energyLevel), true)
})

test('mergeSmartPlanIntoTask keeps completed subtasks and fills smart fields', () => {
  const task = {
    nextAction: '',
    estimatedMinutes: null,
    energyLevel: 'medium',
    subtasks: [
      { id: 'done', title: '已有完成步骤', completed: true, createdAt: '2026-06-09T00:00:00.000Z' },
    ],
  }
  const merged = mergeSmartPlanIntoTask(task, {
    nextAction: '列出输入入口',
    estimatedMinutes: 90,
    energyLevel: 'high',
    subtasks: ['列出输入入口', '补测试', '接入 UI'],
  }, '2026-06-09T01:00:00.000Z')

  assert.equal(merged.nextAction, '列出输入入口')
  assert.equal(merged.estimatedMinutes, 90)
  assert.equal(merged.energyLevel, 'high')
  assert.equal(merged.subtasks.some((subtask) => subtask.id === 'done' && subtask.completed), true)
  assert.equal(merged.subtasks.some((subtask) => subtask.title === '补测试'), true)
})
