# Workbench Dashboard Style Alignment

Date: 2026-09-07  
Status: Draft for review  
Scope: Visual/style only — Project Workbench full page reskin to match Dashboard「今日概览」

## Goal

Make **工作台** (project list + project workspace) feel like the same product surface as **今日概览**: shared glass shells, chips/buttons, radius, and light/dark treatment — without changing workbench information architecture or LAN/room behavior.

## Non-goals

- No new workbench features, room protocol changes, or task model changes
- No dashboard layout rewrite
- No redesign of TaskFlow / Habits / other modules
- No inventing a third glass system alongside GlassCard + workbench-fx

## Current state

| Surface | Pattern |
| --- | --- |
| 今日概览 | `BorderGlow` + `dashboard-hero`; panels via `GlassCard` + `dashboard-panel`; controls via `interactive-glass` / `dashboard-chip` (mineradio-skin) |
| 工作台 | Custom `WbPanel` (BorderGlow wrapper) + large `workbench-fx.css` (`wb-panel`, `wb-btn`, `wb-task`, …) — parallel skin that already drifts from dashboard |

## Chosen approach

**Approach 1 — Direct component swap (confirmed)**

Replace workbench panel shells and primary controls with the same primitives Dashboard uses. Keep workbench-specific CSS only for domain UI (lanes, task rows, room status, drawer chrome).

Rejected:

- Keep `WbPanel` as GlassCard alias only (still two names, easy drift)
- Copy dashboard CSS under `wb-*` (duplicate maintenance)

## Design

### 1. Shared shells

- **Hero / page headers** (工作台列表顶栏、项目页标题区、主线看板外壳): use `BorderGlow` with `border-glow-card--glass` and dashboard-like padding / kicker / title hierarchy, or `GlassCard` with elevated radius consistent with dashboard panels (prefer dashboard tokens: ~22–34px radius family already used by GlassCard / frame).
- **Content panels** (加入房间、创建项目、个人列、公开池、房间条、状态条): use `GlassCard` with `dashboard-panel`-equivalent classes (reuse `dashboard-panel` where it fits, or a thin `wb` content class that only sets layout, not a second glass material).
- **`WbPanel`**: either delete after migration, or reduce to a one-line re-export of `GlassCard` with workbench defaults — no separate glow/surface math.

### 2. Controls

- Map secondary actions to `interactive-glass` (+ `dashboard-chip` where chip-sized).
- Primary actions: keep semantic emphasis (primary fill) but sit on glass-consistent surfaces; avoid opaque flat `wb-btn` skins that fight dashboard chips.
- Inputs: align with glass inset fields used on dashboard / settings (borderless or soft glass, primary focus ring) — drop divergent `wb-input` material rules once classes are remapped.

### 3. Domain chrome (keep, restyle lightly)

Retain structure and behavior:

- Project list: create project, join room, project cards
- Project workspace: back + rename, RoomBar, MainlineBoard (todo/doing/done), PersonalColumn, PoolColumn, TaskDrawer, disconnect banner

Restyle only:

- Task rows / chips: light glass + hover lift consistent with dashboard interactive tiles (no Mineradio-only heavy overlays)
- Lanes: subtle status tint on glass, not competing panel-in-panel materials
- Drawer: glass panel + veil matching modal/glass patterns already in app
- Stage ambient (`wb-stage::before`): tone down or align with dashboard page background so workbench does not look like a different app; light theme should not invent a separate canvas system

### 4. Files expected to change

- `src/modules/workbench/WbPanel.tsx` — migrate or remove
- `src/modules/workbench/ProjectList.tsx`, `ProjectWorkbench.tsx`, `RoomBar.tsx`, `MainlineBoard.tsx`, `PersonalColumn.tsx`, `PoolColumn.tsx`, `TaskRow.tsx`, `TaskDrawer.tsx`, `WorkbenchPage.tsx`
- `src/modules/workbench/workbench-fx.css` — shrink to domain-only rules; remove duplicated panel/button glass that conflicts with GlassCard / mineradio-skin
- Possibly small shared class reuse only (no new design-token package)

### 5. Acceptance criteria

1. Opening 工作台 after 今日概览, panels/buttons read as the same glass language (radius, blur, border glow, chip hover).
2. Project list and project workspace both updated (full scope A).
3. LAN host/join/promote/task edit flows unchanged functionally.
4. Light and dark themes both acceptable; no light-only special-case that reintroduces a separate workbench material.
5. `npm run lint`, `npm test`, `npm run typecheck` pass; rebuild via `npm run rebuild`.

### 6. Out of scope follow-ups

- Pixel-perfect clone of dashboard hero content (clock, weather, score widgets) into workbench
- Motion redesign beyond existing `motion-*` / page enter classes

## Implementation note

After this spec is approved, create an implementation plan under `docs/superpowers/plans/` and execute incrementally (list page → project chrome → columns/board → CSS cleanup → verify).
