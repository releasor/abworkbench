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

export type ReaderCacheMeta = {
  catalog: Array<{ title: string; url: string }>
  nextUrl: string | null
  chapterUrl?: string
  /** Map chapterIndex → url for sequential navigation */
  chapterUrls?: string[]
}

export function readCacheMeta(userData: string, bookId: string): ReaderCacheMeta | null {
  const file = path.join(cacheDir(userData, bookId), 'meta.json')
  try {
    if (!fs.existsSync(file)) return null
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ReaderCacheMeta>
    return {
      catalog: Array.isArray(raw.catalog) ? raw.catalog : [],
      nextUrl: typeof raw.nextUrl === 'string' ? raw.nextUrl : null,
      chapterUrl: typeof raw.chapterUrl === 'string' ? raw.chapterUrl : undefined,
      chapterUrls: Array.isArray(raw.chapterUrls) ? raw.chapterUrls.filter((u) => typeof u === 'string') : undefined,
    }
  } catch {
    return null
  }
}

function writeCacheMeta(userData: string, bookId: string, meta: ReaderCacheMeta): void {
  const dir = cacheDir(userData, bookId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
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

  const chapterUrls = [trimmed]
  if (nextUrl) chapterUrls.push(nextUrl)
  writeCacheMeta(userData, bookId, { catalog, nextUrl, chapterUrl: trimmed, chapterUrls })

  return {
    ok: true,
    book,
    chapter: {
      title: pageTitle || '正文',
      body,
      chapterIndex: 0,
      chapterCount: Math.max(catalog.length || 1, nextUrl ? 2 : 1),
    },
    nextUrl,
    catalog,
  }
}

/** Fetch chapter at index for an existing web book (cache → catalog/nextUrl scrape). */
export async function getWebChapter(
  userData: string,
  book: ReaderBook,
  chapterIndex: number,
): Promise<ScrapeResult> {
  const bookId = book.id
  const cached = readChapterCache(userData, bookId, chapterIndex)
  const meta = readCacheMeta(userData, bookId)
  const catalogCount = Math.max(
    meta?.catalog.length || 0,
    meta?.chapterUrls?.length || 0,
    chapterIndex + 1,
  )

  if (cached) {
    return {
      ok: true,
      book,
      chapter: {
        title: cached.title,
        body: cached.body,
        chapterIndex,
        chapterCount: Math.max(catalogCount, chapterIndex + 1 + (meta?.nextUrl ? 1 : 0)),
      },
      nextUrl: meta?.nextUrl ?? null,
      catalog: meta?.catalog ?? [],
    }
  }

  let targetUrl: string | null = null
  if (meta?.catalog[chapterIndex]?.url) {
    targetUrl = meta.catalog[chapterIndex].url
  } else if (meta?.chapterUrls?.[chapterIndex]) {
    targetUrl = meta.chapterUrls[chapterIndex]
  } else if (chapterIndex === 0 && book.chapterUrl) {
    targetUrl = book.chapterUrl
  } else if (chapterIndex > 0 && meta?.chapterUrls?.[chapterIndex - 1]) {
    // Need sequential fetch: load previous page's nextUrl chain if only nextUrl known
    const prevMeta = meta
    if (chapterIndex === (prevMeta.chapterUrls?.length ?? 0) && prevMeta.nextUrl) {
      targetUrl = prevMeta.nextUrl
    }
  } else if (chapterIndex === 1 && meta?.nextUrl) {
    targetUrl = meta.nextUrl
  }

  if (!targetUrl) {
    return { ok: false, message: '没有更多章节，或尚未缓存下一章链接' }
  }

  // Fetch without upserting a new book id — keep existing bookId
  let res: Response
  try {
    res = await fetch(targetUrl, {
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
  if (!res.ok) return { ok: false, message: `HTTP ${res.status}` }
  const html = await res.text()
  const body = extractMainText(html)
  if (!body || body.length < 20) return { ok: false, message: '未能提取正文' }

  const pageNext = extractNextChapterHref(html, targetUrl)
  const catalog = extractChapterLinks(html, targetUrl)
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const pageTitle = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
    : `第${chapterIndex + 1}章`

  writeChapterCache(userData, bookId, chapterIndex, body, pageTitle || '正文')

  const chapterUrls = [...(meta?.chapterUrls ?? [])]
  while (chapterUrls.length < chapterIndex) chapterUrls.push('')
  chapterUrls[chapterIndex] = targetUrl
  if (pageNext && !chapterUrls[chapterIndex + 1]) {
    chapterUrls[chapterIndex + 1] = pageNext
  }
  const mergedCatalog = (meta?.catalog?.length ? meta.catalog : catalog) ?? []
  writeCacheMeta(userData, bookId, {
    catalog: mergedCatalog,
    nextUrl: pageNext,
    chapterUrl: targetUrl,
    chapterUrls,
  })

  const updatedBook: ReaderBook = {
    ...book,
    chapterUrl: targetUrl,
    catalogUrl: book.catalogUrl || (mergedCatalog.length ? targetUrl : undefined),
    updatedAt: Date.now(),
  }
  upsertBook(userData, updatedBook)

  return {
    ok: true,
    book: updatedBook,
    chapter: {
      title: pageTitle || '正文',
      body,
      chapterIndex,
      chapterCount: Math.max(
        mergedCatalog.length || 1,
        chapterUrls.filter(Boolean).length,
        chapterIndex + 1 + (pageNext ? 1 : 0),
      ),
    },
    nextUrl: pageNext,
    catalog: mergedCatalog,
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
  writeChapterCache(userData, bookId, chapterIndex, result.chapter.body, result.chapter.title)
  const book = { ...result.book, id: bookId, chapterUrl: nextUrl, updatedAt: Date.now() }
  upsertBook(userData, book)
  const meta = readCacheMeta(userData, bookId)
  const chapterUrls = [...(meta?.chapterUrls ?? [])]
  while (chapterUrls.length < chapterIndex) chapterUrls.push('')
  chapterUrls[chapterIndex] = nextUrl
  if (result.nextUrl) chapterUrls[chapterIndex + 1] = result.nextUrl
  writeCacheMeta(userData, bookId, {
    catalog: result.catalog.length ? result.catalog : (meta?.catalog ?? []),
    nextUrl: result.nextUrl,
    chapterUrl: nextUrl,
    chapterUrls,
  })
  return {
    ok: true,
    book,
    chapter: {
      ...result.chapter,
      chapterIndex,
      chapterCount: Math.max(result.chapter.chapterCount, chapterIndex + 1 + (result.nextUrl ? 1 : 0)),
    },
    nextUrl: result.nextUrl,
    catalog: result.catalog,
  }
}
