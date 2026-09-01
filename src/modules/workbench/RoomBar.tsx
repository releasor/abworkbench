import { useState } from 'react'
import { showToast } from '../taskflow/utils/toastEvent'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'

interface RoomBarProps {
  projectId: string
}

const MODE_LABEL = {
  offline: '未连接',
  hosting: '已开房',
  joined: '已加入',
} as const

export default function RoomBar({ projectId }: RoomBarProps) {
  const connection = useWorkbenchStore((s) => s.connection)
  const projects = useWorkbenchStore((s) => s.projects)
  const startHosting = useWorkbenchStore((s) => s.startHosting)
  const joinRoom = useWorkbenchStore((s) => s.joinRoom)
  const disconnect = useWorkbenchStore((s) => s.disconnect)
  const isLive = useWorkbenchStore((s) => s.isLiveForProject(projectId))

  const [passphrase, setPassphrase] = useState('')
  const [joinUrl, setJoinUrl] = useState('')
  const [joinPassphrase, setJoinPassphrase] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  const offline = connection.mode === 'offline'
  const boundElsewhere =
    !offline && connection.projectId != null && connection.projectId !== projectId
  const boundName =
    connection.projectName ||
    projects.find((p) => p.id === connection.projectId)?.name ||
    '另一项目'

  const onHost = async () => {
    setBusy(true)
    try {
      const result = await startHosting({
        projectId,
        passphrase: passphrase.trim() || undefined,
      })
      if (!result.ok) showToast(result.error, 'error')
      else showToast('本项目房间已开启', 'success')
    } finally {
      setBusy(false)
    }
  }

  const onJoin = async () => {
    setBusy(true)
    try {
      const result = await joinRoom({
        baseUrl: joinUrl.trim(),
        passphrase: joinPassphrase.trim() || undefined,
        displayName: displayName.trim() || undefined,
        projectId,
      })
      if (!result.ok) showToast(result.error, 'error')
      else {
        setShowJoin(false)
        showToast('已加入本项目房间', 'success')
      }
    } finally {
      setBusy(false)
    }
  }

  const onDisconnect = async () => {
    setBusy(true)
    try {
      await disconnect()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wb-panel wb-room flex flex-col gap-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tracking-wide text-text">局域网 · 本项目</span>
        {isLive ? (
          <span className="wb-mode-pill" data-mode={connection.mode}>
            {MODE_LABEL[connection.mode]}
          </span>
        ) : boundElsewhere ? (
          <span className="wb-mode-pill" data-mode="offline">
            房间在「{boundName}」
          </span>
        ) : (
          <span className="wb-mode-pill" data-mode="offline">
            未连接
          </span>
        )}
        {isLive && connection.mode === 'hosting' && connection.roomCode ? (
          <span className="text-xs text-text">
            短码 <span className="font-mono font-semibold text-primary">{connection.roomCode}</span>
          </span>
        ) : null}
        {isLive && connection.hostBaseUrl ? (
          <span className="truncate font-mono text-[11px] text-text-muted" title="本机连接地址">
            本机 {connection.hostBaseUrl}
          </span>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {offline ? (
            <>
              <input
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="开房口令（可选）"
                className="wb-input w-32 px-2 py-1 text-xs"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void onHost()}
                title="仅为当前项目开房"
                className="wb-btn-primary px-3 py-1 text-xs"
              >
                开房
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowJoin((v) => !v)}
                className="wb-btn px-3 py-1 text-xs"
              >
                加入
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDisconnect()}
              className="wb-btn px-3 py-1 text-xs"
            >
              断开
            </button>
          )}
        </div>
      </div>

      <p className="wb-subtitle text-[11px]">
        {isLive
          ? '协作仅限本项目：所有人池与团队主线只同步此项目'
          : boundElsewhere
            ? `当前房间绑定「${boundName}」。本页仅本机；回到该项目可继续协作，或断开后为本项目开房。`
            : '开房只绑定当前这一个项目，不会带上其他项目'}
      </p>

      {isLive && connection.mode === 'hosting' && connection.lanUrls && connection.lanUrls.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
          <span>他人加入请用：</span>
          {connection.lanUrls.map((url) => (
            <span key={url} className="font-mono text-text">
              {url}
            </span>
          ))}
        </div>
      ) : null}

      {offline && showJoin ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-2">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <span className="text-[10px] text-text-muted">主机地址</span>
            <input
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
              placeholder="http://192.168.x.x:端口"
              className="wb-input px-2 py-1 text-xs"
            />
          </label>
          <label className="flex w-28 flex-col gap-1">
            <span className="text-[10px] text-text-muted">口令</span>
            <input
              value={joinPassphrase}
              onChange={(e) => setJoinPassphrase(e.target.value)}
              placeholder="可选"
              className="wb-input px-2 py-1 text-xs"
            />
          </label>
          <label className="flex w-28 flex-col gap-1">
            <span className="text-[10px] text-text-muted">显示名</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="可选"
              className="wb-input px-2 py-1 text-xs"
            />
          </label>
          <button
            type="button"
            disabled={busy || !joinUrl.trim()}
            onClick={() => void onJoin()}
            className="wb-btn-primary px-3 py-1 text-xs"
          >
            确认加入
          </button>
        </div>
      ) : null}
    </div>
  )
}
