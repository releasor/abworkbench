import { extractChapterLinks, extractMainText, extractNextChapterHref } from './reader/scrapeHtml'
import {
  readCacheMeta,
  readChapterCache,
  resolveChapterUrl,
  writeCacheMeta,
  writeChapterCache,
} from './reader/chapterCache'
import { makeWebBookId, upsertBook } from './readerLibrary'
import type { ReaderBook } from './reader/types'

export type { ReaderCacheMeta } from './reader/chapterCache'
export { readCacheMeta, readChapterCache } from './reader/chapterCache'

const FETCH_TIMEOUT_MS = 15000
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AbworkbenchReader/1.0',
  Accept: 'text/html,application/xhtml+xml',
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

async function fetchHtml(url: string): Promise<{ ok: true; html: string } | { ok: false; message: string }> {
  let res: Response
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: FETCH_HEADERS,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `请求失败：${msg}` }
  }
  if (!res.ok) return { ok: false, message: `HTTP ${res.status}` }
  const contentType = res.headers.get('content-type') || ''
  const html = await res.text()
  if (!/html/i.test(contentType) && !/<html|<body|<div/i.test(html)) {
    return { ok: false, message: '响应不是 HTML 页面' }
  }
  return { ok: true, html }
}

/** Fetch a novel page and extract chapter text with generic heuristics. */
export async function scrapeUrl(url: string, userData: string): Promise<ScrapeResult> {
  const trimmed = String(url || '').trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, message: '请输入以 http(s) 开头的链接' }
  }

  const fetched = await fetchHtml(trimmed)
  if (!fetched.ok) return fetched

  const body = extractMainText(fetched.html)
  if (!body || body.length < 20) {
    return { ok: false, message: '未能提取正文' }
  }

  const catalog = extractChapterLinks(fetched.html, trimmed)
  const nextUrl = extractNextChapterHref(fetched.html, trimmed)
  const titleMatch = fetched.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
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

  const targetUrl = resolveChapterUrl(meta, chapterIndex, book.chapterUrl)
  if (!targetUrl) {
    return { ok: false, message: '没有更多章节，或尚未缓存下一章链接' }
  }

  const fetched = await fetchHtml(targetUrl)
  if (!fetched.ok) return fetched

  const body = extractMainText(fetched.html)
  if (!body || body.length < 20) return { ok: false, message: '未能提取正文' }

  const pageNext = extractNextChapterHref(fetched.html, targetUrl)
  const catalog = extractChapterLinks(fetched.html, targetUrl)
  const titleMatch = fetched.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
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
