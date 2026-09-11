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

test('workbench host: deleteMainlineTask requires x-user-id header', async () => {
  stopWorkbenchHost()

  const started = await startWorkbenchHost({
    hostUser: { id: 'host', displayName: 'Host' },
  })

  const project = {
    id: 'p1',
    name: 'Alpha',
    leadIds: ['host'],
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
  }
  hostShareProject(project, [
    {
      id: 'team-1',
      projectId: 'p1',
      space: 'mainline',
      title: 'Team task',
      status: 'doing',
      authorId: 'host',
      order: 0,
      updatedAt: '2026-08-21T00:00:00.000Z',
    },
  ])

  const missingHeader = await request(started.port, 'POST', '/command', {
    body: { op: 'deleteMainlineTask', projectId: 'p1', taskId: 'team-1' },
  })
  assert.equal(missingHeader.status, 403)
  assert.equal(missingHeader.body.error, 'missing or unknown x-user-id')

  const deleted = await request(started.port, 'POST', '/command', {
    body: { op: 'deleteMainlineTask', projectId: 'p1', taskId: 'team-1' },
    headers: { 'x-user-id': 'host' },
  })
  assert.equal(deleted.status, 200)
  assert.equal(deleted.body.ok, true)

  const snap = await request(started.port, 'GET', '/projects/p1/snapshot')
  assert.equal(snap.body.mainline.length, 0)

  stopWorkbenchHost()
  assert.equal(getWorkbenchHostStatus().running, false)
})
