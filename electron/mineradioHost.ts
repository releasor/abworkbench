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

function summarizeServerLog(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) return ''
  const interesting = lines.filter((line) =>
    /error|cannot find module|enoent|eaddrinuse|not allowed|thrown|typeerror|referenceerror/i.test(
      line,
    ),
  )
  const picked = (interesting.length ? interesting : lines).slice(-6)
  return picked.join(' | ').slice(0, 500)
}

function appendServerLog(filePath: string, chunk: string) {
  try {
    fs.appendFileSync(filePath, chunk, 'utf8')
  } catch {
    // ignore
  }
}

function waitForHttp(
  port: number,
  options: {
    timeoutMs?: number
    isDead?: () => boolean
    getLog?: () => string
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 45000
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const fail = (reason: string) => {
      const detail = summarizeServerLog(options.getLog?.() || '')
      reject(new Error(detail ? `${reason} (${detail})` : reason))
    }
    const tick = () => {
      if (options.isDead?.()) {
        fail('Mineradio server exited before becoming ready')
        return
      }
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 2000 }, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (options.isDead?.()) {
          fail('Mineradio server exited before becoming ready')
          return
        }
        if (Date.now() - started > timeoutMs) {
          fail('Mineradio server did not become ready in time')
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
        const rel = pathname === '/' ? '/index.html' : pathname
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

function mineradioServerLogPath(): string {
  return path.join(mineradioDataDir(), 'server.log')
}

async function startFullServer(root: string, port: number): Promise<void> {
  stopChild()
  const preferSystemNode = Boolean(process.env.MINERADIO_NODE)
  const nodeBin = process.env.MINERADIO_NODE || process.execPath
  const serverScript = path.join(root, 'server.js')
  const runnerScript = path.join(root, 'abwb-server-runner.cjs')
  if (!fs.existsSync(serverScript)) {
    throw new Error(`Mineradio server.js missing: ${serverScript}`)
  }
  if (!fs.existsSync(runnerScript)) {
    throw new Error(`Mineradio abwb-server-runner.cjs missing: ${runnerScript}`)
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
  }
  // Avoid leaking parent Chromium/Electron switches into the Node-mode child.
  delete env.ELECTRON_NO_ATTACH_CONSOLE
  delete env.ELECTRON_FORCE_WINDOW_MENU_BARS
  if (!preferSystemNode) {
    env.ELECTRON_RUN_AS_NODE = '1'
  } else {
    delete env.ELECTRON_RUN_AS_NODE
  }

  const cwd = mineradioServerCwd(root, preferSystemNode)
  const logPath = mineradioServerLogPath()
  try {
    fs.writeFileSync(
      logPath,
      `[abwb] start ${new Date().toISOString()} port=${port}\nnodeBin=${nodeBin}\nrunner=${runnerScript}\nscript=${serverScript}\ncwd=${cwd}\n\n`,
      'utf8',
    )
  } catch {
    // ignore
  }

  let output = ''
  let exited = false
  let exitCode: number | null = null

  // Runner stubs require('electron') so qishui-auth can load in ELECTRON_RUN_AS_NODE.
  child = spawn(nodeBin, [runnerScript, serverScript], {
    cwd,
    env: mineradioProcessEnv(root, env),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
  })

  const onChunk = (chunk: Buffer | string) => {
    const text = String(chunk)
    output += text
    if (output.length > 80_000) output = output.slice(-60_000)
    appendServerLog(logPath, text)
    const trimmed = text.trim()
    if (trimmed) console.warn('[Mineradio server]', trimmed)
  }
  child.stdout?.on('data', onChunk)
  child.stderr?.on('data', onChunk)

  child.on('error', (error) => {
    exited = true
    output += `\n[abwb] spawn error: ${error.message}\n`
    appendServerLog(logPath, `\n[abwb] spawn error: ${error.message}\n`)
  })

  child.on('exit', (code) => {
    exited = true
    exitCode = code
    if (activeMode === 'full' && activePort === port) {
      activePort = 0
      activeMode = null
    }
    child = null
  })

  try {
    await waitForHttp(port, {
      timeoutMs: 45000,
      isDead: () => exited,
      getLog: () => output,
    })
  } catch (error) {
    stopChild()
    const base = error instanceof Error ? error.message : 'Mineradio server failed'
    throw new Error(`${base} [exit=${exitCode ?? 'n/a'}] log=${logPath}`, { cause: error })
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
