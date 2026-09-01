import { useState } from 'react'
import { showToast } from '../taskflow/utils/toastEvent'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'

interface ProjectListProps {
  onOpenProject: (projectId: string) => void
}

export default function ProjectList({ onOpenProject }: ProjectListProps) {
  const projects = useWorkbenchStore((s) => s.projects)
  const createProject = useWorkbenchStore((s) => s.createProject)
  const connection = useWorkbenchStore((s) => s.connection)
  const joinRoom = useWorkbenchStore((s) => s.joinRoom)
  const disconnect = useWorkbenchStore((s) => s.disconnect)
  const [name, setName] = useState('')
  const [joinUrl, setJoinUrl] = useState('')
  const [joinPassphrase, setJoinPassphrase] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      showToast('请先为项目命名', 'error')
      return
    }
    const id = createProject(trimmed)
    if (!id) {
      showToast('创建项目失败', 'error')
      return
    }
    setName('')
    onOpenProject(id)
  }

  const onJoin = async () => {
    setBusy(true)
    try {
      const result = await joinRoom({
        baseUrl: joinUrl.trim(),
        passphrase: joinPassphrase.trim() || undefined,
        displayName: displayName.trim() || undefined,
      })
      if (!result.ok) {
        showToast(result.error, 'error')
        return
      }
      showToast('已加入房间', 'success')
      onOpenProject(result.projectId)
    } finally {
      setBusy(false)
    }
  }

  const liveName =
    connection.projectName ||
    projects.find((p) => p.id === connection.projectId)?.name ||
    '项目'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 motion-enter">
      <div>
        <h1 className="wb-title text-xl font-semibold text-text">工作台</h1>
        <p className="wb-subtitle mt-1 text-sm">
          先创建并命名项目；开房在项目内进行，且只绑定那一个项目。
        </p>
      </div>

      {connection.mode !== 'offline' && connection.projectId ? (
        <div className="wb-panel flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
          <span className="wb-mode-pill" data-mode={connection.mode}>
            {connection.mode === 'hosting' ? '已开房' : '已加入'}
          </span>
          <span className="text-text">
            房间绑定：<strong>{liveName}</strong>
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => onOpenProject(connection.projectId!)}
              className="wb-btn-primary px-3 py-1 text-xs"
            >
              进入该项目
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void disconnect()}
              className="wb-btn px-3 py-1 text-xs"
            >
              断开
            </button>
          </div>
        </div>
      ) : (
        <section className="wb-panel p-4">
          <h2 className="text-sm font-semibold text-text">加入他人房间</h2>
          <p className="wb-subtitle mt-1 text-xs">加入后会进入对方当前开房的那一个项目。</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
              <span className="text-[10px] text-text-muted">主机地址</span>
              <input
                value={joinUrl}
                onChange={(e) => setJoinUrl(e.target.value)}
                placeholder="http://192.168.x.x:端口"
                className="wb-input px-2 py-1.5 text-xs"
              />
            </label>
            <label className="flex w-24 flex-col gap-1">
              <span className="text-[10px] text-text-muted">口令</span>
              <input
                value={joinPassphrase}
                onChange={(e) => setJoinPassphrase(e.target.value)}
                placeholder="可选"
                className="wb-input px-2 py-1.5 text-xs"
              />
            </label>
            <label className="flex w-24 flex-col gap-1">
              <span className="text-[10px] text-text-muted">显示名</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="可选"
                className="wb-input px-2 py-1.5 text-xs"
              />
            </label>
            <button
              type="button"
              disabled={busy || !joinUrl.trim()}
              onClick={() => void onJoin()}
              className="wb-btn-primary px-3 py-1.5 text-xs"
            >
              加入
            </button>
          </div>
        </section>
      )}

      <section className="wb-panel wb-panel--hero p-4">
        <h2 className="text-sm font-semibold text-text">第一步：命名并创建项目</h2>
        <p className="wb-subtitle mt-1 text-xs">这里填的是项目名称，不是任务。开房请进入项目后再点。</p>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder="例如：产品迭代 / 毕业设计"
            autoFocus
            aria-label="项目名称"
            className="wb-input min-w-0 flex-1 px-3 py-2 text-sm"
          />
          <button type="button" onClick={submit} className="wb-btn-primary shrink-0 px-4 py-2 text-sm">
            创建项目
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-text">已有项目</h2>
        {projects.length === 0 ? (
          <p className="wb-panel rounded-xl border-dashed px-4 py-8 text-center text-sm text-text-muted">
            还没有项目。请在上方输入名称后点「创建项目」。
          </p>
        ) : (
          <ul className="motion-stagger flex flex-col gap-2">
            {projects.map((p) => {
              const isBound = connection.projectId === p.id && connection.mode !== 'offline'
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpenProject(p.id)}
                    className="wb-panel wb-project-card flex w-full items-center justify-between px-4 py-3"
                  >
                    <span className="truncate text-sm font-medium text-text">{p.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-primary">
                      {isBound ? '协作中 →' : '进入 →'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
