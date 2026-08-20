import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookMarked, ClipboardCopy, List, Minus, Plus, StickyNote, Undo2, X } from 'lucide-react'
import type { ReaderUiSettings } from './StealthReaderApp'
import { useStore } from '../../store'
import { buildHighlightParts, findTextMatches } from './readingFind'

interface ReadingPanelProps {
  bookId: string
  settings: ReaderUiSettings
  onError: (msg: string) => void
  onBackLibrary: (message?: string) => void
  onPatchSettings: (partial: Partial<ReaderUiSettings>) => Promise<void>
}

const PERMANENT_FAIL = /不存在|未能提取|不是 HTML|请输入|不支持|无效|已删除|404|not found/i

export default function ReadingPanel({
  bookId,
  settings,
  onError,
  onBackLibrary,
  onPatchSettings,
}: ReadingPanelProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [chapterIndex, setChapterIndex] = useState(0)
  const [chapterCount, setChapterCount] = useState(1)
  const [hasNext, setHasNext] = useState(true)
  const [loading, setLoading] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [tocOpen, setTocOpen] = useState(false)
  const [chapters, setChapters] = useState<Array<{ index: number; title: string }>>([])
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findIndex, setFindIndex] = useState(0)
  const [gotoOpen, setGotoOpen] = useState(false)
  const [gotoDraft, setGotoDraft] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const findInputRef = useRef<HTMLInputElement>(null)
  const gotoInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadGen = useRef(0)
  const hideChromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingProgress = useRef<{ chapterIndex: number; offset: number } | null>(null)
  const findOpenRef = useRef(false)
  const gotoOpenRef = useRef(false)
  const chapterIndexRef = useRef(0)
  const [chapterHistory, setChapterHistory] = useState<Array<{ index: number; offset: number }>>([])
  const [historyBookId, setHistoryBookId] = useState(bookId)
  if (historyBookId !== bookId) {
    setHistoryBookId(bookId)
    setChapterHistory([])
  }
  const historyDepth = chapterHistory.length
  const findLandedRef = useRef(false)

  useEffect(() => { findOpenRef.current = findOpen }, [findOpen])
  useEffect(() => { gotoOpenRef.current = gotoOpen }, [gotoOpen])
  useEffect(() => { chapterIndexRef.current = chapterIndex }, [chapterIndex])
  useEffect(() => { findLandedRef.current = false }, [body, chapterIndex])

  const flashStatus = useCallback((msg: string, ms = 1800) => {
    setStatusMsg(msg)
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => {
      statusTimer.current = null
      setStatusMsg('')
    }, ms)
  }, [])

  const bumpChrome = useCallback(() => {
    setChromeVisible(true)
    void window.electronAPI?.readerWindowControl?.({ type: 'set-click-through', enabled: false })
    if (hideChromeTimer.current) clearTimeout(hideChromeTimer.current)
    hideChromeTimer.current = setTimeout(() => {
      setChromeVisible(false)
      setTocOpen(false)
      // Keep overlays interactive; only arm click-through when find/goto closed.
      if (!findOpenRef.current && !gotoOpenRef.current) {
        void window.electronAPI?.readerWindowControl?.({ type: 'set-click-through', enabled: true })
      }
    }, 2200)
  }, [])

  useEffect(() => {
    queueMicrotask(() => bumpChrome())
    return () => {
      if (hideChromeTimer.current) clearTimeout(hideChromeTimer.current)
      void window.electronAPI?.readerWindowControl?.({ type: 'set-click-through', enabled: false })
    }
  }, [bumpChrome, bookId])

  const flushProgressNow = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const liveOffset = scrollRef.current?.scrollTop
    if (liveOffset != null && chapterIndexRef.current >= 0) {
      pendingProgress.current = { chapterIndex: chapterIndexRef.current, offset: liveOffset }
    }
    const pending = pendingProgress.current
    pendingProgress.current = null
    if (!pending) return
    void window.electronAPI?.readerSetProgress?.({
      bookId,
      chapterIndex: pending.chapterIndex,
      offset: pending.offset,
      updatedAt: Date.now(),
    })
  }, [bookId])

  const persistProgress = useCallback((index: number, offset: number) => {
    pendingProgress.current = { chapterIndex: index, offset }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      const pending = pendingProgress.current
      pendingProgress.current = null
      if (!pending) return
      void window.electronAPI?.readerSetProgress?.({
        bookId,
        chapterIndex: pending.chapterIndex,
        offset: pending.offset,
        updatedAt: Date.now(),
      })
    }, 400)
  }, [bookId])

  useEffect(() => () => {
    flushProgressNow()
  }, [bookId, flushProgressNow])

  // Boss-hide keeps the window mounted — flush before the OS marks us hidden.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flushProgressNow()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', flushProgressNow)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', flushProgressNow)
    }
  }, [flushProgressNow])

  const loadChapter = useCallback(async (
    index: number,
    opts?: { restoreOffset?: number; isInitial?: boolean; fromHistory?: boolean },
  ) => {
    const fromIndex = chapterIndexRef.current
    const fromOffset = scrollRef.current?.scrollTop ?? 0
    const gen = ++loadGen.current
    onError('')
    setLoading(true)
    setTocOpen(false)
    try {
      const result = await window.electronAPI?.readerGetChapter?.(bookId, index)
      if (gen !== loadGen.current) return false

      if (!result) {
        onError('无法读取章节')
        if (opts?.isInitial) onBackLibrary('无法读取章节，已返回书架')
        return false
      }
      if (result.ok === false) {
        const message = result.message
        onError(message)
        const permanent = PERMANENT_FAIL.test(message)
          || /没有更多章节|尚未缓存/.test(message)
        if (opts?.isInitial && permanent) {
          void window.electronAPI?.readerSetProgress?.({ bookId, clear: true })
          onBackLibrary(message)
        }
        if (!opts?.isInitial && /没有更多章节|未缓存/.test(message)) {
          setHasNext(false)
        }
        return false
      }

      setTitle(result.chapter.title)
      setBody(result.chapter.body)
      setChapterIndex(result.chapter.chapterIndex)
      setChapterCount(result.chapter.chapterCount)
      const matched = result.chapter.chapterIndex === index
      setHasNext(result.chapter.chapterIndex + 1 < result.chapter.chapterCount)

      // Only persist when the returned chapter matches the request — silent fallbacks
      // must not wipe a higher resume index the user still wants to reach later.
      const offsetToApply = matched && opts?.restoreOffset != null ? opts.restoreOffset : 0
      if (matched) {
        persistProgress(result.chapter.chapterIndex, offsetToApply)
        if (!opts?.isInitial && !opts?.fromHistory && fromIndex !== result.chapter.chapterIndex) {
          setChapterHistory((prev) => {
            const next = [...prev, { index: fromIndex, offset: fromOffset }]
            return next.length > 40 ? next.slice(-40) : next
          })
        }
      } else if (opts?.isInitial) {
        onError('目标章节暂不可用，已显示最近可读章节')
      }

      requestAnimationFrame(() => {
        if (gen !== loadGen.current || !scrollRef.current) return
        scrollRef.current.scrollTop = offsetToApply
      })

      if (matched && result.book.source === 'web' && result.chapter.chapterIndex + 1 < result.chapter.chapterCount) {
        void window.electronAPI?.readerGetChapter?.(bookId, result.chapter.chapterIndex + 1)
      }
      return true
    } finally {
      if (gen === loadGen.current) setLoading(false)
    }
  }, [bookId, onBackLibrary, onError, persistProgress])

  useEffect(() => {
    loadGen.current += 1
    queueMicrotask(() => {
      void (async () => {
        const lib = await window.electronAPI?.readerListBooks?.()
        const saved = lib?.progressByBook?.[bookId]
          || (lib?.progress?.bookId === bookId ? lib.progress : null)
        const start = saved?.chapterIndex ?? 0
        const offset = saved?.offset ?? 0
        await loadChapter(start, { isInitial: true, restoreOffset: offset })
      })()
    })
    return () => {
      loadGen.current += 1
    }
  }, [bookId, loadChapter])

  const openToc = async () => {
    bumpChrome()
    const list = await window.electronAPI?.readerListChapters?.(bookId)
    setChapters(Array.isArray(list) ? list : [])
    setTocOpen(true)
  }

  const exportToNote = () => {
    if (!body.trim()) {
      onError('当前章节为空，无法摘录')
      return
    }
    const selection = window.getSelection()?.toString().trim() || ''
    const excerpt = (selection || body).slice(0, 50000)
    const noteTitle = selection
      ? `${(title || '摸鱼摘录').slice(0, 36)} · 选段`
      : (title || '摸鱼摘录').slice(0, 80)
    const note = {
      id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: noteTitle,
      content: `# ${noteTitle}\n\n${excerpt}\n\n---\n来自摸鱼阅读 · 第${chapterIndex + 1}章${selection ? ' · 选中文本' : ''}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      color: '#fbbf24',
    }
    try {
      const key = 'dashboard-storage'
      const raw = localStorage.getItem(key)
      const data = raw ? JSON.parse(raw) as { state?: { notes?: unknown[] } } : { state: { notes: [] } }
      if (!data.state) data.state = { notes: [] }
      const notes = Array.isArray(data.state.notes) ? data.state.notes : []
      data.state.notes = [note, ...notes]
      localStorage.setItem(key, JSON.stringify(data))
      try {
        const channel = new BroadcastChannel('abwb-store')
        channel.postMessage({ type: 'notes-upsert', note })
        channel.close()
      } catch { /* BroadcastChannel optional */ }
      // Also update this window's store if present.
      useStore.setState((s) => ({
        notes: [note, ...s.notes.filter((n) => n.id !== note.id)],
      }))
    } catch {
      onError('摘录失败')
      return
    }
    bumpChrome()
    flashStatus(selection ? '已摘录选中文本到笔记' : '已摘录到笔记')
  }

  const copyChapter = async () => {
    if (!body.trim()) {
      onError('当前章节为空，无法复制')
      return
    }
    const selection = window.getSelection()?.toString().trim() || ''
    const text = selection || `${title ? `${title}\n\n` : ''}${body}`
    try {
      await navigator.clipboard.writeText(text)
      bumpChrome()
      flashStatus(selection ? '已复制选中文本' : '已复制本章')
    } catch {
      onError('复制失败')
    }
  }

  const findMatches = useMemo(
    () => findTextMatches(body, findQuery),
    [body, findQuery],
  )

  const highlightedParts = useMemo(() => {
    const q = findQuery.trim()
    if (!findOpen || !q || findMatches.length === 0) return null as Array<{ text: string; hitIndex?: number }> | null
    return buildHighlightParts(body, findQuery, findMatches)
  }, [body, findMatches, findOpen, findQuery])

  const jumpToFind = useCallback((nextIndex: number) => {
    if (findMatches.length === 0) return
    const safe = ((nextIndex % findMatches.length) + findMatches.length) % findMatches.length
    setFindIndex(safe)
    bumpChrome()
    queueMicrotask(() => {
      const mark = scrollRef.current?.querySelector(`[data-find-hit="${safe}"]`) as HTMLElement | null
      if (mark) {
        mark.scrollIntoView({ block: 'center', behavior: 'auto' })
        return
      }
      if (!scrollRef.current) return
      const pos = findMatches[safe]
      const ratio = pos / Math.max(1, body.length)
      const el = scrollRef.current
      el.scrollTop = Math.max(0, ratio * (el.scrollHeight - el.clientHeight) - 40)
    })
  }, [body.length, bumpChrome, findMatches])

  const submitGoto = useCallback(() => {
    const n = Number.parseInt(gotoDraft.trim(), 10)
    if (!Number.isFinite(n) || n < 1) {
      onError('请输入有效章号（从 1 开始）')
      return
    }
    const target = Math.min(Math.max(1, n), Math.max(1, chapterCount)) - 1
    setGotoOpen(false)
    setGotoDraft('')
    void loadChapter(target)
  }, [chapterCount, gotoDraft, loadChapter, onError])

  const historyBack = useCallback(() => {
    setChapterHistory((prev) => {
      if (prev.length === 0) {
        queueMicrotask(() => flashStatus('没有上一浏览记录', 1200))
        return prev
      }
      const entry = prev[prev.length - 1]
      queueMicrotask(() => {
        void loadChapter(entry.index, { fromHistory: true, restoreOffset: entry.offset })
        flashStatus('已返回上一浏览章节', 1200)
      })
      return prev.slice(0, -1)
    })
  }, [flashStatus, loadChapter])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFindOpen(true)
        setGotoOpen(false)
        setTocOpen(false)
        bumpChrome()
        queueMicrotask(() => findInputRef.current?.focus())
        return
      }
      if (e.key === 'F3') {
        e.preventDefault()
        if (!findOpen) {
          setFindOpen(true)
          setGotoOpen(false)
          setTocOpen(false)
          bumpChrome()
          queueMicrotask(() => findInputRef.current?.focus())
          return
        }
        if (findMatches.length === 0) return
        findLandedRef.current = true
        jumpToFind(e.shiftKey ? findIndex - 1 : findIndex + 1)
        return
      }
      const openGoto = () => {
        setGotoOpen(true)
        setFindOpen(false)
        setTocOpen(false)
        setGotoDraft(String(chapterIndex + 1))
        bumpChrome()
        queueMicrotask(() => {
          gotoInputRef.current?.focus()
          gotoInputRef.current?.select()
        })
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        openGoto()
        return
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'g') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        openGoto()
        return
      }
      if (e.key === 'Escape' && (findOpen || gotoOpen)) {
        e.preventDefault()
        e.stopPropagation()
        setFindOpen(false)
        setGotoOpen(false)
        return
      }
      if (loading) return
      if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        historyBack()
        return
      }
      if (e.key === 'PageDown' || e.key === 'PageUp') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return
        e.preventDefault()
        const el = scrollRef.current
        if (!el) return
        const delta = Math.max(120, Math.floor(el.clientHeight * 0.85))
        el.scrollBy({ top: e.key === 'PageDown' ? delta : -delta, behavior: 'auto' })
        bumpChrome()
        return
      }
      if (e.key === 'Home' || e.key === 'End') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return
        e.preventDefault()
        const el = scrollRef.current
        if (!el) return
        el.scrollTop = e.key === 'Home' ? 0 : el.scrollHeight
        bumpChrome()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        if (e.key === 'ArrowLeft') {
          if (chapterIndex > 0) void loadChapter(chapterIndex - 1)
        } else if (hasNext) {
          void loadChapter(chapterIndex + 1)
        }
      } else if (e.key === ' ') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return
        e.preventDefault()
        if (hasNext) void loadChapter(chapterIndex + 1)
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        if (e.altKey) {
          const next = Math.min(2.4, Math.round(((settings.lineHeight ?? 1.7) + 0.1) * 10) / 10)
          void onPatchSettings({ lineHeight: next })
          flashStatus(`行距 ${next.toFixed(1)}`, 900)
        } else {
          void onPatchSettings({ fontSize: Math.min(36, settings.fontSize + 1) })
        }
      } else if (e.key === '-') {
        e.preventDefault()
        if (e.altKey) {
          const next = Math.max(1.2, Math.round(((settings.lineHeight ?? 1.7) - 0.1) * 10) / 10)
          void onPatchSettings({ lineHeight: next })
          flashStatus(`行距 ${next.toFixed(1)}`, 900)
        } else {
          void onPatchSettings({ fontSize: Math.max(12, settings.fontSize - 1) })
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [bumpChrome, chapterIndex, findIndex, findMatches.length, findOpen, flashStatus, gotoOpen, hasNext, historyBack, jumpToFind, loadChapter, loading, onPatchSettings, settings.fontSize, settings.lineHeight])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -1 : 1
      const next = Math.min(36, Math.max(12, settings.fontSize + delta))
      void onPatchSettings({ fontSize: next })
      flashStatus(`${next}px`, 900)
      bumpChrome()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [bumpChrome, flashStatus, onPatchSettings, settings.fontSize])

  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current)
  }, [])

  return (
    <div className="relative flex h-full flex-col" onMouseMove={bumpChrome}>
      <div
        className="absolute inset-x-0 top-0 z-30 h-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      <div
        className={`absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 backdrop-blur-sm transition-opacity ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => onBackLibrary()}
          title="书架"
        >
          <BookMarked size={14} />
        </button>
        <button
          type="button"
          disabled={historyDepth === 0}
          className="rounded-md p-1 hover:bg-white/10 disabled:opacity-30"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={historyBack}
          title="上一浏览章节 (Backspace)"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => void openToc()}
          title="目录"
        >
          <List size={14} />
        </button>
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={exportToNote}
          title="摘录到笔记（有选中则只摘录选中）"
        >
          <StickyNote size={14} />
        </button>
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => void copyChapter()}
          title="复制（有选中则只复制选中）"
        >
          <ClipboardCopy size={14} />
        </button>
        <div className="min-w-0 flex-1 truncate opacity-80">
          {title || (loading ? '加载中…' : '阅读中')}
        </div>
        <input
          type="range"
          min={20}
          max={100}
          value={Math.round(settings.opacity * 100)}
          title={`透明度 ${Math.round(settings.opacity * 100)}%`}
          className="w-16 accent-sky-400"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onChange={(e) => {
            void onPatchSettings({ opacity: Number(e.target.value) / 100 })
          }}
        />
        <input
          type="color"
          value={settings.fontColor}
          title="字体颜色"
          className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onChange={(e) => {
            void onPatchSettings({ fontColor: e.target.value })
          }}
        />
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => void onPatchSettings({ fontSize: Math.max(12, settings.fontSize - 1) })}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => void onPatchSettings({ fontSize: Math.min(36, settings.fontSize + 1) })}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => {
            flushProgressNow()
            void window.electronAPI?.hideReader?.()
          }}
        >
          <X size={14} />
        </button>
      </div>

      {tocOpen && (
        <div
          className="absolute inset-x-2 top-10 z-40 max-h-[50%] overflow-auto rounded-xl border border-white/15 bg-zinc-900/95 p-2 text-xs shadow-xl"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onMouseMove={bumpChrome}
        >
          {chapters.length === 0 ? (
            <div className="px-2 py-3 text-zinc-400">暂无目录</div>
          ) : (
            chapters.map((ch) => (
              <button
                key={ch.index}
                type="button"
                className={`block w-full truncate rounded-lg px-2 py-1.5 text-left hover:bg-white/10 ${ch.index === chapterIndex ? 'bg-sky-500/20 text-sky-100' : 'text-zinc-200'}`}
                onClick={() => void loadChapter(ch.index)}
              >
                {ch.index + 1}. {ch.title}
              </button>
            ))
          )}
        </div>
      )}

      {findOpen && (
        <div
          className="absolute inset-x-2 top-10 z-40 flex items-center gap-2 rounded-xl border border-white/15 bg-zinc-900/95 px-2 py-1.5 text-xs shadow-xl"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onMouseMove={bumpChrome}
        >
          <input
            ref={findInputRef}
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value)
              setFindIndex(0)
              findLandedRef.current = false
              bumpChrome()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (findMatches.length === 0) return
                if (!findLandedRef.current) {
                  findLandedRef.current = true
                  jumpToFind(findIndex)
                  return
                }
                jumpToFind(e.shiftKey ? findIndex - 1 : findIndex + 1)
              }
            }}
            placeholder="查找…"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 outline-none"
          />
          <span className="shrink-0 text-zinc-400">
            {findMatches.length
              ? `${findIndex + 1}/${findMatches.length}${findMatches.length >= 200 ? '+' : ''}`
              : '0'}
          </span>
          <button type="button" className="rounded-md px-1.5 py-0.5 hover:bg-white/10" onClick={() => {
            findLandedRef.current = true
            jumpToFind(findIndex - 1)
          }}>↑</button>
          <button type="button" className="rounded-md px-1.5 py-0.5 hover:bg-white/10" onClick={() => {
            findLandedRef.current = true
            jumpToFind(findIndex + 1)
          }}>↓</button>
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white/10" onClick={() => setFindOpen(false)}>关闭</button>
        </div>
      )}

      {gotoOpen && (
        <div
          className="absolute inset-x-2 top-10 z-40 flex items-center gap-2 rounded-xl border border-white/15 bg-zinc-900/95 px-2 py-1.5 text-xs shadow-xl"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onMouseMove={bumpChrome}
        >
          <span className="shrink-0 text-zinc-400">跳到第</span>
          <input
            ref={gotoInputRef}
            value={gotoDraft}
            onChange={(e) => {
              setGotoDraft(e.target.value.replace(/[^\d]/g, ''))
              bumpChrome()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitGoto()
              }
            }}
            inputMode="numeric"
            className="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1 outline-none"
          />
          <span className="shrink-0 text-zinc-400">/ {Math.max(chapterCount, chapterIndex + 1)} 章</span>
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white/10" onClick={submitGoto}>前往</button>
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white/10" onClick={() => setGotoOpen(false)}>关闭</button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-4 py-10 whitespace-pre-wrap"
        style={{
          WebkitAppRegion: 'no-drag',
          fontSize: settings.fontSize,
          lineHeight: settings.lineHeight ?? 1.7,
          color: settings.fontColor,
          opacity: Math.min(1, settings.opacity + 0.1),
        } as React.CSSProperties}
        onScroll={(e) => {
          persistProgress(chapterIndex, (e.target as HTMLDivElement).scrollTop)
        }}
      >
        {highlightedParts ? (
          highlightedParts.map((part, i) => (
            part.hitIndex == null ? (
              <span key={i}>{part.text}</span>
            ) : (
              <mark
                key={i}
                data-find-hit={part.hitIndex}
                className={part.hitIndex === findIndex ? 'rounded-sm bg-amber-300 px-0.5 text-black' : 'rounded-sm bg-yellow-500/35 px-0.5 text-inherit'}
              >
                {part.text}
              </mark>
            )
          ))
        ) : (
          body || (loading ? '加载中…' : '（空章节）')
        )}
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-zinc-400 backdrop-blur-sm transition-opacity ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          className="hover:text-zinc-200 disabled:opacity-30"
          disabled={loading || chapterIndex <= 0}
          onClick={() => void loadChapter(chapterIndex - 1)}
        >
          上一章
        </button>
        <button
          type="button"
          className="hover:text-zinc-200"
          title="跳章 (G)"
          onClick={() => {
            setGotoOpen(true)
            setFindOpen(false)
            setTocOpen(false)
            setGotoDraft(String(chapterIndex + 1))
            bumpChrome()
            queueMicrotask(() => {
              gotoInputRef.current?.focus()
              gotoInputRef.current?.select()
            })
          }}
        >
          {statusMsg || `${chapterIndex + 1} / ${Math.max(chapterCount, chapterIndex + 1)}${chapterCount > 0 ? ` · ${Math.min(100, Math.round(((chapterIndex + 1) / Math.max(chapterCount, chapterIndex + 1)) * 100))}%` : ''}${loading ? ' · …' : ''}`}
        </button>
        <button
          type="button"
          className="hover:text-zinc-200 disabled:opacity-30"
          disabled={loading || !hasNext}
          onClick={() => void loadChapter(chapterIndex + 1)}
        >
          下一章
        </button>
      </div>
    </div>
  )
}
