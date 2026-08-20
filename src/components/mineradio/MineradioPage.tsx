import { useCallback, useEffect, useRef, useState } from 'react'
import { Music2, RefreshCw } from 'lucide-react'

type MineradioStatus = {
  ok: boolean
  url?: string
  mode?: 'full' | 'static'
  root?: string
  message?: string
  installing?: boolean
  port?: number
  preloadPath?: string
  embedEngine?: 'webview-native' | 'iframe-bridge'
}

type BridgeRequest = {
  source: string
  id: string
  method: string
  args?: unknown
}

export default function MineradioPage() {
  const [status, setStatus] = useState<MineradioStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const useNative = Boolean(status?.preloadPath && status.embedEngine === 'webview-native')

  const start = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ensure = window.electronAPI?.ensureMineradio
      if (!ensure) {
        setError('请在桌面端（Electron）中打开 Abworkbench，以嵌入 Mineradio。')
        setStatus(null)
        return
      }
      const next = await ensure()
      setStatus(next)
      if (!next.ok || !next.url) {
        setError(next.message || 'Mineradio 启动失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mineradio 启动失败')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void start()
  }, [start])

  useEffect(() => {
    const host = mountRef.current
    if (!host || !status?.url || loading || error) return

    host.replaceChildren()
    iframeRef.current = null

    if (useNative) {
      const el = document.createElement('webview')
      el.setAttribute('src', status.url)
      el.setAttribute('partition', 'persist:abwb-mineradio-embed')
      el.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no, sandbox=no')
      el.className = 'mineradio-embed__frame'
      el.style.width = '100%'
      el.style.height = '100%'
      el.style.display = 'flex'
      el.style.flex = '1'
      el.style.border = '0'
      el.style.background = '#050505'
      host.appendChild(el)
      return () => {
        host.replaceChildren()
      }
    }

    const frame = document.createElement('iframe')
    frame.title = 'Mineradio'
    frame.className = 'mineradio-embed__frame'
    frame.src = status.url
    frame.allow = 'autoplay; clipboard-read; clipboard-write; fullscreen'
    frame.style.width = '100%'
    frame.style.height = '100%'
    frame.style.border = '0'
    frame.style.flex = '1'
    frame.style.background = '#050505'
    host.appendChild(frame)
    iframeRef.current = frame

    return () => {
      host.replaceChildren()
      iframeRef.current = null
    }
  }, [status, loading, error, useNative])

  useEffect(() => {
    if (useNative) return

    const onMessage = async (event: MessageEvent) => {
      const data = event.data as BridgeRequest | null
      if (!data || data.source !== 'mineradio-desktop-bridge' || !data.id || !data.method) return
      const frameWindow = iframeRef.current?.contentWindow
      if (!frameWindow || event.source !== frameWindow) return

      const reply = (payload: { ok: boolean; result?: unknown; error?: string }) => {
        try {
          frameWindow.postMessage({ source: 'abwb-desktop-bridge', id: data.id, ...payload }, '*')
        } catch {
          // ignore
        }
      }

      try {
        const api = window.electronAPI
        let result: unknown
        if (data.method === 'openNeteaseMusicLogin') {
          result = await api?.openMineradioNeteaseLogin?.()
        } else if (data.method === 'openQQMusicLogin') {
          result = await api?.openMineradioQQLogin?.(data.args as { forceReauth?: boolean } | undefined)
        } else if (data.method === 'openKugouMusicLogin') {
          result = await api?.openMineradioKugouLogin?.()
        } else if (data.method === 'saveMineradioAccount') {
          result = await api?.saveMineradioAccount?.((data.args as Record<string, unknown>) || {})
        } else if (data.method === 'listMineradioAccounts') {
          result = await api?.listMineradioAccounts?.()
        } else {
          reply({ ok: false, error: `unsupported method: ${data.method}` })
          return
        }
        reply({ ok: true, result })
      } catch (err) {
        reply({ ok: false, error: err instanceof Error ? err.message : String(err) })
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [useNative])

  if (loading) {
    return (
      <div className="mineradio-embed mineradio-embed--state">
        <Music2 className="w-8 h-8 text-[var(--accent,#00f5d4)] animate-pulse" />
        <p className="text-sm text-[var(--text-secondary)]">正在启动 Mineradio…</p>
        <p className="text-xs text-[var(--text-muted)]">首次打开可能需要安装依赖，请稍候</p>
      </div>
    )
  }

  if (error || !status?.url) {
    return (
      <div className="mineradio-embed mineradio-embed--state">
        <Music2 className="w-8 h-8 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-secondary)]">{error || '无法加载 Mineradio'}</p>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)]"
          onClick={() => void start()}
        >
          <RefreshCw className="w-4 h-4" />
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="mineradio-embed">
      {status.mode === 'static' && status.message ? (
        <div className="mineradio-embed__banner" title={status.message}>
          {status.message}
        </div>
      ) : null}
      <div ref={mountRef} className="mineradio-embed__mount" />
    </div>
  )
}
