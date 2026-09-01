import { createId } from './id.ts'
import { canPromoteToMainline } from './permissions.ts'
import type { WorkbenchProject, WorkbenchTask, WorkbenchUser } from './types.ts'

export interface LocalWorkbenchState {
  user: WorkbenchUser
  projects: WorkbenchProject[]
  tasks: WorkbenchTask[]
}

export type LocalAction =
  | { type: 'project/create'; name: string; nowIso: string }
  | { type: 'project/rename'; projectId: string; name: string; nowIso: string }
  | { type: 'project/ensure'; project: WorkbenchProject }
  | { type: 'task/createPersonal'; projectId: string; title: string; nowIso: string }
  | {
      type: 'task/update'
      taskId: string
      patch: Partial<
        Pick<
          WorkbenchTask,
          'title' | 'status' | 'dueDate' | 'description' | 'assigneeId' | 'order' | 'pendingPoolRetry'
        >
      >
      nowIso: string
    }
  | { type: 'task/promoteToLocalMainline'; taskId: string; actorId: string; nowIso: string }
  | { type: 'task/delete'; taskId: string }
  | { type: 'task/importMany'; tasks: WorkbenchTask[] }
  | { type: 'hydrate'; state: LocalWorkbenchState }

export function createEmptyLocalState(user: WorkbenchUser): LocalWorkbenchState {
  return { user, projects: [], tasks: [] }
}

export function reduceLocal(state: LocalWorkbenchState, action: LocalAction): LocalWorkbenchState {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'project/create': {
      const project: WorkbenchProject = {
        id: createId('proj'),
        name: action.name.trim() || '未命名项目',
        leadIds: [state.user.id],
        createdAt: action.nowIso,
        updatedAt: action.nowIso,
      }
      return { ...state, projects: [...state.projects, project] }
    }
    case 'project/rename': {
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, name: action.name, updatedAt: action.nowIso } : p,
        ),
      }
    }
    case 'project/ensure': {
      const idx = state.projects.findIndex((p) => p.id === action.project.id)
      if (idx < 0) {
        return { ...state, projects: [...state.projects, action.project] }
      }
      const projects = state.projects.slice()
      projects[idx] = {
        ...projects[idx],
        name: action.project.name,
        leadIds: action.project.leadIds.length
          ? action.project.leadIds
          : projects[idx].leadIds,
        updatedAt: action.project.updatedAt,
      }
      return { ...state, projects }
    }
    case 'task/createPersonal': {
      const order = state.tasks.filter(
        (t) => t.projectId === action.projectId && t.space === 'personal',
      ).length
      const task: WorkbenchTask = {
        id: createId('task'),
        projectId: action.projectId,
        space: 'personal',
        title: action.title.trim() || '未命名',
        status: 'todo',
        authorId: state.user.id,
        assigneeId: state.user.id,
        order,
        updatedAt: action.nowIso,
      }
      return { ...state, tasks: [...state.tasks, task] }
    }
    case 'task/update': {
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, ...action.patch, updatedAt: action.nowIso } : t,
        ),
      }
    }
    case 'task/promoteToLocalMainline': {
      const source = state.tasks.find((t) => t.id === action.taskId)
      if (!source) return state
      const already = state.tasks.some(
        (t) =>
          t.projectId === source.projectId &&
          t.space === 'mainline' &&
          (t.sourceTaskId === source.id || t.id === source.id),
      )
      if (already) return state
      const project = state.projects.find((p) => p.id === source.projectId)
      const allowed = canPromoteToMainline({
        connected: false,
        actorId: action.actorId,
        localUserId: state.user.id,
        leadIds: project?.leadIds ?? [],
        sourceSpace: source.space,
        sourceAuthorId: source.authorId,
      })
      if (!allowed) return state
      const order = state.tasks.filter(
        (t) => t.projectId === source.projectId && t.space === 'mainline',
      ).length
      const promoted: WorkbenchTask = {
        ...source,
        id: createId('task'),
        space: 'mainline',
        sourceTaskId: source.id,
        order,
        updatedAt: action.nowIso,
      }
      return { ...state, tasks: [...state.tasks, promoted] }
    }
    case 'task/delete': {
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.taskId) }
    }
    case 'task/importMany': {
      if (!action.tasks.length) return state
      return { ...state, tasks: [...state.tasks, ...action.tasks] }
    }
    default:
      return state
  }
}
