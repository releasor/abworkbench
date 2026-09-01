import type { HostEvent } from './hostRoomState.ts'
import type { WorkbenchProject, WorkbenchTask, WorkbenchUser } from './types.ts'

export type ClientRequest =
  | { op: 'join'; user: WorkbenchUser; passphrase?: string }
  | { op: 'listProjects' }
  | { op: 'getSnapshot'; projectId: string }
  | { op: 'submitToPool'; projectId: string; task: WorkbenchTask }
  | { op: 'promote'; projectId: string; sourceTask: WorkbenchTask }
  | { op: 'updateMainlineTask'; projectId: string; taskId: string; patch: Partial<WorkbenchTask> }
  | { op: 'deleteMainlineTask'; projectId: string; taskId: string }
  | { op: 'shareProject'; project: WorkbenchProject; mainlineSeed: WorkbenchTask[] }
  | { op: 'setLeads'; projectId: string; leadIds: string[] }

/** Wire-format server events; structurally identical to HostEvent. */
export type ServerEvent = HostEvent

export function encodeClientRequest(req: ClientRequest): string {
  return JSON.stringify(req)
}

export function decodeClientRequest(raw: string): ClientRequest {
  const v = JSON.parse(raw) as ClientRequest
  if (!v || typeof v !== 'object' || typeof (v as { op?: unknown }).op !== 'string') {
    throw new Error('invalid ClientRequest')
  }
  return v
}

export function encodeServerEvent(ev: ServerEvent): string {
  return JSON.stringify(ev)
}

export function decodeServerEvent(raw: string): ServerEvent {
  const v = JSON.parse(raw) as ServerEvent
  if (!v || typeof v !== 'object' || typeof (v as { type?: unknown }).type !== 'string') {
    throw new Error('invalid ServerEvent')
  }
  return v
}

/** SSE data line helper */
export function formatSseData(ev: ServerEvent): string {
  return `data: ${encodeServerEvent(ev)}\n\n`
}
