import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBlockerSummary,
  buildCompletionReviewSentence,
  createCompletionReviewNote,
  shouldAddCompletionReview,
} from './taskWorkflow.ts'

const baseTask = {
  id: 't1',
  title: '整理项目交付清单',
  status: 'in-progress',
  blockerReason: '',
  dependencies: [],
  estimatedMinutes: 60,
  nextAction: '确认验收项',
  timeEntries: [],
  notes: [],
}

test('buildBlockerSummary prefers explicit blocker reason and dependency titles', () => {
  const summary = buildBlockerSummary({
    task: {
      ...baseTask,
      blockerReason: '等待设计稿确认',
      dependencies: [{ id: 'd1', taskId: 't1', dependsOnId: 't0', type: 'blocked-by' }],
    },
    dependencyTitles: ['设计稿定稿'],
  })

  assert.deepEqual(summary, {
    isBlocked: true,
    reason: '等待设计稿确认',
    dependencyTitles: ['设计稿定稿'],
    label: '被 1 个任务阻塞：等待设计稿确认',
  })
})

test('buildCompletionReviewSentence summarizes done work, time and next action', () => {
  const sentence = buildCompletionReviewSentence({
    task: {
      ...baseTask,
      status: 'done',
      timeEntries: [{ id: 'e1', startTime: '2026-06-09T08:00:00', endTime: '2026-06-09T09:00:00', duration: 3600, description: '' }],
    },
  })

  assert.equal(sentence, '已完成「整理项目交付清单」，实际用时 60 分钟；下一步：确认验收项。')
})

test('createCompletionReviewNote avoids duplicate automatic reviews', () => {
  const note = createCompletionReviewNote({
    task: baseTask,
    nowIso: '2026-06-09T10:00:00.000Z',
  })

  assert.equal(note.content, '自动复盘：已完成「整理项目交付清单」，预计用时 60 分钟；下一步：确认验收项。')
  assert.equal(note.createdAt, '2026-06-09T10:00:00.000Z')
  assert.equal(shouldAddCompletionReview({ ...baseTask, notes: [note] }), false)
})
