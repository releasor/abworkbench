import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { splitChapters } from './reader/splitChapters'
import { readCacheMeta, readChapterCache } from './reader/chapterCache'
import type { ReaderBook, ReaderLibraryState, ReaderProgress } from './reader/types'

export function libraryPath(userData: string): string {
  return path.join(userData, 'reader-library.json')
}

export function emptyLibrary(): ReaderLibraryState {
  return { books: [], progress: null, progressByBook: {} }
}

function mostRecentProgress(map: Record<string, ReaderProgress>): ReaderProgress | null {
  let best: ReaderProgress | null = null
  for (const entry of Object.values(map)) {
    if (!best || entry.updatedAt > best.updatedAt) best = entry
  }
  return best
}

function isProgress(value: unknown): value is ReaderProgress {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return typeof p.bookId === 'string'
    && typeof p.chapterIndex === 'number'
    && typeof p.offset === 'number'
    && typeof p.updatedAt === 'number'
}

function normalizeProgressMap(
  rawMap: unknown,
  legacy: ReaderProgress | null,
): Record<string, ReaderProgress> {
  const out: Record<string, ReaderProgress> = {}
  if (rawMap && typeof rawMap === 'object') {
    for (const [id, value] of Object.entries(rawMap as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const p = value as Record<string, unknown>
      const candidate = {
        bookId: typeof p.bookId === 'string' ? p.bookId : id,
        chapterIndex: typeof p.chapterIndex === 'number' ? p.chapterIndex : 0,
        offset: typeof p.offset === 'number' ? p.offset : 0,
        updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : 0,
      }
      if (isProgress(candidate)) out[candidate.bookId] = candidate
    }
  }
  if (legacy && isProgress(legacy) && !out[legacy.bookId]) {
    out[legacy.bookId] = legacy
  }
  return out
}

export function loadLibrary(userData: string): ReaderLibraryState {
  const file = libraryPath(userData)
  try {
    if (!fs.existsSync(file)) return emptyLibrary()
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ReaderLibraryState>
    const legacy = raw.progress && isProgress(raw.progress) ? raw.progress : null
    const progressByBook = normalizeProgressMap(raw.progressByBook, legacy)
    const progress = legacy && progressByBook[legacy.bookId]
      ? progressByBook[legacy.bookId]
      : mostRecentProgress(progressByBook)
    return {
      books: Array.isArray(raw.books) ? raw.books.filter(isBook) : [],
      progress,
      progressByBook,
    }
  } catch {
    return emptyLibrary()
  }
}

export function saveLibrary(userData: string, state: ReaderLibraryState): void {
  try {
    fs.mkdirSync(userData, { recursive: true })
    fs.writeFileSync(libraryPath(userData), JSON.stringify(state, null, 2), 'utf8')
  } catch {
    // best-effort
  }
}

/** Serialize library RMW so async scrape/progress IPC cannot clobber each other. */
let libraryChain: Promise<unknown> = Promise.resolve()

export function withLibraryLock<T>(fn: () => T): Promise<T> {
  const run = libraryChain.then(() => fn())
  libraryChain = run.then(() => undefined, () => undefined)
  return run
}

function isBook(value: unknown): value is ReaderBook {
  if (!value || typeof value !== 'object') return false
  const b = value as Record<string, unknown>
  return typeof b.id === 'string'
    && typeof b.title === 'string'
    && (b.source === 'local' || b.source === 'web')
    && typeof b.updatedAt === 'number'
}

export function upsertBook(userData: string, book: ReaderBook): ReaderLibraryState {
  const state = loadLibrary(userData)
  const idx = state.books.findIndex((b) => b.id === book.id)
  if (idx >= 0) {
    const prev = state.books[idx]
    state.books[idx] = {
      ...prev,
      ...book,
      // Preserve pin unless the caller explicitly sets it.
      pinned: typeof book.pinned === 'boolean' ? book.pinned : prev.pinned,
    }
  } else {
    state.books.unshift(book)
  }
  saveLibrary(userData, state)
  return state
}

export function setProgress(userData: string, progress: ReaderProgress | null): ReaderLibraryState {
  const state = loadLibrary(userData)
  if (!state.progressByBook) state.progressByBook = {}
  if (progress) {
    state.progressByBook[progress.bookId] = progress
    state.progress = progress
  } else if (state.progress) {
    delete state.progressByBook[state.progress.bookId]
    state.progress = mostRecentProgress(state.progressByBook)
  } else {
    state.progress = null
  }
  saveLibrary(userData, state)
  return state
}

/** Clear one book's resume point without wiping unrelated titles. */
export function clearBookProgress(userData: string, bookId: string): ReaderLibraryState {
  const state = loadLibrary(userData)
  if (!state.progressByBook) state.progressByBook = {}
  delete state.progressByBook[bookId]
  if (state.progress?.bookId === bookId) {
    state.progress = mostRecentProgress(state.progressByBook)
  }
  saveLibrary(userData, state)
  return state
}

export function removeBook(userData: string, bookId: string): ReaderLibraryState {
  const state = loadLibrary(userData)
  state.books = state.books.filter((b) => b.id !== bookId)
  if (state.progressByBook) delete state.progressByBook[bookId]
  if (state.progress?.bookId === bookId) {
    state.progress = mostRecentProgress(state.progressByBook || {})
  }
  saveLibrary(userData, state)
  try {
    const cache = path.join(userData, 'reader-cache', bookId)
    if (fs.existsSync(cache)) fs.rmSync(cache, { recursive: true, force: true })
  } catch {
    // cache cleanup is best-effort
  }
  return state
}

export function listTxtFiles(dir: string): Array<{ name: string; path: string }> {
  if (!dir || !fs.existsSync(dir)) return []
  const out: Array<{ name: string; path: string }> = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      if (!entry.name.toLowerCase().endsWith('.txt')) continue
      out.push({ name: entry.name.replace(/\.txt$/i, ''), path: path.join(dir, entry.name) })
    }
  } catch {
    return []
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
}

export function makeLocalBookId(filePath: string): string {
  return `local-${crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 12)}`
}

export function makeWebBookId(url: string): string {
  return `web-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}`
}

export function importTxtDirectory(userData: string, dir: string): ReaderLibraryState {
  const state = loadLibrary(userData)
  const now = Date.now()
  for (const file of listTxtFiles(dir)) {
    const id = makeLocalBookId(file.path)
    const book: ReaderBook = {
      id,
      title: file.name,
      source: 'local',
      path: file.path,
      updatedAt: now,
    }
    const idx = state.books.findIndex((b) => b.id === id)
    if (idx >= 0) state.books[idx] = book
    else state.books.unshift(book)
  }
  saveLibrary(userData, state)
  return state
}

export function importTxtFile(userData: string, filePath: string): ReaderLibraryState {
  const state = loadLibrary(userData)
  const normalized = path.resolve(filePath)
  const id = makeLocalBookId(normalized)
  const book: ReaderBook = {
    id,
    title: path.basename(normalized).replace(/\.txt$/i, ''),
    source: 'local',
    path: normalized,
    updatedAt: Date.now(),
  }
  const idx = state.books.findIndex((b) => b.id === id)
  if (idx >= 0) state.books[idx] = book
  else state.books.unshift(book)
  saveLibrary(userData, state)
  return state
}

export function readLocalChapter(
  filePath: string,
  chapterIndex: number,
): { title: string; body: string; chapterCount: number; chapterIndex: number } {
  const text = fs.readFileSync(filePath, 'utf8')
  const chapters = splitChapters(text)
  const safeIndex = Math.max(0, Math.min(chapterIndex, chapters.length - 1))
  const ch = chapters[safeIndex]
  return {
    title: ch.title,
    body: ch.body,
    chapterCount: chapters.length,
    chapterIndex: safeIndex,
  }
}

export function listChapterTitles(
  userData: string,
  bookId: string,
): Array<{ index: number; title: string }> {
  const book = getBook(userData, bookId)
  if (!book) return []
  if (book.source === 'local' && book.path && fs.existsSync(book.path)) {
    try {
      const chapters = splitChapters(fs.readFileSync(book.path, 'utf8'))
      return chapters.map((ch, index) => ({ index, title: ch.title }))
    } catch {
      return []
    }
  }
  if (book.source === 'web') {
    const meta = readCacheMeta(userData, bookId)
    if (meta?.catalog?.length) {
      return meta.catalog.map((entry, index) => ({
        index,
        title: entry.title || `第${index + 1}章`,
      }))
    }
    const urls = meta?.chapterUrls || []
    const count = Math.max(urls.filter(Boolean).length, 1)
    const out: Array<{ index: number; title: string }> = []
    for (let i = 0; i < count; i++) {
      const cached = readChapterCache(userData, bookId, i)
      out.push({ index: i, title: cached?.title || `第${i + 1}章` })
    }
    return out
  }
  return []
}

export function getBook(userData: string, bookId: string): ReaderBook | null {
  return loadLibrary(userData).books.find((b) => b.id === bookId) ?? null
}
