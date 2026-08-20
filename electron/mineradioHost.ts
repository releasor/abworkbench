import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export type MineradioHostStatus = {
  ok: boolean
  url?: string
  mode?: 'full' | 'static'
  root?: string
  message?: string
  installing?: boolean
  port?: number
}

let child: ChildProcess | null = null
let staticServer: http.Server | null = null
let activePort = 0
let activeRoot: string | null = null
let activeMode: 'full' | 'static' | null = null
let startPromise: Promise<MineradioHostStatus> | null = null
let installPromise: Promise<boolean> | null = null

function candidateRoots(): string[] {
  const cwd = process.cwd()
  const appPath = app.getAppPath()
  const resourcesPath = process.resourcesPath || ''
  return [
    path.join(resourcesPath, 'mineradio'),
    path.join(cwd, 'vendor', 'mineradio'),
    path.join(appPath, 'vendor', 'mineradio'),
    path.join(appPath, '..', 'vendor', 'mineradio'),
    path.join(__dirname, '..', 'vendor', 'mineradio'),
    path.join(__dirname, '../..', 'vendor', 'mineradio'),
    path.join(cwd, 'Mineradio-main', 'Mineradio-main'),
    path.join(cwd, 'Mineradio-main'),
    path.join(appPath, 'Mineradio-main', 'Mineradio-main'),
    path.join(__dirname, '..', 'Mineradio-main', 'Mineradio-main'),
  ]
}

function mineradioDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'mineradio')
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    // ignore
  }
  return dir
}

function mineradioProcessEnv(root: string, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const dataDir = mineradioDataDir()
  const next: NodeJS.ProcessEnv = {
    ...env,
    COOKIE_FILE: path.join(dataDir, '.cookie'),
    QQ_COOKIE_FILE: path.join(dataDir, '.qq-cookie'),
    KUGOU_COOKIE_FILE: path.join(dataDir, '.kugou-cookie'),
    QISHUI_COOKIE_FILE: path.join(dataDir, '.qishui-cookie'),
    QISHUI_TOKEN_FILE: path.join(dataDir, '.qishui-token'),
    QISHUI_QR_CONFIG_FILE: path.join(dataDir, '.qishui-qr-login.json'),
    QISHUI_OAUTH_CONFIG_FILE: path.join(dataDir, '.qishui-oauth.json'),
    SPOTIFY_TOKEN_FILE: path.join(dataDir, '.spotify-token.json'),
    SPOTIFY_CONFIG_FILE: path.join(dataDir, '.spotify-credentials.json'),
    CUEFIELD_FEEDBACK_FILE: path.join(dataDir, 'cuefield-feedback.jsonl'),
    MINERADIO_LISTEN_SYNC_FILE: path.join(dataDir, 'listen-sync-journal.json'),
    MINERADIO_BEAT_CACHE_DIR: path.join(dataDir, 'beatmaps'),
    MINERADIO_DISABLE_LOGIN_EASTER_EGG: '1',
    MINERADIO_APP_ROOT: root,
  }
  delete next.MINERADIO_LOGIN_EASTER_EGG_GATE_FILE
  delete next.MINERADIO_LOGIN_EASTER_EGG_GATE_VERSION
  return next
}

export function resolveMineradioRoot(): string | null {
  for (const root of candidateRoots()) {
    try {
      if (
        fs.existsSync(path.join(root, 'server.js')) &&
        fs.existsSync(path.join(root, 'public', 'index.html'))
      ) {
        return root
      }
    } catch {
      // ignore
    }
  }
  return null
}

function hasFullDeps(root: string): boolean {
  return fs.existsSync(path.join(root, 'node_modules', 'NeteaseCloudMusicApi'))
}

function findOpenPort(start = 37100): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = start
    const tryListen = () => {
      if (port > start + 200) {
        reject(new Error('No free port for Mineradio'))
        return
      }
      const server = net.createServer()
      server.once('error', () => {
        port += 1
        tryListen()
      })
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(port))
      })
    }
    tryListen()
  })
}

function waitForHttp(port: number, timeoutMs = 45000): Promise<void> {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 2000 }, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error('Mineradio server did not become ready in time'))
          return
        }
        setTimeout(tick, 400)
      })
      req.on('timeout', () => {
        req.destroy()
      })
    }
    tick()
  })
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.webp': 'image/webp',
  }
  return map[ext] || 'application/octet-stream'
}

function startStaticServer(root: string, port: number): Promise<http.Server> {
  const publicDir = path.join(root, 'public')
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const rawUrl = req.url || '/'
        const pathname = decodeURIComponent(rawUrl.split('?')[0] || '/')
        let rel = pathname === '/' ? '/index.html' : pathname
        if (rel.includes('..')) {
          res.writeHead(400)
          res.end('Bad request')
          return
        }
        const filePath = path.join(publicDir, rel)
        if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.writeHead(404)
          res.end('Not found')
          return
        }
        res.writeHead(200, { 'Content-Type': contentType(filePath) })
        fs.createReadStream(filePath).pipe(res)
      } catch (error) {
        res.writeHead(500)
        res.end(error instanceof Error ? error.message : 'Server error')
      }
    })
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

async function ensureDepsInstalled(root: string, onProgress?: (message: string) => void): Promise<boolean> {
  if (hasFullDeps(root)) return true
  if (installPromise) return installPromise

  installPromise = new Promise<boolean>((resolve) => {
    onProgress?.('正在安装 Mineradio 依赖…')
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const proc = spawn(npmCmd, ['install', '--omit=dev', '--no-fund', '--no-audit'], {
      cwd: root,
      env: { ...process.env, npm_config_progress: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    })

    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }

    const timer = setTimeout(() => {
      try {
        proc.kill()
      } catch {
        // ignore
      }
      finish(false)
    }, 10 * 60 * 1000)

    proc.on('error', () => {
      clearTimeout(timer)
      finish(false)
    })
    proc.on('exit', (code) => {
      clearTimeout(timer)
      finish(code === 0 && hasFullDeps(root))
    })
  }).finally(() => {
    installPromise = null
  })

  return installPromise
}

function embeddedUrl(port: number): string {
  return `http://127.0.0.1:${port}/?embedded=1`
}

function stopChild() {
  if (child && !child.killed) {
    try {
      if (process.platform === 'win32' && child.pid) {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      } else {
        child.kill('SIGTERM')
      }
    } catch {
      // ignore
    }
  }
  child = null
}

function stopStatic() {
  if (staticServer) {
    try {
      staticServer.close()
    } catch {
      // ignore
    }
  }
  staticServer = null
}

export function stopMineradioHost(): void {
  stopChild()
  stopStatic()
  activePort = 0
  activeRoot = null
  activeMode = null
}

export function getMineradioHostStatus(): MineradioHostStatus {
  const root = activeRoot || resolveMineradioRoot()
  if (activePort && activeMode) {
    return {
      ok: true,
      url: embeddedUrl(activePort),
      mode: activeMode,
      root: root || undefined,
      port: activePort,
      message: activeMode === 'static' ? '静态预览模式（API 依赖未就绪）' : 'Mineradio 已就绪',
    }
  }
  if (!root) {
    return { ok: false, message: '未找到已打包的 Mineradio（vendor/mineradio）。请先运行 npm run vendor:mineradio' }
  }
  return {
    ok: false,
    root,
    installing: Boolean(installPromise),
    message: installPromise ? '正在安装 Mineradio 依赖…' : 'Mineradio 尚未启动',
  }
}

function mineradioServerCwd(root: string, preferSystemNode: boolean): string {
  // Electron-as-node resolves built-in modules (e.g. require('electron')) from the app exe
  // directory. Spawning with cwd=mineradio root breaks that in packaged builds.
  return preferSystemNode ? root : path.dirname(process.execPath)
}

async function startFullServer(root: string, port: number): Promise<void> {
  stopChild()
  const preferSystemNode = Boolean(process.env.MINERADIO_NODE)
  const nodeBin = process.env.MINERADIO_NODE || process.execPath
  const serverScript = path.join(root, 'server.js')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
  }
  if (!preferSystemNode) {
    env.ELECTRON_RUN_AS_NODE = '1'
  } else {
    delete env.ELECTRON_RUN_AS_NODE
  }

  let stderr = ''
  child = spawn(nodeBin, [serverScript], {
    cwd: mineradioServerCwd(root, preferSystemNode),
    env: mineradioProcessEnv(root, env),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
  })

  child.stderr?.on('data', (chunk) => {
    const text = String(chunk)
    stderr += text
    console.warn('[Mineradio server]', text.trim())
  })

  child.on('exit', () => {
    if (activeMode === 'full' && activePort === port) {
      activePort = 0
      activeMode = null
    }
    child = null
  })

  try {
    await waitForHttp(port)
  } catch (error) {
    stopChild()
    const tail = stderr.trim().split(/\r?\n/).slice(-2).join(' ').trim()
    if (tail) {
      throw new Error(
        `${error instanceof Error ? error.message : 'Mineradio server failed'} (${tail})`,
      )
    }
    throw error
  }
}

export async function ensureMineradioHost(): Promise<MineradioHostStatus> {
  if (activePort && activeMode) {
    return getMineradioHostStatus()
  }
  if (startPromise) return startPromise

  startPromise = (async (): Promise<MineradioHostStatus> => {
    const root = resolveMineradioRoot()
    if (!root) {
      return { ok: false, message: '未找到已打包的 Mineradio。请先运行 npm run vendor:mineradio，或保留 vendor/mineradio 目录。' }
    }

    const canInstall = !app.isPackaged
    const depsOk = hasFullDeps(root) || (canInstall && (await ensureDepsInstalled(root)))
    const port = await findOpenPort()

    if (depsOk) {
      try {
        await startFullServer(root, port)
        activePort = port
        activeRoot = root
        activeMode = 'full'
        return {
          ok: true,
          url: embeddedUrl(port),
          mode: 'full',
          root,
          port,
          message: 'Mineradio 已就绪',
        }
      } catch (error) {
        stopChild()
        // fall through to static
        const message = error instanceof Error ? error.message : '完整服务启动失败'
        try {
          staticServer = await startStaticServer(root, port)
          activePort = port
          activeRoot = root
          activeMode = 'static'
          return {
            ok: true,
            url: embeddedUrl(port),
            mode: 'static',
            root,
            port,
            message: `${message}；已回退为静态预览`,
          }
        } catch (staticError) {
          return {
            ok: false,
            root,
            message: staticError instanceof Error ? staticError.message : message,
          }
        }
      }
    }

    try {
      staticServer = await startStaticServer(root, port)
      activePort = port
      activeRoot = root
      activeMode = 'static'
      return {
        ok: true,
        url: embeddedUrl(port),
        mode: 'static',
        root,
        port,
        message: '依赖未安装完成，当前为静态预览（播放能力可能受限）',
      }
    } catch (error) {
      return {
        ok: false,
        root,
        message: error instanceof Error ? error.message : '无法启动 Mineradio',
      }
    }
  })().finally(() => {
    startPromise = null
  })

  return startPromise
}
