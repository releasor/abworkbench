import assert from 'node:assert/strict'
import test from 'node:test'
import { importLegacyTasks } from './importFromTaskflow.ts'

test('imports title status dueDate description into personal space', () => {
  const out = importLegacyTasks({
    projectId: 'p1',
    authorId: 'u1',
    nowIso: '2026-08-21T00:00:00.000Z',
    legacyTasks: [
      {
        id: 'old1',
        title: 'A',
        description: 'd',
        status: 'in-progress',
        dueDate: '2026-08-22',
        energyLevel: 'high',
      },
    ],
  })
  assert.equal(out.length, 1)
  assert.equal(out[0].space, 'personal')
  assert.equal(out[0].status, 'doing')
  assert.equal(out[0].title, 'A')
  assert.equal(out[0].dueDate, '2026-08-22')
  assert.equal(out[0].description, 'd')
  assert.equal(out[0].authorId, 'u1')
  assert.ok(!('energyLevel' in out[0]))
})
