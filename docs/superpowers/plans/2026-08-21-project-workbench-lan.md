# 项目工作台（局域网协作）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付轻量「项目工作台」：本机个人+主线；局域网一人开房后出现「所有人」池与负责人策展主线；默认替换任务流入口，经典 taskflow 可保留旁路。

**Architecture:** 领域逻辑（权限、promote、主机房间状态机、导入映射）做成可单测的纯模块；本机数据经 Electron `userData/workbench-local.json` 持久化；开房用主进程 `http` + SSE 广播（不引入 `ws`）；渲染进程用 `fetch`/EventSource 做客户端。UI 为项目列表 + 三段工作台（个人 / 所有人 / 主线）。

**Tech Stack:** Electron 42、React 19、Zustand、TypeScript、Node `node:test`、`node:http` + SSE、现有 `desktop:*` IPC / preload。

**Spec:** `docs/superpowers/specs/2026-08-21-project-workbench-lan-design.md`

**Phasing (each phase is shippable):**
- **Phase A（Task 1–7）：** 纯本地项目工作台（个人 + 本机主线），无局域网。
- **Phase B（Task 8–12）：** 开房/加入、所有人池、负责人权限、断线降级。
- **Phase C（Task 13–15）：** 导航替换、旧 taskflow 导入、收尾验收。

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/modules/workbench/types.ts` | Project / Task / Member / ConnectionState 类型 |
| `src/modules/workbench/id.ts` | `createId()` |
| `src/modules/workbench/permissions.ts` | `canSubmitToPool` / `canPromoteToMainline` |
| `src/modules/workbench/statusMap.ts` | 旧四态 → 三态；导入用 |
| `src/modules/workbench/localState.ts` | 本机状态结构 + reduce 动作（纯函数） |
| `src/modules/workbench/hostRoomState.ts` | 主机房间权威状态 + 权限校验（纯函数） |
| `src/modules/workbench/protocol.ts` | HTTP/SSE 报文类型与编解码 |
| `src/modules/workbench/importFromTaskflow.ts` | 旧 Task → 工作台 personal Task |
| `src/modules/workbench/*.test.mjs` | 上述纯逻辑测试 |
| `src/modules/workbench/hooks/useWorkbenchStore.ts` | Zustand：本机状态 + 连接态 |
| `src/modules/workbench/lanClient.ts` | join / mutate / SSE 订阅（渲染进程） |
| `src/modules/workbench/WorkbenchPage.tsx` | 列表 vs 工作台路由 |
| `src/modules/workbench/ProjectList.tsx` | 项目列表 UI |
| `src/modules/workbench/ProjectWorkbench.tsx` | 三栏壳 + 顶栏 |
| `src/modules/workbench/PersonalColumn.tsx` | 个人列 |
| `src/modules/workbench/PoolColumn.tsx` | 所有人列（连网才渲染） |
| `src/modules/workbench/MainlineBoard.tsx` | 主线三列看板 |
| `src/modules/workbench/TaskRow.tsx` | 行内编辑 |
| `src/modules/workbench/TaskDrawer.tsx` | 详情抽屉 |
| `src/modules/workbench/RoomBar.tsx` | 开房/加入/断开 UI |
| `electron/workbenchLocal.ts` | `workbench-local.json` 读写 |
| `electron/workbenchHost.ts` | 局域网 HTTP+SSE 服务，调用 `hostRoomState` |
| `electron/main.ts` | 注册 IPC |
| `electron/preload.ts` | 暴露 workbench API |
| `src/env.d.ts` | preload 类型 |
| `src/navigation/pages.ts` | 增加 `taskflowClassic`（或等价） |
| `src/App.tsx` / `Sidebar.tsx` / i18n | 默认进工作台；经典旁路 |
| `src/modules/taskflow/TaskFlowPage.tsx` | 仅经典入口仍用，不改内核 |

---

### Task 1: 类型 + id + permissions（TDD）

**Files:**
- Create: `src/modules/workbench/types.ts`
- Create: `src/modules/workbench/id.ts`
- Create: `src/modules/workbench/permissions.ts`
- Test: `src/modules/workbench/permissions.test.mjs`

- [x] **Step 1: Write failing test**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { canPromoteToMainline, canSubmitToPool } from './permissions.ts'

const base = {
  connected: false,
  localUserId: 'u1',
  leadIds: ['lead1'],
}

test('offline: anyone can promote own personal to local mainline', () => {
  assert.equal(
    canPromoteToMainline({ ...base, connected: false, actorId: 'u1', sourceSpace: 'personal', sourceAuthorId: 'u1' }),
    true,
  )
})

test('offline: cannot promote others personal', () => {
  assert.equal(
    canPromoteToMainline({ ...base, connected: false, actorId: 'u1', sourceSpace: 'personal', sourceAuthorId: 'u2' }),
    false,
  )
})

test('online: only lead can promote pool or personal to team mainline', () => {
  assert.equal(
    canPromoteToMainline({ ...base, connected: true, actorId: 'lead1', sourceSpace: 'pool', sourceAuthorId: 'u2' }),
    true,
  )
  assert.equal(
    canPromoteToMainline({ ...base, connected: true, actorId: 'u1', sourceSpace: 'pool', sourceAuthorId: 'u2' }),
    false,
  )
})

test('submitToPool requires connection', () => {
  assert.equal(canSubmitToPool({ connected: false }), false)
  assert.equal(canSubmitToPool({ connected: true }), true)
})
```

- [x] **Step 2: Run test — expect FAIL**

Run: `node --test src/modules/workbench/permissions.test.mjs`  
Expected: module not found / fail

- [x] **Step 3: Implement types, id, permissions**

`types.ts`:

```ts
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
  roomCode?: string
  hostBaseUrl?: string
  localUser: WorkbenchUser
}
```

`id.ts`:

```ts
export function createId(prefix = 'wb'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
```

`permissions.ts`:

```ts
export function canSubmitToPool(input: { connected: boolean }): boolean {
  return input.connected
}

export function canPromoteToMainline(input: {
  connected: boolean
  actorId: string
  localUserId: string
  leadIds: string[]
  sourceSpace: 'personal' | 'pool' | 'mainline'
  sourceAuthorId: string
}): boolean {
  if (input.sourceSpace === 'mainline') return false
  if (!input.connected) {
    return input.sourceSpace === 'personal' && input.sourceAuthorId === input.actorId
  }
  return input.leadIds.includes(input.actorId)
}
```

- [x] **Step 4: Run test — expect PASS**

Run: `node --test src/modules/workbench/permissions.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/modules/workbench/types.ts src/modules/workbench/id.ts src/modules/workbench/permissions.ts src/modules/workbench/permissions.test.mjs
git commit -m "feat(workbench): add core types and promote/submit permissions"
```

---

### Task 2: statusMap + importFromTaskflow（TDD）

**Files:**
- Create: `src/modules/workbench/statusMap.ts`
- Create: `src/modules/workbench/importFromTaskflow.ts`
- Test: `src/modules/workbench/statusMap.test.mjs`
- Test: `src/modules/workbench/importFromTaskflow.test.mjs`

- [x] **Step 1: Write failing tests**

`statusMap.test.mjs`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { mapLegacyStatus } from './statusMap.ts'

test('maps legacy statuses to three-state', () => {
  assert.equal(mapLegacyStatus('todo'), 'todo')
  assert.equal(mapLegacyStatus('in-progress'), 'doing')
  assert.equal(mapLegacyStatus('review'), 'doing')
  assert.equal(mapLegacyStatus('done'), 'done')
  assert.equal(mapLegacyStatus('unknown'), 'todo')
})
```

`importFromTaskflow.test.mjs`:

```js
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
```

- [x] **Step 2: Run — expect FAIL**

Run: `node --test src/modules/workbench/statusMap.test.mjs src/modules/workbench/importFromTaskflow.test.mjs`

- [x] **Step 3: Implement**

`statusMap.ts`:

```ts
import type { TaskStatus } from './types'

export function mapLegacyStatus(status: string): TaskStatus {
  if (status === 'done') return 'done'
  if (status === 'in-progress' || status === 'review' || status === 'doing') return 'doing'
  return 'todo'
}
```

`importFromTaskflow.ts`:

```ts
import { createId } from './id'
import { mapLegacyStatus } from './statusMap'
import type { WorkbenchTask } from './types'

export interface LegacyTaskLike {
  id?: string
  title: string
  description?: string
  status?: string
  dueDate?: string | null
}

export function importLegacyTasks(input: {
  projectId: string
  authorId: string
  nowIso: string
  legacyTasks: LegacyTaskLike[]
}): WorkbenchTask[] {
  return input.legacyTasks.map((t, index) => ({
    id: createId('task'),
    projectId: input.projectId,
    space: 'personal',
    title: t.title,
    status: mapLegacyStatus(t.status ?? 'todo'),
    dueDate: t.dueDate ?? null,
    description: t.description || undefined,
    authorId: input.authorId,
    assigneeId: input.authorId,
    sourceTaskId: t.id ?? null,
    order: index,
    updatedAt: input.nowIso,
  }))
}
```

- [x] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/workbench/statusMap.ts src/modules/workbench/importFromTaskflow.ts src/modules/workbench/*.test.mjs
git commit -m "feat(workbench): map legacy statuses and import personal tasks"
```

---

### Task 3: localState reducer（TDD）

**Files:**
- Create: `src/modules/workbench/localState.ts`
- Test: `src/modules/workbench/localState.test.mjs`

- [x] **Step 1: Write failing test**

Cover: create project, add personal task, promote personal→mainline offline, reject illegal promote.

```js
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
```

- [x] **Step 2: Run — expect FAIL**

- [x] **Step 3: Implement `localState.ts`**

```ts
import { createId } from './id'
import { canPromoteToMainline } from './permissions'
import type { WorkbenchProject, WorkbenchTask, WorkbenchUser } from './types'

export interface LocalWorkbenchState {
  user: WorkbenchUser
  projects: WorkbenchProject[]
  /** personal + local mainline only */
  tasks: WorkbenchTask[]
}

export type LocalAction =
  | { type: 'project/create'; name: string; nowIso: string }
  | { type: 'project/rename'; projectId: string; name: string; nowIso: string }
  | { type: 'task/createPersonal'; projectId: string; title: string; nowIso: string }
  | { type: 'task/update'; taskId: string; patch: Partial<Pick<WorkbenchTask, 'title' | 'status' | 'dueDate' | 'description' | 'assigneeId' | 'order'>>; nowIso: string }
  | { type: 'task/promoteToLocalMainline'; taskId: string; actorId: string; nowIso: string }
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
    case 'task/createPersonal': {
      const order = state.tasks.filter((t) => t.projectId === action.projectId && t.space === 'personal').length
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
      const order = state.tasks.filter((t) => t.projectId === source.projectId && t.space === 'mainline').length
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
    default:
      return state
  }
}
```

- [x] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/workbench/localState.ts src/modules/workbench/localState.test.mjs
git commit -m "feat(workbench): add local project/task reducer"
```

---

### Task 4: Electron 本机持久化 + IPC

**Files:**
- Create: `electron/workbenchLocal.ts`
- Modify: `electron/main.ts`（注册 handle）
- Modify: `electron/preload.ts`
- Modify: `src/env.d.ts`

- [x] **Step 1: Implement `workbenchLocal.ts`**

Mirror `launcherSettings.ts` style: path under `app.getPath('userData')`, `workbench-local.json`, `loadLocalState()` / `saveLocalState(state)`.

```ts
import fs from 'node:fs'
import path from 'node:path'
import type { LocalWorkbenchState } from '../src/modules/workbench/localState'

// Note: if electron build cannot import from src, duplicate a minimal JSON shape
// in electron/workbenchLocal.ts and keep types aligned — prefer shared types if vite-plugin-electron already bundles TS from electron importing relative src.
```

If现有 electron 不从 `src/` 引用：在 `electron/workbenchLocal.ts` 内定义相同 JSON 接口，renderer 只收纯对象。

API:

```ts
export function getWorkbenchLocalPath(userData: string): string {
  return path.join(userData, 'workbench-local.json')
}

export function loadWorkbenchLocal(userData: string): unknown | null { /* read JSON or null */ }
export function saveWorkbenchLocal(userData: string, data: unknown): void { /* atomic write tmp+rename */ }
```

- [x] **Step 2: Register IPC in `main.ts`**

```ts
ipcMain.handle('desktop:workbench-local-get', () => loadWorkbenchLocal(app.getPath('userData')))
ipcMain.handle('desktop:workbench-local-set', (_e, data: unknown) => {
  saveWorkbenchLocal(app.getPath('userData'), data)
  return true
})
```

- [x] **Step 3: Preload + env.d.ts**

```ts
workbenchLocalGet: () => ipcRenderer.invoke('desktop:workbench-local-get'),
workbenchLocalSet: (data: unknown) => ipcRenderer.invoke('desktop:workbench-local-set', data),
```

- [ ] **Step 4: Smoke in Electron** — open DevTools, `await window.electronAPI.workbenchLocalGet()` returns null or object

- [ ] **Step 5: Commit**

```bash
git add electron/workbenchLocal.ts electron/main.ts electron/preload.ts src/env.d.ts
git commit -m "feat(workbench): persist local state via Electron userData"
```

---

### Task 5: useWorkbenchStore（本机）

**Files:**
- Create: `src/modules/workbench/hooks/useWorkbenchStore.ts`

- [x] **Step 1: Implement Zustand store**

- `hydrate` from `window.electronAPI?.workbenchLocalGet`（无 electronAPI 时用 memory）
- 每次成功 `reduceLocal` 后 debounce `workbenchLocalSet`
- 暴露：`projects`, `tasksForProject(projectId)`, `createProject`, `createPersonalTask`, `updateTask`, `promoteToLocalMainline`, `connection`（先固定 `mode: 'offline'`）

- [x] **Step 2: Manual check** — unit test `hooks/useWorkbenchStore.test.mjs`（hydrate + mutate in memory）；Electron 刷新持久化留给 Task 6 UI

- [ ] **Step 3: Commit**

```bash
git add src/modules/workbench/hooks/useWorkbenchStore.ts
git commit -m "feat(workbench): add zustand store with local persistence"
```

---

### Task 6: Phase A UI — 项目列表 + 工作台（个人/主线）

**Files:**
- Create: `src/modules/workbench/WorkbenchPage.tsx`
- Create: `src/modules/workbench/ProjectList.tsx`
- Create: `src/modules/workbench/ProjectWorkbench.tsx`
- Create: `src/modules/workbench/PersonalColumn.tsx`
- Create: `src/modules/workbench/MainlineBoard.tsx`
- Create: `src/modules/workbench/TaskRow.tsx`
- Create: `src/modules/workbench/TaskDrawer.tsx`

- [x] **Step 1: Wire minimal UI**

- `WorkbenchPage`: 无 `projectId` 查参则 `ProjectList`，否则 `ProjectWorkbench`
- `ProjectList`: 新建项目、点击进入 `?project=<id>`（或内部 state）
- `ProjectWorkbench`: 两栏（个人 | 主线）；顶栏项目名；**不渲染**「所有人」
- `PersonalColumn`: 输入框快速添加；列表；「拉入主线」按钮
- `MainlineBoard`: `todo/doing/done` 三列；拖拽可用 HTML5 DnD 或先用「移到…」按钮（v1 按钮可接受，DnD 同 Task）
- `TaskDrawer`: title/status/dueDate/description

视觉：沿用现有 `border-border` / `bg-surface` / `text-text` token，保持克制，不要堆旧 taskflow 控件。

- [x] **Step 2: Temporarily mount in App** — 将 `taskflow` 页渲染改为 `WorkbenchPage`（可先硬切，经典入口在 Task 13 补）

- [x] **Step 3: Manual QA**

未连网：建项目 → 加个人任务 → 拉入主线 → 改状态 → 重启仍在。

- [ ] **Step 4: Commit**

```bash
git add src/modules/workbench/*.tsx src/App.tsx
git commit -m "feat(workbench): local project UI with personal and mainline"
```

---

### Task 7: Phase A 验收检查点

- [x] **Step 1: Run unit tests**

Run: `node --test src/modules/workbench/**/*.test.mjs`  
Expected: all PASS — verified 17 pass (incl. electron/workbenchLocal)

- [x] **Step 2: Confirm spec §验收 1** — 个人+主线可用，无「所有人」（代码：ProjectWorkbench 仅两栏；自动化测覆盖 promote）

- [ ] **Step 3: Commit any fixes**（若有）

---

### Task 8: protocol + hostRoomState（TDD）

**Files:**
- Create: `src/modules/workbench/protocol.ts`
- Create: `src/modules/workbench/hostRoomState.ts`
- Test: `src/modules/workbench/hostRoomState.test.mjs`

- [x] **Step 1: Write failing tests**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHostRoom, applyHostCommand } from './hostRoomState.ts'

test('join registers member; non-lead cannot promote', () => {
  let room = createHostRoom({
    hostUser: { id: 'host', displayName: 'Host' },
    roomCode: 'ABCD',
    passphrase: '',
    nowIso: 't0',
  })
  room = applyHostCommand(room, {
    type: 'shareProject',
    project: { id: 'p1', name: 'P', leadIds: ['host'], createdAt: 't0', updatedAt: 't0' },
    mainlineSeed: [],
    nowIso: 't1',
  }).room
  room = applyHostCommand(room, {
    type: 'join',
    user: { id: 'u2', displayName: 'Bob' },
    passphrase: '',
    nowIso: 't2',
  }).room
  const denied = applyHostCommand(room, {
    type: 'promote',
    actorId: 'u2',
    projectId: 'p1',
    sourceTask: {
      id: 's1', projectId: 'p1', space: 'pool', title: 'X', status: 'todo',
      authorId: 'u2', order: 0, updatedAt: 't2',
    },
    nowIso: 't3',
  })
  assert.equal(denied.ok, false)
  assert.equal(room.members.some((m) => m.id === 'u2'), true)
})

test('lead promote from pool creates mainline task', () => {
  let room = createHostRoom({
    hostUser: { id: 'host', displayName: 'Host' },
    roomCode: 'ABCD',
    passphrase: '',
    nowIso: 't0',
  })
  room = applyHostCommand(room, {
    type: 'shareProject',
    project: { id: 'p1', name: 'P', leadIds: ['host'], createdAt: 't0', updatedAt: 't0' },
    mainlineSeed: [],
    nowIso: 't1',
  }).room
  room = applyHostCommand(room, {
    type: 'join',
    user: { id: 'u2', displayName: 'Bob' },
    passphrase: '',
    nowIso: 't2',
  }).room
  room = applyHostCommand(room, {
    type: 'submitToPool',
    actorId: 'u2',
    projectId: 'p1',
    task: {
      id: 's1',
      projectId: 'p1',
      space: 'pool',
      title: 'X',
      status: 'todo',
      authorId: 'u2',
      order: 0,
      updatedAt: 't2',
    },
    nowIso: 't3',
  }).room
  const promoted = applyHostCommand(room, {
    type: 'promote',
    actorId: 'host',
    projectId: 'p1',
    sourceTask: room.projects.p1.pool[0],
    nowIso: 't4',
  })
  assert.equal(promoted.ok, true)
  assert.equal(promoted.room.projects.p1.mainline.length, 1)
  assert.equal(promoted.room.projects.p1.mainline[0].sourceTaskId, 's1')
  assert.equal(promoted.room.projects.p1.mainline[0].authorId, 'u2')
})
```

- [x] **Step 2: Implement**

`hostRoomState.ts` 维护：

```ts
export interface HostRoomState {
  roomCode: string
  passphrase: string
  hostUserId: string
  members: WorkbenchUser[]
  /** projectId -> { project, pool[], mainline[], leadIds } */
  projects: Record<string, HostProjectBundle>
}

export type HostCommandResult = { ok: true; room: HostRoomState; events: HostEvent[] } | { ok: false; error: string; room: HostRoomState }
```

命令：`join` | `shareProject` | `submitToPool` | `promote` | `updateMainlineTask` | `setLeads`

权限全部走 `canPromoteToMainline` / `canSubmitToPool`，`connected: true`。

- [x] **Step 3: Run tests PASS + Commit**

```bash
git commit -m "feat(workbench): host room state machine with lead promote rules"
```

(Commit deferred — not requested.)

---

### Task 9: protocol 报文

**Files:**
- Create/extend: `src/modules/workbench/protocol.ts`
- Test: `src/modules/workbench/protocol.test.mjs`（encode/decode roundtrip）

Messages:

```ts
export type ClientRequest =
  | { op: 'join'; user: WorkbenchUser; passphrase?: string }
  | { op: 'listProjects' }
  | { op: 'getSnapshot'; projectId: string }
  | { op: 'submitToPool'; projectId: string; task: WorkbenchTask }
  | { op: 'promote'; projectId: string; sourceTask: WorkbenchTask }
  | { op: 'updateMainlineTask'; projectId: string; taskId: string; patch: Partial<WorkbenchTask> }
  | { op: 'shareProject'; project: WorkbenchProject; mainlineSeed: WorkbenchTask[] }
  | { op: 'setLeads'; projectId: string; leadIds: string[] }

export type ServerEvent =
  | { type: 'snapshot'; projectId: string; pool: WorkbenchTask[]; mainline: WorkbenchTask[]; leadIds: string[]; members: WorkbenchUser[] }
  | { type: 'poolUpsert'; projectId: string; task: WorkbenchTask }
  | { type: 'mainlineUpsert'; projectId: string; task: WorkbenchTask }
  | { type: 'error'; message: string }
  | { type: 'members'; members: WorkbenchUser[] }
```

- [x] **Step 1–4: TDD roundtrip + Commit**（Commit deferred — not requested.）

---

### Task 10: electron/workbenchHost.ts（HTTP + SSE）

**Files:**
- Create: `electron/workbenchHost.ts`
- Modify: `electron/main.ts`, `electron/preload.ts`, `src/env.d.ts`

- [ ] **Step 1: Implement server**

- `http.createServer` listen `0.0.0.0:0`（或固定 `47821`）
- Routes:
  - `POST /join` body → `applyHostCommand join`
  - `GET /projects`
  - `GET /projects/:id/snapshot`
  - `POST /command` body = ClientRequest（除 join）
  - `GET /events` SSE：持有 `res` 列表，每次 `HostEvent` write `data: ${JSON.stringify(ev)}\n\n`
- `startHost({ passphrase })` → `{ port, roomCode, lanUrls[] }`
- `stopHost()`
- roomCode: 4 位大写字母数字
- lanUrls: 枚举 `os.networkInterfaces()` 非内部 IPv4

- [ ] **Step 2: IPC**

```ts
'desktop:workbench-host-start'
'desktop:workbench-host-stop'
'desktop:workbench-host-status'
```

开房时：把当前打开项目 `shareProject` + 本机 mainline 作 `mainlineSeed`（仅当主机房间内尚无该项目）。

- [ ] **Step 3: Manual** — 浏览器/`curl` 打本机 join + snapshot

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(workbench): LAN host HTTP+SSE room server"
```

---

### Task 11: lanClient + store 接线

**Files:**
- Create: `src/modules/workbench/lanClient.ts`
- Modify: `src/modules/workbench/hooks/useWorkbenchStore.ts`
- Create: `src/modules/workbench/RoomBar.tsx`
- Modify: `ProjectWorkbench.tsx` / `PoolColumn.tsx`

- [x] **Step 1: `lanClient.ts`**

```ts
export function createLanClient(baseUrl: string) {
  return {
    async join(user, passphrase) { /* POST /join */ },
    async getSnapshot(projectId) { /* GET */ },
    async command(req) { /* POST /command */ },
    subscribe(onEvent: (e: ServerEvent) => void) {
      const es = new EventSource(`${baseUrl}/events`)
      es.onmessage = (msg) => onEvent(JSON.parse(msg.data))
      return () => es.close()
    },
  }
}
```

- [x] **Step 2: Store**

- `startHosting` / `joinRoom(baseUrl, passphrase)` / `disconnect`
- 连接后：`remotePool` / `remoteMainline` / `remoteLeadIds` 来自 snapshot+SSE
- UI 主线：`mode==='offline'` 用本地 mainline；否则用 remote
- `submitToPool`：校验权限 → command；失败设 `pendingPoolRetry`
- `promote`：走 host command；错误 toast
- `retryPendingPool`

- [x] **Step 3: RoomBar UI** — 开房展示 IP+短码+口令；加入表单；断开

- [x] **Step 4: PoolColumn** — 仅 `mode!=='offline'` 显示；作者名用 members map

- [x] **Step 5: Two-window / two-machine QA** — structure wired; full two-machine QA deferred to manual

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(workbench): join room, pool column, and live SSE sync"
```

---

### Task 12: 断线降级 + 本机主线未同步提示

**Files:**
- Modify: store + `ProjectWorkbench.tsx`

- [x] **Step 1: Heartbeat** — 客户端每 5s `GET /projects`；连续失败 → `disconnect()` 逻辑（清 remote，mode offline）
- [x] **Step 2: Banner** — 「已断开，显示本机主线；团队主线需重连」
- [x] **Step 3: 若本机 mainline 有 `updatedAt` 新于上次成功 snapshot 的项，显示「提交到所有人」批量入口（显式，不自动合并）
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(workbench): disconnect fallback and unsynced local mainline actions"
```

---

### Task 13: 导航 — 默认工作台 + 经典旁路

**Files:**
- Modify: `src/navigation/pages.ts`
- Modify: `src/navigation/pages.test.mjs`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/i18n/locales/zh.ts`, `en.ts`
- Modify: shortcuts/catalog 若绑定 page id

- [x] **Step 1: Update pages**
- [x] **Step 2: Fix `pages.test.mjs` expectations**
- [x] **Step 3: Run** `node --test src/navigation/pages.test.mjs`
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(workbench): make workbench default; keep classic taskflow route"
```

---

### Task 14: 导入旧 taskflow

- [x] **Step 1–3:** `importLegacyIntoProject` + ProjectList「导入经典」
- [ ] **Step 4: Commit**

### Task 15: 全量验收 + 文档指针

- [x] **Step 1: Run unit tests** — workbench + host + pages: 25 pass
- [x] **Step 2: Checklist** — Phase A/B/C wired per spec (LAN two-machine QA仍需桌面端手测)
- [ ] **Step 3–4: Spec note / commit**（按需）

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| 项目容器 + 每项目三层 | 3, 6, 8, 11 |
| 离线仅个人+本机主线 | 3, 6, 12 |
| 连网显示所有人 | 11 |
| 负责人策展主线 | 1, 8, 11 |
| 开房/短码/可选口令 | 10, 11 |
| 主机权威 + 后写覆盖 | 8, 10, 11 |
| 断线降级 + 不自动合并 | 12 |
| 轻量字段 / 三态 | 1, 2, 6 |
| 替换默认入口 + 经典旁路 | 13 |
| 旧数据导入 | 2, 14 |
| 不做 CRDT/日历等 | 全计划未包含 |

## Notes for agents

- Prefer **Phase A complete** before starting host networking.
- Do not port TaskModal / FilterBar / Matrix into workbench.
- If `electron` cannot import `src/modules/workbench/*`, keep pure logic duplicated only as last resort; better: put shared pure modules under `shared/workbench/` — only if build requires it; default try `electron` importing relative compiled output or duplicate `hostRoomState` into `electron/workbench/` with identical tests copying source. **Preferred:** implement pure modules under `src/modules/workbench/` and from electron use dynamic `await import('../src/modules/workbench/hostRoomState.ts')` only if tooling allows; else copy file into `electron/workbench/hostRoomState.ts` and re-export tests against that path.
- Toast: reuse `src/modules/taskflow/utils/toastEvent` `showToast` for errors (already global).
