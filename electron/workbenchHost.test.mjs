import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'

import {
  getWorkbenchHostStatus,
  hostShareProject,
  startWorkbenchHost,
  stopWorkbenchHost,
} from './workbenchHost.ts'

function request(port, method, path, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body)
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let json = null
          try {
            json = text ? JSON.parse(text) : null
          } catch {
            json = text
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json, text })
        })
      },
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

test('workbench host: start, join, share, snapshot, stop', async () => {
  stopWorkbenchHost()

  const started = await startWorkbenchHost({
    hostUser: { id: 'host', displayName: '主机' },
  })
  assert.equal(typeof started.port, 'number')
  assert.ok(started.port > 0)
  assert.match(started.roomCode, /^[A-Z0-9]{4}$/)
  assert.ok(Array.isArray(started.lanUrls))

  const status = getWorkbenchHostStatus()
  assert.equal(status.running, true)
  assert.equal(status.port, started.port)
  assert.equal(status.roomCode, started.roomCode)

  const join = await request(started.port, 'POST', '/join', {
    body: { user: { id: 'u2', displayName: 'Bob' }, passphrase: '' },
  })
  assert.equal(join.status, 200)
  assert.equal(join.body.ok, true)
  assert.ok(join.body.members.some((m) => m.id === 'u2'))
  assert.ok(join.body.members.some((m) => m.id === 'host'))

  const project = {
    id: 'p1',
    name: 'Alpha',
    leadIds: ['host'],
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
  }
  const mainlineSeed = [
    {
      id: 't1',
      projectId: 'p1',
      space: 'mainline',
      title: 'Seed',
      status: 'todo',
      authorId: 'host',
      order: 0,
      updatedAt: '2026-08-21T00:00:00.000Z',
    },
  ]
  const shared = hostShareProject(project, mainlineSeed)
  assert.equal(shared.ok, true)

  const snap = await request(started.port, 'GET', '/projects/p1/snapshot')
  assert.equal(snap.status, 200)
  assert.equal(snap.body.mainline.length, 1)
  assert.equal(snap.body.mainline[0].title, 'Seed')
  assert.deepEqual(snap.body.leadIds, ['host'])
  assert.ok(snap.body.members.some((m) => m.id === 'u2'))
  assert.deepEqual(snap.body.pool, [])

  const projects = await request(started.port, 'GET', '/projects')
  assert.equal(projects.status, 200)
  assert.deepEqual(projects.body, [{ id: 'p1', name: 'Alpha' }])

  stopWorkbenchHost()
  assert.equal(getWorkbenchHostStatus().running, false)

  await assert.rejects(
    () => request(started.port, 'GET', '/projects'),
    (err) => err && (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET'),
  )
})
