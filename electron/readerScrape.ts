import { extractChapterLinks, extractMainText, extractNextChapterHref } from './reader/scrapeHtml'
import {
  estimateChapterCount,
  readCacheMeta,
  readChapterCache,
  resolveChapterUrl,
  writeCacheMeta,
  writeChapterCache,
} from './reader/chapterCache'
import { getBook, makeWebBookId, upsertBook, withLibraryLock } from './readerLibrary'
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
  if (!res.ok) {
    if (res.status === 404 || res.status === 410) {
      return { ok: false, message: `页面不存在（HTTP ${res.status}）` }
    }
    return { ok: false, message: `HTTP ${res.status}` }
  }
  const contentType = res.headers.get('content-type') || ''
  const html = await res.text()
  if (!/html/i.test(contentType) && !/<html|<body|<div/i.test(html)) {
    return { ok: false, message: '响应不是 HTML 页面' }
  }
  return { ok: true, html }
}

/** Fetch a novel page and extract chapter text with generic heuristics. */
export async function scrapeUrl(url: string, userData: string, forceBookId?: string): Promise<ScrapeResult> {
  const trimmed = String(url || '').trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, message: '请输入以 http(s) 开头的链接' }
  }

  const fetched = await fetchHtml(trimmed)
  if (!fetched.ok) return fetched

  const catalog = extractChapterLinks(fetched.html, trimmed)
  const body = extractMainText(fetched.html)
  const titleMatch = fetched.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const pageTitle = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
    : '网文'

  // Directory/TOC pages: prefer seeding when the page has many chapter links and
  // little standalone prose (avoid hijacking real chapter pages that also list TOC).
  const looksLikeToc = catalog.length >= 3 && (!body || body.length < Math.max(120, catalog.length * 24))
  if ((!body || body.length < 20 || looksLikeToc) && catalog[0]?.url) {
    const first = await fetchHtml(catalog[0].url)
    if (!first.ok) {
      // Fall through to treating the pasted page as chapter 0 when TOC seed fails.
      if (!body || body.length < 20) return first
    } else {
      const firstBody = extractMainText(first.html)
      if (!firstBody || firstBody.length < 20) {
        if (!body || body.length < 20) return { ok: false, message: '未能提取正文' }
      } else {
        const nextUrl = extractNextChapterHref(first.html, catalog[0].url)
          || catalog[1]?.url
          || null
        const firstTitleMatch = first.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        const firstTitle = firstTitleMatch
          ? firstTitleMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
          : (catalog[0].title || '正文')

        const bookId = forceBookId || makeWebBookId(trimmed)
        const book: ReaderBook = await withLibraryLock(() => {
          const existing = getBook(userData, bookId)
          const next = {
            id: bookId,
            title: existing?.title || pageTitle || '网文',
            source: 'web' as const,
            catalogUrl: trimmed,
            chapterUrl: catalog[0].url,
            pinned: existing?.pinned,
            updatedAt: Date.now(),
          }
          upsertBook(userData, next)
          return next
        })
        writeChapterCache(userData, bookId, 0, firstBody, firstTitle || '正文')
        const chapterUrls = catalog.map((c) => c.url)
        writeCacheMeta(userData, bookId, {
          catalog,
          nextUrl,
          chapterUrl: catalog[0].url,
          chapterUrls: chapterUrls.length ? chapterUrls : [catalog[0].url],
        })
        return {
          ok: true,
          book,
          chapter: {
            title: firstTitle || '正文',
            body: firstBody,
            chapterIndex: 0,
            chapterCount: Math.max(catalog.length, nextUrl ? 2 : 1),
          },
          nextUrl,
          catalog,
        }
      }
    }
  }

  if (!body || body.length < 20) {
    return { ok: false, message: '未能提取正文' }
  }

  const nextUrl = extractNextChapterHref(fetched.html, trimmed)

  const bookId = forceBookId || makeWebBookId(trimmed)
  const book: ReaderBook = await withLibraryLock(() => {
    const existing = getBook(userData, bookId)
    const next = {
      id: bookId,
      title: existing?.title || pageTitle || '网文',
      source: 'web' as const,
      catalogUrl: catalog.length ? trimmed : undefined,
      chapterUrl: trimmed,
      pinned: existing?.pinned,
      updatedAt: Date.now(),
    }
    upsertBook(userData, next)
    return next
  })
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

  if (cached) {
    return {
      ok: true,
      book,
      chapter: {
        title: cached.title,
        body: cached.body,
        chapterIndex,
        chapterCount: estimateChapterCount(meta, chapterIndex),
      },
      nextUrl: meta?.nextUrl ?? null,
      catalog: meta?.catalog ?? [],
    }
  }

  const targetUrl = resolveChapterUrl(meta, chapterIndex, book.chapterUrl)
  if (!targetUrl) {
    // Resume/jump past known chapters: fall back to the nearest earlier readable chapter.
    if (chapterIndex > 0) {
      for (let i = chapterIndex - 1; i >= 0; i--) {
        if (readChapterCache(userData, bookId, i) || resolveChapterUrl(meta, i, book.chapterUrl)) {
          return getWebChapter(userData, book, i)
        }
      }
    }
    return { ok: false, message: '没有更多章节，或尚未缓存下一章链接' }
  }

  const fetched = await fetchHtml(targetUrl)
  if (!fetched.ok) {
    if (/页面不存在|HTTP 404|HTTP 410/.test(fetched.message) && chapterIndex > 0) {
      for (let i = chapterIndex - 1; i >= 0; i--) {
        if (readChapterCache(userData, bookId, i) || resolveChapterUrl(meta, i, book.chapterUrl)) {
          return getWebChapter(userData, book, i)
        }
      }
    }
    return fetched
  }

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
  await withLibraryLock(() => upsertBook(userData, updatedBook))

  return {
    ok: true,
    book: updatedBook,
    chapter: {
      title: pageTitle || '正文',
      body,
      chapterIndex,
      chapterCount: estimateChapterCount(
        { catalog: mergedCatalog, nextUrl: pageNext, chapterUrls },
        chapterIndex,
      ),
    },
    nextUrl: pageNext,
    catalog: mergedCatalog,
  }
}
