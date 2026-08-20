import assert from 'node:assert/strict'
import test from 'node:test'

import { WORKSPACE_MODE_OPTIONS, getWorkspaceModeOption } from './workspaceModes.ts'

test('workspace mode options include focus, deep, night, minimal and dashboard modes', () => {
  assert.deepEqual(WORKSPACE_MODE_OPTIONS.map((item) => item.mode), [
    'focus',
    'deep',
    'night',
    'minimal',
    'dashboard',
  ])
  assert.equal(getWorkspaceModeOption('minimal').label, '极简工作台')
  assert.equal(getWorkspaceModeOption('deep').label, '深度工作')
})

