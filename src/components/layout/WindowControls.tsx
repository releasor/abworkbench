import { useEffect, useState, type CSSProperties } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'

const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties

/**
 * Theme-matching window controls for the frameless main window.
 * Renders nothing outside the desktop (Electron) environment.
 */
export default function WindowControls() {
  const [maximized, setMaximized] = useState(false)
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined

  useEffect(() => {
    if (!api?.windowControl) return
    void api.isWindowMaximized?.().then(setMaximized)
    return api.onWindowMaximizedChanged?.(setMaximized)
  }, [api])

  if (!api?.windowControl) return null

  const btn = 'no-motion p-2 rounded-lg transition-colors text-text-muted hover:text-text hover:bg-surface-lighter'

  return (
    <div className="flex items-center gap-1" style={noDrag}>
      <button
        onClick={() => void api.windowControl?.('minimize')}
        aria-label="最小化"
        title="最小化"
        className={btn}
      >
        <Minus size={16} />
      </button>
      <button
        onClick={() => {
          void (async () => {
            await api.windowControl?.('toggle-maximize')
            const next = await api.isWindowMaximized?.()
            if (typeof next === 'boolean') setMaximized(next)
          })()
        }}
        aria-label={maximized ? '还原窗口' : '最大化'}
        title={maximized ? '还原' : '最大化'}
        className={btn}
      >
        {maximized ? <Copy size={14} /> : <Square size={14} />}
      </button>
      <button
        onClick={() => void api.windowControl?.('close')}
        aria-label="关闭（最小化到托盘）"
        title="关闭（最小化到托盘）"
        className="p-2 rounded-lg transition-colors text-text-muted hover:text-white hover:bg-danger"
      >
        <X size={16} />
      </button>
    </div>
  )
}
