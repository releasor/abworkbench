import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const embedCss = () => readFileSync(join(root, 'vendor/mineradio/public/css/abwb-embed.css'), 'utf8')
const indexHtml = () => readFileSync(join(root, 'vendor/mineradio/public/index.html'), 'utf8')
const hostCss = () => readFileSync(join(root, 'src/index.css'), 'utf8')

test('embed shell uses % + vh/dvh/-webkit-fill-available min-height cascade', () => {
  const css = embedCss()
  const shellBlock = css.slice(
    css.indexOf('html.abwb-embedded #desktop-window-shell'),
    css.indexOf('html.abwb-embedded[data-theme="light"] #desktop-window-shell'),
  )
  assert.match(shellBlock, /height:\s*100%\s*;/)
  assert.match(shellBlock, /min-height:\s*100%\s*;/)
  assert.match(shellBlock, /min-height:\s*100vh\s*;/)
  assert.match(shellBlock, /min-height:\s*-webkit-fill-available\s*;/)
  assert.match(shellBlock, /min-height:\s*100dvh\s*;/)
  // preferred dynamic unit must win when supported
  const vh = shellBlock.lastIndexOf('min-height: 100vh')
  const fill = shellBlock.lastIndexOf('min-height: -webkit-fill-available')
  const dvh = shellBlock.lastIndexOf('min-height: 100dvh')
  assert.ok(vh >= 0 && fill > vh && dvh > fill)
})

test('embed bg layers keep fixed cover + dark fallback under custom-bg', () => {
  const css = embedCss()
  assert.match(css, /html\.abwb-embedded\s+#custom-bg\s*\{[^}]*position:\s*fixed/s)
  assert.match(css, /html\.abwb-embedded\s+#custom-bg\s*\{[^}]*inset:\s*0/s)
  assert.match(css, /#custom-bg::before[^}]*background-size:\s*cover/s)
  assert.match(
    css,
    /html\.abwb-embedded\s+#custom-bg\s*\{[^}]*--custom-bg-color-rgb,\s*5,\s*5,\s*5/s,
  )
})

test('index.html has Abworkbench critical first-paint style before css links', () => {
  const html = indexHtml()
  const criticalIdx = html.indexOf('/* abwb-embed-critical')
  const cssLinkIdx = html.indexOf('href="css/index.css')
  assert.ok(criticalIdx > 0, 'missing critical style marker')
  assert.ok(cssLinkIdx > criticalIdx, 'critical style must precede index.css link')
  assert.match(html, /background:\s*#050505/)
})

test('host mineradio mount has light-theme shell background', () => {
  const css = hostCss()
  assert.match(
    css,
    /\.mineradio-embed\[data-embed-theme="light"\]\s+\.mineradio-embed__mount[\s\S]*?background:\s*linear-gradient\(165deg,\s*#f8fafc/,
  )
})

test('host embed column is full-bleed under floating header', () => {
  const skin = readFileSync(join(root, 'src/styles/mineradio-skin.css'), 'utf8')
  const blockStart = skin.indexOf('/* === Embed tab:')
  assert.ok(blockStart >= 0, 'missing embed tab block in mineradio-skin.css')
  const block = skin.slice(blockStart, blockStart + 1800)
  assert.match(block, /\.app-content-column--embed\s*\{[^}]*padding:\s*0\s*!important/s)
  assert.match(block, /\.app-content-column--embed\s*\{[^}]*gap:\s*0\s*!important/s)
  assert.match(block, /--embed-menu-clear:\s*calc\(var\(--embed-chrome-side\)\s*\+\s*5\.35rem\)/)
  assert.match(block, /\.app-main-stage--embed\s*\{[^}]*position:\s*absolute/s)
  assert.match(block, /\.app-main-stage--embed\s*\{[^}]*inset:\s*0/s)
  assert.match(block, /\.header-float\s*\{[^}]*position:\s*absolute\s*!important/s)
})

test('embed MineRadio chrome uses host safe-top clearance', () => {
  const css = embedCss()
  assert.match(css, /--abwb-embed-safe-top:\s*6\.75rem/)
  assert.match(css, /--abwb-embed-home-top:\s*calc\(var\(--abwb-embed-safe-top\)\s*\+\s*3\.5rem\)/)
  assert.match(css, /#top-right[\s\S]*?top:\s*var\(--abwb-embed-safe-top\)/)
  assert.match(css, /#empty-home[\s\S]*?top:\s*var\(--abwb-embed-home-top\)\s*!important/)
})
