import { useCallback, useEffect, useRef, useState } from 'react'
import { Music2, RefreshCw } from 'lucide-react'
import { useStore } from '../../store'

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

type EmbedTheme = 'light' | 'dark'

type MineradioWebview = HTMLElement & {
  executeJavaScript?: (code: string) => Promise<unknown>
  addEventListener: HTMLElement['addEventListener']
  removeEventListener: HTMLElement['removeEventListener']
}

function withEmbedTheme(url: string, theme: EmbedTheme): string {
  try {
    const next = new URL(url)
    next.searchParams.set('theme', theme)
    return next.toString()
  } catch {
    const join = url.includes('?') ? '&' : '?'
    return `${url}${join}theme=${theme}`
  }
}

function themeShellBackground(theme: EmbedTheme): string {
  return theme === 'light' ? '#f1f5f9' : '#050505'
}

function applyThemeScript(theme: EmbedTheme): string {
  return `(function(t){try{if(window.__abwbApplyTheme){window.__abwbApplyTheme(t);return;}var r=document.documentElement;r.dataset.theme=t;r.classList.toggle('abwb-theme-light',t==='light');r.classList.toggle('abwb-theme-dark',t!=='light');if(document.body)document.body.dataset.theme=t;r.style.colorScheme=t;}catch(e){}})(${JSON.stringify(theme)})`
}

export default function MineradioPage() {
  const themeMode = useStore((s) => s.themeMode)
  const embedTheme: EmbedTheme = themeMode === 'light' ? 'light' : 'dark'
  const [status, setStatus] = useState<MineradioStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const webviewRef = useRef<MineradioWebview | null>(null)
  const webviewReadyRef = useRef(false)
  const embedThemeRef = useRef(embedTheme)
  embedThemeRef.current = embedTheme
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

    const src = withEmbedTheme(status.url, embedThemeRef.current)
    const shellBg = themeShellBackground(embedThemeRef.current)

    host.replaceChildren()
    iframeRef.current = null
    webviewRef.current = null
    webviewReadyRef.current = false

    if (useNative) {
      const el = document.createElement('webview') as MineradioWebview
      el.setAttribute('src', src)
      el.setAttribute('partition', 'persist:abwb-mineradio-embed')
      el.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no, sandbox=no')
      el.className = 'mineradio-embed__frame'
      el.style.width = '100%'
      el.style.height = '100%'
      el.style.display = 'flex'
      el.style.flex = '1'
      el.style.border = '0'
      el.style.background = shellBg
      const onDomReady = () => {
        if (webviewRef.current !== el) return
        webviewReadyRef.current = true
        el.style.background = themeShellBackground(embedThemeRef.current)
        if (!el.isConnected || !el.executeJavaScript) return
        void el.executeJavaScript(applyThemeScript(embedThemeRef.current)).catch(() => {})
      }
      el.addEventListener('dom-ready', onDomReady)
      webviewRef.current = el
      host.appendChild(el)
      return () => {
        el.removeEventListener('dom-ready', onDomReady)
        webviewReadyRef.current = false
        webviewRef.current = null
        host.replaceChildren()
      }
    }

    const frame = document.createElement('iframe')
    frame.title = 'Mineradio'
    frame.className = 'mineradio-embed__frame'
    frame.src = src
    frame.allow = 'autoplay; clipboard-read; clipboard-write; fullscreen'
    frame.style.width = '100%'
    frame.style.height = '100%'
    frame.style.border = '0'
    frame.style.flex = '1'
    frame.style.background = shellBg
    host.appendChild(frame)
    iframeRef.current = frame

    return () => {
      host.replaceChildren()
      iframeRef.current = null
    }
    // Intentionally omit embedTheme: live theme sync uses postMessage / executeJavaScript.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per status/engine
  }, [status, loading, error, useNative])

  useEffect(() => {
    const shellBg = themeShellBackground(embedTheme)

    if (useNative) {
      const webview = webviewRef.current
      if (!webview) return
      webview.style.background = shellBg
      // executeJavaScript requires attached DOM + prior dom-ready
      if (!webviewReadyRef.current || !webview.isConnected || !webview.executeJavaScript) return
      void webview.executeJavaScript(applyThemeScript(embedTheme)).catch(() => {})
      return
    }

    const frame = iframeRef.current
    if (!frame) return
    frame.style.background = shellBg
    const pushTheme = () => {
      try {
        frame.contentWindow?.postMessage({ source: 'abwb-theme', theme: embedTheme }, '*')
      } catch {
        // ignore
      }
    }
    pushTheme()
    frame.addEventListener('load', pushTheme)
    return () => frame.removeEventListener('load', pushTheme)
  }, [embedTheme, useNative, status, loading, error])

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
        <p className="text-xs text-[var(--text-muted)]">正在拉起本地音乐服务，稍候即可播放</p>
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
    <div className="mineradio-embed" data-embed-theme={embedTheme}>
      {status.mode === 'static' && status.message ? (
        <div className="mineradio-embed__banner" title={status.message}>
          {status.message}
        </div>
      ) : null}
      <div ref={mountRef} className="mineradio-embed__mount" />
    </div>
  )
}
