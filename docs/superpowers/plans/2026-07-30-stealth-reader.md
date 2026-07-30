# 摸鱼阅读 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在启动器提供「摸鱼阅读」：透明悬浮窗续读/书架，支持本地 `.txt` 与通用 URL 抓取，可调样式与老板键（隐藏/可选伪装）。

**Architecture:** 纯逻辑（分章、抽取、`auto` 判定）放可测模块；Electron 主进程管窗体、书架 JSON、抓取与热键；渲染进程 `?reader=1` 渲染 `StealthReaderApp`。启动器左键 `mode:auto`、右键进书架。设置「阅读」页持久化样式与老板键。

**Tech Stack:** Electron 42、React 19、Vite、TypeScript、Node `node:test`、现有 `desktop:*` IPC / preload 模式。

**Spec:** `docs/superpowers/specs/2026-07-30-stealth-reader-design.md`

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/modules/stealthReader/types.ts` | Book / Progress / ReaderSettings / OpenMode 共享类型 |
| `src/modules/stealthReader/resolveOpenMode.ts` | `auto` → `reading` \| `library` |
| `src/modules/stealthReader/splitChapters.ts` | `.txt` 分章纯函数 |
| `src/modules/stealthReader/scrapeHtml.ts` | 从 HTML 抽正文/目录/下一章（主进程与测试共用） |
| `src/modules/stealthReader/*.test.mjs` | 上述纯逻辑测试 |
| `electron/readerSettings.ts` | `reader-settings.json` 读写 |
| `electron/readerLibrary.ts` | `reader-library.json`、选目录、列书、读章、进度 |
| `electron/readerScrape.ts` | fetch + 调用 `scrapeHtml` + 缓存到 `reader-cache/` |
| `electron/readerWindow.ts` | BrowserWindow 创建/显示/隐藏/bounds/opacity/老板键 |
| `electron/main.ts` | 注册 IPC、接线 reader 模块 |
| `electron/preload.ts` | 暴露 reader API |
| `src/env.d.ts` | 类型 |
| `src/modules/stealthReader/StealthReaderApp.tsx` | 书架 / 阅读 / 伪装根组件 |
| `src/modules/stealthReader/LibraryPanel.tsx` | 书架 UI |
| `src/modules/stealthReader/ReadingPanel.tsx` | 阅读 UI |
| `src/modules/stealthReader/DisguisePanel.tsx` | 伪装 UI |
| `src/App.tsx` | `?reader=1` 分支 |
| `src/launcher/intents.ts` | 命令 `stealth-reader` |
| `src/launcher/LauncherApp.tsx` | 左键打开、右键菜单 |
| `src/components/settings/ReaderSettings.tsx` | 设置「阅读」 |
| `src/components/settings/SettingsPage.tsx` | 新 tab |
| `src/shortcuts/catalog.ts` | `readerBossKey` |
| `src/shortcuts/syncElectron.ts` | 同步老板键到 reader settings |

---

### Task 1: 类型 + `resolveOpenMode`（TDD）

**Files:**
- Create: `src/modules/stealthReader/types.ts`
- Create: `src/modules/stealthReader/resolveOpenMode.ts`
- Test: `src/modules/stealthReader/resolveOpenMode.test.mjs`

- [ ] **Step 1: Write failing test**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveOpenMode } from './resolveOpenMode.ts'

test('auto with valid progress returns reading + bookId', () => {
  const r = resolveOpenMode('auto', {
    books: [{ id: 'b1', title: '书', source: 'local', path: 'C:\\a.txt', updatedAt: 1 }],
    progress: { bookId: 'b1', chapterIndex: 2, offset: 10, updatedAt: 2 },
  })
  assert.deepEqual(r, { mode: 'reading', bookId: 'b1' })
})

test('auto without progress returns library', () => {
  const r = resolveOpenMode('auto', { books: [], progress: null })
  assert.deepEqual(r, { mode: 'library' })
})

test('auto with stale progress returns library', () => {
  const r = resolveOpenMode('auto', {
    books: [],
    progress: { bookId: 'missing', chapterIndex: 0, offset: 0, updatedAt: 1 },
  })
  assert.deepEqual(r, { mode: 'library' })
})

test('library mode always library', () => {
  const r = resolveOpenMode('library', {
    books: [{ id: 'b1', title: '书', source: 'local', path: 'C:\\a.txt', updatedAt: 1 }],
    progress: { bookId: 'b1', chapterIndex: 0, offset: 0, updatedAt: 1 },
  })
  assert.deepEqual(r, { mode: 'library' })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `node --test src/modules/stealthReader/resolveOpenMode.test.mjs`  
Expected: module not found / fail

- [ ] **Step 3: Implement**

`types.ts`:

```ts
export type BookSource = 'local' | 'web'

export interface ReaderBook {
  id: string
  title: string
  source: BookSource
  path?: string
  catalogUrl?: string
  chapterUrl?: string
  updatedAt: number
}

export interface ReaderProgress {
  bookId: string
  chapterIndex: number
  offset: number
  updatedAt: number
}

export interface ReaderLibraryState {
  books: ReaderBook[]
  progress: ReaderProgress | null
}

export type ReaderOpenRequest = 'auto' | 'library' | 'reading'

export interface ReaderOpenResult {
  mode: 'reading' | 'library'
  bookId?: string
}

export interface ReaderSettings {
  opacity: number
  fontSize: number
  fontColor: string
  bossKey: string
  disguiseEnabled: boolean
  novelDir: string
  windowBounds: { x: number; y: number; width: number; height: number } | null
}
```

`resolveOpenMode.ts`:

```ts
import type { ReaderLibraryState, ReaderOpenRequest, ReaderOpenResult } from './types'

export function resolveOpenMode(
  request: ReaderOpenRequest,
  state: ReaderLibraryState,
): ReaderOpenResult {
  if (request === 'library') return { mode: 'library' }
  if (request === 'reading') {
    const id = state.progress?.bookId
    if (id && state.books.some((b) => b.id === id)) return { mode: 'reading', bookId: id }
    return { mode: 'library' }
  }
  // auto
  const id = state.progress?.bookId
  if (id && state.books.some((b) => b.id === id)) return { mode: 'reading', bookId: id }
  return { mode: 'library' }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `node --test src/modules/stealthReader/resolveOpenMode.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/modules/stealthReader/types.ts src/modules/stealthReader/resolveOpenMode.ts src/modules/stealthReader/resolveOpenMode.test.mjs
git commit -m "添加摸鱼阅读打开模式判定"
```

---

### Task 2: `.txt` 分章（TDD）

**Files:**
- Create: `src/modules/stealthReader/splitChapters.ts`
- Test: `src/modules/stealthReader/splitChapters.test.mjs`

- [ ] **Step 1: Write failing test**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { splitChapters } from './splitChapters.ts'

test('splits on 第N章 headings', () => {
  const text = '前言\n第1章 开端\n内容甲\n第2章 发展\n内容乙'
  const chapters = splitChapters(text)
  assert.equal(chapters.length, 3)
  assert.match(chapters[1].title, /第1章/)
  assert.match(chapters[1].body, /内容甲/)
})

test('whole file is one chapter when no headings', () => {
  const chapters = splitChapters('只有一段没有章标题的正文')
  assert.equal(chapters.length, 1)
  assert.equal(chapters[0].title, '全文')
  assert.match(chapters[0].body, /只有一段/)
})

test('recognizes Chapter N', () => {
  const chapters = splitChapters('Chapter 1 Hello\nAAA\nChapter 2 World\nBBB')
  assert.ok(chapters.length >= 2)
  assert.match(chapters[0].title, /Chapter 1/i)
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `node --test src/modules/stealthReader/splitChapters.test.mjs`

- [ ] **Step 3: Implement**

```ts
export interface ChapterSlice {
  index: number
  title: string
  body: string
  start: number
  end: number
}

const HEADING = /^(?:第[零一二三四五六七八九十百千0-9]+章\s*.*|Chapter\s+\d+\s*.*)$/gim

export function splitChapters(text: string): ChapterSlice[] {
  const matches = [...text.matchAll(HEADING)]
  if (matches.length === 0) {
    return [{ index: 0, title: '全文', body: text, start: 0, end: text.length }]
  }
  const slices: ChapterSlice[] = []
  const first = matches[0]
  if ((first.index ?? 0) > 0) {
    slices.push({
      index: 0,
      title: '前言',
      body: text.slice(0, first.index),
      start: 0,
      end: first.index!,
    })
  }
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const start = m.index!
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length
    const titleLine = m[0].trim()
    const bodyStart = start + m[0].length
    slices.push({
      index: slices.length,
      title: titleLine,
      body: text.slice(bodyStart, end).replace(/^\r?\n/, ''),
      start,
      end,
    })
  }
  return slices
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `node --test src/modules/stealthReader/splitChapters.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/modules/stealthReader/splitChapters.ts src/modules/stealthReader/splitChapters.test.mjs
git commit -m "添加本地小说分章逻辑"
```

---

### Task 3: HTML 通用抽取（TDD）

**Files:**
- Create: `src/modules/stealthReader/scrapeHtml.ts`
- Create: `src/modules/stealthReader/fixtures/chapter-sample.html`
- Test: `src/modules/stealthReader/scrapeHtml.test.mjs`

- [ ] **Step 1: Fixture + failing test**

`fixtures/chapter-sample.html`:

```html
<html><body>
  <div id="content">第一段正文。第二句也在这里。</div>
  <a href="/book/2.html">下一章</a>
  <div id="list">
    <a href="/book/1.html">第1章</a>
    <a href="/book/2.html">第2章</a>
  </div>
</body></html>
```

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { extractChapterLinks, extractMainText, extractNextChapterHref } from './scrapeHtml.ts'

const dir = path.dirname(fileURLToPath(import.meta.url))
const html = fs.readFileSync(path.join(dir, 'fixtures/chapter-sample.html'), 'utf8')

test('extractMainText prefers #content', () => {
  assert.match(extractMainText(html), /第一段正文/)
})

test('extractNextChapterHref finds 下一章', () => {
  assert.equal(extractNextChapterHref(html, 'https://example.com/book/1.html'), 'https://example.com/book/2.html')
})

test('extractChapterLinks from list', () => {
  const links = extractChapterLinks(html, 'https://example.com/book/1.html')
  assert.ok(links.length >= 2)
  assert.ok(links.some((l) => /第1章/.test(l.title)))
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement minimal regex/DOM-free extractors**

```ts
export function extractMainText(html: string): string {
  const contentMatch = html.match(/<[^>]+id=["']content["'][^>]*>([\s\S]*?)<\/div>/i)
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const raw = contentMatch?.[1] ?? articleMatch?.[1] ?? largestTextBlock(html)
  return stripTags(raw).replace(/\s+\n/g, '\n').trim()
}

export function extractNextChapterHref(html: string, baseUrl: string): string | null {
  const m = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*下一[章节回]\s*<\/a>/i)
  if (!m) return null
  try { return new URL(m[1], baseUrl).href } catch { return null }
}

export function extractChapterLinks(html: string, baseUrl: string): Array<{ title: string; url: string }> {
  const links: Array<{ title: string; url: string }> = []
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const title = stripTags(m[2]).trim()
    if (!/第.+章|Chapter\s*\d+/i.test(title)) continue
    try {
      links.push({ title, url: new URL(m[1], baseUrl).href })
    } catch { /* skip */ }
  }
  return dedupeByUrl(links)
}

function stripTags(s: string): string {
  return s.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function largestTextBlock(html: string): string {
  const chunks = [...html.matchAll(/<(?:div|p|section)[^>]*>([\s\S]*?)<\/(?:div|p|section)>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length > 80)
  chunks.sort((a, b) => b.length - a.length)
  return chunks[0] ?? stripTags(html)
}

function dedupeByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)))
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `node --test src/modules/stealthReader/scrapeHtml.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/modules/stealthReader/scrapeHtml.ts src/modules/stealthReader/scrapeHtml.test.mjs src/modules/stealthReader/fixtures
git commit -m "添加通用小说页 HTML 抽取"
```

---

### Task 4: `readerSettings` + `readerLibrary`（主进程）

**Files:**
- Create: `electron/readerSettings.ts`（镜像 `electron/launcherSettings.ts` 风格）
- Create: `electron/readerLibrary.ts`
- Modify: none yet（IPC 在 Task 5）

- [ ] **Step 1: Implement `readerSettings.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'
import type { ReaderSettings } from '../src/modules/stealthReader/types'

export const DEFAULT_BOSS_KEY = 'Ctrl+Shift+Q'

export function defaultReaderSettings(): ReaderSettings {
  return {
    opacity: 0.85,
    fontSize: 16,
    fontColor: '#e8e8e8',
    bossKey: DEFAULT_BOSS_KEY,
    disguiseEnabled: false,
    novelDir: '',
    windowBounds: null,
  }
}

export function readerSettingsPath(userData: string): string {
  return path.join(userData, 'reader-settings.json')
}

export function loadReaderSettings(userData: string): ReaderSettings {
  const file = readerSettingsPath(userData)
  try {
    if (!fs.existsSync(file)) return defaultReaderSettings()
    return normalizeReaderSettings(JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch {
    return defaultReaderSettings()
  }
}

export function saveReaderSettings(userData: string, input: unknown): ReaderSettings {
  const next = normalizeReaderSettings(input)
  fs.writeFileSync(readerSettingsPath(userData), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function normalizeReaderSettings(input: unknown): ReaderSettings {
  const base = defaultReaderSettings()
  if (!input || typeof input !== 'object') return base
  const raw = input as Record<string, unknown>
  if (typeof raw.opacity === 'number' && raw.opacity >= 0.2 && raw.opacity <= 1) base.opacity = raw.opacity
  if (typeof raw.fontSize === 'number' && raw.fontSize >= 12 && raw.fontSize <= 36) base.fontSize = raw.fontSize
  if (typeof raw.fontColor === 'string' && raw.fontColor.trim()) base.fontColor = raw.fontColor.trim()
  if (typeof raw.bossKey === 'string' && raw.bossKey.trim()) base.bossKey = raw.bossKey.trim()
  if (typeof raw.disguiseEnabled === 'boolean') base.disguiseEnabled = raw.disguiseEnabled
  if (typeof raw.novelDir === 'string') base.novelDir = raw.novelDir
  if (raw.windowBounds && typeof raw.windowBounds === 'object') {
    const b = raw.windowBounds as Record<string, unknown>
    if ([b.x, b.y, b.width, b.height].every((n) => typeof n === 'number')) {
      base.windowBounds = { x: b.x as number, y: b.y as number, width: b.width as number, height: b.height as number }
    }
  }
  return base
}
```

注意：Electron 侧若不便直接 import `src/`，把 `ReaderSettings` 接口在 `electron/readerSettings.ts` 内重复声明一份，或把 `types.ts` 复制为 `electron/readerTypes.ts` 并由两边引用。**本计划选定：在 `electron/readerTypes.ts` 放一份与 `src/modules/stealthReader/types.ts` 相同的类型，两边各自维护时优先以 src 为准；实现时改为 electron 内自包含类型，避免 vite electron 编译路径问题。**

实现时：`electron/readerTypes.ts` 放类型；`src/modules/stealthReader/types.ts` 保持相同字段供渲染与测试；注释两边对齐。

- [ ] **Step 2: Implement `readerLibrary.ts`**

核心 API（签名必须实现）：

```ts
export function loadLibrary(userData: string): ReaderLibraryState
export function saveLibrary(userData: string, state: ReaderLibraryState): void
export function upsertBook(userData: string, book: ReaderBook): ReaderLibraryState
export function setProgress(userData: string, progress: ReaderProgress | null): ReaderLibraryState
export function listTxtFiles(dir: string): Array<{ name: string; path: string }>
export function readLocalChapter(filePath: string, chapterIndex: number): Promise<{ title: string; body: string; chapterCount: number; chapterIndex: number }>
```

`readLocalChapter`：读全文 → `splitChapters`（从 `src/modules/stealthReader/splitChapters.ts` 复制一份到 `electron/splitChapters.ts`，或在 electron 测试外用相对 import；**推荐复制纯函数到 `electron/splitChapters.ts`，src 测试仍测 src 副本，实现后保持算法一致**）。

为降低双副本风险：**最终实现把 `splitChapters.ts` / `scrapeHtml.ts` / `resolveOpenMode.ts` 放在 `electron/reader/` 纯 TS，并由 vite electron 打包；渲染侧测试用 `node --test` 直接跑 `electron/reader/*.test.mjs` 导入 `.ts`。**  

**计划修正（以本段为准，覆盖上文 File map）：** 纯逻辑统一放：

- `electron/reader/types.ts`
- `electron/reader/resolveOpenMode.ts`
- `electron/reader/splitChapters.ts`
- `electron/reader/scrapeHtml.ts`
- 对应 `*.test.mjs` 同目录

`src/modules/stealthReader/` 只放 UI。若 Task 1–3 已写在 `src/modules/...`，实现时**移动**到 `electron/reader/` 并改测试路径，一次提交说明「迁到 electron/reader」。

- [ ] **Step 3: Smoke 用临时脚本或 node 测试库文件读写（可选小测试）**

对 `resolveOpenMode` / `splitChapters` 测试路径更新后全部 PASS。

- [ ] **Step 4: Commit**

```bash
git add electron/reader electron/readerSettings.ts electron/readerLibrary.ts
git commit -m "添加摸鱼阅读设置与书架主进程模块"
```

---

### Task 5: `readerScrape` + `readerWindow` + IPC

**Files:**
- Create: `electron/readerScrape.ts`
- Create: `electron/readerWindow.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/env.d.ts`

- [ ] **Step 1: `readerScrape.ts`**

```ts
export async function scrapeUrl(url: string, userData: string): Promise<{
  ok: true
  book: ReaderBook
  chapter: { title: string; body: string; chapterIndex: number; chapterCount: number }
} | { ok: false; message: string }>
```

实现：`fetch(url, { signal: AbortSignal.timeout(15000) })` → 校验 text/html → `extractMainText` / links → 写 `reader-cache/<bookId>/<n>.txt` → `upsertBook`。空正文返回 `{ ok: false, message: '未能提取正文' }`。

- [ ] **Step 2: `readerWindow.ts`**

仿 `createLauncherWindow`：

```ts
export function createReaderWindow(opts: {
  dist: string
  preload: string
  bounds?: ReaderSettings['windowBounds']
}): BrowserWindow

export function showReader(win: BrowserWindow, payload: { mode: string; bookId?: string }): void
export function hideReader(win: BrowserWindow | null): void
export function registerBossKey(accelerator: string, onTrigger: () => void): { ok: boolean; error?: string }
export function unregisterBossKey(): void
```

窗体选项：`frame: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, `backgroundColor: '#00000000'`。  
`showReader`：`loadFile` 若未加载则带 `query: { reader: '1' }`；`webContents.send('reader:shown', payload)`；`show()`。

老板键回调由 main 决定：读 settings，若 `disguiseEnabled` 则 `send('reader:toggle-disguise')`，否则 `hide()`。

- [ ] **Step 3: Wire `main.ts`**

在 `app.whenReady` 注册：

```ts
ipcMain.handle('desktop:open-reader', async (_e, req: { mode?: string }) => { ... resolveOpenMode + showReader })
ipcMain.handle('desktop:hide-reader', ...)
ipcMain.handle('desktop:reader-window-control', (_e, action: { type: 'set-bounds' | 'set-opacity' | 'start-drag', ... }) => ...)
ipcMain.handle('desktop:get-reader-settings', ...)
ipcMain.handle('desktop:set-reader-settings', (_e, s) => { save; re-register boss key; return s })
ipcMain.handle('desktop:reader-list-books', ...)
ipcMain.handle('desktop:reader-set-progress', ...)
ipcMain.handle('desktop:reader-get-chapter', (_e, { bookId, chapterIndex }) => ...)
ipcMain.handle('desktop:reader-pick-directory', async () => dialog.showOpenDialog ... listTxt + upsert)
ipcMain.handle('desktop:reader-import-txt', ...) // 可选：单文件
ipcMain.handle('desktop:reader-scrape-url', (_e, url: string) => scrapeUrl(...))
ipcMain.handle('desktop:reader-open-book', (_e, bookId: string) => show reading)
```

启动时 `loadReaderSettings` + `registerBossKey`。

- [ ] **Step 4: preload + env.d.ts**

```ts
openReader: (req?: { mode?: 'auto' | 'library' | 'reading' }) => ipcRenderer.invoke('desktop:open-reader', req),
hideReader: () => ipcRenderer.invoke('desktop:hide-reader'),
onReaderShown: (cb: (payload: { mode: string; bookId?: string }) => void) => { ... 'reader:shown' },
onReaderToggleDisguise: (cb: () => void) => { ... },
getReaderSettings: () => ipcRenderer.invoke('desktop:get-reader-settings'),
setReaderSettings: (s: unknown) => ipcRenderer.invoke('desktop:set-reader-settings', s),
readerListBooks: () => ipcRenderer.invoke('desktop:reader-list-books'),
readerSetProgress: (p: unknown) => ipcRenderer.invoke('desktop:reader-set-progress', p),
readerGetChapter: (bookId: string, chapterIndex: number) => ipcRenderer.invoke('desktop:reader-get-chapter', { bookId, chapterIndex }),
readerPickDirectory: () => ipcRenderer.invoke('desktop:reader-pick-directory'),
readerScrapeUrl: (url: string) => ipcRenderer.invoke('desktop:reader-scrape-url', url),
readerWindowControl: (action: unknown) => ipcRenderer.invoke('desktop:reader-window-control', action),
```

同步扩展 `src/env.d.ts`。

- [ ] **Step 5: `npm run desktop:dev` 冒烟** — 开发者控制台 `window.electronAPI.openReader({mode:'library'})` 应出现透明窗（UI 可为空白）。

- [ ] **Step 6: Commit**

```bash
git add electron/readerScrape.ts electron/readerWindow.ts electron/main.ts electron/preload.ts src/env.d.ts
git commit -m "接入摸鱼阅读窗口与 IPC"
```

---

### Task 6: `StealthReaderApp` UI（书架 + 阅读 + 伪装）

**Files:**
- Create: `src/modules/stealthReader/StealthReaderApp.tsx`
- Create: `src/modules/stealthReader/LibraryPanel.tsx`
- Create: `src/modules/stealthReader/ReadingPanel.tsx`
- Create: `src/modules/stealthReader/DisguisePanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: App 分支**

在 `isLauncherMode` / `isMiniMode` 旁：

```tsx
const isReaderMode = useMemo(() => new URLSearchParams(window.location.search).get('reader') === '1', [])
```

```tsx
if (isReaderMode) {
  return <StealthReaderApp />
}
```

透明背景：仿 launcher，`document.documentElement` / `body` 设透明（参考 `App.tsx` launcher 分支 effect）。

- [ ] **Step 2: `StealthReaderApp`**

状态：`view: 'library' | 'reading' | 'disguise'`、`bookId`、`settings`、`error`。  
挂载时：`getReaderSettings`；`onReaderShown` 设 mode/bookId；`onReaderToggleDisguise` 在 reading↔disguise 间切换。  
Esc：`hideReader()` 或按伪装逻辑。

- [ ] **Step 3: `LibraryPanel`**

- 按钮「选择小说目录」→ `readerPickDirectory` → 刷新列表  
- 输入框粘贴 URL +「抓取」→ `readerScrapeUrl` → 成功则进入 reading  
- 书籍列表点击 → `readerGetChapter(id, progress?.chapterIndex ?? 0)` → reading  
- 显示错误文案

- [ ] **Step 4: `ReadingPanel`**

- 顶栏拖动：`onMouseDown` → `readerWindowControl({ type: 'start-drag' })` 或使用 `-webkit-app-region: drag`（Electron 透明窗优先 CSS drag + 按钮 `no-drag`）  
- 正文：`fontSize` / `fontColor` / 容器 `opacity` 来自 settings  
- 滚轮滚动；记录 `scrollTop` 节流 `readerSetProgress`  
- ←/→ / 空格：章节 ±1  
- 快捷：字号 ±、打开书架

- [ ] **Step 5: `DisguisePanel`**

静态假「工作周报」或等宽「代码」面板，无小说内容。

- [ ] **Step 6: 手动验证阅读/书架切换**

Run: `npm run desktop:dev`  
Expected: `openReader({mode:'library'})` 见书架；导入 txt 后可读。

- [ ] **Step 7: Commit**

```bash
git add src/modules/stealthReader src/App.tsx
git commit -m "实现摸鱼阅读悬浮窗界面"
```

---

### Task 7: 启动器命令与右键菜单

**Files:**
- Modify: `src/launcher/intents.ts`
- Modify: `src/launcher/LauncherApp.tsx`
- Test: `src/launcher/intents.test.mjs`（可选断言命令可匹配）

- [ ] **Step 1: 增加命令**

```ts
{ id: 'stealth-reader', label: '摸鱼阅读', description: '打开透明悬浮窗继续阅读或进入书架', keywords: ['reader', 'novel', 'moyu', '摸鱼', '阅读', '小说', '看书'] },
```

- [ ] **Step 2: `runCommand`**

```ts
if (commandId === 'stealth-reader') {
  void window.electronAPI?.openReader?.({ mode: 'auto' })
  hideLauncher()
  return
}
```

- [ ] **Step 3: 右键菜单**

在命令结果项 `button` 上：

```tsx
onContextMenu={(e) => {
  if (item.kind !== 'command' || item.commandId !== 'stealth-reader') return
  e.preventDefault()
  // 简易：固定弹出「进入书架」；或 window.confirm 级自定义小菜单
  void window.electronAPI?.openReader?.({ mode: 'library' })
  hideLauncher()
}}
```

更稳妥：本地 state `contextMenu: { x, y } | null`，渲染绝对定位菜单项「进入书架」。

- [ ] **Step 4: 空查询时快捷入口**（若启动器有命令网格）把 `stealth-reader` 加入可见命令列表（与其它 nav 命令一致）。

- [ ] **Step 5: 手动** — Alt+Space → 摸鱼阅读；无进度进书架；有进度续读；右键进书架。

- [ ] **Step 6: Commit**

```bash
git add src/launcher/intents.ts src/launcher/LauncherApp.tsx src/launcher/intents.test.mjs
git commit -m "启动器接入摸鱼阅读命令与右键书架"
```

---

### Task 8: 设置页 + 老板键快捷键同步

**Files:**
- Create: `src/components/settings/ReaderSettings.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`
- Modify: `src/shortcuts/catalog.ts`
- Modify: `src/shortcuts/syncElectron.ts`

- [ ] **Step 1: catalog**

```ts
{ id: 'readerBossKey', group: '全局', label: '摸鱼阅读老板键', defaultAccelerator: 'Ctrl+Shift+Q', scope: 'global', electron: true },
```

- [ ] **Step 2: `ReaderSettings.tsx`**

加载/保存 `getReaderSettings` / `setReaderSettings`：透明度滑块、字号、颜色、伪装 checkbox、老板键用现有 `ShortcutRecorder`、显示注册失败信息（若 set 返回 error 字段则展示）。

- [ ] **Step 3: SettingsPage 增加 tab**

```ts
{ id: 'reader' as const, label: '阅读', icon: BookOpen },
```

`{activeTab === 'reader' && <ReaderSettings onToast={showToast} />}`

- [ ] **Step 4: syncElectron**

扩展 `useSyncElectronShortcuts`：读写 `readerBossKey` ↔ `getReaderSettings().bossKey` / `setReaderSettings`，与 launcher 三键并列（避免循环：比较后再写）。

- [ ] **Step 5: 手动** — 改透明度/老板键；按老板键隐藏；开伪装后再按切换。

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/ReaderSettings.tsx src/components/settings/SettingsPage.tsx src/shortcuts/catalog.ts src/shortcuts/syncElectron.ts
git commit -m "添加阅读设置与老板键同步"
```

---

### Task 9: 收尾验证

- [ ] **Step 1: 跑全部相关单测**

```bash
node --test electron/reader/*.test.mjs src/modules/stealthReader/*.test.mjs src/launcher/intents.test.mjs
```

Expected: all pass（若测试已迁到 `electron/reader`，只跑该目录）。

- [ ] **Step 2: `npm run lint` — 修复本功能引入的问题。

- [ ] **Step 3: 对照 spec 手工清单**

- [ ] 启动器左键 auto 续读 / 无进度书架  
- [ ] 右键进入书架  
- [ ] 本地目录 `.txt` 分章阅读  
- [ ] URL 抓取成功/失败提示  
- [ ] 透明、拖动、字号、透明度  
- [ ] 老板键隐藏；伪装开关  

- [ ] **Step 4: 若有未提交改动则提交**

```bash
git add -A
git commit -m "完善摸鱼阅读收尾与校验"
```

（无改动则跳过）

---

## Spec coverage checklist

| Spec 项 | Task |
|---------|------|
| 启动器入口 + auto/library | 7, 1, 5 |
| 透明悬浮窗 | 5, 6 |
| 本地 txt + 分章 | 2, 4, 6 |
| 通用 URL 抓取 | 3, 5, 6 |
| 样式（透明度/字号/颜色/拖动） | 6, 8 |
| 老板键隐藏 + 可选伪装 | 5, 6, 8 |
| 设置「阅读」页 | 8 |
| 进度持久化 | 4, 6 |
| 错误提示 | 5, 6 |
| 单测分章/抽取/auto | 1–3 |
| 非目标（EPUB/适配器等） | 不实现 |

## Placeholder / consistency notes

- 纯逻辑目录以 **Task 4 修正** 为准：`electron/reader/`；UI 在 `src/modules/stealthReader/`。  
- 类型字段名全程：`ReaderBook`、`ReaderProgress`、`bossKey`、`disguiseEnabled`。  
- IPC 前缀：`desktop:open-reader`、`desktop:reader-*`、`reader:shown`。
