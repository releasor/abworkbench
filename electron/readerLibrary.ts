import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { splitChapters } from './reader/splitChapters'
import type { ReaderBook, ReaderLibraryState, ReaderProgress } from './reader/types'

export function libraryPath(userData: string): string {
  return path.join(userData, 'reader-library.json')
}

export function emptyLibrary(): ReaderLibraryState {
  return { books: [], progress: null }
}

export function loadLibrary(userData: string): ReaderLibraryState {
  const file = libraryPath(userData)
  try {
    if (!fs.existsSync(file)) return emptyLibrary()
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ReaderLibraryState>
    return {
      books: Array.isArray(raw.books) ? raw.books.filter(isBook) : [],
      progress: raw.progress && isProgress(raw.progress) ? raw.progress : null,
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

function isBook(value: unknown): value is ReaderBook {
  if (!value || typeof value !== 'object') return false
  const b = value as Record<string, unknown>
  return typeof b.id === 'string'
    && typeof b.title === 'string'
    && (b.source === 'local' || b.source === 'web')
    && typeof b.updatedAt === 'number'
}

function isProgress(value: unknown): value is ReaderProgress {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return typeof p.bookId === 'string'
    && typeof p.chapterIndex === 'number'
    && typeof p.offset === 'number'
    && typeof p.updatedAt === 'number'
}

export function upsertBook(userData: string, book: ReaderBook): ReaderLibraryState {
  const state = loadLibrary(userData)
  const idx = state.books.findIndex((b) => b.id === book.id)
  if (idx >= 0) state.books[idx] = book
  else state.books.unshift(book)
  saveLibrary(userData, state)
  return state
}

export function setProgress(userData: string, progress: ReaderProgress | null): ReaderLibraryState {
  const state = loadLibrary(userData)
  state.progress = progress
  saveLibrary(userData, state)
  return state
}

export function removeBook(userData: string, bookId: string): ReaderLibraryState {
  const state = loadLibrary(userData)
  state.books = state.books.filter((b) => b.id !== bookId)
  if (state.progress?.bookId === bookId) state.progress = null
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

export function getBook(userData: string, bookId: string): ReaderBook | null {
  return loadLibrary(userData).books.find((b) => b.id === bookId) ?? null
}
