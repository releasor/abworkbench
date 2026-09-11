/**
 * Build vendor/mineradio/desktop/abwb-preload.js from desktop/preload.js
 * Adds Abworkbench account helpers without replacing Mineradio's desktopWindow.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const desktopDir = path.join(root, 'vendor', 'mineradio', 'desktop')
const source = path.join(desktopDir, 'preload.js')
const outFile = path.join(desktopDir, 'abwb-preload.js')

if (!fs.existsSync(source)) {
  console.error('build-mineradio-abwb-preload: missing', source)
  process.exit(1)
}

let src = fs.readFileSync(source, 'utf8')
if (!src.includes('contextBridge.exposeInMainWorld(\'desktopWindow\'')) {
  console.error('build-mineradio-abwb-preload: desktopWindow export missing')
  process.exit(1)
}

src = src.replace(
  'contextBridge.exposeInMainWorld(\'desktopWindow\', {\n  isDesktop: true,',
  `contextBridge.exposeInMainWorld('desktopWindow', {
  isDesktop: true,
  __abwbNative: true,
  saveMineradioAccount: (info) => ipcRenderer.invoke('desktop:mineradio-save-account', info || {}),
  listMineradioAccounts: () => ipcRenderer.invoke('desktop:mineradio-list-accounts'),`,
)

src = src.replace(
  "document.documentElement.classList.add('desktop-shell-root');\n  document.body.classList.add('desktop-shell');\n});",
  `document.documentElement.classList.add('desktop-shell-root');
  document.body.classList.add('desktop-shell');
  try {
    const params = new URLSearchParams(location.search || '');
    if (params.get('embedded') === '1') {
      document.documentElement.classList.add('abwb-embedded');
      document.body.classList.add('abwb-embedded');
      const theme = params.get('theme') === 'light' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      document.body.dataset.theme = theme;
      document.documentElement.classList.toggle('abwb-theme-light', theme === 'light');
      document.documentElement.classList.toggle('abwb-theme-dark', theme === 'dark');
      try { document.documentElement.style.colorScheme = theme; } catch (_) {}
    }
  } catch (_) {}
});`,
)

fs.writeFileSync(outFile, src)
console.log('build-mineradio-abwb-preload: wrote', path.relative(root, outFile))
