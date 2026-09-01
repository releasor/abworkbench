import {
  HOTLIST_AGGREGATOR_ALIASES,
  HOTLIST_PLATFORMS,
  HOTLIST_RSS_SOURCES,
  type HotlistPlatform,
} from './hotlistPlatforms.ts'

export { HOTLIST_PLATFORMS } from './hotlistPlatforms.ts'
export type { HotlistPlatform } from './hotlistPlatforms.ts'

export type HotlistItem = {
  rank: number
  title: string
  url: string
  hot?: string
}

export type HotlistBoard = {
  id: string
  title: string
  subtitle?: string
  link?: string
  updateTime: string
  fromCache: boolean
  items: HotlistItem[]
  error?: string
}

const FETCH_TIMEOUT_MS = 15000
const CACHE_TTL_MS = 5 * 60 * 1000

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 AbworkbenchHotlist/1.0'

type CacheEntry = { board: HotlistBoard; expiresAt: number }
const cache = new Map<string, CacheEntry>()

function nowIso(): string {
  return new Date().toISOString()
}

function formatUpdateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm} 更新`
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
    headers: {
      'User-Agent': UA,
      Accept: 'application/json,text/plain,*/*',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('数据格式异常')
  }
}

async function fetchJsonPost<T>(url: string, body: unknown, init?: RequestInit): Promise<T> {
  return fetchJson<T>(url, {
    ...init,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    body: JSON.stringify(body),
  })
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function normalizeItems(raw: Array<{ title?: string; url?: string; hot?: string | number }>, limit = 15): HotlistItem[] {
  const items: HotlistItem[] = []
  for (const row of raw) {
    const title = String(row.title || '').trim()
    const url = String(row.url || '').trim()
    if (!title || !/^https?:\/\//i.test(url)) continue
    items.push({
      rank: items.length + 1,
      title,
      url,
      hot: row.hot != null && String(row.hot).trim() ? String(row.hot).trim() : undefined,
    })
    if (items.length >= limit) break
  }
  return items
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim()
}

function parseRssItems(xml: string, limit = 15): HotlistItem[] {
  const items: HotlistItem[] = []
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || []
  for (const block of blocks) {
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    let url = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim()
    if (!url) {
      url = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim()
    }
    const titleClean = title ? decodeXmlText(title) : ''
    if (!titleClean || !url || !/^https?:\/\//i.test(url)) continue
    items.push({
      rank: items.length + 1,
      title: titleClean,
      url,
    })
    if (items.length >= limit) break
  }
  return items
}

async function fetchFromRss(url: string): Promise<HotlistItem[]> {
  const xml = await fetchText(url)
  return parseRssItems(xml)
}

type AggregatorRow = { title?: string; url?: string; hot?: string | number; mobileUrl?: string }

function rowsFromAggregatorData(data: AggregatorRow[]): HotlistItem[] {
  return normalizeItems(
    data.map((v) => ({
      title: v.title,
      url: v.url || v.mobileUrl,
      hot: v.hot,
    })),
  )
}

async function fetchFromPublicDailyHot(id: string): Promise<HotlistItem[] | null> {
  const bases = [
    'https://api-hot.imsyy.top',
    'https://hotapi.bizhangqu.cn/api',
  ]
  for (const base of bases) {
    try {
      const json = await fetchJson<{ data?: AggregatorRow[] }>(`${base.replace(/\/$/, '')}/${id}`)
      if (Array.isArray(json.data) && json.data.length > 0) {
        return rowsFromAggregatorData(json.data)
      }
    } catch {
      // try next mirror
    }
  }
  return null
}

async function fetchFromVvhan(id: string): Promise<HotlistItem[] | null> {
  try {
    const json = await fetchJson<{ success?: boolean; data?: AggregatorRow[] }>(
      `https://api.vvhan.com/api/hotlist/${id}`,
    )
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return rowsFromAggregatorData(json.data)
    }
  } catch {
    // ignore
  }
  return null
}

async function fetchFromAggregators(ids: string[]): Promise<HotlistItem[] | null> {
  for (const id of ids) {
    const vvhan = await fetchFromVvhan(id)
    if (vvhan?.length) return vvhan

    const publicHot = await fetchFromPublicDailyHot(id)
    if (publicHot?.length) return publicHot

    const mirrored = await fetchFromDailyHotMirror(id)
    if (mirrored?.length) return mirrored
  }
  return null
}

function friendlyFetchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/SyntaxError|Unexpected token|数据格式异常|not valid JSON/i.test(msg)) return '数据源暂不可用'
  if (/fetch failed|ECONNREFUSED|ETIMEDOUT|aborted|network/i.test(msg)) return '网络请求失败'
  if (/HTTP \d+/.test(msg)) return msg
  return msg.length > 60 ? `${msg.slice(0, 60)}…` : msg
}

async function fetchFund(): Promise<HotlistItem[]> {
  const text = await fetchText(
    'https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&sc=1nzf&st=desc&pi=1&pn=15&dx=1',
    { headers: { Referer: 'https://fund.eastmoney.com/' } },
  )
  const datasMatch = text.match(/datas:\[([\s\S]*?)\],allRecords:/)
  if (!datasMatch) throw new Error('基金数据解析失败')
  const rawItems = JSON.parse(`[${datasMatch[1]}]`) as string[]
  return normalizeItems(
    rawItems.map((row) => {
      const cols = row.split(',')
      const code = cols[0]
      return {
        title: cols[1] || code,
        url: code ? `https://fund.eastmoney.com/${code}.html` : '',
        hot: cols[3],
      }
    }),
  )
}

async function fetchXueqiu(): Promise<HotlistItem[]> {
  try {
    await fetchText('https://xueqiu.com/', { headers: { Referer: 'https://xueqiu.com/' } })
  } catch {
    // warmup is best-effort
  }
  const json = await fetchJson<{
    data?: { items?: Array<{ name?: string; symbol?: string; value?: number }> }
  }>(
    `https://stock.xueqiu.com/v5/stock/hot_stock/list.json?size=15&order=desc&order_by=value&type=20&_=${Date.now()}`,
    { headers: { Referer: 'https://xueqiu.com/' } },
  )
  return normalizeItems(
    (json.data?.items || []).map((v) => ({
      title: v.name,
      url: v.symbol ? `https://xueqiu.com/S/${v.symbol}` : '',
      hot: v.value,
    })),
  )
}

async function fetchJuejin(): Promise<HotlistItem[]> {
  const json = await fetchJson<{
    data?: Array<{
      content?: { content_id?: string; title?: string }
      content_counter?: { hot_rank?: number }
    }>
  }>(
    'https://api.juejin.cn/content_api/v1/content/article_rank?category_id=1&type=hot',
    { headers: { Referer: 'https://juejin.cn/' } },
  )
  return normalizeItems(
    (json.data || []).map((v) => ({
      title: v.content?.title,
      url: v.content?.content_id ? `https://juejin.cn/post/${v.content.content_id}` : '',
      hot: v.content_counter?.hot_rank,
    })),
  )
}

async function fetchWoshipm(): Promise<HotlistItem[]> {
  const html = await fetchText('https://www.woshipm.com/', { headers: { Referer: 'https://www.woshipm.com/' } })
  const items: HotlistItem[] = []
  const linkRe = /<a[^>]+href="(https:\/\/www\.woshipm\.com\/[^"]+)"[^>]*title="([^"]+)"/gi
  let match: RegExpExecArray | null
  while ((match = linkRe.exec(html)) && items.length < 15) {
    const title = decodeXmlText(match[2])
    if (!title || title.length < 4) continue
    items.push({
      rank: items.length + 1,
      title,
      url: match[1],
    })
  }
  return items
}

async function fetch52pojie(): Promise<HotlistItem[]> {
  const html = await fetchText('https://www.52pojie.cn/', { headers: { Referer: 'https://www.52pojie.cn/' } })
  const items: HotlistItem[] = []
  const linkRe = /<a[^>]+href="(https?:\/\/www\.52pojie\.cn\/thread-\d+-\d+-\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = linkRe.exec(html)) && items.length < 15) {
    const title = decodeXmlText(match[2])
    if (!title || title.length < 4) continue
    items.push({
      rank: items.length + 1,
      title,
      url: match[1],
    })
  }
  return items
}

async function fetchWeibo(): Promise<HotlistItem[]> {
  const json = await fetchJson<{ data?: { realtime?: Array<{ word?: string; word_scheme?: string; num?: number }> } }>(
    'https://weibo.com/ajax/side/hotSearch',
    { headers: { Referer: 'https://weibo.com/' } },
  )
  const list = json.data?.realtime || []
  return normalizeItems(
    list.map((v) => {
      const key = v.word_scheme ? v.word_scheme : `#${v.word || ''}`
      return {
        title: v.word,
        url: `https://s.weibo.com/weibo?q=${encodeURIComponent(key)}&t=31&band_rank=1&Refer=top`,
        hot: v.num,
      }
    }),
  )
}

async function fetchZhihu(): Promise<HotlistItem[]> {
  const json = await fetchJson<{ data?: Array<{ target?: { title?: string; url?: string }; detail_text?: string }> }>(
    'https://api.zhihu.com/topstory/hot-lists/total?limit=50',
    { headers: { Referer: 'https://www.zhihu.com/hot' } },
  )
  return normalizeItems(
    (json.data || []).map((v) => {
      const target = v.target
      const questionId = target?.url?.split('/').pop()
      const url = questionId ? `https://www.zhihu.com/question/${questionId}` : target?.url
      return {
        title: target?.title,
        url,
        hot: v.detail_text,
      }
    }),
  )
}

async function fetchBilibili(): Promise<HotlistItem[]> {
  const json = await fetchJson<{ data?: { list?: Array<{ title?: string; bvid?: string; short_link_v2?: string; stat?: { view?: number } }> } }>(
    'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all',
    { headers: { Referer: 'https://www.bilibili.com/' } },
  )
  return normalizeItems(
    (json.data?.list || []).map((v) => ({
      title: v.title,
      url: v.short_link_v2 || (v.bvid ? `https://www.bilibili.com/video/${v.bvid}` : ''),
      hot: v.stat?.view,
    })),
  )
}

async function fetchBaidu(): Promise<HotlistItem[]> {
  const json = await fetchJson<{
    data?: {
      cards?: Array<{
        content?: Array<
          | { word?: string; url?: string; heat_score?: number; query?: string }
          | { content?: Array<{ word?: string; url?: string; heat_score?: number; query?: string }> }
        >
      }>
    }
  }>(
    'https://top.baidu.com/api/board?platform=wise&tab=realtime',
    { headers: { Referer: 'https://top.baidu.com/board' } },
  )
  const cardContent = json.data?.cards?.[0]?.content || []
  const nested = cardContent[0] && 'content' in cardContent[0] && Array.isArray(cardContent[0].content)
    ? cardContent[0].content
    : (cardContent as Array<{ word?: string; url?: string; heat_score?: number; query?: string }>)
  return normalizeItems(
    nested.map((v) => ({
      title: v.word,
      url: v.url || (v.word ? `https://www.baidu.com/s?wd=${encodeURIComponent(v.query || v.word)}` : ''),
      hot: v.heat_score,
    })),
  )
}

async function fetchV2ex(): Promise<HotlistItem[]> {
  const json = await fetchJson<Array<{ id?: number; title?: string; replies?: number }>>(
    'https://www.v2ex.com/api/topics/hot.json',
    { headers: { Accept: 'application/json' } },
    25000,
  )
  return normalizeItems(
    json.map((v) => ({
      title: v.title,
      url: v.id ? `https://www.v2ex.com/t/${v.id}` : '',
      hot: v.replies != null ? `${v.replies} 回复` : undefined,
    })),
  )
}

async function fetchIthome(): Promise<HotlistItem[]> {
  const json = await fetchJson<{
    newslist?: Array<{ title?: string; Url?: string; url?: string; newsid?: number }>
  }>('https://api.ithome.com/json/newslist/news')
  const list = json.newslist || []
  return normalizeItems(
    list.map((v) => {
      let url = v.Url || v.url || (v.newsid ? `https://www.ithome.com/0/${v.newsid}.htm` : '')
      if (url && !/^https?:\/\//i.test(url)) {
        url = `https://www.ithome.com${url.startsWith('/') ? '' : '/'}${url}`
      }
      return { title: v.title, url }
    }),
  )
}

async function fetch36kr(): Promise<HotlistItem[]> {
  const json = await fetchJsonPost<{
    data?: {
      hotRankList?: Array<{
        itemId?: string
        templateMaterial?: { widgetTitle?: string; statCollect?: number }
      }>
    }
  }>(
    'https://gateway.36kr.com/api/mis/nav/home/nav/rank/hot',
    {
      partner_id: 'wap',
      param: { siteId: 1, platformId: 2 },
      timestamp: Date.now(),
    },
    { headers: { Referer: 'https://36kr.com/' } },
  )
  return normalizeItems(
    (json.data?.hotRankList || []).map((v) => ({
      title: v.templateMaterial?.widgetTitle,
      url: v.itemId ? `https://www.36kr.com/p/${v.itemId}` : '',
      hot: v.templateMaterial?.statCollect,
    })),
  )
}

async function fetchSspai(): Promise<HotlistItem[]> {
  const json = await fetchJson<{ data?: Array<{ title?: string; id?: number }> }>(
    'https://sspai.com/api/v1/article/index/page/get?limit=20&offset=0&created_at=-1&tag=%E7%83%AD%E9%97%A8%E6%96%87%E7%AB%A0',
    { headers: { Referer: 'https://sspai.com/' } },
  )
  return normalizeItems(
    (json.data || []).map((v) => ({
      title: v.title,
      url: v.id ? `https://sspai.com/post/${v.id}` : '',
    })),
  )
}

async function fetchThepaper(): Promise<HotlistItem[]> {
  const json = await fetchJson<{ data?: { hotNews?: Array<{ name?: string; contId?: string; praiseTimes?: string }> } }>(
    'https://cache.thepaper.cn/contentapi/wwwIndex/rightSidebar',
    { headers: { Referer: 'https://www.thepaper.cn/' } },
  )
  return normalizeItems(
    (json.data?.hotNews || []).map((v) => ({
      title: v.name,
      url: v.contId ? `https://www.thepaper.cn/newsDetail_forward_${v.contId}` : '',
      hot: v.praiseTimes,
    })),
  )
}

async function fetchHupu(): Promise<HotlistItem[]> {
  const json = await fetchJson<{
    data?: { topicThreads?: Array<{ tid?: string; title?: string; replies?: number }> }
  }>('https://m.hupu.com/api/v2/bbs/topicThreads?topicId=1&page=1', {
    headers: { Referer: 'https://bbs.hupu.com/' },
  })
  return normalizeItems(
    (json.data?.topicThreads || []).map((v) => ({
      title: v.title,
      url: v.tid ? `https://bbs.hupu.com/${v.tid}.html` : '',
      hot: v.replies != null ? `${v.replies} 回复` : undefined,
    })),
  )
}

async function fetchSina(): Promise<HotlistItem[]> {
  const json = await fetchJson<{
    data?: { hotList?: Array<{ base?: { base?: { url?: string } }; info?: { title?: string; hotValue?: string } }> }
  }>('https://newsapp.sina.cn/api/hotlist?newsId=HB-1-snhs%2Ftop_news_list-all', {
    headers: { Referer: 'https://sinanews.sina.cn/' },
  })
  return normalizeItems(
    (json.data?.hotList || []).map((v) => ({
      title: v.info?.title,
      url: v.base?.base?.url,
      hot: v.info?.hotValue,
    })),
  )
}

async function fetchHuxiu(): Promise<HotlistItem[]> {
  const json = await fetchJson<{
    data?: { moment_list?: { datalist?: Array<{ content?: string; object_id?: string; count_info?: { agree_num?: number } }> } }
  }>('https://moment-api.huxiu.com/web-v3/moment/feed?platform=www', {
    headers: { Referer: 'https://www.huxiu.com/moment/' },
  })
  return normalizeItems(
    (json.data?.moment_list?.datalist || []).map((v) => {
      const content = (v.content || '').replace(/<br\s*\/?>/gi, '\n')
      const title = content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)[0]
        ?.replace(/。$/, '')
      return {
        title,
        url: v.object_id ? `https://www.huxiu.com/moment/${v.object_id}.html` : '',
        hot: v.count_info?.agree_num,
      }
    }),
  )
}

async function fetchFollow(): Promise<HotlistItem[]> {
  const json = await fetchJson<{ stories?: Array<{ id?: string; title?: string; url?: string; type?: number }> }>(
    'https://daily.zhihu.com/api/4/news/latest',
    { headers: { Referer: 'https://daily.zhihu.com/' } },
  )
  return normalizeItems(
    (json.stories || [])
      .filter((story) => story.type === 0)
      .map((story) => ({
        title: story.title,
        url: story.url || (story.id ? `https://daily.zhihu.com/story/${story.id}` : ''),
      })),
  )
}

async function fetchDouyin(): Promise<HotlistItem[]> {
  const json = await fetchJson<{ data?: { word_list?: Array<{ word?: string; hot_value?: number; sentence_id?: string }> } }>(
    'https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1',
    { headers: { Referer: 'https://www.douyin.com/' } },
  )
  return normalizeItems(
    (json.data?.word_list || []).map((v) => ({
      title: v.word,
      url: v.sentence_id
        ? `https://www.douyin.com/search/${encodeURIComponent(v.word || '')}?source=hot_search`
        : `https://www.douyin.com/search/${encodeURIComponent(v.word || '')}`,
      hot: v.hot_value,
    })),
  )
}

async function fetchToutiao(): Promise<HotlistItem[]> {
  const json = await fetchJson<{ data?: Array<{ Title?: string; Url?: string; HotValue?: string }> }>(
    'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc',
    { headers: { Referer: 'https://www.toutiao.com/' } },
  )
  return normalizeItems(
    (json.data || []).map((v) => ({
      title: v.Title,
      url: v.Url,
      hot: v.HotValue,
    })),
  )
}

async function fetchTieba(): Promise<HotlistItem[]> {
  const json = await fetchJson<{ data?: { bang_topic?: { topic_list?: Array<{ topic_name?: string; topic_url?: string; discuss_num?: number }> } } }>(
    'https://tieba.baidu.com/hottopic/browse/topicList',
    { headers: { Referer: 'https://tieba.baidu.com/' } },
  )
  const list = json.data?.bang_topic?.topic_list || []
  return normalizeItems(
    list.map((v) => ({
      title: v.topic_name,
      url: v.topic_url?.startsWith('http') ? v.topic_url : v.topic_url ? `https://tieba.baidu.com${v.topic_url}` : '',
      hot: v.discuss_num,
    })),
  )
}

async function fetchGithub(): Promise<HotlistItem[]> {
  const html = await fetchText('https://github.com/trending?since=daily')
  const items: HotlistItem[] = []
  const articleRe = /<article class="Box-row"[\s\S]*?<\/article>/g
  let match: RegExpExecArray | null
  while ((match = articleRe.exec(html)) && items.length < 15) {
    const block = match[0]
    const hrefMatch = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"/)
    const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]+>[\s\S]*?([^\n<]+)\s*<\/a>/)
    const starsMatch = block.match(/(\d[\d,]*)\s*stars today/i)
    const href = hrefMatch?.[1]
    const title = titleMatch?.[1]?.replace(/\s+/g, ' ').trim()
    if (!href || !title) continue
    items.push({
      rank: items.length + 1,
      title,
      url: href.startsWith('http') ? href : `https://github.com${href}`,
      hot: starsMatch?.[1],
    })
  }
  return items
}

async function fetchWallstreetcn(): Promise<HotlistItem[]> {
  const json = await fetchJson<{ data?: { day?: Array<{ title?: string; uri?: string }> } }>(
    'https://api-one.wallstcn.com/apiv1/content/articles/hot?period=day',
    { headers: { Referer: 'https://wallstreetcn.com/' } },
  )
  return normalizeItems(
    (json.data?.day || []).map((v) => ({
      title: v.title,
      url: v.uri?.startsWith('http') ? v.uri : v.uri ? `https://wallstreetcn.com${v.uri}` : '',
    })),
  )
}

async function fetchXiaohongshu(): Promise<HotlistItem[]> {
  const mirrored = await fetchFromAggregators(['xiaohongshu'])
  if (mirrored?.length) return mirrored
  throw new Error('小红书热榜暂不可用')
}

const DIRECT_FETCHERS: Record<string, () => Promise<HotlistItem[]>> = {
  weibo: fetchWeibo,
  zhihu: fetchZhihu,
  baidu: fetchBaidu,
  bilibili: fetchBilibili,
  v2ex: fetchV2ex,
  ithome: fetchIthome,
  '36kr': fetch36kr,
  sspai: fetchSspai,
  thepaper: fetchThepaper,
  douyin: fetchDouyin,
  toutiao: fetchToutiao,
  tieba: fetchTieba,
  github: fetchGithub,
  wallstreetcn: fetchWallstreetcn,
  xiaohongshu: fetchXiaohongshu,
  fund: fetchFund,
  xueqiu: fetchXueqiu,
  'toutiao-dev': fetchJuejin,
  juejin: fetchJuejin,
  woshipm: fetchWoshipm,
  '52pojie': fetch52pojie,
  hupu: fetchHupu,
  sina: fetchSina,
  huxiu: fetchHuxiu,
  follow: fetchFollow,
}

async function fetchFromDailyHotMirror(id: string): Promise<HotlistItem[] | null> {
  const bases = [
    process.env.ABWB_DAILYHOT_API_BASE,
    'http://127.0.0.1:6688',
  ].filter(Boolean) as string[]

  for (const base of bases) {
    try {
      const json = await fetchJson<{ data?: Array<{ title?: string; url?: string; hot?: string | number; mobileUrl?: string }> }>(
        `${base.replace(/\/$/, '')}/${id}`,
      )
      if (!Array.isArray(json.data) || json.data.length === 0) continue
      return normalizeItems(
        json.data.map((v) => ({
          title: v.title,
          url: v.url || v.mobileUrl,
          hot: v.hot,
        })),
      )
    } catch {
      // try next mirror
    }
  }
  return null
}

async function fetchBoardDirect(id: string, platform: HotlistPlatform): Promise<HotlistBoard> {
  const updateTime = nowIso()
  const aggregatorIds = HOTLIST_AGGREGATOR_ALIASES[id] || [id]

  const loadItems = async (): Promise<HotlistItem[]> => {
    const fetcher = DIRECT_FETCHERS[id]
    if (fetcher) {
      try {
        const direct = await fetcher()
        if (direct.length > 0) return direct
      } catch {
        // fall through to RSS / aggregator
      }
    }

    const rssUrl = HOTLIST_RSS_SOURCES[id]
    if (rssUrl) {
      try {
        const rssItems = await fetchFromRss(rssUrl)
        if (rssItems.length > 0) return rssItems
      } catch {
        // fall through to aggregator
      }
    }

    const mirrored = await fetchFromAggregators(aggregatorIds)
    if (mirrored?.length) return mirrored

    return []
  }

  try {
    const items = await loadItems()
    if (items.length === 0) {
      return {
        id,
        title: platform.title,
        subtitle: platform.subtitle,
        updateTime,
        fromCache: false,
        items: [],
        error: '暂无榜单数据',
      }
    }
    return {
      id,
      title: platform.title,
      subtitle: platform.subtitle,
      updateTime,
      fromCache: false,
      items,
    }
  } catch (err) {
    try {
      const mirrored = await fetchFromAggregators(aggregatorIds)
      if (mirrored?.length) {
        return {
          id,
          title: platform.title,
          subtitle: platform.subtitle,
          updateTime,
          fromCache: false,
          items: mirrored,
        }
      }
    } catch {
      // fall through to error board
    }
    return {
      id,
      title: platform.title,
      subtitle: platform.subtitle,
      updateTime,
      fromCache: false,
      items: [],
      error: friendlyFetchError(err),
    }
  }
}

export async function fetchHotlistBoard(id: string, opts?: { noCache?: boolean }): Promise<HotlistBoard> {
  const platform = HOTLIST_PLATFORMS.find((p) => p.id === id)
  if (!platform) {
    return {
      id,
      title: id,
      updateTime: nowIso(),
      fromCache: false,
      items: [],
      error: '未知平台',
    }
  }

  if (!opts?.noCache) {
    const hit = cache.get(id)
    if (hit && hit.expiresAt > Date.now()) {
      return { ...hit.board, fromCache: true }
    }
  }

  const board = await fetchBoardDirect(id, platform)
  if (!board.error && board.items.length > 0) {
    cache.set(id, { board, expiresAt: Date.now() + CACHE_TTL_MS })
  }
  return board
}

export async function fetchHotlistBoardsBatch(ids: string[], opts?: { noCache?: boolean }): Promise<HotlistBoard[]> {
  const concurrency = 4
  const boards: HotlistBoard[] = new Array(ids.length)
  let cursor = 0

  async function worker() {
    while (cursor < ids.length) {
      const index = cursor++
      boards[index] = await fetchHotlistBoard(ids[index], opts)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()),
  )
  return boards
}

export async function fetchAllHotlistBoards(opts?: { noCache?: boolean }): Promise<HotlistBoard[]> {
  const concurrency = 8
  const boards: HotlistBoard[] = new Array(HOTLIST_PLATFORMS.length)
  let cursor = 0

  async function worker() {
    while (cursor < HOTLIST_PLATFORMS.length) {
      const index = cursor++
      const platform = HOTLIST_PLATFORMS[index]
      boards[index] = await fetchHotlistBoard(platform.id, opts)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, HOTLIST_PLATFORMS.length) }, () => worker()),
  )
  return boards
}

export function formatHotlistUpdateLabel(iso: string): string {
  return formatUpdateTime(iso)
}
