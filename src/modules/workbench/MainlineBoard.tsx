import { useMemo } from 'react'
import TaskRow from './TaskRow'
import type { TaskStatus } from './types'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: '待办' },
  { status: 'doing', label: '进行中' },
  { status: 'done', label: '已完成' },
]

interface MainlineBoardProps {
  projectId: string
  onOpenTask: (taskId: string) => void
}

export default function MainlineBoard({ projectId, onOpenTask }: MainlineBoardProps) {
  const isLive = useWorkbenchStore((s) => s.isLiveForProject(projectId))
  const tasks = useWorkbenchStore((s) => s.tasks)
  const remoteMainline = useWorkbenchStore((s) => s.remoteMainline)
  const updateTask = useWorkbenchStore((s) => s.updateTask)
  const updateRemoteMainlineTask = useWorkbenchStore((s) => s.updateRemoteMainlineTask)
  const deleteMainlineTask = useWorkbenchStore((s) => s.deleteMainlineTask)
  const lead = useWorkbenchStore((s) => s.isLead())

  const mainline = useMemo(() => {
    if (!isLive) {
      return tasks
        .filter((t) => t.projectId === projectId && t.space === 'mainline')
        .slice()
        .sort((a, b) => a.order - b.order)
    }
    return remoteMainline
      .filter((t) => t.projectId === projectId)
      .slice()
      .sort((a, b) => a.order - b.order)
  }, [isLive, tasks, remoteMainline, projectId])

  const canDelete = !isLive || lead

  const onStatusChange = (taskId: string, status: TaskStatus) => {
    if (!isLive) {
      updateTask(taskId, { status })
    } else {
      void updateRemoteMainlineTask(taskId, { status })
    }
  }

  const onDelete = (taskId: string) => {
    if (!window.confirm('确定从主线删除该任务？')) return
    void deleteMainlineTask(taskId)
  }

  return (
    <section className="wb-panel wb-panel--hero flex min-h-[12rem] w-full shrink-0 flex-col motion-pop">
      <header className="wb-panel-header px-3 py-2.5">
        <h2 className="wb-title text-sm font-semibold text-text">主线</h2>
        <p className="wb-subtitle text-[11px]">团队真正在做的事（每个来源任务只能拉入一次）</p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = mainline.filter((t) => t.status === col.status)
          return (
            <div key={col.status} className="wb-lane flex min-h-0 flex-col" data-status={col.status}>
              <div className="wb-lane-label border-b border-border/50 px-2.5 py-1.5 text-xs text-text">
                {col.label}
                <span className="ml-1 text-text-muted">({items.length})</span>
              </div>
              <div className="motion-stagger flex flex-1 flex-col gap-2 p-2">
                {items.length === 0 ? (
                  <p className="py-4 text-center text-xs text-text-muted">空</p>
                ) : (
                  items.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onOpen={onOpenTask}
                      trailing={
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <select
                            aria-label="更改状态"
                            value={task.status}
                            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
                            className="wb-input max-w-[5.5rem] px-1 py-0.5 text-[10px] text-text-muted"
                          >
                            {COLUMNS.map((opt) => (
                              <option key={opt.status} value={opt.status}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => onDelete(task.id)}
                              className="wb-btn wb-btn-danger px-2 py-0.5 text-[10px]"
                            >
                              删除
                            </button>
                          ) : null}
                        </div>
                      }
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
