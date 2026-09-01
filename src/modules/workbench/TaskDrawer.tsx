import { useEffect, useState } from 'react'
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
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setStatus(task.status)
    setDueDate(task.dueDate ?? '')
    setDescription(task.description ?? '')
  }, [task])

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

  return (
    <div className="wb-drawer-veil fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <aside className="wb-drawer-panel flex h-full w-full max-w-md flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="wb-panel-header flex items-center justify-between px-4 py-3">
          <h2 className="wb-title text-sm font-semibold text-text">任务详情</h2>
          <button type="button" onClick={onClose} className="wb-btn px-2 py-1 text-sm">
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
              className="wb-input w-full px-3 py-2 text-sm"
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
              className="wb-input w-full px-3 py-2 text-sm"
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
              className="wb-input w-full px-3 py-2 text-sm"
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
              className="wb-input w-full resize-none px-3 py-2 text-sm"
              placeholder="可选描述"
            />
          </label>
        </div>
      </aside>
    </div>
  )
}
