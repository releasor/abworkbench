# MineRadio Embed Fullscreen Background Adaptation

Date: 2026-09-11  
Status: Draft for review  
Scope: Abworkbench **embed mode only** (`?embedded=1`) — page-load and resize fullscreen background fill

## Goal

When MineRadio opens inside Abworkbench (webview/iframe), the background layer fills the entire embed viewport with no blank margins, scrollbars, or uncovered edges; first paint matches the host shell so load does not flash a mismatched color; window/panel resize keeps cover adaptation without blocking first paint.

## Non-goals

- Standalone MineRadio window / non-embed `index.css` root `100vh` rewrite (out of scope A)
- `workbench-fx.css` or Workbench module visuals
- New background media features, Wallpaper Engine changes, or third-party libraries
- Host overlay/mask that waits for webview `ready` (rejected approach 3)
- JS `--app-vh` / `visualViewport` polling (rejected approach 2)

## Pain points (confirmed)

1. **A — First paint flash / edge gaps** when opening the MineRadio tab (host shell vs inner page color or size mismatch).
2. **B — Resize gaps** after scaling the window/panel: background not covering, or overflow scrollbar / uncovered strip.

## Current state

```
Abworkbench tab
  └─ .mineradio-embed (#050505 / light gradient host shell)
       └─ <webview|iframe> → http://127.0.0.1/?embedded=1
            └─ index.html
                 ├─ #custom-bg / video / WE
                 ├─ #album-bg*
                 ├─ #canvas-container
                 └─ #splash
```

| Layer | Today | Gap |
| --- | --- | --- |
| Host `.mineradio-embed*` | Already `#050505` / light gradient, `height: 100%`, `overflow: hidden` | Mostly OK; must stay aligned with inner critical CSS |
| Embed `html/body` (`abwb-embed.css`) | `width/height: 100%`, solid `#050505` / light `#f1f5f9` | Good base; shell still uses `100vh` |
| `#desktop-window-shell` (embed) | `height/min-height: 100vh` | Classic `100vh` risk; prefer `%` + `dvh` chain |
| `#custom-bg::before` | Already `background-size: cover` + position vars | Keep; ensure embed fallback color always visible under failed image |
| Critical CSS in `index.html` | None before `index.css` / `abwb-embed.css` | First frame can flash before stylesheets apply |

## Chosen approach

**Approach 1 — Pure CSS viewport chain + critical first-paint style (confirmed as option C)**

- Prefer percentage height chain from host → webview document → shell.
- Use `min-height: 100dvh` with `100vh` and `-webkit-fill-available` fallbacks where needed.
- Keep background layers on `position: fixed; inset: 0` with `cover` / `center` (or existing crop vars).
- Add a short critical `<style>` in MineRadio `index.html` so embed first paint has shell color before external CSS.
- Align host shell colors with embed critical/embed CSS (dark `#050505`, light gradient already used by `themeShellBackground`).

Rejected:

- **JS `--app-vh`**: extra paint delay, unnecessary in Electron embed.
- **Host ready-mask**: hides flash but feels slower and duplicates splash.

## Design

### 1. Viewport fill (embed)

In `abwb-embed.css`:

- `html.abwb-embedded, body`: keep `width/height: 100%`, `margin: 0`, `overflow: hidden`.
- `#desktop-window-shell` (existing embed selectors): replace sole `height/min-height: 100vh` with this **exact cascade** (later lines win when supported):

```css
height: 100%;
min-height: 100%;
min-height: 100vh;                 /* fallback */
min-height: -webkit-fill-available; /* Safari/iOS when needed */
min-height: 100dvh;               /* preferred dynamic viewport */
```

- Prefer filling via the host → document → shell **percentage chain** first; the `min-height` cascade is the safety net when `%` alone does not stretch inside the webview.
- Do **not** change standalone `index.css` `html, body { height: 100vh }` rules.

### 2. Background layers (embed overrides only)

Under `html.abwb-embedded` (or existing embed selectors):

- `#custom-bg`, `#splash`, `#album-bg`, `#album-bg-next`, wallpaper layer: ensure `position: fixed; inset: 0;` (already largely true), no border-radius/clip gaps (already zeroed in embed).
- `#custom-bg`: solid base always on (`rgba(var(--custom-bg-color-rgb…))` already); embed may reinforce theme fallback `#050505` / light equivalent so a failed `--custom-bg-image` still shows full-bleed color.
- Image layer: keep `background-size: cover`, `background-repeat: no-repeat`, position via existing `--custom-bg-position-*` (default center).
- Video: keep `object-fit: cover`.
- No new JS image preload unless CSS fallback proves insufficient in verification.

### 3. First-paint critical CSS

In `vendor/mineradio/public/index.html` `<head>`, before stylesheet links, a minimal block (comment: Abworkbench embed first paint):

- Default dark: `html, body { background: #050505; }` and height/overflow essentials.
- When `html.abwb-embedded` / theme classes already applied by `preload-mode.js` / `abwb-theme.js` (scripts currently load **before** CSS links — keep that order), mirror light fallback to match host gradient or `#f1f5f9` / `#f8fafc` family already used in embed light rules.

Constraint: keep the critical block short; do not duplicate full embed theme tokens.

### 4. Host shell alignment

- `src/index.css`: verify `.mineradio-embed`, `__mount`, `__frame` remain `width/height: 100%`, `min-height: 0`, `overflow: hidden`, backgrounds `#050505` / light gradient — tighten only if gaps appear at stage/column boundaries.
- `MineradioPage.tsx`: keep `themeShellBackground()` as single source for frame inline background; extract shared color constants only if duplication drifts (optional, YAGNI unless needed).
- No host overlay waiting for load.

### 5. Performance

- CSS-only adaptation; no resize listeners for background cover.
- Critical CSS is tiny (bytes) to avoid FOUC without blocking render.
- No new dependencies.

### 6. Files expected to change

| File | Change |
| --- | --- |
| `vendor/mineradio/public/css/abwb-embed.css` | Viewport chain + embed bg cover/fallback reinforcement |
| `vendor/mineradio/public/index.html` | Short critical `<style>` for first paint |
| `src/index.css` | Host embed shell size/overflow/background alignment if needed |
| `src/components/mineradio/MineradioPage.tsx` | Only if shell color constants need unifying |

### 7. Acceptance criteria

1. Opening MineRadio tab: no visible blank strip or color flash between host shell and inner splash/bg (dark and light paths).
2. Resizing the Abworkbench window / embed panel: background remains full-bleed; no scrollbar on embed document from bg sizing.
3. Custom background image still uses `cover` + existing crop/zoom vars; if image URL fails, solid/gradient base remains full-screen.
4. Standalone MineRadio (non-embed) behavior unchanged by this work.
5. No new third-party deps; `npm run rebuild` after host (`src/**`) changes; MineRadio vendor static assets are served live from `vendor/mineradio/public` (verify via running embed).

### 8. Edge cases

| Case | Mitigation |
| --- | --- |
| Mobile Safari / WebView `100vh` chrome | Prefer `%` chain; `min-height: 100dvh` with `100vh` fallback; `-webkit-fill-available` where needed |
| Orientation / panel resize | `fixed; inset: 0` + `%`/`dvh` — no JS |
| Stylesheets late | Critical inline style before links |
| Image load failure | `#custom-bg` color base + embed theme fallback |
| Light theme | Host + critical + `abwb-embed` light rules stay in sync |
| Vendor sync wiping customizations | Prefer `abwb-embed.css` (sync-safe); keep `index.html` critical block minimal and commented |

### 9. Out of scope follow-ups

- Standalone page root `100vh` → `dvh` migration in `index.css`
- Ready-state host mask if FOUC persists after critical CSS
- Explicit JS image `onerror` clearing `--custom-bg-image` (only if CSS fallback insufficient)
