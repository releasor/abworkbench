/**
 * Build vendor/mineradio/desktop/abwb-host-runtime.js from desktop/main.js
 * so Abworkbench can attach Mineradio's full desktop IPC without taking over the app.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const desktopDir = path.join(root, 'vendor', 'mineradio', 'desktop')
const sourceMain = path.join(desktopDir, 'main.js')
const outFile = path.join(desktopDir, 'abwb-host-runtime.js')

if (!fs.existsSync(sourceMain)) {
  console.error('build-mineradio-abwb-runtime: missing', sourceMain)
  process.exit(1)
}

let src = fs.readFileSync(sourceMain, 'utf8')

if (!src.includes("app.setName(APP_NAME);")) {
  console.error('build-mineradio-abwb-runtime: app.setName marker missing')
  process.exit(1)
}
src = src.replace(
  "app.setName(APP_NAME);",
  "if (process.env.MINERADIO_ABWB_HOST !== '1') app.setName(APP_NAME);",
)
src = src.replace(
  "const STABLE_USER_DATA_PATH = STARTUP_QA_USER_DATA_PATH || path.join(app.getPath('appData'), APP_NAME);",
  "const STABLE_USER_DATA_PATH = process.env.MINERADIO_ABWB_USER_DATA\n  ? path.resolve(String(process.env.MINERADIO_ABWB_USER_DATA))\n  : (STARTUP_QA_USER_DATA_PATH || path.join(app.getPath('appData'), APP_NAME));",
)
src = src.replace(
  "app.setPath('userData', STABLE_USER_DATA_PATH);",
  "if (process.env.MINERADIO_ABWB_HOST !== '1') app.setPath('userData', STABLE_USER_DATA_PATH);",
)

src = src.replace(
  'const gotSingleInstanceLock = app.requestSingleInstanceLock();',
  "const gotSingleInstanceLock = process.env.MINERADIO_ABWB_HOST === '1' ? true : app.requestSingleInstanceLock();",
)

src = src.replace(
  'function getSenderWindow(event) {\n  return BrowserWindow.fromWebContents(event.sender);\n}',
  `function getSenderWindow(event) {
  const fromSender = BrowserWindow.fromWebContents(event.sender);
  if (fromSender) return fromSender;
  try {
    if (abwbEmbedWebContents && event.sender === abwbEmbedWebContents && abwbHostWindowRaw && !abwbHostWindowRaw.isDestroyed()) {
      return abwbHostWindowRaw;
    }
  } catch (_) {}
  return abwbHostWindowRaw && !abwbHostWindowRaw.isDestroyed() ? abwbHostWindowRaw : null;
}`,
)

src = src.replaceAll(
  'if (!loginEasterEggGate.isUnlocked()) return loginEasterEggLockedResult();',
  "if (process.env.MINERADIO_ABWB_HOST !== '1' && !loginEasterEggGate.isUnlocked()) return loginEasterEggLockedResult();",
)

src = src.replace(
  "ipcMain.handle('mineradio-login-easter-egg-status', async (event) => {\n  if (!isTrustedMainWindowIpc(event)) return { ok: false, error: 'UNTRUSTED_SENDER', unlocked: false };\n  return loginEasterEggGate.publicStatus();\n});",
  `ipcMain.handle('mineradio-login-easter-egg-status', async (event) => {
  if (process.env.MINERADIO_ABWB_HOST === '1') {
    return { ok: true, unlocked: true, resetComplete: true, embedded: true, gateVersion: LOGIN_EASTER_EGG_GATE_VERSION };
  }
  if (!isTrustedMainWindowIpc(event)) return { ok: false, error: 'UNTRUSTED_SENDER', unlocked: false };
  return loginEasterEggGate.publicStatus();
});`,
)

src = src.replace(
  "ipcMain.handle('mineradio-login-easter-egg-unlock', async (event, value) => {\n  if (!isTrustedMainWindowIpc(event)) return { ok: false, error: 'UNTRUSTED_SENDER', unlocked: false };\n  return loginEasterEggGate.unlock(value);\n});",
  `ipcMain.handle('mineradio-login-easter-egg-unlock', async (event, value) => {
  if (process.env.MINERADIO_ABWB_HOST === '1') {
    return { ok: true, unlocked: true, resetComplete: true, embedded: true };
  }
  if (!isTrustedMainWindowIpc(event)) return { ok: false, error: 'UNTRUSTED_SENDER', unlocked: false };
  return loginEasterEggGate.unlock(value);
});`,
)

src = src.replace(
  'function isTrustedMainWindowIpc(event) {\n  try {\n    if (!event || !event.sender || !mainWindow || mainWindow.isDestroyed()) return false;\n    if (event.sender !== mainWindow.webContents || event.sender.isDestroyed()) return false;',
  `let abwbEmbedWebContents = null;
let abwbHostWindowRaw = null;
function bindAbwbHostWindow(hostWindow) {
  if (!hostWindow || hostWindow.isDestroyed()) {
    abwbHostWindowRaw = null;
    mainWindow = null;
    return;
  }
  abwbHostWindowRaw = hostWindow;
  mainWindow = new Proxy(hostWindow, {
    get(target, prop, receiver) {
      if (prop === 'webContents') {
        return abwbEmbedWebContents || target.webContents;
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
function isTrustedMainWindowIpc(event) {
  try {
    if (!event || !event.sender || !mainWindow || mainWindow.isDestroyed()) return false;
    if (event.sender !== mainWindow.webContents || event.sender.isDestroyed()) return false;`,
)

const bootstrapMarker = 'if (process.platform === \'win32\') app.setAppUserModelId(APP_USER_MODEL_ID);'
const bootstrapIdx = src.indexOf(bootstrapMarker)
if (bootstrapIdx < 0) {
  console.error('build-mineradio-abwb-runtime: bootstrap marker not found')
  process.exit(1)
}

const head = src.slice(0, bootstrapIdx)
const bootstrap = src.slice(bootstrapIdx)

const attachExport = `
${bootstrapMarker}

function attachMineradioDesktopRuntime(options = {}) {
  const port = Number(options.port || 0) || 0;
  if (port > 0) mainServerPort = port;
  if (options.embedWebContents) abwbEmbedWebContents = options.embedWebContents;
  if (options.hostWindow) bindAbwbHostWindow(options.hostWindow);
  try {
    if (loginEasterEggGate && typeof loginEasterEggGate.writeState === 'function') {
      loginEasterEggGate.writeState({
        gateVersion: LOGIN_EASTER_EGG_GATE_VERSION,
        cookieResetVersion: LOGIN_EASTER_EGG_GATE_VERSION,
        resetComplete: true,
        unlocked: true,
        unlockedAt: Date.now(),
        resetError: '',
      });
    }
  } catch (_) {}
  return {
    setHostWindow(win) { bindAbwbHostWindow(win); },
    setEmbedWebContents(wc) { abwbEmbedWebContents = wc || null; },
    setMainServerPort(nextPort) {
      const n = Number(nextPort || 0) || 0;
      if (n > 0) mainServerPort = n;
    },
    getStableUserDataPath() { return STABLE_USER_DATA_PATH; },
  };
}

async function installMineradioDesktopProtocols() {
  try {
    await localMusicLibrary.installProtocol(protocol);
  } catch (error) {
    console.warn('[ABWB Mineradio] local music protocol:', error && error.message || error);
  }
  try {
    await wallpaperEngineLibrary.installProtocol(protocol);
  } catch (error) {
    console.warn('[ABWB Mineradio] wallpaper engine protocol:', error && error.message || error);
  }
}

if (process.env.MINERADIO_ABWB_HOST === '1') {
  module.exports = {
    attachMineradioDesktopRuntime,
    installMineradioDesktopProtocols,
    STABLE_USER_DATA_PATH,
  };
} else {
${bootstrap}
}
`

fs.writeFileSync(outFile, head + attachExport)
console.log('build-mineradio-abwb-runtime: wrote', path.relative(root, outFile))
