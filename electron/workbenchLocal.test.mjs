import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { getWorkbenchLocalPath, loadWorkbenchLocal, saveWorkbenchLocal } from './workbenchLocal.ts'

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'abwb-workbench-local-'))
}

test('getWorkbenchLocalPath joins workbench-local.json', () => {
  assert.equal(getWorkbenchLocalPath('/tmp/userdata'), path.join('/tmp/userdata', 'workbench-local.json'))
})

test('loadWorkbenchLocal returns null when file is missing', () => {
  const dir = makeTempDir()
  assert.equal(loadWorkbenchLocal(dir), null)
})

test('loadWorkbenchLocal returns null when JSON is corrupt', () => {
  const dir = makeTempDir()
  fs.writeFileSync(getWorkbenchLocalPath(dir), '{not-json', 'utf-8')
  assert.equal(loadWorkbenchLocal(dir), null)
})

test('save then load roundtrips plain JSON', () => {
  const dir = makeTempDir()
  const payload = {
    user: { id: 'u1', displayName: 'Ada' },
    projects: [{ id: 'p1', name: 'Alpha' }],
    tasks: [],
  }
  saveWorkbenchLocal(dir, payload)
  assert.deepEqual(loadWorkbenchLocal(dir), payload)
  const raw = fs.readFileSync(getWorkbenchLocalPath(dir), 'utf-8')
  assert.ok(raw.includes('\n'))
  assert.ok(!fs.existsSync(`${getWorkbenchLocalPath(dir)}.tmp`))
})

test('saveWorkbenchLocal overwrites existing file', () => {
  const dir = makeTempDir()
  saveWorkbenchLocal(dir, { v: 1 })
  saveWorkbenchLocal(dir, { v: 2 })
  assert.deepEqual(loadWorkbenchLocal(dir), { v: 2 })
})
