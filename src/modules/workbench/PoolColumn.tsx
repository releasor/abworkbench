import { useMemo } from 'react'
import { showToast } from '../taskflow/utils/toastEvent'
import TaskRow from './TaskRow'
import WbPanel from './WbPanel'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'

interface PoolColumnProps {
  projectId: string
  onOpenTask: (taskId: string) => void
}

export default function PoolColumn({ projectId, onOpenTask }: PoolColumnProps) {
  const remoteMembers = useWorkbenchStore((s) => s.remoteMembers)
  const remotePool = useWorkbenchStore((s) => s.remotePool)
  const connection = useWorkbenchStore((s) => s.connection)
  const promoteRemote = useWorkbenchStore((s) => s.promoteRemote)
  const isOnMainline = useWorkbenchStore((s) => s.isOnMainline)
  const remoteLeadIds = useWorkbenchStore((s) => s.remoteLeadIds)
  const user = useWorkbenchStore((s) => s.user)

  const isLive = connection.mode !== 'offline' && connection.projectId === projectId
  const lead =
    connection.mode === 'offline' ||
    remoteLeadIds.includes(connection.localUser.id || user.id)

  const pool = useMemo(() => {
    if (!isLive) return []
    return remotePool
      .filter((t) => t.projectId === projectId)
      .slice()
      .sort((a, b) => a.order - b.order)
  }, [isLive, remotePool, projectId])

  const memberName = (authorId: string) =>
    remoteMembers.find((m) => m.id === authorId)?.displayName || authorId

  return (
    <WbPanel className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="wb-panel-header px-3 py-2.5">
        <h2 className="text-sm font-semibold text-text">所有人</h2>
        <p className="mt-0.5 text-[11px] text-text-muted">公开池 · 可被负责人拉入主线</p>
      </header>

      <div className="motion-stagger flex flex-1 flex-col gap-2 overflow-auto p-3">
        {!isLive ? (
          <p className="py-6 text-center text-sm text-text-muted">加入或开房后，这里会显示团队需求池</p>
        ) : pool.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">暂无公开池任务</p>
        ) : (
          pool.map((task) => {
            const onMainline = isOnMainline(task.id, projectId)
            return (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={onOpenTask}
                trailing={
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="max-w-[5.5rem] truncate text-[10px] text-text-muted">
                      {memberName(task.authorId)}
                    </span>
                    {onMainline ? (
                      <span className="wb-badge-on-mainline">已在主线</span>
                    ) : lead ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (isOnMainline(task.id, projectId)) {
                            showToast('该任务已在主线中', 'error')
                            return
                          }
                          void promoteRemote(task)
                        }}
                        className="interactive-glass dashboard-chip rounded-xl px-2 py-1 text-xs font-semibold text-text-muted"
                      >
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
    </WbPanel>
  )
}
