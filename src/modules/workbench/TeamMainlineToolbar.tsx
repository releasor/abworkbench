import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import WbPanel from './WbPanel'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'
import {
  ACTIVITY_ACTION_LABEL,
  memberLabel,
  statusLabel,
} from './teamMainlineActivity.ts'
import type { TaskStatus } from './types.ts'

interface TeamMainlineToolbarProps {
  projectId: string
}

export default function TeamMainlineToolbar({ projectId }: TeamMainlineToolbarProps) {
  const [openPanel, setOpenPanel] = useState<'log' | 'trash' | null>(null)
  const connection = useWorkbenchStore((s) => s.connection)
  const remoteActivityLog = useWorkbenchStore((s) => s.remoteActivityLog)
  const remoteMainlineTrash = useWorkbenchStore((s) => s.remoteMainlineTrash)
  const remoteMembers = useWorkbenchStore((s) => s.remoteMembers)
  const isLead = useWorkbenchStore((s) => s.isLead())
  const restoreTeamMainlineTask = useWorkbenchStore((s) => s.restoreTeamMainlineTask)
  const purgeTeamMainlineTask = useWorkbenchStore((s) => s.purgeTeamMainlineTask)

  const isLive = connection.mode !== 'offline' && connection.projectId === projectId

  const activityLog = useMemo(() => {
    if (!isLive) return []
    return remoteActivityLog.filter((entry) => entry.projectId === projectId)
  }, [isLive, projectId, remoteActivityLog])

  const trashItems = useMemo(() => {
    if (!isLive) return []
    return remoteMainlineTrash.filter((item) => item.task.projectId === projectId)
  }, [isLive, projectId, remoteMainlineTrash])

  const trashCount = trashItems.length

  const logRows = useMemo(
    () =>
      activityLog.map((entry) => {
        const actor = memberLabel(remoteMembers, entry.actorId)
        const action = ACTIVITY_ACTION_LABEL[entry.action]
        const detail = entry.details
          ? entry.action === 'updated' && ['todo', 'doing', 'done'].includes(entry.details)
            ? statusLabel(entry.details as TaskStatus)
            : entry.details
          : ''
        return {
          id: entry.id,
          time: new Date(entry.timestamp).toLocaleString(),
          text: detail
            ? `${actor} ${action}「${entry.taskTitle}」→ ${detail}`
            : `${actor} ${action}「${entry.taskTitle}」`,
        }
      }),
    [activityLog, remoteMembers],
  )

  useEffect(() => {
    if (!openPanel) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPanel(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openPanel])

  const modalTitle = openPanel === 'log' ? '团队主线变更日志' : '团队主线回收站'

  return (
    <>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpenPanel('log')}
          className={
            'interactive-glass dashboard-chip rounded-xl px-2.5 py-1 text-xs font-semibold ' +
            (openPanel === 'log' ? 'text-primary' : 'text-text-muted')
          }
          aria-haspopup="dialog"
          aria-expanded={openPanel === 'log'}
        >
          变更日志{activityLog.length > 0 ? ` (${activityLog.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setOpenPanel('trash')}
          className={
            'interactive-glass dashboard-chip rounded-xl px-2.5 py-1 text-xs font-semibold ' +
            (openPanel === 'trash' ? 'text-primary' : 'text-text-muted')
          }
          aria-haspopup="dialog"
          aria-expanded={openPanel === 'trash'}
        >
          回收站{trashCount > 0 ? ` (${trashCount})` : ''}
        </button>
      </div>

      {openPanel
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label={modalTitle}
            >
              <button
                type="button"
                className="absolute inset-0 modal-veil"
                onClick={() => setOpenPanel(null)}
                aria-label="关闭弹窗"
              />
              <WbPanel
                className="wb-team-modal modal-panel-cinematic liquid-glass-panel relative z-10 flex max-h-[min(32rem,80vh)] w-full max-w-lg flex-col shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <header className="wb-panel-header flex items-center justify-between px-4 py-3">
                  <h3 className="text-sm font-semibold text-text">{modalTitle}</h3>
                  <button
                    type="button"
                    onClick={() => setOpenPanel(null)}
                    className="interactive-glass dashboard-chip rounded-xl px-2 py-1 text-xs font-semibold text-text-muted"
                  >
                    关闭
                  </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {openPanel === 'log' ? (
                    logRows.length === 0 ? (
                      <p className="py-8 text-center text-xs text-text-muted">暂无变更记录</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {logRows.map((row) => (
                          <li
                            key={row.id}
                            className="rounded-xl border border-white/5 px-2.5 py-2 text-xs text-text"
                          >
                            <div className="text-[10px] text-text-muted">{row.time}</div>
                            <div className="mt-0.5 leading-relaxed">{row.text}</div>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : trashItems.length === 0 ? (
                    <p className="py-8 text-center text-xs text-text-muted">回收站为空</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {trashItems.map((item) => (
                        <li
                          key={item.task.id}
                          className="rounded-xl border border-white/5 px-2.5 py-2 text-xs text-text"
                        >
                          <div className="font-medium text-sm">{item.task.title}</div>
                          <div className="mt-1 text-[10px] text-text-muted">
                            {statusLabel(item.task.status)} · 删除于{' '}
                            {new Date(item.deletedAt).toLocaleString()} ·{' '}
                            {memberLabel(remoteMembers, item.deletedBy)}
                          </div>
                          {isLead ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => void restoreTeamMainlineTask(item.task.id)}
                                className="interactive-glass dashboard-chip rounded-lg px-2 py-0.5 text-[10px] font-semibold text-primary"
                              >
                                恢复
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('确定永久删除该任务？')) {
                                    void purgeTeamMainlineTask(item.task.id)
                                  }
                                }}
                                className="interactive-glass dashboard-chip rounded-lg px-2 py-0.5 text-[10px] font-semibold text-red-300"
                              >
                                永久删除
                              </button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </WbPanel>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
