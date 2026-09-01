'use strict'
/**
 * Smoke test: start Mineradio server the same way mineradioHost does
 * (Electron-as-node + absolute server.js + cwd=exe dir), after loading
 * abwb-host-runtime with MINERADIO_ABWB_HOST=1 (as the real app does).
 *
 * Usage: npx electron scripts/smoke-mineradio-host.cjs
 */
const { app } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

process.env.MINERADIO_ABWB_HOST = '1'
process.env.MINERADIO_DISABLE_LOGIN_EASTER_EGG = '1'

const rootCandidates = [
  path.join(process.resourcesPath || '', 'mineradio'),
  path.join(process.cwd(), 'vendor', 'mineradio'),
  path.join(process.cwd(), 'release', 'win-unpacked', 'resources', 'mineradio'),
]

function resolveRoot() {
  for (const root of rootCandidates) {
    if (fs.existsSync(path.join(root, 'server.js')) && fs.existsSync(path.join(root, 'node_modules', 'NeteaseCloudMusicApi'))) {
      return root
    }
  }
  return null
}

const rootEarly = resolveRoot()
if (!rootEarly) {
  console.error('NO_ROOT')
  process.exit(2)
}
process.env.MINERADIO_ABWB_USER_DATA = path.join(app.getPath('userData'), 'mineradio')
fs.mkdirSync(process.env.MINERADIO_ABWB_USER_DATA, { recursive: true })

// Must load before app.ready (registerSchemesAsPrivileged).
try {
  require(path.join(rootEarly, 'desktop', 'abwb-host-runtime.js'))
  console.log('runtime loaded ok, userData=', app.getPath('userData'))
} catch (error) {
  console.error('runtime load failed', error)
  process.exit(3)
}

function waitForHttp(port, timeoutMs, isDead, getLog) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (isDead()) {
        reject(new Error(`exited early: ${getLog().slice(-400)}`))
        return
      }
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 2000 }, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (isDead()) {
          reject(new Error(`exited early: ${getLog().slice(-400)}`))
          return
        }
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`timeout: ${getLog().slice(-400)}`))
          return
        }
        setTimeout(tick, 300)
      })
      req.on('timeout', () => req.destroy())
    }
    tick()
  })
}

app.whenReady().then(async () => {
  const root = rootEarly
  console.log('userData after ready=', app.getPath('userData'))

  const port = 37277
  const serverScript = path.join(root, 'server.js')
  const cwd = path.dirname(process.execPath)
  let output = ''
  let exited = false
  const child = spawn(process.execPath, [serverScript], {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      HOST: '127.0.0.1',
      MINERADIO_APP_ROOT: root,
      MINERADIO_DISABLE_LOGIN_EASTER_EGG: '1',
      COOKIE_FILE: path.join(process.env.MINERADIO_ABWB_USER_DATA, '.cookie'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const onData = (chunk) => {
    output += String(chunk)
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.on('exit', (code) => {
    exited = true
    console.error('child exit', code)
  })

  try {
    await waitForHttp(port, 20000, () => exited, () => output)
    const version = await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/api/app/version`, (res) => {
          let body = ''
          res.on('data', (c) => (body += c))
          res.on('end', () => resolve(body))
        })
        .on('error', reject)
    })
    console.log('SUCCESS', version)
    child.kill()
    app.exit(0)
  } catch (error) {
    console.error('FAIL', error.message)
    console.error('--- output ---')
    console.error(output.slice(-1500))
    try {
      child.kill()
    } catch (_) {}
    app.exit(1)
  }
})
