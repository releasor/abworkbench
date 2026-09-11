import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TaskStatus, WorkbenchTask } from './types'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '待办' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
]

interface TaskDrawerProps {
  task: WorkbenchTask | null
  onClose: () => void
}

export default function TaskDrawer({ task, onClose }: TaskDrawerProps) {
  const connection = useWorkbenchStore((s) => s.connection)
  const updateTask = useWorkbenchStore((s) => s.updateTask)
  const updateRemoteMainlineTask = useWorkbenchStore((s) => s.updateRemoteMainlineTask)
  const [title, setTitle] = useState(task?.title ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [seedTaskId, setSeedTaskId] = useState(task?.id ?? null)
  const nextTaskId = task?.id ?? null
  if (nextTaskId !== seedTaskId) {
    setSeedTaskId(nextTaskId)
    if (task) {
      setTitle(task.title)
      setStatus(task.status)
      setDueDate(task.dueDate ?? '')
      setDescription(task.description ?? '')
    }
  }

  useEffect(() => {
    if (!task) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [task, onClose])

  if (!task) return null

  const live = connection.mode !== 'offline' && connection.projectId === task.projectId
  const save = (patch: Partial<Pick<WorkbenchTask, 'title' | 'status' | 'dueDate' | 'description'>>) => {
    if (task.space === 'pool') return
    if (live && task.space === 'mainline') {
      void updateRemoteMainlineTask(task.id, patch)
      return
    }
    updateTask(task.id, patch)
  }

  return createPortal(
    <div
      className="wb-drawer-veil fixed inset-0 z-[200] flex"
      role="dialog"
      aria-modal="true"
      aria-label="任务详情"
    >
      <button
        type="button"
        className="absolute inset-0 modal-veil"
        onClick={onClose}
        aria-label="关闭任务详情"
      />
      <aside
        className="wb-drawer-panel wb-drawer-panel--glass modal-panel-cinematic liquid-glass-panel relative z-10 flex min-h-0 flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wb-panel-header flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-text">任务详情</h2>
          <button
            type="button"
            onClick={onClose}
            className="interactive-glass dashboard-chip rounded-xl px-2 py-1 text-xs font-semibold text-text-muted"
          >
            关闭
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
          <label className="block">
            <span className="mb-1 block text-xs text-text-muted">标题</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                const next = title.trim()
                if (next && next !== task.title) save({ title: next })
                else setTitle(task.title)
              }}
              className="interactive-glass w-full rounded-xl px-3 py-2 text-sm text-text bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-text-muted">状态</span>
            <select
              value={status}
              onChange={(e) => {
                const next = e.target.value as TaskStatus
                setStatus(next)
                save({ status: next })
              }}
              className="interactive-glass w-full rounded-xl px-3 py-2 text-sm text-text bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-text-muted">截止日期</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                const next = e.target.value
                setDueDate(next)
                save({ dueDate: next || null })
              }}
              className="interactive-glass w-full rounded-xl px-3 py-2 text-sm text-text bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block flex-1">
            <span className="mb-1 block text-xs text-text-muted">描述</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (description !== (task.description ?? '')) {
                  save({ description })
                }
              }}
              rows={6}
              className="interactive-glass w-full resize-none rounded-xl px-3 py-2 text-sm text-text bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="可选描述"
            />
          </label>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
