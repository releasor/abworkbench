import http from 'node:http'
import os from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'

import {
  applyHostCommand,
  createHostRoom,
  type HostEvent,
  type HostRoomState,
} from '../src/modules/workbench/hostRoomState.ts'
import {
  decodeClientRequest,
  formatSseData,
  type ClientRequest,
} from '../src/modules/workbench/protocol.ts'
import type { WorkbenchProject, WorkbenchTask, WorkbenchUser } from '../src/modules/workbench/types.ts'

let server: http.Server | null = null
let room: HostRoomState | null = null
let sseClients: Set<ServerResponse> = new Set()
let port: number | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 4; i += 1) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]!
  }
  return code
}

function collectLanUrls(listenPort: number): string[] {
  const urls: string[] = []
  const ifaces = os.networkInterfaces()
  for (const entries of Object.values(ifaces)) {
    if (!entries) continue
    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        urls.push(`http://${entry.address}:${listenPort}`)
      }
    }
  }
  return urls
}

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id')
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  setCors(res)
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function broadcastEvents(events: HostEvent[]): void {
  if (!events.length || sseClients.size === 0) return
  for (const ev of events) {
    const chunk = formatSseData(ev)
    for (const client of [...sseClients]) {
      try {
        client.write(chunk)
      } catch {
        sseClients.delete(client)
      }
    }
  }
}

function applyAndBroadcast(
  command: Parameters<typeof applyHostCommand>[1],
): ReturnType<typeof applyHostCommand> {
  if (!room) {
    return { ok: false, error: 'not running', room: null as unknown as HostRoomState }
  }
  const result = applyHostCommand(room, command)
  room = result.room
  if (result.ok) broadcastEvents(result.events)
  return result
}

function listProjectsBody(): Array<{ id: string; name: string }> {
  if (!room) return []
  return Object.values(room.projects).map((b) => ({
    id: b.project.id,
    name: b.project.name,
  }))
}

function snapshotBody(projectId: string): {
  pool: WorkbenchTask[]
  mainline: WorkbenchTask[]
  leadIds: string[]
  members: WorkbenchUser[]
} | null {
  if (!room) return null
  const bundle = room.projects[projectId]
  if (!bundle) return null
  return {
    pool: bundle.pool,
    mainline: bundle.mainline,
    leadIds: bundle.project.leadIds,
    members: room.members,
  }
}

function memberIdFromHeader(req: IncomingMessage): string | null {
  const raw = req.headers['x-user-id']
  const id = Array.isArray(raw) ? raw[0] : raw
  if (!id || typeof id !== 'string') return null
  if (!room?.members.some((m) => m.id === id)) return null
  return id
}

export function hostApplyClientRequest(
  req: unknown,
  actorIdHint?: string,
): { ok: boolean; error?: string; body?: unknown } {
  if (!room) return { ok: false, error: 'not running' }

  let clientReq: ClientRequest
  try {
    if (typeof req === 'string') {
      clientReq = decodeClientRequest(req)
    } else {
      clientReq = decodeClientRequest(JSON.stringify(req))
    }
  } catch {
    return { ok: false, error: 'invalid request' }
  }

  const nowIso = new Date().toISOString()

  switch (clientReq.op) {
    case 'join':
      return { ok: false, error: 'use POST /join' }

    case 'listProjects':
      return { ok: true, body: listProjectsBody() }

    case 'getSnapshot': {
      const snap = snapshotBody(clientReq.projectId)
      if (!snap) return { ok: false, error: 'project not found' }
      return { ok: true, body: snap }
    }

    case 'shareProject': {
      const result = applyAndBroadcast({
        type: 'shareProject',
        project: clientReq.project,
        mainlineSeed: clientReq.mainlineSeed,
        nowIso,
      })
      return result.ok ? { ok: true } : { ok: false, error: result.error }
    }

    case 'submitToPool': {
      if (!actorIdHint) return { ok: false, error: 'missing x-user-id' }
      const result = applyAndBroadcast({
        type: 'submitToPool',
        actorId: actorIdHint,
        projectId: clientReq.projectId,
        task: clientReq.task,
        nowIso,
      })
      return result.ok ? { ok: true } : { ok: false, error: result.error }
    }

    case 'promote': {
      if (!actorIdHint) return { ok: false, error: 'missing x-user-id' }
      const result = applyAndBroadcast({
        type: 'promote',
        actorId: actorIdHint,
        projectId: clientReq.projectId,
        sourceTask: clientReq.sourceTask,
        nowIso,
      })
      return result.ok ? { ok: true } : { ok: false, error: result.error }
    }

    case 'updateMainlineTask': {
      if (!actorIdHint) return { ok: false, error: 'missing x-user-id' }
      const result = applyAndBroadcast({
        type: 'updateMainlineTask',
        actorId: actorIdHint,
        projectId: clientReq.projectId,
        taskId: clientReq.taskId,
        patch: clientReq.patch,
        nowIso,
      })
      return result.ok ? { ok: true } : { ok: false, error: result.error }
    }

    case 'deleteMainlineTask': {
      if (!actorIdHint) return { ok: false, error: 'missing x-user-id' }
      const result = applyAndBroadcast({
        type: 'deleteMainlineTask',
        actorId: actorIdHint,
        projectId: clientReq.projectId,
        taskId: clientReq.taskId,
        nowIso,
      })
      return result.ok ? { ok: true } : { ok: false, error: result.error }
    }

    case 'setLeads': {
      if (!actorIdHint) return { ok: false, error: 'missing x-user-id' }
      const result = applyAndBroadcast({
        type: 'setLeads',
        actorId: actorIdHint,
        projectId: clientReq.projectId,
        leadIds: clientReq.leadIds,
        nowIso,
      })
      return result.ok ? { ok: true } : { ok: false, error: result.error }
    }

    default:
      return { ok: false, error: 'unknown op' }
  }
}

export function hostShareProject(
  project: WorkbenchProject,
  mainlineSeed: WorkbenchTask[],
): { ok: boolean; error?: string } {
  if (!room) return { ok: false, error: 'not running' }
  const result = applyAndBroadcast({
    type: 'shareProject',
    project,
    mainlineSeed,
    nowIso: new Date().toISOString(),
  })
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCors(res)
  const method = req.method || 'GET'
  const url = new URL(req.url || '/', 'http://127.0.0.1')

  if (method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (!room) {
    sendJson(res, 503, { ok: false, error: 'not running' })
    return
  }

  if (method === 'POST' && url.pathname === '/join') {
    const raw = await readBody(req)
    let body: { user?: WorkbenchUser; passphrase?: string }
    try {
      body = JSON.parse(raw || '{}') as { user?: WorkbenchUser; passphrase?: string }
    } catch {
      sendJson(res, 400, { ok: false, error: 'invalid json' })
      return
    }
    if (!body.user?.id || !body.user.displayName) {
      sendJson(res, 400, { ok: false, error: 'user required' })
      return
    }
    const result = applyAndBroadcast({
      type: 'join',
      user: body.user,
      passphrase: body.passphrase ?? '',
      nowIso: new Date().toISOString(),
    })
    if (!result.ok) {
      sendJson(res, 403, { ok: false, error: result.error })
      return
    }
    sendJson(res, 200, { ok: true, members: result.room.members })
    return
  }

  if (method === 'GET' && url.pathname === '/projects') {
    sendJson(res, 200, listProjectsBody())
    return
  }

  const snapshotMatch = url.pathname.match(/^\/projects\/([^/]+)\/snapshot$/)
  if (method === 'GET' && snapshotMatch) {
    const projectId = decodeURIComponent(snapshotMatch[1]!)
    const snap = snapshotBody(projectId)
    if (!snap) {
      sendJson(res, 404, { ok: false, error: 'project not found' })
      return
    }
    sendJson(res, 200, snap)
    return
  }

  if (method === 'POST' && url.pathname === '/command') {
    const raw = await readBody(req)
    let parsed: unknown
    try {
      parsed = JSON.parse(raw || '{}')
    } catch {
      sendJson(res, 400, { ok: false, error: 'invalid json' })
      return
    }
    const op = (parsed as { op?: string })?.op
    const needsActor = op === 'submitToPool' || op === 'promote' || op === 'updateMainlineTask' || op === 'setLeads'
    const actorId = needsActor ? memberIdFromHeader(req) : undefined
    if (needsActor && !actorId) {
      sendJson(res, 403, { ok: false, error: 'missing or unknown x-user-id' })
      return
    }
    const result = hostApplyClientRequest(parsed, actorId ?? undefined)
    if (!result.ok) {
      const status = result.error === 'project not found' ? 404 : 403
      sendJson(res, status, { ok: false, error: result.error })
      return
    }
    sendJson(res, 200, { ok: true, ...(result.body !== undefined ? { body: result.body } : {}) })
    return
  }

  if (method === 'GET' && url.pathname === '/events') {
    setCors(res)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })
    res.write(': connected\n\n')
    sseClients.add(res)
    req.on('close', () => {
      sseClients.delete(res)
    })
    return
  }

  sendJson(res, 404, { ok: false, error: 'not found' })
}

function clearHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

export async function startWorkbenchHost(opts: {
  hostUser: { id: string; displayName: string }
  passphrase?: string
}): Promise<{ port: number; roomCode: string; lanUrls: string[] }> {
  stopWorkbenchHost()

  const roomCode = generateRoomCode()
  room = createHostRoom({
    hostUser: opts.hostUser,
    roomCode,
    passphrase: opts.passphrase ?? '',
    nowIso: new Date().toISOString(),
  })
  sseClients = new Set()

  const httpServer = http.createServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      try {
        sendJson(res, 500, {
          ok: false,
          error: err instanceof Error ? err.message : 'server error',
        })
      } catch {
        // ignore
      }
    })
  })

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(0, '0.0.0.0', () => resolve())
  })

  const addr = httpServer.address()
  if (!addr || typeof addr === 'string') {
    httpServer.close()
    room = null
    throw new Error('failed to bind workbench host port')
  }

  server = httpServer
  port = addr.port

  heartbeatTimer = setInterval(() => {
    for (const client of [...sseClients]) {
      try {
        client.write(': ping\n\n')
      } catch {
        sseClients.delete(client)
      }
    }
  }, 15_000)
  if (typeof heartbeatTimer === 'object' && 'unref' in heartbeatTimer) {
    heartbeatTimer.unref()
  }

  return {
    port: addr.port,
    roomCode,
    lanUrls: collectLanUrls(addr.port),
  }
}

export function stopWorkbenchHost(): void {
  clearHeartbeat()
  for (const client of sseClients) {
    try {
      client.end()
    } catch {
      // ignore
    }
  }
  sseClients = new Set()
  if (server) {
    try {
      server.close()
    } catch {
      // ignore
    }
    server = null
  }
  room = null
  port = null
}

export function getWorkbenchHostStatus(): {
  running: boolean
  port: number | null
  roomCode: string | null
  lanUrls: string[]
} {
  const running = Boolean(server && room && port != null)
  return {
    running,
    port: running ? port : null,
    roomCode: running && room ? room.roomCode : null,
    lanUrls: running && port != null ? collectLanUrls(port) : [],
  }
}
