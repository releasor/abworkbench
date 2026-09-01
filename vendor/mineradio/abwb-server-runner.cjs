'use strict'

/**
 * Runs Mineradio server.js under Electron's ELECTRON_RUN_AS_NODE mode.
 * qishui-auth-v6.js does require('electron') at load time; in packaged Node-mode
 * that resolve often fails (or returns the npm path string). Provide a headless
 * stub so the HTTP API can start. Desktop QR login stays on Abworkbench main.
 *
 * Usage: electron.exe abwb-server-runner.cjs <absolute-path-to-server.js>
 */
const Module = require('module')
const path = require('path')
const os = require('os')

const serverScript = process.argv[2]
if (!serverScript) {
  console.error('[abwb-server-runner] missing server.js path')
  process.exit(1)
}

function createElectronStub() {
  const userData =
    process.env.MINERADIO_ABWB_USER_DATA ||
    process.env.MINERADIO_APP_ROOT ||
    path.join(os.tmpdir(), 'abwb-mineradio-server')

  const app = {
    isReady: () => true,
    whenReady: () => Promise.resolve(),
    getPath: (name) => path.join(userData, String(name || 'data')),
    getName: () => 'MineradioServer',
    getVersion: () => process.env.MINERADIO_VERSION || '0.0.0',
    on() {
      return app
    },
    once() {
      return app
    },
    removeListener() {
      return app
    },
  }

  class BrowserWindow {
    constructor() {
      throw new Error(
        'BrowserWindow is unavailable in the Abworkbench Mineradio server process; use the host login bridge.',
      )
    }
  }

  const session = {
    fromPartition() {
      return {
        cookies: {
          get: async () => [],
          set: async () => {},
          remove: async () => {},
        },
        webRequest: {
          onBeforeSendHeaders() {},
          onHeadersReceived() {},
        },
      }
    },
    defaultSession: {
      cookies: {
        get: async () => [],
        set: async () => {},
        remove: async () => {},
      },
    },
  }

  return { app, BrowserWindow, session }
}

const electronStub = createElectronStub()
const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'electron') {
    try {
      const loaded = originalLoad.apply(this, arguments)
      if (loaded && typeof loaded === 'object' && typeof loaded.app === 'object') {
        return loaded
      }
    } catch (_) {
      // fall through to stub
    }
    return electronStub
  }
  return originalLoad.apply(this, arguments)
}

require(path.resolve(serverScript))
