import { useCallback, useEffect, useRef, useState } from 'react'
import LibraryPanel from './LibraryPanel'
import ReadingPanel from './ReadingPanel'
import DisguisePanel from './DisguisePanel'

export interface ReaderUiSettings {
  opacity: number
  fontSize: number
  fontColor: string
  bossKey: string
  disguiseEnabled: boolean
  novelDir: string
  windowBounds: { x: number; y: number; width: number; height: number } | null
  bossKeyError?: string
}

type View = 'library' | 'reading' | 'disguise'

const DEFAULT_SETTINGS: ReaderUiSettings = {
  opacity: 0.85,
  fontSize: 16,
  fontColor: '#e8e8e8',
  bossKey: 'Ctrl+Shift+Q',
  disguiseEnabled: false,
  novelDir: '',
  windowBounds: null,
}

export default function StealthReaderApp() {
  const [view, setView] = useState<View>('library')
  const [bookId, setBookId] = useState<string | undefined>()
  const [settings, setSettings] = useState<ReaderUiSettings>(DEFAULT_SETTINGS)
  const [error, setError] = useState('')
  const readingBeforeDisguise = useRef(false)

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')
    html.style.background = 'transparent'
    body.style.background = 'transparent'
    if (root) root.style.background = 'transparent'
    document.title = '摸鱼阅读'
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void window.electronAPI?.getReaderSettings?.().then((s) => {
        if (s) setSettings({ ...DEFAULT_SETTINGS, ...s })
      })
    })
  }, [])

  const openBook = useCallback((id: string) => {
    setBookId(id)
    setView('reading')
    setError('')
  }, [])

  useEffect(() => {
    const offShown = window.electronAPI?.onReaderShown?.((payload) => {
      if (payload.mode === 'library') {
        setView('library')
        return
      }
      if (payload.bookId) openBook(payload.bookId)
      else setView('library')
    })
    const offDisguise = window.electronAPI?.onReaderToggleDisguise?.(() => {
      setView((prev) => {
        if (prev === 'disguise') {
          return readingBeforeDisguise.current ? 'reading' : 'library'
        }
        readingBeforeDisguise.current = prev === 'reading'
        return 'disguise'
      })
    })
    return () => {
      offShown?.()
      offDisguise?.()
    }
  }, [openBook])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        void window.electronAPI?.hideReader?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const patchSettings = useCallback(async (partial: Partial<ReaderUiSettings>) => {
    const next = { ...settings, ...partial }
    setSettings(next)
    const saved = await window.electronAPI?.setReaderSettings?.(next)
    if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved })
    if (typeof partial.opacity === 'number') {
      void window.electronAPI?.readerWindowControl?.({ type: 'set-opacity', opacity: partial.opacity })
    }
  }, [settings])

  return (
    <div
      className="h-screen w-screen overflow-hidden select-none"
      style={{ background: `rgba(12, 14, 18, ${settings.opacity * 0.55})` }}
    >
      {view === 'library' && (
        <LibraryPanel
          settings={settings}
          error={error}
          onError={setError}
          onOpenBook={openBook}
          onPatchSettings={patchSettings}
        />
      )}
      {view === 'reading' && bookId && (
        <ReadingPanel
          bookId={bookId}
          settings={settings}
          onError={setError}
          onBackLibrary={() => setView('library')}
          onPatchSettings={patchSettings}
        />
      )}
      {view === 'disguise' && <DisguisePanel />}
      {error && view !== 'disguise' && (
        <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-red-500/20 border border-red-400/40 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      )}
    </div>
  )
}
