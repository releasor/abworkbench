import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dest = path.join(root, 'vendor', 'mineradio')
const stampName = '.abwb-vendor.json'

const SKIP_NAMES = new Set([
  'node_modules',
  '.git',
  'tests',
  'docs',
  'scripts',
  'build',
  'dist',
  '.cookie',
  '.qq-cookie',
  '.kugou-cookie',
  '.qishui-cookie',
  '.qishui-token',
  '.spotify-token.json',
  '.spotify-credentials.json',
])

const PRESERVE_RELATIVE = [
  'public/js/abwb-desktop-bridge.js',
  'public/js/modules/08-account/00-login-easter-egg.js',
  'public/css/abwb-embed.css',
]

function findSource() {
  const candidates = [
    path.join(root, 'Mineradio-main', 'Mineradio-main'),
    path.join(root, 'Mineradio-main'),
    dest,
  ]
  for (const dir of candidates) {
    if (
      fs.existsSync(path.join(dir, 'server.js')) &&
      fs.existsSync(path.join(dir, 'public', 'index.html'))
    ) {
      return dir
    }
  }
  return null
}

function shouldSkip(name) {
  return SKIP_NAMES.has(name) || name.startsWith('.cookie') || name.endsWith('-cookie')
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) continue
    const srcPath = path.join(from, entry.name)
    const destPath = path.join(to, entry.name)
    if (entry.isDirectory()) {
      copyTree(srcPath, destPath)
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function vendorLooksComplete(dir) {
  return (
    fs.existsSync(path.join(dir, 'server.js')) &&
    fs.existsSync(path.join(dir, 'public', 'index.html')) &&
    fs.existsSync(path.join(dir, 'package.json')) &&
    fs.existsSync(path.join(dir, 'kugou-api.js')) &&
    fs.existsSync(path.join(dir, 'node_modules', 'NeteaseCloudMusicApi'))
  )
}

function installDeps() {
  const sourceModules = path.join(findSource() || '', 'node_modules')
  const destModules = path.join(dest, 'node_modules')
  if (fs.existsSync(path.join(sourceModules, 'NeteaseCloudMusicApi'))) {
    console.log('vendor-mineradio: copying node_modules from source')
    fs.cpSync(sourceModules, destModules, { recursive: true, force: true })
    return
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npmCmd, ['install', '--omit=dev', '--no-fund', '--no-audit'], {
    cwd: dest,
    stdio: 'inherit',
    windowsHide: true,
    shell: true,
    env: { ...process.env, npm_config_progress: 'false' },
  })
  if (result.status !== 0) {
    throw new Error(`Mineradio npm install failed with code ${result.status}`)
  }
}

function preserveAbwbPatches(fromDest) {
  const saved = new Map()
  for (const rel of PRESERVE_RELATIVE) {
    const full = path.join(fromDest, rel)
    if (fs.existsSync(full)) saved.set(rel, fs.readFileSync(full))
  }
  return saved
}

function restoreAbwbPatches(saved) {
  for (const [rel, buf] of saved) {
    const full = path.join(dest, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, buf)
  }
}

function syncDesktopFromSource(sourceRoot) {
  const from = path.join(sourceRoot, 'desktop')
  const to = path.join(dest, 'desktop')
  if (!fs.existsSync(path.join(from, 'main.js'))) return false
  fs.rmSync(to, { recursive: true, force: true })
  copyTree(from, to)
  return true
}

function ensureAbwbServerPatches() {
  const serverPath = path.join(dest, 'server.js')
  if (!fs.existsSync(serverPath)) return
  let src = fs.readFileSync(serverPath, 'utf8')
  if (src.includes('MINERADIO_DISABLE_LOGIN_EASTER_EGG')) return
  const next = src.replace(
    'function loginEasterEggGateUnlocked() {\n  if (!LOGIN_EASTER_EGG_GATE_FILE) return true;',
    "function loginEasterEggGateUnlocked() {\n  if (String(process.env.MINERADIO_DISABLE_LOGIN_EASTER_EGG || '') === '1') return true;\n  if (!LOGIN_EASTER_EGG_GATE_FILE) return true;",
  )
  if (next !== src) fs.writeFileSync(serverPath, next)
}

function ensureAbwbIndexHooks() {
  const indexPath = path.join(dest, 'public', 'index.html')
  if (!fs.existsSync(indexPath)) return
  let html = fs.readFileSync(indexPath, 'utf8')
  let changed = false
  if (!html.includes('js/abwb-desktop-bridge.js')) {
    html = html.replace(
      '<script src="js/preload-mode.js"></script>',
      '<script src="js/preload-mode.js"></script>\n  <script src="js/abwb-desktop-bridge.js"></script>',
    )
    changed = true
  }
  if (!html.includes('css/abwb-embed.css')) {
    html = html.replace(
      /(<link rel="stylesheet" href="css\/index\.css[^"]*">)/,
      '$1\n  <link rel="stylesheet" href="css/abwb-embed.css">',
    )
    changed = true
  }
  if (changed) fs.writeFileSync(indexPath, html)
}

function buildAbwbRuntime() {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-mineradio-abwb-runtime.mjs')], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.status !== 0) {
    throw new Error(`build-mineradio-abwb-runtime failed with code ${result.status}`)
  }
  const preload = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-mineradio-abwb-preload.mjs')], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (preload.status !== 0) {
    throw new Error(`build-mineradio-abwb-preload failed with code ${preload.status}`)
  }
}

const source = findSource()
if (!source) {
  console.error('vendor-mineradio: 找不到 Mineradio 源码或已有 vendor/mineradio')
  process.exit(1)
}

const destReady = vendorLooksComplete(dest)
const externalSource = source !== dest

if (externalSource) {
  const saved = preserveAbwbPatches(dest)
  console.log(`vendor-mineradio: copying ${source} -> ${dest}`)
  // Avoid wiping dest/node_modules on every vendor run.
  const prevSkip = SKIP_NAMES.has('node_modules')
  copyTree(source, dest)
  if (!prevSkip) SKIP_NAMES.add('node_modules')
  restoreAbwbPatches(saved)
} else if (!destReady) {
  console.error('vendor-mineradio: vendor incomplete and no external source')
  process.exit(1)
} else {
  console.log('vendor-mineradio: using existing vendor/mineradio')
}

const upstreamDesktop = [
  path.join(root, 'Mineradio-main', 'Mineradio-main'),
  path.join(root, 'Mineradio-main'),
  source,
].find((dir) => fs.existsSync(path.join(dir, 'desktop', 'main.js')))

if (upstreamDesktop) {
  console.log('vendor-mineradio: syncing desktop/ from', path.relative(root, upstreamDesktop))
  syncDesktopFromSource(upstreamDesktop)
}

if (fs.existsSync(path.join(dest, 'desktop', 'main.js'))) {
  buildAbwbRuntime()
} else {
  console.warn('vendor-mineradio: desktop/main.js missing — embed will fall back to limited bridge')
}

ensureAbwbIndexHooks()
ensureAbwbServerPatches()

const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'))
fs.writeFileSync(
  path.join(dest, stampName),
  JSON.stringify(
    {
      source: path.relative(root, source).replaceAll('\\', '/'),
      version: pkg.version || '',
      copiedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
)

if (!fs.existsSync(path.join(dest, 'node_modules', 'NeteaseCloudMusicApi'))) {
  console.log('vendor-mineradio: installing production dependencies')
  installDeps()
}

if (!vendorLooksComplete(dest)) {
  console.error('vendor-mineradio: copy incomplete')
  process.exit(1)
}

console.log('vendor-mineradio: ready')
