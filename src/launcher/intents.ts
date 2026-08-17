// Intent detection for the uTools-style launcher.
// Pure functions so they can be unit-tested with node:test.

export interface LauncherCommandDef {
  id: string
  label: string
  description: string
  keywords: string[]
}

export type LauncherItem =
  | { id: string; kind: 'command'; label: string; description: string; commandId: string }
  | { id: string; kind: 'translate'; label: string; description: string; text: string; explicit: boolean }
  | { id: string; kind: 'calc'; label: string; description: string; expression: string; result: string }
  | { id: string; kind: 'url'; label: string; description: string; url: string }
  | { id: string; kind: 'reader-url'; label: string; description: string; url: string }
  | { id: string; kind: 'path'; label: string; description: string; path: string; pathKind: 'file' | 'dir' }
  | { id: string; kind: 'websearch'; label: string; description: string; query: string; url: string; explicit: boolean }
  | { id: string; kind: 'everything'; label: string; description: string; query: string; explicit: boolean }

// --- Built-in feature commands (integrated, no plugin marketplace) ---
export const LAUNCHER_COMMANDS: LauncherCommandDef[] = [
  { id: 'open-main', label: '打开主窗口', description: '显示 Abworkbench 主界面', keywords: ['main', 'home', 'zhu', '主窗口', '主页', 'open'] },
  { id: 'nav-dashboard', label: '仪表盘', description: '打开主窗口并进入仪表盘', keywords: ['dashboard', 'yibiao', '仪表盘'] },
  { id: 'nav-taskflow', label: '任务流', description: '打开主窗口并进入任务流', keywords: ['task', 'todo', 'renwu', '任务', 'taskflow'] },
  { id: 'nav-pomodoro', label: '番茄钟', description: '打开主窗口并开始专注', keywords: ['pomodoro', 'focus', 'fanqie', '番茄', '专注'] },
  { id: 'nav-habits', label: '每日打卡', description: '打开主窗口并进入习惯打卡', keywords: ['habit', 'daka', '打卡', '习惯'] },
  { id: 'nav-notes', label: '笔记', description: '打开主窗口并进入笔记', keywords: ['note', 'biji', '笔记'] },
  { id: 'nav-weather', label: '天气', description: '打开主窗口并查看天气', keywords: ['weather', 'tianqi', '天气'] },
  { id: 'nav-settings', label: '设置', description: '打开主窗口并进入设置', keywords: ['settings', 'shezhi', '设置', 'preferences'] },
  { id: 'translate-clipboard', label: '翻译剪贴板内容', description: '用默认翻译引擎翻译剪贴板中的文本', keywords: ['translate', 'fanyi', '翻译', 'fy', 'clipboard'] },
  { id: 'stealth-reader', label: '摸鱼阅读', description: '打开透明悬浮窗继续阅读或进入书架', keywords: ['reader', 'novel', 'moyu', '摸鱼', '阅读', '小说', '看书'] },
]

// --- Prefix handling ---
const TRANSLATE_PREFIX = /^(?:翻译|翻譯|fy|translate|tr)\s+(.+)$/i
const FILE_SEARCH_PREFIX = /^(?:find|fd|ss|搜索文件|文件|搜文件)\s+(.+)$/i
const WEB_SEARCH_PREFIX = /^(?:搜索|搜|网页搜索|上网搜|google|bing|search|g|bd)\s+(.+)$/i

export function stripTranslatePrefix(input: string): string | null {
  const match = input.trim().match(TRANSLATE_PREFIX)
  return match ? match[1].trim() : null
}

export function stripFileSearchPrefix(input: string): string | null {
  const match = input.trim().match(FILE_SEARCH_PREFIX)
  return match ? match[1].trim() : null
}

export function stripWebSearchPrefix(input: string): string | null {
  const match = input.trim().match(WEB_SEARCH_PREFIX)
  return match ? match[1].trim() : null
}

// --- Translate heuristics ---
export function containsCJK(text: string): boolean {
  return /[一-鿿぀-ヿ가-힯]/.test(text)
}

/** Bare (unprefixed) input that is likely meant to be translated: CJK text or an English phrase. */
export function looksTranslatable(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 2) return false
  if (containsCJK(trimmed)) return true
  return /^[a-zA-Z][a-zA-Z0-9\s',.!?;:"()&-]*[a-zA-Z0-9.!?]$/.test(trimmed) && trimmed.length <= 200
}

// --- Local path detection (Windows absolute / UNC / file://) ---
export type DetectedLocalPath = {
  path: string
  pathKind: 'file' | 'dir'
}

/** Normalize and detect an absolute local filesystem path the user typed. */
export function detectLocalPath(input: string): DetectedLocalPath | null {
  let trimmed = input.trim()
  if (!trimmed) return null

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1)
    || (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length > 1)
  ) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  if (!trimmed) return null

  if (/^file:/i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      if (url.protocol.toLowerCase() !== 'file:') return null
      // file:///E:/foo/bar → E:\foo\bar ; file://localhost/E:/foo → E:\foo
      let pathname = decodeURIComponent(url.pathname || '')
      if (/^\/[A-Za-z]:/.test(pathname)) pathname = pathname.slice(1)
      trimmed = pathname.replace(/\//g, '\\')
    } catch {
      return null
    }
  }

  const isDrive = /^[A-Za-z]:[\\/]/.test(trimmed)
  const isUnc = /^\\\\[^\\/]+[\\/][^\\/]/.test(trimmed)
  if (!isDrive && !isUnc) return null

  // Reject newlines / control chars; spaces are allowed (e.g. "Setup 1.0.0.exe").
  if (/[\r\n\0]/.test(trimmed)) return null

  const normalized = trimmed.replace(/\//g, '\\')
  const endsWithSep = /\\$/.test(normalized)
  const withoutTrailing = normalized.replace(/\\+$/, '')
  const base = withoutTrailing.split('\\').filter(Boolean).pop() || ''

  // Drive root: E: or E:\
  if (/^[A-Za-z]:$/i.test(withoutTrailing)) {
    return { path: `${withoutTrailing.toUpperCase()}\\`, pathKind: 'dir' }
  }

  if (endsWithSep) {
    return { path: `${withoutTrailing}\\`, pathKind: 'dir' }
  }

  // Filename with extension → file; otherwise treat as directory (Explorer can still open it).
  if (/\.[a-zA-Z0-9]{1,16}$/.test(base)) {
    return { path: withoutTrailing, pathKind: 'file' }
  }

  return { path: withoutTrailing, pathKind: 'dir' }
}

// --- URL detection ---
/** Extract / normalize a URL from typed text or clipboard content. */
export function detectUrl(input: string): string | null {
  const trimmed = input.trim().replace(/^[<"'[]+|[>"'\],.。，；;]+$/g, '')
  if (!trimmed || /\s/.test(trimmed)) {
    // Allow a lone URL buried in short clipboard paste with surrounding words? Keep strict for typed.
    // But clipboard often has pure URL — also try extracting first http(s) token.
    const httpMatch = input.match(/https?:\/\/[^\s<>"']+/i)
    if (httpMatch) {
      return httpMatch[0].replace(/[),.\]]+$/g, '')
    }
    const wwwMatch = input.match(/(?:^|\s)(www\.[^\s<>"']+)/i)
    if (wwwMatch) return `https://${wwwMatch[1].replace(/[),.\]]+$/g, '')}`
    return null
  }

  if (/^https?:\/\/\S+/i.test(trimmed)) {
    return trimmed.replace(/[),.\]]+$/g, '')
  }
  if (/^www\.[^\s]+$/i.test(trimmed)) {
    return `https://${trimmed.replace(/[),.\]]+$/g, '')}`
  }
  // domain.tld or domain.tld/path — require a real TLD-ish suffix
  if (/^(localhost|(?:[\w-]+\.)+[a-z]{2,})(:\d+)?(\/\S*)?$/i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return null
}

export function buildWebSearchUrl(query: string): string {
  return `https://www.bing.com/search?q=${encodeURIComponent(query.trim())}`
}

// --- Calculator ---
const MATH_CHARS = /^[\d\s+\-*/().%^×÷]+$/

export function looksLikeMathExpression(input: string): boolean {
  const trimmed = input.trim()
  if (trimmed.length < 3 || !MATH_CHARS.test(trimmed)) return false
  if (!/\d/.test(trimmed)) return false
  // Must contain at least one binary operator between digits/parens.
  return /[\d)][\s]*[+\-*/%^×÷][\s]*[(\d-]/.test(trimmed)
}

type Token = { type: 'num'; value: number } | { type: 'op'; value: string }

function tokenize(expr: string): Token[] | null {
  const normalized = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '')
  const tokens: Token[] = []
  let i = 0
  let prev: Token | null = null
  while (i < normalized.length) {
    const ch = normalized[i]
    if (/[\d.]/.test(ch)) {
      let j = i
      while (j < normalized.length && /[\d.]/.test(normalized[j])) j++
      const value = Number(normalized.slice(i, j))
      if (!Number.isFinite(value)) return null
      tokens.push({ type: 'num', value })
      prev = tokens[tokens.length - 1]
      i = j
      continue
    }
    if ('+-*/%^'.includes(ch)) {
      // Unary minus/plus: at start, after an operator, or after '('.
      if ((ch === '-' || ch === '+') && (!prev || (prev.type === 'op' && prev.value !== ')'))) {
        const sign = ch === '-' ? -1 : 1
        let j = i + 1
        if (normalized[j] === '(') {
          // -( ... ) → represent as 0 - ( ... )
          tokens.push({ type: 'num', value: 0 })
          tokens.push({ type: 'op', value: sign === -1 ? '-' : '+' })
          prev = tokens[tokens.length - 1]
          i++
          continue
        }
        while (j < normalized.length && /[\d.]/.test(normalized[j])) j++
        if (j === i + 1) return null
        const value = sign * Number(normalized.slice(i + 1, j))
        if (!Number.isFinite(value)) return null
        tokens.push({ type: 'num', value })
        prev = tokens[tokens.length - 1]
        i = j
        continue
      }
      tokens.push({ type: 'op', value: ch })
      prev = tokens[tokens.length - 1]
      i++
      continue
    }
    if (ch === '(' || ch === ')') {
      // Implicit multiplication: 2(3) or (2)(3)
      if (ch === '(' && prev && (prev.type === 'num' || (prev.type === 'op' && prev.value === ')'))) {
        tokens.push({ type: 'op', value: '*' })
      }
      tokens.push({ type: 'op', value: ch })
      prev = tokens[tokens.length - 1]
      i++
      continue
    }
    return null
  }
  return tokens
}

/** Safely evaluate a basic arithmetic expression (shunting-yard; no eval). Returns null when invalid. */
export function evaluateExpression(input: string): number | null {
  const tokens = tokenize(input)
  if (!tokens || tokens.length === 0) return null

  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 }
  const output: Token[] = []
  const ops: string[] = []

  for (const token of tokens) {
    if (token.type === 'num') {
      output.push(token)
      continue
    }
    const op = token.value
    if (op === '(') {
      ops.push(op)
    } else if (op === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') {
        output.push({ type: 'op', value: ops.pop()! })
      }
      if (!ops.length) return null
      ops.pop()
    } else {
      while (ops.length) {
        const top = ops[ops.length - 1]
        if (top === '(') break
        const higher = precedence[top] > precedence[op]
        const equalLeft = precedence[top] === precedence[op] && op !== '^'
        if (higher || equalLeft) output.push({ type: 'op', value: ops.pop()! })
        else break
      }
      ops.push(op)
    }
  }
  while (ops.length) {
    const op = ops.pop()!
    if (op === '(') return null
    output.push({ type: 'op', value: op })
  }

  const stack: number[] = []
  for (const token of output) {
    if (token.type === 'num') {
      stack.push(token.value)
      continue
    }
    const b = stack.pop()
    const a = stack.pop()
    if (a === undefined || b === undefined) return null
    switch (token.value) {
      case '+': stack.push(a + b); break
      case '-': stack.push(a - b); break
      case '*': stack.push(a * b); break
      case '/':
        if (b === 0) return null
        stack.push(a / b)
        break
      case '%': stack.push(a % b); break
      case '^': stack.push(Math.pow(a, b)); break
      default: return null
    }
  }
  if (stack.length !== 1 || !Number.isFinite(stack[0])) return null
  return stack[0]
}

export function formatCalcResult(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value)
  return String(Number(value.toPrecision(10)))
}

// --- Command matching ---
function matchScore(command: LauncherCommandDef, normalizedQuery: string): number {
  const label = command.label.toLowerCase()
  if (label === normalizedQuery) return 100
  if (label.startsWith(normalizedQuery)) return 80
  if (label.includes(normalizedQuery)) return 60
  for (const keyword of command.keywords) {
    const kw = keyword.toLowerCase()
    if (kw === normalizedQuery) return 90
    if (kw.startsWith(normalizedQuery)) return 70
    if (kw.includes(normalizedQuery)) return 40
  }
  return 0
}

export function matchCommands(input: string, commands: LauncherCommandDef[] = LAUNCHER_COMMANDS): LauncherCommandDef[] {
  const normalized = input.trim().toLowerCase()
  if (!normalized) return []
  return commands
    .map((command) => ({ command, score: matchScore(command, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.command)
}

// --- Unified item builder ---
export function buildLauncherItems(input: string, commands: LauncherCommandDef[] = LAUNCHER_COMMANDS): LauncherItem[] {
  const trimmed = input.trim()
  if (!trimmed) return []

  const items: LauncherItem[] = []

  // 1. Calculator wins over everything else.
  if (looksLikeMathExpression(trimmed)) {
    const value = evaluateExpression(trimmed)
    if (value !== null) {
      items.push({
        id: 'calc',
        kind: 'calc',
        label: `= ${formatCalcResult(value)}`,
        description: `计算器：${trimmed}（回车复制结果）`,
        expression: trimmed,
        result: formatCalcResult(value),
      })
      return items
    }
  }

  // 2. Absolute local path — open file or jump to folder.
  const localPath = detectLocalPath(trimmed)
  if (localPath) {
    const label = localPath.pathKind === 'dir' ? '打开目录' : '打开文件'
    const description =
      localPath.pathKind === 'dir'
        ? `在资源管理器中打开：${localPath.path}`
        : `用默认程序打开：${localPath.path}`
    items.push({
      id: 'path',
      kind: 'path',
      label,
      description,
      path: localPath.path,
      pathKind: localPath.pathKind,
    })
    return items
  }

  // 3. URL — open directly in default browser.
  const url = detectUrl(trimmed)
  if (url) {
    const t = trimmed.trim()
    const mostlyUrl = !/\s/.test(t) || /^https?:\/\//i.test(t) || /^www\./i.test(t)
    if (mostlyUrl) {
      items.push({ id: 'url', kind: 'url', label: '打开网址', description: url, url })
      items.push({
        id: 'reader-url',
        kind: 'reader-url',
        label: '摸鱼阅读此链接',
        description: '抓取正文并在透明悬浮窗阅读',
        url,
      })
      return items
    }
  }

  // 4. Explicit translate prefix.
  const translateText = stripTranslatePrefix(trimmed)
  if (translateText) {
    items.push({
      id: 'translate',
      kind: 'translate',
      label: `翻译：${translateText}`,
      description: '使用默认翻译引擎（回车打开）',
      text: translateText,
      explicit: true,
    })
  }

  // 5. Explicit web search prefix.
  const webQuery = stripWebSearchPrefix(trimmed)
  if (webQuery) {
    items.push({
      id: 'websearch',
      kind: 'websearch',
      label: `网页搜索：${webQuery}`,
      description: '在默认浏览器中搜索（Bing）',
      query: webQuery,
      url: buildWebSearchUrl(webQuery),
      explicit: true,
    })
  }

  // 6. Explicit file-search prefix.
  const fileQuery = stripFileSearchPrefix(trimmed)
  if (fileQuery) {
    items.push({
      id: 'everything',
      kind: 'everything',
      label: `搜索文件：${fileQuery}`,
      description: '使用 Everything 全局搜索文件',
      query: fileQuery,
      explicit: true,
    })
  }

  // 7. Feature commands.
  for (const command of matchCommands(trimmed, commands)) {
    items.push({
      id: `cmd-${command.id}`,
      kind: 'command',
      label: command.label,
      description: command.description,
      commandId: command.id,
    })
  }

  // 8. Implicit intents for bare text.
  if (!translateText && !fileQuery && !webQuery) {
    if (looksTranslatable(trimmed)) {
      items.push({
        id: 'translate-implicit',
        kind: 'translate',
        label: `翻译：${trimmed}`,
        description: '使用默认翻译引擎（回车打开）',
        text: trimmed,
        explicit: false,
      })
    }
    if (trimmed.length >= 1 && trimmed.length <= 120) {
      items.push({
        id: 'websearch-implicit',
        kind: 'websearch',
        label: `网页搜索：${trimmed}`,
        description: '在默认浏览器中搜索（回车打开）',
        query: trimmed,
        url: buildWebSearchUrl(trimmed),
        explicit: false,
      })
    }
    if (trimmed.length >= 2 && trimmed.length <= 60) {
      items.push({
        id: 'everything-implicit',
        kind: 'everything',
        label: `搜索文件：${trimmed}`,
        description: '使用 Everything 全局搜索文件',
        query: trimmed,
        explicit: false,
      })
    }
  }

  return items
}
