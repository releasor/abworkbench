import { BrowserWindow, session, shell, type BrowserWindow as BW } from 'electron'
import { createRequire } from 'node:module'
import path from 'node:path'
import { resolveMineradioRoot } from './mineradioHost'

const require = createRequire(import.meta.url)

const NETEASE_LOGIN_PARTITION = 'persist:abwb-mineradio-netease-login'
const QQ_LOGIN_PARTITION = 'persist:abwb-mineradio-qqmusic-login'
const KUGOU_LOGIN_PARTITION = 'persist:abwb-mineradio-kugou-login'
const NETEASE_LOGIN_URL = 'https://music.163.com/#/login'
const QQ_LOGIN_URL = 'https://y.qq.com/n/ryqq/profile'
const QQ_LOGIN_FALLBACK_URL = 'https://y.qq.com/'
const KUGOU_LOGIN_URL = 'https://www.kugou.com/'
const KUGOU_LOGIN_WARMUP_URL = 'https://www.kugou.com/newuc/user/uc/type=edit'

const QQ_LOGIN_COOKIE_PRIORITY = [
  'uin', 'qqmusic_uin', 'wxuin', 'login_type', 'qm_keyst', 'qqmusic_key', 'p_skey', 'skey',
  'psrf_qqopenid', 'psrf_qqunionid', 'psrf_qqaccess_token', 'psrf_qqrefresh_token',
  'wxopenid', 'wxunionid', 'wxrefresh_token', 'wxskey', 'p_uin', 'ptcz', 'RK',
]
const NETEASE_LOGIN_COOKIE_PRIORITY = [
  'MUSIC_U', '__csrf', 'NMTID', 'MUSIC_A', '__remember_me', '_ntes_nuid', '_ntes_nnid',
  'WEVNSM', 'WNMCID', 'JSESSIONID-WYYY',
]
const KUGOU_LOGIN_COOKIE_PRIORITY = [
  'KuGoo', 'token', 'userid', 'KugooID', 'kugouID', 'UserId', 'kg_mid', 'kg_dfid', 'Kugou', 'NickName',
]

export type MineradioLoginResult = {
  ok: boolean
  cookie?: string
  reused?: boolean
  recovered?: boolean
  partial?: boolean
  cancelled?: boolean
  error?: string
  message?: string
}

type CookieLike = {
  name?: string
  value?: string
  domain?: string
  path?: string
  secure?: boolean
  hostOnly?: boolean
  expirationDate?: number
}

function parseCookieHeader(cookieText: string): Record<string, string> {
  const out: Record<string, string> = {}
  String(cookieText || '').split(';').forEach((part) => {
    const raw = String(part || '').trim()
    if (!raw) return
    const idx = raw.indexOf('=')
    if (idx <= 0) return
    out[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim()
  })
  return out
}

function qqCookieHasLogin(cookieText: string): boolean {
  const obj = parseCookieHeader(cookieText)
  const isWechat = !!obj.wxopenid || Number(obj.login_type) === 2
  const rawUin = isWechat
    ? (obj.wxuin || obj.uin || obj.p_uin || '')
    : (obj.uin || obj.qqmusic_uin || obj.wxuin || obj.p_uin || '')
  const uin = String(rawUin).replace(/\D/g, '')
  const musicKey = obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.p_skey || obj.skey ||
    obj.psrf_qqaccess_token || obj.psrf_qqrefresh_token || obj.wxrefresh_token || obj.wxskey || ''
  return !!(uin && musicKey)
}

function qqCookieHasPlaybackLogin(cookieText: string): boolean {
  const obj = parseCookieHeader(cookieText)
  const isWechat = !!obj.wxopenid || Number(obj.login_type) === 2
  const rawUin = isWechat
    ? (obj.wxuin || obj.uin || obj.p_uin || '')
    : (obj.uin || obj.qqmusic_uin || obj.wxuin || obj.p_uin || '')
  const uin = String(rawUin).replace(/\D/g, '')
  const playbackKey = obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.wxskey || ''
  return !!(uin && playbackKey)
}

function neteaseCookieHasLogin(cookieText: string): boolean {
  return !!parseCookieHeader(cookieText).MUSIC_U
}

function isTrustedQQLoginUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(String(targetUrl || ''))
    if (parsed.protocol !== 'https:') return false
    const hostname = parsed.hostname.toLowerCase()
    return ['qq.com', 'tencent.com', 'qqmusic.com', 'gtimg.com', 'qpic.cn', 'weixin.qq.com']
      .some((domain) => hostname === domain || hostname.endsWith('.' + domain))
  } catch {
    return false
  }
}

function qqLoginCompletionFromCookie(cookieText: string): MineradioLoginResult {
  if (qqCookieHasPlaybackLogin(cookieText)) return { ok: true, cookie: cookieText }
  if (qqCookieHasLogin(cookieText)) {
    return {
      ok: false,
      partial: true,
      error: 'QQ_PLAYBACK_AUTH_INCOMPLETE',
      message: 'QQ 账号验证已完成，但 QQ 音乐播放授权尚未生成，请在官方登录窗口完成授权后再关闭',
    }
  }
  return { ok: false, cancelled: true, message: 'QQ 登录窗口已关闭' }
}

function isQQCookieDomain(domain: string): boolean {
  const normalized = String(domain || '').replace(/^\./, '').toLowerCase()
  return normalized === 'qq.com' || normalized.endsWith('.qq.com') || normalized.endsWith('qqmusic.qq.com')
}

function isNeteaseCookieDomain(domain: string): boolean {
  const normalized = String(domain || '').replace(/^\./, '').toLowerCase()
  return normalized === '163.com' || normalized.endsWith('.163.com') ||
    normalized === 'music.163.com' || normalized.endsWith('.music.163.com') ||
    normalized === 'netease.com' || normalized.endsWith('.netease.com')
}

function isKugouCookieDomain(domain: string): boolean {
  const normalized = String(domain || '').replace(/^\./, '').toLowerCase()
  return normalized === 'kugou.com' || normalized.endsWith('.kugou.com')
}

function getKugouAuth(cookieText: string): { loggedIn: boolean; playbackReady: boolean } {
  try {
    const root = resolveMineradioRoot()
    if (!root) return { loggedIn: false, playbackReady: false }
    const { extractKugouAuth } = require(path.join(root, 'kugou-api.js')) as {
      extractKugouAuth: (cookie: string) => { loggedIn?: boolean; playbackReady?: boolean }
    }
    const auth = extractKugouAuth(cookieText) || {}
    return { loggedIn: !!auth.loggedIn, playbackReady: !!auth.playbackReady }
  } catch {
    const obj = parseCookieHeader(cookieText)
    const loggedIn = !!(obj.KuGoo || obj.token || obj.userid || obj.KugooID)
    return { loggedIn, playbackReady: loggedIn && !!(obj.token || obj.KuGoo) }
  }
}

function cookieIsExpired(cookie: CookieLike, nowSeconds: number): boolean {
  const expires = Number(cookie && cookie.expirationDate)
  return Number.isFinite(expires) && expires > 0 && expires <= nowSeconds
}

function qqLoginCookieCandidateScore(cookie: CookieLike): number {
  const domain = String(cookie && cookie.domain || '').replace(/^\./, '').toLowerCase()
  const pathName = String(cookie && cookie.path || '/')
  let score = 0
  if (domain === 'y.qq.com' || domain.endsWith('.y.qq.com')) score += 400
  else if (domain === 'qqmusic.qq.com' || domain.endsWith('.qqmusic.qq.com')) score += 360
  else if (domain === 'qq.com') score += 240
  else if (domain.endsWith('.qq.com')) score += 160
  if (pathName === '/') score += 40
  if (cookie && cookie.secure) score += 10
  if (cookie && cookie.hostOnly) score += 5
  const expires = Number(cookie && cookie.expirationDate)
  if (Number.isFinite(expires) && expires > Date.now() / 1000) {
    score += Math.min(20, Math.floor((expires - Date.now() / 1000) / 86400))
  }
  return score
}

function buildCookieHeaderFor(
  cookies: CookieLike[],
  isAllowedDomain: (domain: string) => boolean,
  priority: string[],
  candidateScore?: (cookie: CookieLike) => number,
): string {
  const picked = new Map<string, { value: string; score: number; expirationDate: number; tieKey: string }>()
  const nowSeconds = Date.now() / 1000
  ;(cookies || []).forEach((cookie) => {
    if (!cookie || !cookie.name || !isAllowedDomain(String(cookie.domain || '')) || cookieIsExpired(cookie, nowSeconds)) return
    const score = typeof candidateScore === 'function' ? Number(candidateScore(cookie)) || 0 : 0
    const previous = picked.get(cookie.name)
    const expirationDate = Number(cookie.expirationDate) || 0
    const tieKey = [cookie.domain || '', cookie.path || '', cookie.value || ''].join('\n')
    if (
      !previous ||
      score > previous.score ||
      (score === previous.score && expirationDate > previous.expirationDate) ||
      (score === previous.score && expirationDate === previous.expirationDate && tieKey > previous.tieKey)
    ) {
      picked.set(cookie.name, { value: cookie.value || '', score, expirationDate, tieKey })
    }
  })
  const names = [...picked.keys()].sort((a, b) => {
    const ai = priority.indexOf(a)
    const bi = priority.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  return names.map((name) => `${name}=${picked.get(name)!.value}`).join('; ')
}

async function readQQLoginCookieHeader(cookieSession: Electron.Session): Promise<string> {
  const cookies = await cookieSession.cookies.get({})
  return buildCookieHeaderFor(cookies, isQQCookieDomain, QQ_LOGIN_COOKIE_PRIORITY, qqLoginCookieCandidateScore)
}

async function readNeteaseLoginCookieHeader(cookieSession: Electron.Session): Promise<string> {
  const cookies = await cookieSession.cookies.get({})
  return buildCookieHeaderFor(cookies, isNeteaseCookieDomain, NETEASE_LOGIN_COOKIE_PRIORITY)
}

async function readKugouLoginCookieHeader(cookieSession: Electron.Session): Promise<string> {
  const cookies = await cookieSession.cookies.get({})
  return buildCookieHeaderFor(cookies, isKugouCookieDomain, KUGOU_LOGIN_COOKIE_PRIORITY)
}

export async function openNeteaseMusicLogin(owner?: BW | null): Promise<MineradioLoginResult> {
  const cookieSession = session.fromPartition(NETEASE_LOGIN_PARTITION)
  const initialCookie = await readNeteaseLoginCookieHeader(cookieSession)
  if (neteaseCookieHasLogin(initialCookie)) return { ok: true, cookie: initialCookie, reused: true }

  return new Promise((resolve) => {
    let settled = false
    let pollTimer: NodeJS.Timeout | null = null
    const loginWindow = new BrowserWindow({
      width: 940,
      height: 760,
      minWidth: 780,
      minHeight: 580,
      parent: owner && !owner.isDestroyed() ? owner : undefined,
      modal: false,
      show: false,
      autoHideMenuBar: true,
      title: '网易云音乐登录',
      backgroundColor: '#111111',
      webPreferences: {
        partition: NETEASE_LOGIN_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    const finish = async (result: MineradioLoginResult) => {
      if (settled) return
      settled = true
      if (pollTimer) clearInterval(pollTimer)
      if (!loginWindow.isDestroyed()) loginWindow.close()
      resolve(result)
    }

    const checkCookies = async () => {
      try {
        const cookie = await readNeteaseLoginCookieHeader(cookieSession)
        if (neteaseCookieHasLogin(cookie)) await finish({ ok: true, cookie })
      } catch (e) {
        console.warn('Netease login cookie check failed:', e instanceof Error ? e.message : e)
      }
    }

    loginWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\/([^/]+\.)?(163|music\.163|netease)\.com/i.test(url)) {
        void loginWindow.loadURL(url)
      } else if (/^https?:\/\//i.test(url)) {
        void shell.openExternal(url)
      }
      return { action: 'deny' }
    })

    loginWindow.webContents.on('did-finish-load', () => {
      void checkCookies()
      void loginWindow.webContents.executeJavaScript(`
        setTimeout(() => {
          const docs = [document];
          document.querySelectorAll('iframe').forEach((frame) => {
            try { if (frame.contentDocument) docs.push(frame.contentDocument); } catch (_) {}
          });
          for (const doc of docs) {
            const nodes = Array.from(doc.querySelectorAll('a, button, span, div'));
            const loginNode = nodes.find((node) => {
              const text = (node.textContent || '').trim();
              if (!/登录|立即登录/.test(text)) return false;
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            });
            if (loginNode) { loginNode.click(); return true; }
          }
          return false;
        }, 900);
      `, true).catch(() => {})
    })

    loginWindow.on('ready-to-show', () => loginWindow.show())
    loginWindow.on('closed', async () => {
      if (settled) return
      if (pollTimer) clearInterval(pollTimer)
      try {
        const cookie = await readNeteaseLoginCookieHeader(cookieSession)
        resolve(neteaseCookieHasLogin(cookie)
          ? { ok: true, cookie }
          : { ok: false, cancelled: true, message: '网易云登录窗口已关闭' })
      } catch (e) {
        resolve({ ok: false, error: e instanceof Error ? e.message : '网易云登录窗口已关闭' })
      }
    })

    pollTimer = setInterval(() => { void checkCookies() }, 1200)
    void loginWindow.loadURL(NETEASE_LOGIN_URL).catch((e) => finish({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  })
}

export async function openQQMusicLogin(
  owner?: BW | null,
  options?: { forceReauth?: boolean },
): Promise<MineradioLoginResult> {
  const forceReauth = !!options?.forceReauth
  const cookieSession = session.fromPartition(QQ_LOGIN_PARTITION)
  const initialCookie = await readQQLoginCookieHeader(cookieSession)
  if (qqCookieHasPlaybackLogin(initialCookie)) {
    return { ok: true, cookie: initialCookie, reused: true, recovered: forceReauth }
  }
  if (forceReauth) {
    await cookieSession.clearStorageData({
      storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'],
    })
  }

  return new Promise((resolve) => {
    let settled = false
    let pollTimer: NodeJS.Timeout | null = null
    let warmupTimer: NodeJS.Timeout | null = null
    let warmupWindow: BW | null = null
    let playbackFinalizePending = false
    let showWatchdog: NodeJS.Timeout | null = null
    const popupWindows = new Set<BW>()

    const loginWindow = new BrowserWindow({
      width: 900,
      height: 720,
      minWidth: 760,
      minHeight: 560,
      parent: owner && !owner.isDestroyed() ? owner : undefined,
      modal: false,
      show: false,
      autoHideMenuBar: true,
      title: 'QQ 音乐登录',
      backgroundColor: '#111111',
      webPreferences: {
        partition: QQ_LOGIN_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    const closeAuxiliaryWindows = () => {
      if (showWatchdog) { clearTimeout(showWatchdog); showWatchdog = null }
      if (warmupTimer) { clearTimeout(warmupTimer); warmupTimer = null }
      const windows = Array.from(popupWindows)
      popupWindows.clear()
      if (warmupWindow) windows.push(warmupWindow)
      warmupWindow = null
      windows.forEach((win) => {
        try { if (win && !win.isDestroyed()) win.close() } catch { /* ignore */ }
      })
    }

    const finish = async (result: MineradioLoginResult) => {
      if (settled) return
      settled = true
      if (pollTimer) clearInterval(pollTimer)
      closeAuxiliaryWindows()
      try { await cookieSession.flushStorageData() } catch { /* ignore */ }
      if (!loginWindow.isDestroyed()) loginWindow.close()
      resolve(result)
    }

    const showLoginWindow = () => {
      if (settled || loginWindow.isDestroyed() || loginWindow.isVisible()) return
      loginWindow.show()
      loginWindow.focus()
    }

    const schedulePlaybackWarmup = () => {
      if (settled || warmupTimer || warmupWindow) return
      warmupTimer = setTimeout(() => {
        warmupTimer = null
        if (settled || loginWindow.isDestroyed()) return
        warmupWindow = new BrowserWindow({
          width: 720,
          height: 520,
          parent: loginWindow,
          modal: false,
          show: false,
          autoHideMenuBar: true,
          backgroundColor: '#111111',
          webPreferences: {
            partition: QQ_LOGIN_PARTITION,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        })
        warmupWindow.on('closed', () => { warmupWindow = null })
        warmupWindow.webContents.on('did-finish-load', () => { void checkCookies() })
        void warmupWindow.loadURL('https://y.qq.com/n/ryqq/player')
          .catch((e) => console.warn('QQ login warmup navigation failed:', e.message))
      }, 5000)
    }

    const checkCookies = async () => {
      try {
        const cookie = await readQQLoginCookieHeader(cookieSession)
        if (qqCookieHasPlaybackLogin(cookie)) {
          if (playbackFinalizePending) return
          playbackFinalizePending = true
          await new Promise((r) => setTimeout(r, 450))
          const finalizedCookie = await readQQLoginCookieHeader(cookieSession)
          await finish({
            ok: true,
            cookie: qqCookieHasPlaybackLogin(finalizedCookie) ? finalizedCookie : cookie,
          })
        } else if (qqCookieHasLogin(cookie)) {
          schedulePlaybackWarmup()
        }
      } catch (e) {
        if (!settled) playbackFinalizePending = false
        console.warn('QQ login cookie check failed:', e instanceof Error ? e.message : e)
      }
    }

    const installQQLoginWindowHandlers = (win: BW, isRoot: boolean) => {
      if (!win || win.isDestroyed()) return
      win.webContents.setWindowOpenHandler(({ url }) => {
        if (isTrustedQQLoginUrl(url)) {
          return {
            action: 'allow',
            overrideBrowserWindowOptions: {
              width: 760,
              height: 640,
              parent: loginWindow,
              modal: false,
              show: true,
              autoHideMenuBar: true,
              backgroundColor: '#111111',
              webPreferences: {
                partition: QQ_LOGIN_PARTITION,
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
              },
            },
          }
        }
        if (/^https?:\/\//i.test(String(url || ''))) void shell.openExternal(url)
        return { action: 'deny' }
      })
      win.webContents.on('did-create-window', (child) => {
        popupWindows.add(child)
        child.on('closed', () => popupWindows.delete(child))
        installQQLoginWindowHandlers(child, false)
      })
      if (!isRoot) win.webContents.on('did-finish-load', () => { void checkCookies() })
    }
    installQQLoginWindowHandlers(loginWindow, true)

    loginWindow.webContents.on('did-finish-load', () => {
      void checkCookies()
      showLoginWindow()
      void loginWindow.webContents.executeJavaScript(`
        setTimeout(() => {
          const nodes = Array.from(document.querySelectorAll('a, button, span, div'));
          const loginNode = nodes.find((node) => {
            const text = (node.textContent || '').trim();
            if (!/登录|登陆/.test(text)) return false;
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          if (loginNode) loginNode.click();
        }, 700);
      `, true).catch(() => {})
    })

    loginWindow.on('ready-to-show', showLoginWindow)
    loginWindow.on('closed', async () => {
      if (settled) return
      settled = true
      if (pollTimer) clearInterval(pollTimer)
      closeAuxiliaryWindows()
      try {
        const cookie = await readQQLoginCookieHeader(cookieSession)
        try { await cookieSession.flushStorageData() } catch { /* ignore */ }
        resolve(qqLoginCompletionFromCookie(cookie))
      } catch (e) {
        resolve({ ok: false, error: e instanceof Error ? e.message : 'QQ 登录窗口已关闭' })
      }
    })

    pollTimer = setInterval(() => { void checkCookies() }, 1200)
    showWatchdog = setTimeout(showLoginWindow, 2500)
    void (async () => {
      try {
        await loginWindow.loadURL(QQ_LOGIN_URL)
      } catch (firstError) {
        const message = String(firstError instanceof Error ? firstError.message : firstError || '')
        if (/HTTP2|PROTOCOL_ERROR|ERR_FAILED/i.test(message)) {
          try { await cookieSession.clearCache() } catch { /* ignore */ }
        }
        try {
          await loginWindow.loadURL(QQ_LOGIN_FALLBACK_URL)
        } catch (e) {
          await finish({ ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      }
    })()
  })
}

export async function openKugouMusicLogin(owner?: BW | null): Promise<MineradioLoginResult> {
  const cookieSession = session.fromPartition(KUGOU_LOGIN_PARTITION)
  const initialCookie = await readKugouLoginCookieHeader(cookieSession)
  if (getKugouAuth(initialCookie).playbackReady) return { ok: true, cookie: initialCookie, reused: true }

  return new Promise((resolve) => {
    let settled = false
    let pollTimer: NodeJS.Timeout | null = null
    let warmupStarted = false
    const loginWindow = new BrowserWindow({
      width: 900,
      height: 720,
      minWidth: 760,
      minHeight: 560,
      parent: owner && !owner.isDestroyed() ? owner : undefined,
      modal: false,
      show: false,
      autoHideMenuBar: true,
      title: '酷狗音乐登录',
      backgroundColor: '#111111',
      webPreferences: {
        partition: KUGOU_LOGIN_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    const finish = async (result: MineradioLoginResult) => {
      if (settled) return
      settled = true
      if (pollTimer) clearInterval(pollTimer)
      if (!loginWindow.isDestroyed()) loginWindow.close()
      resolve(result)
    }

    const checkCookies = async () => {
      try {
        const cookie = await readKugouLoginCookieHeader(cookieSession)
        const auth = getKugouAuth(cookie)
        if (auth.playbackReady) {
          await finish({ ok: true, cookie })
        } else if (auth.loggedIn && !warmupStarted) {
          warmupStarted = true
          setTimeout(() => {
            if (!settled && !loginWindow.isDestroyed()) {
              void loginWindow.loadURL(KUGOU_LOGIN_WARMUP_URL)
                .catch((e) => console.warn('Kugou login warmup navigation failed:', e.message))
            }
          }, 900)
        }
      } catch (e) {
        console.warn('Kugou login cookie check failed:', e instanceof Error ? e.message : e)
      }
    }

    loginWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) void loginWindow.loadURL(url)
      else void shell.openExternal(url)
      return { action: 'deny' }
    })

    loginWindow.webContents.on('did-finish-load', () => {
      void checkCookies()
      void loginWindow.webContents.executeJavaScript(`
        setTimeout(() => {
          const nodes = Array.from(document.querySelectorAll('a, button, span, div'));
          const loginNode = nodes.find((node) => {
            const text = (node.textContent || '').trim();
            if (!/登录|登陆/.test(text)) return false;
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          if (loginNode) loginNode.click();
        }, 700);
      `, true).catch(() => {})
    })

    loginWindow.on('ready-to-show', () => loginWindow.show())
    loginWindow.on('closed', async () => {
      if (settled) return
      if (pollTimer) clearInterval(pollTimer)
      try {
        const cookie = await readKugouLoginCookieHeader(cookieSession)
        const auth = getKugouAuth(cookie)
        resolve(auth.playbackReady
          ? { ok: true, cookie }
          : (auth.loggedIn
            ? { ok: true, cookie, partial: true, message: '酷狗账号已登录，但播放 token 不完整，请稍后在播放器内重试登录' }
            : { ok: false, cancelled: true, message: '酷狗登录窗口已关闭' }))
      } catch (e) {
        resolve({ ok: false, error: e instanceof Error ? e.message : '酷狗登录窗口已关闭' })
      }
    })

    pollTimer = setInterval(() => { void checkCookies() }, 1200)
    void loginWindow.loadURL(KUGOU_LOGIN_URL).catch((e) => finish({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  })
}
