# MineRadio Embed Fullscreen Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MineRadio’s embed viewport background fill edge-to-edge on first paint and after window/panel resize, with host/inner color sync and solid fallback when images fail — without changing standalone MineRadio.

**Architecture:** Pure CSS viewport chain in sync-safe `abwb-embed.css` (`%` + `100vh` → `-webkit-fill-available` → `100dvh`), plus a short critical `<style>` in `index.html` after embed preload scripts, plus host shell color/size alignment in `src/index.css`. No JS `--vh`, no host ready-mask.

**Tech Stack:** Existing MineRadio static CSS/HTML, Abworkbench host CSS/React, Node `node:test` regression contracts, `npm run rebuild` for host assets.

**Spec:** `docs/superpowers/specs/2026-09-11-mineradio-embed-fullscreen-bg-design.md`

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/components/mineradio/embedFullscreenBg.test.mjs` | Regression contracts for cascade, critical CSS, host/inner shell colors |
| `vendor/mineradio/public/css/abwb-embed.css` | Embed viewport min-height cascade + fullscreen bg cover/fallback |
| `vendor/mineradio/public/index.html` | Critical first-paint `<style>` (after preload scripts, before CSS links) |
| `src/index.css` | Host `.mineradio-embed*` / stage fill; fix light-theme `__mount` mismatch |
| `src/components/mineradio/MineradioPage.tsx` | Touch only if shell colors drift from `#050505` / light gradient (likely no change) |

**Do not modify:** `vendor/mineradio/public/css/index.css` standalone root rules, `workbench-fx.css`, background JS modules.

**Shared color tokens (keep in sync across files):**

| Token use | Dark | Light |
|-----------|------|-------|
| Host shell / critical / embed default | `#050505` | `linear-gradient(165deg, #f8fafc 0%, #f1f5f9 100%)` preferred on host; embed body may use `#f1f5f9` solid (already) |

---

### Task 1: Failing regression contracts

**Files:**
- Create: `src/components/mineradio/embedFullscreenBg.test.mjs`
- Test runner already includes `src/components/**/*.test.mjs` via `npm test`

- [x] **Step 1: Write the failing test**

```js
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
  assert.match(css, /html\.abwb-embedded\s+#custom-bg\s*\{[^}]*#050505/s)
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/components/mineradio/embedFullscreenBg.test.mjs`

Expected: FAIL — shell still `100vh` only; missing critical marker; missing light `__mount` rule; embed `#custom-bg` cover block may be incomplete.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/components/mineradio/embedFullscreenBg.test.mjs
git commit -m "test: add MineRadio embed fullscreen bg contracts"
```

---

### Task 2: Embed viewport + background CSS

**Files:**
- Modify: `vendor/mineradio/public/css/abwb-embed.css` (top shell block ~lines 1–108, plus new fullscreen bg section after the border-radius wipe block)

- [ ] **Step 1: Replace `#desktop-window-shell` embed sizing**

Find:

```css
html.abwb-embedded #desktop-window-shell,
body.abwb-embedded #desktop-window-shell,
html.abwb-embedded body.desktop-shell #desktop-window-shell {
  height: 100vh;
  min-height: 100vh;
  border-radius: 0 !important;
  clip-path: none !important;
  -webkit-clip-path: none !important;
  box-shadow: none !important;
  border: 0 !important;
  filter: none !important;
  overflow: hidden;
}
```

Replace with:

```css
html.abwb-embedded #desktop-window-shell,
body.abwb-embedded #desktop-window-shell,
html.abwb-embedded body.desktop-shell #desktop-window-shell {
  /* % chain from host webview; min-height cascade for Safari/odd viewports */
  height: 100%;
  min-height: 100%;
  min-height: 100vh;
  min-height: -webkit-fill-available;
  min-height: 100dvh;
  border-radius: 0 !important;
  clip-path: none !important;
  -webkit-clip-path: none !important;
  box-shadow: none !important;
  border: 0 !important;
  filter: none !important;
  overflow: hidden;
}
```

Also reinforce html/body min-height safety (keep existing width/height/background):

```css
html.abwb-embedded,
html.abwb-embedded body {
  width: 100%;
  height: 100%;
  min-height: 100%;
  min-height: 100vh;
  min-height: -webkit-fill-available;
  min-height: 100dvh;
  margin: 0;
  overflow: hidden;
  background: #050505;
}
```

- [ ] **Step 2: Add embed fullscreen background reinforcement**

Insert immediately after the existing “Kill standalone-window rounding…” block (after the `#album-bg-next` rule group ends ~line 108):

```css
/* Fullscreen bg fill — embed only (cover + solid fallback; no JS --vh) */
html.abwb-embedded #custom-bg,
html.abwb-embedded #splash,
html.abwb-embedded #splash.ready,
html.abwb-embedded #album-bg,
html.abwb-embedded #album-bg-next,
html.abwb-embedded #wallpaper-engine-layer {
  position: fixed;
  inset: 0;
  width: auto;
  height: auto;
}

html.abwb-embedded #custom-bg {
  background-color: #050505;
  background-image: none;
}

html.abwb-embedded[data-theme="light"] #custom-bg,
html.abwb-embedded.abwb-theme-light #custom-bg {
  background-color: #f1f5f9;
}

html.abwb-embedded #custom-bg::before {
  background-size: cover;
  background-repeat: no-repeat;
  background-position: var(--custom-bg-position-x, 50%) var(--custom-bg-position-y, 50%);
}

html.abwb-embedded #custom-bg-video {
  object-fit: cover;
  object-position: var(--custom-bg-position-x, 50%) var(--custom-bg-position-y, 50%);
}

html.abwb-embedded #album-bg,
html.abwb-embedded #album-bg-next {
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}
```

Note: `#custom-bg` already uses `rgba(var(--custom-bg-color-rgb…))` in `index.css`. Embed `background-color` is the failure/first-paint floor underneath; do not set `background` shorthand that would wipe the rgba layer — use `background-color` only as above.

- [ ] **Step 3: Re-run Task 1 tests**

Run: `node --test src/components/mineradio/embedFullscreenBg.test.mjs`

Expected: cascade + custom-bg tests PASS; critical HTML + host light mount still FAIL.

- [ ] **Step 4: Commit**

```bash
git add vendor/mineradio/public/css/abwb-embed.css
git commit -m "fix: embed MineRadio viewport and bg cover fallback"
```

---

### Task 3: Critical first-paint CSS in `index.html`

**Files:**
- Modify: `vendor/mineradio/public/index.html` (`<head>`, after `abwb-theme.js`, before `css/index.css`)

- [ ] **Step 1: Insert critical style**

After:

```html
  <script src="js/abwb-theme.js"></script>
```

Before:

```html
  <link rel="stylesheet" href="css/index.css?v=20260716-we-continuity-vsync">
```

Insert:

```html
  <!-- Abworkbench embed: first-paint shell before external CSS (do not remove) -->
  <style>
    /* abwb-embed-critical */
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #050505;
    }
    html.abwb-embedded,
    html.abwb-embedded body {
      background: #050505;
    }
    html.abwb-embedded[data-theme="light"],
    html.abwb-embedded[data-theme="light"] body,
    html.abwb-embedded.abwb-theme-light,
    html.abwb-embedded.abwb-theme-light body {
      background: #f1f5f9;
    }
  </style>
```

Placement is intentional: `preload-mode.js` / `abwb-theme.js` run first so `.abwb-embedded` / theme classes exist before this style is parsed for the light path; dark `html, body` still paints immediately for the default case.

- [ ] **Step 2: Re-run tests**

Run: `node --test src/components/mineradio/embedFullscreenBg.test.mjs`

Expected: critical HTML test PASS; host light `__mount` still FAIL.

- [ ] **Step 3: Commit**

```bash
git add vendor/mineradio/public/index.html
git commit -m "fix: critical first-paint shell for MineRadio embed"
```

---

### Task 4: Host shell light `__mount` + overflow alignment

**Files:**
- Modify: `src/index.css` (`.mineradio-embed__mount` block ~1120)
- Modify only if needed: `src/components/mineradio/MineradioPage.tsx` (`themeShellBackground` already returns `#050505` / light gradient — leave unless drift found)

- [ ] **Step 1: Add light-theme mount background**

After:

```css
.mineradio-embed__mount {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #050505;
}
```

Add:

```css
html[data-theme="light"] .mineradio-embed__mount,
.mineradio-embed[data-embed-theme="light"] .mineradio-embed__mount {
  background: linear-gradient(165deg, #f8fafc 0%, #f1f5f9 100%);
}
```

Confirm existing rules already have `overflow: hidden` on `.mineradio-embed`, `__frame`, `__mount`, and `.app-main-stage--embed` background `#050505` — do not duplicate unless a gap remains.

- [ ] **Step 2: Run full contract suite**

Run: `node --test src/components/mineradio/embedFullscreenBg.test.mjs`

Expected: all four tests PASS.

- [ ] **Step 3: Rebuild host assets**

Run: `npm run rebuild`

Expected: rebuild completes without error (vendor MineRadio public CSS/HTML is served live; rebuild covers `src/index.css`).

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "fix: align MineRadio host mount shell for light theme"
```

---

### Task 5: Manual / runtime verification

**Files:** none (verification only)

- [ ] **Step 1: Ensure desktop app can load MineRadio embed**

If app not running: `npm run rebuild:app` or existing `npx electron .` after rebuild.

- [ ] **Step 2: Visual checks (acceptance)**

1. Open MineRadio tab — no blank strip; no dark→light or light→dark flash at host/webview seam (test dark path at minimum; light if theme path available).
2. Resize Abworkbench window — background stays full-bleed; no embed document scrollbar from bg sizing.
3. Optional: set a broken custom bg image URL in MineRadio DIY — solid `#050505` / `#f1f5f9` still fills the viewport.

IronBee browser MCP may not reach Electron `<webview>`; prefer desktop visual check. If only browser tooling is available, skip Electron-only steps and rely on contract tests + CSS review.

- [ ] **Step 3: Final commit only if verification forced tiny fixes**

If no code changes: skip empty commit.

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Embed-only scope (not standalone `index.css`) | Tasks 2–4 file map |
| Pain A first-paint flash | Tasks 3–4 |
| Pain B resize fill | Task 2 cascade + fixed inset |
| Critical CSS before external sheets | Task 3 |
| Host + inner color sync | Tasks 3–4 |
| Image fail → solid fallback | Task 2 `#custom-bg` `background-color` |
| No JS `--vh` / ready-mask | Explicit non-goals; no tasks add them |
| Safari `100vh` / `dvh` / `-webkit-fill-available` | Task 2 cascade order |
| `npm run rebuild` after host change | Task 4 Step 3 |
| Regression safety | Task 1 contracts |

## Self-review notes

- No TBD/placeholder steps; CSS and test code are concrete.
- Test asserts cascade **order** (`vh` → fill → `dvh`) matching the spec.
- Light host `__mount` gap is a real existing bug addressed in Task 4.
- `MineradioPage.tsx` left as no-op unless verification finds drift — YAGNI.
