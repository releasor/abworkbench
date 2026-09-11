import { useMemo, useRef, useState, type DragEvent } from 'react'
import TaskRow from './TaskRow'
import WbPanel from './WbPanel'
import MainlineTaskContextMenu from './MainlineTaskContextMenu'
import {
  encodeWorkbenchDragPayload,
  readWorkbenchDragPayload,
  shouldUpdateMainlineStatus,
  type WorkbenchDragSource,
} from './workbenchDrag'
import type { TaskStatus, WorkbenchTask } from './types'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: '待办' },
  { status: 'doing', label: '进行中' },
  { status: 'done', label: '已完成' },
]

export type MainlineLaneKind = 'personalMainline' | 'teamMainline'

interface MainlineLaneBoardProps {
  projectId: string
  kind: MainlineLaneKind
  title: string
  subtitle: string
  onOpenTask: (taskId: string) => void
}

export default function MainlineLaneBoard({
  projectId,
  kind,
  title,
  subtitle,
  onOpenTask,
}: MainlineLaneBoardProps) {
  const tasks = useWorkbenchStore((s) => s.tasks)
  const remoteMainline = useWorkbenchStore((s) => s.remoteMainline)
  const updateTask = useWorkbenchStore((s) => s.updateTask)
  const updateRemoteMainlineTask = useWorkbenchStore((s) => s.updateRemoteMainlineTask)
  const deleteMainlineTask = useWorkbenchStore((s) => s.deleteMainlineTask)
  const createMainlineTask = useWorkbenchStore((s) => s.createMainlineTask)
  const submitToTeamMainline = useWorkbenchStore((s) => s.submitToTeamMainline)
  const isLive = useWorkbenchStore((s) => s.isLiveForProject(projectId))
  const lead = useWorkbenchStore((s) => s.isLead())

  const [draft, setDraft] = useState('')
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null)
  const [contextMenu, setContextMenu] = useState<{ task: WorkbenchTask; x: number; y: number } | null>(null)
  const dragStartedRef = useRef(false)

  const boardTasks = useMemo(() => {
    if (kind === 'teamMainline') {
      return remoteMainline
        .filter((t) => t.projectId === projectId)
        .slice()
        .sort((a, b) => a.order - b.order)
    }
    return tasks
      .filter((t) => t.projectId === projectId && t.space === 'mainline')
      .slice()
      .sort((a, b) => a.order - b.order)
  }, [kind, tasks, remoteMainline, projectId])

  const canDelete = kind === 'personalMainline' ? true : !isLive || lead
  const remote = kind === 'teamMainline'
  const canCreate = kind === 'personalMainline'

  const onStatusChange = (taskId: string, status: TaskStatus) => {
    if (!remote) {
      updateTask(taskId, { status })
      return
    }
    void updateRemoteMainlineTask(taskId, { status })
  }

  const onDelete = (taskId: string) => {
    if (!window.confirm(kind === 'teamMainline' ? '确定将该任务移到回收站？' : '确定从主线删除该任务？')) return
    void deleteMainlineTask(taskId, kind)
  }

  const handleOpenTask = (taskId: string) => {
    if (dragStartedRef.current) {
      dragStartedRef.current = false
      return
    }
    onOpenTask(taskId)
  }

  const handleContextMenu = (event: React.MouseEvent, task: WorkbenchTask) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ task, x: event.clientX, y: event.clientY })
  }

  const submitDraft = () => {
    const title = draft.trim()
    if (!title) return
    createMainlineTask(projectId, title)
    setDraft('')
  }

  const handleDragStart = (event: DragEvent, taskId: string, source: WorkbenchDragSource) => {
    const target = event.target as HTMLElement
    if (target.closest('button, select, textarea, input, [data-no-drag]')) {
      event.preventDefault()
      return
    }
    dragStartedRef.current = true
    event.dataTransfer.setData(
      'application/x-wb-task-drag',
      encodeWorkbenchDragPayload({ taskId, source }),
    )
    event.dataTransfer.effectAllowed = 'move'
    setDraggingTaskId(taskId)
  }

  const clearDragState = () => {
    setDraggingTaskId(null)
    setDragOverStatus(null)
    window.setTimeout(() => {
      dragStartedRef.current = false
    }, 50)
  }

  const handleLaneDragOver = (event: DragEvent, status: TaskStatus) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverStatus(status)
  }

  const handleLaneDragLeave = (event: DragEvent) => {
    const relatedTarget = event.relatedTarget as HTMLElement | null
    const currentTarget = event.currentTarget as HTMLElement
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setDragOverStatus(null)
    }
  }

  const resolveSourceTask = (payload: { taskId: string; source: WorkbenchDragSource }): WorkbenchTask | null => {
    if (payload.source === 'personalMainline') {
      return tasks.find((t) => t.id === payload.taskId && t.space === 'mainline') ?? null
    }
    return remoteMainline.find((t) => t.id === payload.taskId) ?? null
  }

  const handleLaneDrop = (event: DragEvent, status: TaskStatus) => {
    event.preventDefault()
    const payload = readWorkbenchDragPayload(event.dataTransfer)
    if (!payload) {
      clearDragState()
      return
    }

    if (payload.source === kind) {
      const task = boardTasks.find((item) => item.id === payload.taskId)
      if (task && shouldUpdateMainlineStatus(task.status, status)) {
        onStatusChange(task.id, status)
      }
      clearDragState()
      return
    }

    if (kind === 'teamMainline' && isLive && payload.source === 'personalMainline') {
      const source = resolveSourceTask(payload)
      if (source) void submitToTeamMainline(source, status)
      clearDragState()
      return
    }

    clearDragState()
  }

  return (
    <WbPanel className="wb-lane-board flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="wb-panel-header px-3 py-2.5">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <p className="mt-0.5 text-[11px] text-text-muted">{subtitle}</p>
        {canCreate ? (
          <div className="mt-2 flex gap-2" data-no-drag>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitDraft()
              }}
              placeholder="输入任务标题，回车创建"
              aria-label="新建个人主线任务"
              className="interactive-glass min-w-0 flex-1 rounded-xl px-2.5 py-1.5 text-xs text-text bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={submitDraft}
              className="interactive-glass dashboard-chip shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-primary"
            >
              添加
            </button>
          </div>
        ) : null}
      </header>

      <div className="wb-board-grid grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-2 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = boardTasks.filter((t) => t.status === col.status)
          const isDropTarget = dragOverStatus === col.status
          return (
            <div
              key={col.status}
              className={`wb-lane flex min-h-0 flex-col${isDropTarget ? ' wb-lane--drop-target' : ''}`}
              data-status={col.status}
              onDragOver={(event) => handleLaneDragOver(event, col.status)}
              onDragLeave={handleLaneDragLeave}
              onDrop={(event) => handleLaneDrop(event, col.status)}
            >
              <div className="wb-lane-label wb-section-divider px-2.5 py-1.5 text-xs text-text">
                {col.label}
                <span className="ml-1 text-text-muted">({items.length})</span>
              </div>
              <div className="motion-stagger flex min-h-[4.5rem] flex-1 flex-col gap-2 p-2">
                {items.length === 0 ? (
                  <p className="py-4 text-center text-xs text-text-muted">拖入任务或保持为空</p>
                ) : (
                  items.map((task) => (
                    <div
                      key={task.id}
                      className="wb-task-wrap"
                      draggable
                      onDragStart={(event) => handleDragStart(event, task.id, kind)}
                      onDragEnd={clearDragState}
                    >
                      <TaskRow
                        task={task}
                        isDragging={draggingTaskId === task.id}
                        onOpen={handleOpenTask}
                        onContextMenu={(event) => handleContextMenu(event, task)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {contextMenu ? (
        <MainlineTaskContextMenu
          task={contextMenu.task}
          x={contextMenu.x}
          y={contextMenu.y}
          canDelete={canDelete}
          onClose={() => setContextMenu(null)}
          onOpen={() => handleOpenTask(contextMenu.task.id)}
          onStatusChange={(status) => onStatusChange(contextMenu.task.id, status)}
          deleteLabel={kind === 'teamMainline' ? '移到回收站' : '删除'}
          onDelete={() => onDelete(contextMenu.task.id)}
        />
      ) : null}
    </WbPanel>
  )
}
