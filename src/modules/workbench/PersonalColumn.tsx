import { useMemo, useState } from 'react'
import { showToast } from '../taskflow/utils/toastEvent'
import TaskRow from './TaskRow'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'

interface PersonalColumnProps {
  projectId: string
  onOpenTask: (taskId: string) => void
}

export default function PersonalColumn({ projectId, onOpenTask }: PersonalColumnProps) {
  const tasks = useWorkbenchStore((s) => s.tasks)
  const createPersonalTask = useWorkbenchStore((s) => s.createPersonalTask)
  const promoteToLocalMainline = useWorkbenchStore((s) => s.promoteToLocalMainline)
  const promoteRemote = useWorkbenchStore((s) => s.promoteRemote)
  const submitToPool = useWorkbenchStore((s) => s.submitToPool)
  const isOnMainline = useWorkbenchStore((s) => s.isOnMainline)
  const isLive = useWorkbenchStore((s) => s.isLiveForProject(projectId))
  const lead = useWorkbenchStore((s) => s.isLead())
  const [draft, setDraft] = useState('')

  const personal = useMemo(
    () =>
      tasks
        .filter((t) => t.projectId === projectId && t.space === 'personal')
        .slice()
        .sort((a, b) => a.order - b.order),
    [tasks, projectId],
  )

  const connected = isLive

  const submit = () => {
    const title = draft.trim()
    if (!title) return
    createPersonalTask(projectId, title)
    setDraft('')
  }

  const onPromote = (taskId: string) => {
    if (isOnMainline(taskId, projectId)) {
      showToast('该任务已在主线中', 'error')
      return
    }
    if (!connected) {
      promoteToLocalMainline(taskId)
      return
    }
    if (!lead) {
      showToast('仅负责人可将任务拉入主线', 'error')
      return
    }
    const task = personal.find((t) => t.id === taskId)
    if (task) void promoteRemote(task)
  }

  return (
    <section className="wb-panel flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="wb-panel-header px-3 py-2.5">
        <h2 className="wb-title text-sm font-semibold text-text">个人任务</h2>
        <p className="wb-subtitle text-[11px]">在这里添加任务，不是改项目名</p>
      </header>

      <div className="flex gap-2 border-b border-border/60 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="输入任务标题…"
          aria-label="任务标题"
          className="wb-input min-w-0 flex-1 px-3 py-2 text-sm"
        />
        <button type="button" onClick={submit} className="wb-btn-primary shrink-0 px-3 py-2 text-sm">
          添加任务
        </button>
      </div>

      <div className="motion-stagger flex flex-1 flex-col gap-2 overflow-auto p-3">
        {personal.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">暂无个人任务</p>
        ) : (
          personal.map((task) => {
            const onMainline = isOnMainline(task.id, projectId)
            return (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={onOpenTask}
                trailing={
                  <div className="flex shrink-0 flex-col gap-1">
                    {connected ? (
                      <button
                        type="button"
                        onClick={() => void submitToPool(task.id)}
                        className="wb-btn px-2 py-1 text-xs"
                      >
                        {task.pendingPoolRetry ? '重试提交' : '提交到所有人'}
                      </button>
                    ) : null}
                    {onMainline ? (
                      <span className="wb-badge-on-mainline text-center">已在主线</span>
                    ) : !connected || lead ? (
                      <button type="button" onClick={() => onPromote(task.id)} className="wb-btn px-2 py-1 text-xs">
                        拉入主线
                      </button>
                    ) : null}
                  </div>
                }
              />
            )
          })
        )}
      </div>
    </section>
  )
}
