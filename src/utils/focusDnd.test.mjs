import assert from 'node:assert/strict'
import test from 'node:test'

import { buildFocusDndState, shouldMuteReminder } from './focusDnd.ts'

const now = Date.parse('2026-06-09T09:00:00+08:00')

test('shouldMuteReminder mutes non-critical reminders during DND', () => {
  assert.equal(shouldMuteReminder({ enabled: true, reminder: { title: '喝水', dueAt: '2026-06-09T10:00' }, now }), true)
  assert.equal(shouldMuteReminder({ enabled: true, reminder: { title: '紧急交付', dueAt: '2026-06-09T10:00' }, now }), false)
  assert.equal(shouldMuteReminder({ enabled: true, reminder: { title: '逾期', dueAt: '2026-06-09T08:00' }, now }), false)
  assert.equal(shouldMuteReminder({ enabled: false, reminder: { title: '喝水', dueAt: '2026-06-09T10:00' }, now }), false)
})

test('buildFocusDndState summarizes current focus task', () => {
  const state = buildFocusDndState({
    enabled: true,
    task: { title: '写周报', nextAction: '先列完成项', estimatedMinutes: 25 },
  })

  assert.equal(state.badge, '防打扰中')
  assert.equal(state.summary, '写周报 · 先列完成项 · 25 分钟')
})
