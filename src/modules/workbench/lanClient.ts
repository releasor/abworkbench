import type { ServerEvent } from './protocol.ts'
import type { WorkbenchTask, WorkbenchUser } from './types.ts'

export type LanResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface SnapshotPayload {
  pool: WorkbenchTask[]
  mainline: WorkbenchTask[]
  leadIds: string[]
  members: WorkbenchUser[]
}

export interface ProjectListItem {
  id: string
  name: string
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function errorFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error?: unknown }).error
    if (typeof err === 'string' && err) return err
  }
  return fallback
}

export function createLanClient(baseUrl: string) {
  const root = baseUrl.replace(/\/$/, '')

  return {
    async join(
      user: { id: string; displayName: string },
      passphrase?: string,
    ): Promise<LanResult<{ members: WorkbenchUser[] }>> {
      try {
        const res = await fetch(`${root}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, passphrase: passphrase ?? '' }),
        })
        const body = await readJson(res)
        if (!res.ok) {
          return { ok: false, error: errorFromBody(body, `HTTP ${res.status}`) }
        }
        const members =
          body && typeof body === 'object' && Array.isArray((body as { members?: unknown }).members)
            ? ((body as { members: WorkbenchUser[] }).members)
            : []
        return { ok: true, data: { members } }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'join failed'
        return {
          ok: false,
          error: /failed to fetch|networkerror|load failed/i.test(msg)
            ? '无法连接主机（请检查地址、防火墙，或本机请用 127.0.0.1）'
            : msg,
        }
      }
    },

    async listProjects(): Promise<LanResult<ProjectListItem[]>> {
      try {
        const res = await fetch(`${root}/projects`)
        const body = await readJson(res)
        if (!res.ok) {
          return { ok: false, error: errorFromBody(body, `HTTP ${res.status}`) }
        }
        if (!Array.isArray(body)) {
          return { ok: false, error: 'invalid projects response' }
        }
        return { ok: true, data: body as ProjectListItem[] }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'listProjects failed'
        return {
          ok: false,
          error: /failed to fetch|networkerror|load failed/i.test(msg)
            ? '无法连接主机（网络或 CSP 拦截）'
            : msg,
        }
      }
    },

    async getSnapshot(projectId: string): Promise<LanResult<SnapshotPayload>> {
      try {
        const res = await fetch(`${root}/projects/${encodeURIComponent(projectId)}/snapshot`)
        const body = await readJson(res)
        if (!res.ok) {
          return { ok: false, error: errorFromBody(body, `HTTP ${res.status}`) }
        }
        if (!body || typeof body !== 'object') {
          return { ok: false, error: 'invalid snapshot' }
        }
        const snap = body as Partial<SnapshotPayload>
        return {
          ok: true,
          data: {
            pool: Array.isArray(snap.pool) ? snap.pool : [],
            mainline: Array.isArray(snap.mainline) ? snap.mainline : [],
            leadIds: Array.isArray(snap.leadIds) ? snap.leadIds : [],
            members: Array.isArray(snap.members) ? snap.members : [],
          },
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'getSnapshot failed'
        return {
          ok: false,
          error: /failed to fetch|networkerror|load failed/i.test(msg)
            ? '无法连接主机（网络或 CSP 拦截）'
            : msg,
        }
      }
    },

    async command(req: unknown, userId: string): Promise<LanResult<unknown>> {
      try {
        const res = await fetch(`${root}/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify(req),
        })
        const body = await readJson(res)
        if (!res.ok) {
          return { ok: false, error: errorFromBody(body, `HTTP ${res.status}`) }
        }
        if (body && typeof body === 'object' && (body as { ok?: boolean }).ok === false) {
          return { ok: false, error: errorFromBody(body, 'command failed') }
        }
        const data =
          body && typeof body === 'object' && 'body' in body
            ? (body as { body: unknown }).body
            : body
        return { ok: true, data }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'command failed'
        return {
          ok: false,
          error: /failed to fetch|networkerror|load failed/i.test(msg)
            ? '提交失败：无法连接房间服务（请断开后重新开房）'
            : msg,
        }
      }
    },

    subscribe(onEvent: (e: ServerEvent | unknown) => void): () => void {
      const es = new EventSource(`${root}/events`)
      es.onmessage = (msg) => {
        try {
          onEvent(JSON.parse(msg.data) as ServerEvent)
        } catch {
          // ignore malformed SSE payloads
        }
      }
      return () => es.close()
    },
  }
}

export type LanClient = ReturnType<typeof createLanClient>
