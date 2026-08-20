import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEEP_WORK_LOCKED_COMMAND_IDS,
  filterCommandsForWorkspaceMode,
  planWorkspaceModeEffects,
  readPersistedWorkspaceMode,
} from './workspaceModeEffects.ts'

test('planWorkspaceModeEffects enables DND and pomodoro when entering deep', () => {
  assert.deepEqual(planWorkspaceModeEffects('focus', 'deep'), {
    enableDnd: true,
    disableDnd: false,
    navigatePomodoro: true,
    startPomodoro: true,
  })
})

test('planWorkspaceModeEffects disables DND when leaving deep', () => {
  assert.deepEqual(planWorkspaceModeEffects('deep', 'night'), {
    enableDnd: false,
    disableDnd: true,
    navigatePomodoro: false,
    startPomodoro: false,
  })
})

test('planWorkspaceModeEffects is no-op when staying in deep', () => {
  assert.deepEqual(planWorkspaceModeEffects('deep', 'deep'), {
    enableDnd: false,
    disableDnd: false,
    navigatePomodoro: false,
    startPomodoro: false,
  })
})

test('filterCommandsForWorkspaceMode locks stealth reader in deep mode', () => {
  const commands = [
    { id: 'nav-pomodoro', label: '番茄', description: '', keywords: [] },
    { id: 'stealth-reader', label: '摸鱼', description: '', keywords: [] },
    { id: 'stealth-reader-library', label: '书架', description: '', keywords: [] },
  ]
  const filtered = filterCommandsForWorkspaceMode(commands, 'deep')
  assert.deepEqual(filtered.map((c) => c.id), ['nav-pomodoro'])
  assert.ok(DEEP_WORK_LOCKED_COMMAND_IDS.has('stealth-reader'))
})

test('readPersistedWorkspaceMode reads zustand persist blob', () => {
  const storage = {
    getItem: () => JSON.stringify({ state: { workspaceMode: 'deep' }, version: 0 }),
  }
  assert.equal(readPersistedWorkspaceMode(storage), 'deep')
  assert.equal(readPersistedWorkspaceMode({ getItem: () => null }), 'focus')
})
