import fs from 'node:fs'
import path from 'node:path'
import { extractChapterLinks, extractMainText, extractNextChapterHref } from './reader/scrapeHtml'
import { makeWebBookId, upsertBook } from './readerLibrary'
import type { ReaderBook } from './reader/types'

function cacheDir(userData: string, bookId: string): string {
  return path.join(userData, 'reader-cache', bookId)
}

function writeChapterCache(userData: string, bookId: string, index: number, body: string, title: string): void {
  const dir = cacheDir(userData, bookId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${index}.json`), JSON.stringify({ title, body }), 'utf8')
}

export function readChapterCache(
  userData: string,
  bookId: string,
  index: number,
): { title: string; body: string } | null {
  const file = path.join(cacheDir(userData, bookId), `${index}.json`)
  try {
    if (!fs.existsSync(file)) return null
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { title?: string; body?: string }
    if (typeof raw.body !== 'string') return null
    return { title: typeof raw.title === 'string' ? raw.title : `第${index + 1}章`, body: raw.body }
  } catch {
    return null
  }
}

export type ScrapeResult =
  | {
    ok: true
    book: ReaderBook
    chapter: { title: string; body: string; chapterIndex: number; chapterCount: number }
    nextUrl: string | null
    catalog: Array<{ title: string; url: string }>
  }
  | { ok: false; message: string }

/** Fetch a novel page and extract chapter text with generic heuristics. */
export async function scrapeUrl(url: string, userData: string): Promise<ScrapeResult> {
  const trimmed = String(url || '').trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, message: '请输入以 http(s) 开头的链接' }
  }

  let res: Response
  try {
    res = await fetch(trimmed, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AbworkbenchReader/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `请求失败：${msg}` }
  }

  if (!res.ok) {
    return { ok: false, message: `HTTP ${res.status}` }
  }

  const contentType = res.headers.get('content-type') || ''
  const html = await res.text()
  if (!/html/i.test(contentType) && !/<html|<body|<div/i.test(html)) {
    return { ok: false, message: '响应不是 HTML 页面' }
  }

  const body = extractMainText(html)
  if (!body || body.length < 20) {
    return { ok: false, message: '未能提取正文' }
  }

  const catalog = extractChapterLinks(html, trimmed)
  const nextUrl = extractNextChapterHref(html, trimmed)
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const pageTitle = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
    : '网文'

  const bookId = makeWebBookId(trimmed)
  const book: ReaderBook = {
    id: bookId,
    title: pageTitle || '网文',
    source: 'web',
    catalogUrl: catalog.length ? trimmed : undefined,
    chapterUrl: trimmed,
    updatedAt: Date.now(),
  }
  upsertBook(userData, book)
  writeChapterCache(userData, bookId, 0, body, pageTitle || '正文')

  // Persist catalog as meta for later navigation (best-effort).
  try {
    const metaPath = path.join(cacheDir(userData, bookId), 'meta.json')
    fs.writeFileSync(metaPath, JSON.stringify({ catalog, nextUrl, chapterUrl: trimmed }, null, 2), 'utf8')
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    book,
    chapter: {
      title: pageTitle || '正文',
      body,
      chapterIndex: 0,
      chapterCount: Math.max(1, catalog.length),
    },
    nextUrl,
    catalog,
  }
}

export async function scrapeNextChapter(
  userData: string,
  bookId: string,
  nextUrl: string,
  chapterIndex: number,
): Promise<ScrapeResult> {
  const result = await scrapeUrl(nextUrl, userData)
  if (!result.ok) return result
  // Re-key cache under existing book id
  writeChapterCache(userData, bookId, chapterIndex, result.chapter.body, result.chapter.title)
  const book = { ...result.book, id: bookId, chapterUrl: nextUrl, updatedAt: Date.now() }
  upsertBook(userData, book)
  return {
    ok: true,
    book,
    chapter: {
      ...result.chapter,
      chapterIndex,
      chapterCount: result.chapter.chapterCount,
    },
    nextUrl: result.nextUrl,
    catalog: result.catalog,
  }
}
