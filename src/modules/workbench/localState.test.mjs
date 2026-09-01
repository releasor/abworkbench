import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyLocalState, reduceLocal } from './localState.ts'

const user = { id: 'u1', displayName: 'Ada' }

test('create project and personal task', () => {
  let s = createEmptyLocalState(user)
  s = reduceLocal(s, { type: 'project/create', name: 'Alpha', nowIso: '2026-08-21T00:00:00.000Z' })
  const projectId = s.projects[0].id
  s = reduceLocal(s, {
    type: 'task/createPersonal',
    projectId,
    title: 'Do thing',
    nowIso: '2026-08-21T00:00:01.000Z',
  })
  assert.equal(s.tasks.filter((t) => t.space === 'personal').length, 1)
})

test('offline promote moves copy to mainline with sourceTaskId', () => {
  let s = createEmptyLocalState(user)
  s = reduceLocal(s, { type: 'project/create', name: 'Alpha', nowIso: 't0' })
  const projectId = s.projects[0].id
  s = reduceLocal(s, { type: 'task/createPersonal', projectId, title: 'X', nowIso: 't1' })
  const personalId = s.tasks[0].id
  s = reduceLocal(s, {
    type: 'task/promoteToLocalMainline',
    taskId: personalId,
    actorId: 'u1',
    nowIso: 't2',
  })
  const main = s.tasks.find((t) => t.space === 'mainline')
  assert.ok(main)
  assert.equal(main.sourceTaskId, personalId)
  assert.equal(main.title, 'X')
  assert.ok(s.tasks.some((t) => t.id === personalId && t.space === 'personal'))
})

test('cannot promote the same personal task twice', () => {
  let s = createEmptyLocalState(user)
  s = reduceLocal(s, { type: 'project/create', name: 'Alpha', nowIso: 't0' })
  const projectId = s.projects[0].id
  s = reduceLocal(s, { type: 'task/createPersonal', projectId, title: 'X', nowIso: 't1' })
  const personalId = s.tasks[0].id
  s = reduceLocal(s, {
    type: 'task/promoteToLocalMainline',
    taskId: personalId,
    actorId: 'u1',
    nowIso: 't2',
  })
  const afterFirst = s.tasks.filter((t) => t.space === 'mainline').length
  s = reduceLocal(s, {
    type: 'task/promoteToLocalMainline',
    taskId: personalId,
    actorId: 'u1',
    nowIso: 't3',
  })
  assert.equal(s.tasks.filter((t) => t.space === 'mainline').length, afterFirst)
})

test('delete removes mainline task', () => {
  let s = createEmptyLocalState(user)
  s = reduceLocal(s, { type: 'project/create', name: 'Alpha', nowIso: 't0' })
  const projectId = s.projects[0].id
  s = reduceLocal(s, { type: 'task/createPersonal', projectId, title: 'X', nowIso: 't1' })
  const personalId = s.tasks[0].id
  s = reduceLocal(s, {
    type: 'task/promoteToLocalMainline',
    taskId: personalId,
    actorId: 'u1',
    nowIso: 't2',
  })
  const mainId = s.tasks.find((t) => t.space === 'mainline').id
  s = reduceLocal(s, { type: 'task/delete', taskId: mainId })
  assert.equal(s.tasks.filter((t) => t.space === 'mainline').length, 0)
  assert.ok(s.tasks.some((t) => t.id === personalId))
})

test('offline promote of another users personal is rejected', () => {
  let s = createEmptyLocalState(user)
  s = reduceLocal(s, { type: 'project/create', name: 'Alpha', nowIso: 't0' })
  const projectId = s.projects[0].id
  s = reduceLocal(s, { type: 'task/createPersonal', projectId, title: 'X', nowIso: 't1' })
  // forge foreign author
  s = {
    ...s,
    tasks: s.tasks.map((t) => ({ ...t, authorId: 'u2' })),
  }
  const before = s.tasks.length
  s = reduceLocal(s, {
    type: 'task/promoteToLocalMainline',
    taskId: s.tasks[0].id,
    actorId: 'u1',
    nowIso: 't2',
  })
  assert.equal(s.tasks.length, before)
  assert.equal(s.tasks.filter((t) => t.space === 'mainline').length, 0)
})
