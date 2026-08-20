import { useCallback, useEffect, useState } from 'react'
import { BookOpen, FileText, FolderOpen, Link2, Pencil, Pin, RefreshCw, Trash2, X } from 'lucide-react'
import type { ReaderUiSettings } from './StealthReaderApp'

interface BookRow {
  id: string
  title: string
  source: 'local' | 'web'
  path?: string
  catalogUrl?: string
  chapterUrl?: string
  pinned?: boolean
  missing?: boolean
  updatedAt?: number
}

interface ProgressHint {
  chapterIndex: number
  updatedAt?: number
}

interface LibraryPanelProps {
  settings: ReaderUiSettings
  error: string
  onError: (msg: string) => void
  onOpenBook: (id: string) => void
  onPatchSettings: (partial: Partial<ReaderUiSettings>) => Promise<void>
  onReloadSettings: () => Promise<void>
}

function formatReadAgo(ts: number): string {
  const delta = Date.now() - ts
  if (delta < 60_000) return '刚刚'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}分钟前`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}小时前`
  if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)}天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

export default function LibraryPanel({
  settings,
  onError,
  onOpenBook,
  onReloadSettings,
}: LibraryPanelProps) {
  const [books, setBooks] = useState<BookRow[]>([])
  const [progressBookId, setProgressBookId] = useState<string | null>(null)
  const [progressByBook, setProgressByBook] = useState<Record<string, ProgressHint>>({})
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [filter, setFilter] = useState('')

  const applyLibrary = useCallback((lib: {
    books?: BookRow[]
    progress?: { bookId: string; chapterIndex: number; updatedAt?: number } | null
    progressByBook?: Record<string, { bookId: string; chapterIndex: number; updatedAt?: number }>
  } | undefined) => {
    if (lib?.books) setBooks(lib.books)
    setProgressBookId(lib?.progress?.bookId ?? null)
    const map: Record<string, ProgressHint> = {}
    if (lib?.progressByBook) {
      for (const [id, p] of Object.entries(lib.progressByBook)) {
        map[id] = { chapterIndex: p.chapterIndex, updatedAt: p.updatedAt }
      }
    } else if (lib?.progress?.bookId) {
      map[lib.progress.bookId] = {
        chapterIndex: lib.progress.chapterIndex,
        updatedAt: lib.progress.updatedAt,
      }
    }
    setProgressByBook(map)
  }, [])

  const refresh = useCallback(async () => {
    const lib = await window.electronAPI?.readerListBooks?.()
    applyLibrary(lib)
  }, [applyLibrary])

  useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh])

  const pickDir = async () => {
    setBusy(true)
    onError('')
    try {
      const result = await window.electronAPI?.readerPickDirectory?.()
      applyLibrary(result?.library)
      await onReloadSettings()
    } finally {
      setBusy(false)
    }
  }

  const pickTxt = async () => {
    setBusy(true)
    onError('')
    try {
      const before = new Set(books.map((b) => b.id))
      const result = await window.electronAPI?.readerPickTxtFile?.()
      applyLibrary(result?.library)
      const added = result?.library?.books?.find((b) => !before.has(b.id) && !b.missing)
      if (added) onOpenBook(added.id)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (bookId: string, event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    const book = books.find((b) => b.id === bookId)
    const ok = window.confirm(`确定从书架移除「${book?.title || '这本书'}」？本地进度也会清除。`)
    if (!ok) return
    setBusy(true)
    onError('')
    try {
      const lib = await window.electronAPI?.readerRemoveBook?.(bookId)
      applyLibrary(lib)
    } finally {
      setBusy(false)
    }
  }

  const commitRename = async (book: BookRow) => {
    const title = renameDraft.trim()
    setRenamingId(null)
    if (!title || title === book.title) return
    setBusy(true)
    onError('')
    try {
      const lib = await window.electronAPI?.readerUpsertBook?.({
        id: book.id,
        title,
        source: book.source,
        path: book.path,
        catalogUrl: book.catalogUrl,
        chapterUrl: book.chapterUrl,
        pinned: book.pinned,
        updatedAt: Date.now(),
      })
      applyLibrary(lib)
    } finally {
      setBusy(false)
    }
  }

  const togglePin = async (book: BookRow, event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    setBusy(true)
    onError('')
    try {
      const lib = await window.electronAPI?.readerUpsertBook?.({
        id: book.id,
        title: book.title,
        source: book.source,
        path: book.path,
        catalogUrl: book.catalogUrl,
        chapterUrl: book.chapterUrl,
        pinned: !book.pinned,
        updatedAt: Date.now(),
      })
      applyLibrary(lib)
    } finally {
      setBusy(false)
    }
  }

  const refreshWebBook = async (book: BookRow, event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    const target = (book.catalogUrl || book.chapterUrl || '').trim()
    if (book.source !== 'web' || !target) {
      onError('该书没有可刷新的链接')
      return
    }
    setBusy(true)
    onError('')
    try {
      const result = await window.electronAPI?.readerScrapeUrl?.(target, book.id)
      if (!result) {
        onError('桌面能力不可用')
        return
      }
      if (result.ok === false) {
        onError(result.message)
        return
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const scrape = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      onError('请粘贴小说目录页或章节页链接')
      return
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      onError('请输入以 http(s) 开头的链接')
      return
    }
    setBusy(true)
    onError('')
    try {
      const result = await window.electronAPI?.readerScrapeUrl?.(trimmed)
      if (!result) {
        onError('桌面能力不可用')
        return
      }
      if (result.ok === false) {
        onError(result.message)
        return
      }
      await refresh()
      onOpenBook(result.book.id)
    } finally {
      setBusy(false)
    }
  }

  const needle = filter.trim().toLowerCase()
  const filteredBooks = books
    .slice()
    .sort((a, b) => {
      const pin = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      if (pin !== 0) return pin
      const aRead = progressByBook[a.id]?.updatedAt ?? a.updatedAt ?? 0
      const bRead = progressByBook[b.id]?.updatedAt ?? b.updatedAt ?? 0
      return bRead - aRead
    })
    .filter((book) => !needle || book.title.toLowerCase().includes(needle))

  return (
    <div className="flex h-full flex-col text-sm text-zinc-100">
      <div
        className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 font-medium">
          <BookOpen size={16} />
          摸鱼书架
        </div>
        <button
          type="button"
          className="rounded-lg p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => void window.electronAPI?.hideReader?.()}
          title="隐藏"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 overflow-auto p-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void pickDir()}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10 disabled:opacity-50"
          >
            <FolderOpen size={16} />
            选目录
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void pickTxt()}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10 disabled:opacity-50"
          >
            <FileText size={16} />
            选 txt
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴章节/目录 URL"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs outline-none focus:border-sky-400/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void scrape()
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void scrape()}
            className="rounded-xl border border-sky-400/40 bg-sky-500/20 px-3 py-2 text-xs hover:bg-sky-500/30 disabled:opacity-50"
          >
            <Link2 size={14} className="inline" /> 抓取
          </button>
        </div>

        <div className="text-[11px] text-zinc-400">
          字号 {settings.fontSize} · 透明度 {Math.round(settings.opacity * 100)}%
          {settings.novelDir ? ` · ${settings.novelDir}` : ''}
        </div>

        {books.length > 0 && (
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="搜索书架…"
            className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-xs outline-none focus:border-sky-400/50"
          />
        )}

        <div className="space-y-1">
          {books.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 px-3 py-8 text-center text-xs text-zinc-400">
              还没有书。选择本地目录 / txt 或粘贴链接开始。
            </div>
          )}
          {books.length > 0 && filteredBooks.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 px-3 py-6 text-center text-xs text-zinc-400">
              <div>没有匹配「{filter.trim()}」的书</div>
              <button
                type="button"
                className="mt-2 text-sky-300 hover:underline"
                onClick={() => setFilter('')}
              >
                清除搜索
              </button>
            </div>
          )}
          {filteredBooks.map((book) => {
            const hint = progressByBook[book.id]
            return (
              <div
                key={book.id}
                className="group flex w-full items-center gap-1 rounded-xl border border-transparent hover:border-white/15 hover:bg-white/5"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (book.missing) {
                      onError('本地文件不存在，请移除或重新选择目录')
                      return
                    }
                    onOpenBook(book.id)
                  }}
                  className="flex min-w-0 flex-1 items-center justify-between px-3 py-2 text-left"
                >
                  {renamingId === book.id ? (
                    <input
                      autoFocus
                      value={renameDraft}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => void commitRename(book)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void commitRename(book)
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setRenamingId(null)
                        }
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-sky-400/40 bg-black/40 px-2 py-0.5 text-sm outline-none"
                    />
                  ) : (
                    <span
                      className={`truncate ${book.missing ? 'text-zinc-500 line-through' : ''}`}
                    >
                      {book.pinned ? '★ ' : ''}{book.title}
                    </span>
                  )}
                  <span className="ml-2 flex shrink-0 items-center gap-1 text-[10px] text-zinc-500">
                    {progressBookId === book.id && (
                      <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-amber-200">续读</span>
                    )}
                    {hint && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-zinc-300">
                        第{hint.chapterIndex + 1}章
                      </span>
                    )}
                    {hint?.updatedAt ? (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-500" title={new Date(hint.updatedAt).toLocaleString('zh-CN')}>
                        {formatReadAgo(hint.updatedAt)}
                      </span>
                    ) : null}
                    {book.missing && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-200">缺失</span>
                    )}
                    {book.source === 'local' ? '本地' : '网上'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  title="重命名"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRenamingId(book.id)
                    setRenameDraft(book.title)
                  }}
                  className="rounded-lg p-1.5 text-zinc-500 opacity-0 hover:bg-white/10 group-hover:opacity-100 disabled:opacity-30"
                >
                  <Pencil size={14} />
                </button>
                {book.source === 'web' && (book.catalogUrl || book.chapterUrl) && (
                  <button
                    type="button"
                    disabled={busy}
                    title="重新抓取目录/正文"
                    onClick={(e) => void refreshWebBook(book, e)}
                    className="rounded-lg p-1.5 text-zinc-500 opacity-0 hover:bg-white/10 group-hover:opacity-100 disabled:opacity-30"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  title={book.pinned ? '取消置顶' : '置顶'}
                  onClick={(e) => void togglePin(book, e)}
                  className={`rounded-lg p-1.5 opacity-0 hover:bg-white/10 group-hover:opacity-100 disabled:opacity-30 ${book.pinned ? 'text-amber-300 opacity-100' : 'text-zinc-500'}`}
                >
                  <Pin size={14} />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  title="移除"
                  onClick={(e) => void remove(book.id, e)}
                  className="mr-2 rounded-lg p-1.5 text-zinc-500 opacity-0 hover:bg-white/10 hover:text-red-300 group-hover:opacity-100 disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
