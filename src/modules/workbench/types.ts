export type TaskSpace = 'personal' | 'pool' | 'mainline'
export type TaskStatus = 'todo' | 'doing' | 'done'

export interface WorkbenchUser {
  id: string
  displayName: string
}

export interface WorkbenchProject {
  id: string
  name: string
  leadIds: string[]
  createdAt: string
  updatedAt: string
}

export interface WorkbenchTask {
  id: string
  projectId: string
  space: TaskSpace
  title: string
  status: TaskStatus
  dueDate?: string | null
  description?: string
  assigneeId?: string | null
  authorId: string
  sourceTaskId?: string | null
  order: number
  updatedAt: string
  /** personal only: last failed submit marker */
  pendingPoolRetry?: boolean
}

export type ConnectionMode = 'offline' | 'hosting' | 'joined'

export interface ConnectionState {
  mode: ConnectionMode
  /** Room is bound to exactly one project */
  projectId?: string
  projectName?: string
  roomCode?: string
  hostBaseUrl?: string
  lanUrls?: string[]
  localUser: WorkbenchUser
}
