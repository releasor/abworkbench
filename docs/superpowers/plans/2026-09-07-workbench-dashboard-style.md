# Workbench Dashboard Style Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the full Project Workbench (list + project workspace) to use the same GlassCard / BorderGlow / interactive-glass language as Dashboard「今日概览」, without changing LAN or task behavior.

**Architecture:** Replace `WbPanel` with a thin GlassCard-based shell; map secondary controls to `interactive-glass` (+ `dashboard-chip` where chip-sized); keep primary CTA emphasis; shrink `workbench-fx.css` to domain-only rules (lanes, task rows, mode pills, drawer, stage scroll).

**Tech Stack:** React 19, existing `GlassCard` / `BorderGlow`, Tailwind utility classes, `mineradio-skin.css` glass tokens, `workbench-fx.css` (trimmed).

**Spec:** `docs/superpowers/specs/2026-09-07-workbench-dashboard-style-design.md`

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/modules/workbench/WbPanel.tsx` | Thin GlassCard wrapper (defaults for workbench panels); remove custom BorderGlow math |
| `src/modules/workbench/ProjectList.tsx` | List page hero + GlassCard sections + glass controls |
| `src/modules/workbench/ProjectWorkbench.tsx` | Header / banner / sync strip glass controls |
| `src/modules/workbench/RoomBar.tsx` | Room strip as GlassCard + interactive-glass buttons |
| `src/modules/workbench/MainlineBoard.tsx` | Hero GlassCard shell; keep lane/task domain markup |
| `src/modules/workbench/PersonalColumn.tsx` | GlassCard column + glass controls |
| `src/modules/workbench/PoolColumn.tsx` | GlassCard column + glass controls |
| `src/modules/workbench/TaskRow.tsx` | Task row classes compatible with trimmed CSS |
| `src/modules/workbench/TaskDrawer.tsx` | Drawer panel aligned to glass modal patterns |
| `src/modules/workbench/WorkbenchPage.tsx` | Stage wrapper; drop competing ambient if needed |
| `src/modules/workbench/workbench-fx.css` | Domain-only CSS; delete duplicate panel/button glass |

---

### Task 1: Convert `WbPanel` to GlassCard shell

**Files:**
- Modify: `src/modules/workbench/WbPanel.tsx`
- Verify: `npm run typecheck`

- [ ] **Step 1: Replace WbPanel implementation**

Rewrite `WbPanel.tsx` so it wraps `GlassCard` instead of raw `BorderGlow`:

```tsx
import type { ComponentPropsWithoutRef, ElementType } from 'react'
import clsx from 'clsx'
import GlassCard from '../../components/common/GlassSurface/GlassCard'

type WbPanelProps<T extends ElementType = 'section'> = {
  as?: T
  hero?: boolean
  borderRadius?: number
  className?: string
  contentClassName?: string
  children?: React.ReactNode
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>

export default function WbPanel<T extends ElementType = 'section'>({
  as,
  className,
  contentClassName = '',
  children,
  hero = false,
  borderRadius,
  ...props
}: WbPanelProps<T>) {
  const radius = borderRadius ?? (hero ? 28 : 22)
  return (
    <GlassCard
      as={as}
      borderRadius={radius}
      className={clsx(
        'dashboard-panel wb-panel',
        hero && 'wb-panel--hero',
        className,
      )}
      contentClassName={contentClassName}
      {...props}
    >
      {children}
    </GlassCard>
  )
}
```

Notes for implementer:
- If `GlassCard` generics fight `as="button"` typing (same issue SettingsGlassCard had), drop the generic and use `GlassCardProps` without `T`, or cast props as `GlassCardProps`.
- Keep exporting default `WbPanel` so call sites can migrate class names first without a big-bang rename.
- Remove `useBorderGlowTheme` / `useBorderGlowSurfaceColor` from this file.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`  
Expected: PASS (or only errors outside this file — fix WbPanel-related errors before continuing)

- [ ] **Step 3: Commit**

```bash
git add src/modules/workbench/WbPanel.tsx
git commit -m "将工作台面板外壳对齐 GlassCard。"
```

---

### Task 2: Reskin project list page

**Files:**
- Modify: `src/modules/workbench/ProjectList.tsx`

- [ ] **Step 1: Update imports and page chrome**

Add dashboard-style imports if needed (e.g. `FolderKanban` or `Zap` from `lucide-react` for kicker). Keep `WbPanel`.

Replace the plain title block:

```tsx
{/* before */}
<div>
  <h1 className="wb-title text-xl font-semibold text-text">工作台</h1>
  <p className="wb-subtitle mt-1 text-sm">...</p>
</div>

{/* after */}
<WbPanel hero className="p-6 md:p-8">
  <div className="home-kicker mb-3 inline-flex items-center gap-2">
    <span>工作台</span>
  </div>
  <h1 className="text-3xl font-black tracking-tight text-text md:text-4xl">项目协作</h1>
  <p className="mt-2 text-sm text-text-muted">
    先创建并命名项目；开房在项目内进行，且只绑定那一个项目。
  </p>
</WbPanel>
```

- [ ] **Step 2: Remap controls**

On the same file, replace button/input classes:

| Old | New |
| --- | --- |
| `wb-btn` | `interactive-glass dashboard-chip rounded-xl px-3 py-1 text-xs font-semibold text-text-muted` |
| `wb-btn-primary` | `interactive-glass rounded-xl px-3 py-1.5 text-xs font-semibold text-primary` (or keep a single primary class if glass primary already exists — prefer `interactive-glass` + `text-primary` / accent border via existing dashboard chip patterns) |
| `wb-input` | `interactive-glass rounded-xl px-2 py-1.5 text-xs text-text bg-transparent outline-none focus:ring-2 focus:ring-primary/30` |

Apply to: live-room strip, join form, create form, empty state, project cards (`wb-project-card` may remain as a layout hook; ensure card uses `WbPanel as="button"` + `interactive-glass`-friendly hover from GlassCard).

Example join primary button:

```tsx
<button
  type="button"
  disabled={busy || !joinUrl.trim()}
  onClick={() => void onJoin()}
  className="interactive-glass dashboard-chip rounded-xl px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
>
  加入
</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/workbench/ProjectList.tsx
git commit -m "将工作台项目列表对齐今日概览玻璃风格。"
```

---

### Task 3: Reskin project workspace chrome

**Files:**
- Modify: `src/modules/workbench/ProjectWorkbench.tsx`
- Modify: `src/modules/workbench/RoomBar.tsx`
- Modify: `src/modules/workbench/TaskDrawer.tsx`

- [ ] **Step 1: ProjectWorkbench controls + strips**

- Back button: `interactive-glass dashboard-chip rounded-xl …`
- Rename input: glass input classes from Task 2
- Disconnect banner: wrap in `WbPanel as="div"` or keep `wb-banner` but soften to glass (prefer `GlassCard`/`WbPanel` + muted text)
- Unsynced strip: already `WbPanel`; remap primary button classes

- [ ] **Step 2: RoomBar**

Keep `WbPanel as="div" className="wb-room …"`. Remap all `wb-btn` / `wb-btn-primary` / `wb-input` to the Task 2 class map. Keep `wb-mode-pill` for status (domain CSS).

- [ ] **Step 3: TaskDrawer**

- Keep structure (`wb-drawer-veil` / `wb-drawer-panel`)
- Close button → interactive-glass chip
- Inputs → glass input classes
- In Task 5 CSS pass, restyle `.wb-drawer-panel` to match glass modal (blur + border glow tokens), not opaque sheet

- [ ] **Step 4: Commit**

```bash
git add src/modules/workbench/ProjectWorkbench.tsx src/modules/workbench/RoomBar.tsx src/modules/workbench/TaskDrawer.tsx
git commit -m "将工作台顶栏、房间条与抽屉对齐玻璃控件。"
```

---

### Task 4: Reskin board columns and task rows

**Files:**
- Modify: `src/modules/workbench/MainlineBoard.tsx`
- Modify: `src/modules/workbench/PersonalColumn.tsx`
- Modify: `src/modules/workbench/PoolColumn.tsx`
- Modify: `src/modules/workbench/TaskRow.tsx`

- [ ] **Step 1: Columns**

Keep `WbPanel` / `WbPanel hero` wrappers. Remap header typography to dashboard panel headers:

```tsx
<header className="wb-panel-header px-4 py-3">
  <h2 className="text-sm font-semibold text-text">主线</h2>
  <p className="mt-0.5 text-[11px] text-text-muted">…</p>
</header>
```

Remap promote / submit / delete buttons:
- secondary → `interactive-glass dashboard-chip …`
- danger → `interactive-glass … text-red-300` (or keep `wb-btn-danger` until CSS trim maps it onto glass)

- [ ] **Step 2: TaskRow**

Keep `wb-task` / `wb-chip` class hooks for domain CSS. Ensure title uses `text-text` and does not rely on old `wb-title` text-shadow.

- [ ] **Step 3: Commit**

```bash
git add src/modules/workbench/MainlineBoard.tsx src/modules/workbench/PersonalColumn.tsx src/modules/workbench/PoolColumn.tsx src/modules/workbench/TaskRow.tsx
git commit -m "将工作台主线与任务列对齐概览面板风格。"
```

---

### Task 5: Trim `workbench-fx.css` + stage

**Files:**
- Modify: `src/modules/workbench/workbench-fx.css`
- Modify: `src/modules/workbench/WorkbenchPage.tsx` (only if stage class needs tweak)

- [ ] **Step 1: Delete duplicate glass materials**

Remove or neutralize rules that fight GlassCard / mineradio-skin:

- `.wb-panel` background / border / `::after` sheen that double-glass with GlassCard
- Light-theme `html[data-theme="light"] .wb-panel*` overrides that force separate `--wb-surface`
- `.wb-btn`, `.wb-btn-primary`, `.wb-input` material blocks (once call sites no longer use them — grep first)

Keep:

- `.wb-stage` / `.wb-content-scroll` layout
- Soften or remove `.wb-stage::before` heavy ambient so page background matches dashboard (prefer remove radial wash or cut opacity to ≤0.35)
- `.wb-lane*`, `.wb-task*`, `.wb-chip*`, `.wb-mode-pill`, `.wb-badge-on-mainline`, `.wb-drawer-*`, `.wb-banner` (restyled lightly)
- Light padding helpers on `.wb-content-scroll` / `.wb-board-grid` if still needed for shadow room

Grep safety:

```bash
rg "wb-btn|wb-input|wb-panel::" src/modules/workbench
```

Expected: no remaining `wb-btn` / `wb-input` in TSX before deleting their CSS; `wb-panel` may remain as layout hook class on GlassCard.

- [ ] **Step 2: Drawer glass**

Update `.wb-drawer-panel` to use shared glass tokens (`var(--glass-bg)`, blur, border) consistent with modal panels in `mineradio-skin.css`, not a flat opaque sidebar.

- [ ] **Step 3: Commit**

```bash
git add src/modules/workbench/workbench-fx.css src/modules/workbench/WorkbenchPage.tsx
git commit -m "精简工作台特效样式，仅保留领域 UI。"
```

---

### Task 6: Verify and rebuild

**Files:** none new

- [ ] **Step 1: Automated checks**

Run:

```bash
npm run lint
npm test
npm run typecheck
npm run rebuild
```

Expected: all PASS / build succeeds.

- [ ] **Step 2: Manual / IronBee spot check**

If the desktop or Vite preview is available via IronBee browser tools:

1. Open app → navigate to 工作台 (taskflow / workbench page)
2. Confirm list hero + create/join panels look like dashboard glass
3. Open a project → RoomBar + Mainline + Personal match
4. Check light and dark themes if theme toggle exists

If IronBee cannot reach Electron, visually confirm in the running Electron window after `npm run rebuild` (or existing `desktop:watch`).

- [ ] **Step 3: Final commit if verification fixes needed**

Only if Step 1–2 caused follow-up edits; otherwise skip.

```bash
git add -u src/modules/workbench
git commit -m "修复工作台玻璃换肤验收问题。"
```

---

## Spec coverage checklist

| Spec item | Task |
| --- | --- |
| Shared shells via GlassCard / BorderGlow language | Task 1 |
| List page hero + cards (scope A) | Task 2 |
| Project workspace chrome + room bar + drawer | Task 3 |
| Mainline / personal / pool | Task 4 |
| Trim workbench-fx; no second material system | Task 5 |
| Behavior unchanged; lint/test/typecheck/rebuild | Task 6 |
| Light + dark acceptable | Task 5–6 |

## Self-review notes

- No placeholders left in steps.
- Primary CTA mapping prefers `interactive-glass` + primary text/chip rather than inventing a new button primitive.
- `WbPanel` kept as a name to reduce churn; implementation becomes GlassCard.
- Functional LAN tests already exist under `src/modules/workbench/*.test.mjs` — style work must not break them; Task 6 runs full `npm test`.
