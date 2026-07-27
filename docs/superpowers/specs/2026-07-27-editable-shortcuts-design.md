# Editable Shortcuts Design

**Goal:** Make all listed app shortcuts user-editable with restore-defaults; change launcher default to `Ctrl+Alt+Space`.

## Defaults
- Launcher (global): `Ctrl+Alt+Space`
- Quick capture (global): `Ctrl+Shift+Space`
- One-time migrate: if persisted launcher hotkey is exactly `Alt+Space`, replace with `Ctrl+Alt+Space`

## Architecture
- `src/shortcuts/catalog.ts` — id, group, label, default accelerator, scope (`global` | `page`)
- `src/shortcuts/parse.ts` — parse/format/match Electron-style accelerators
- `src/shortcuts/store.ts` — Zustand persist for overrides
- Electron `launcher-settings`: `hotkey` + `quickCaptureHotkey`; register both via `globalShortcut`
- Settings → Shortcuts: click-to-record, conflict hint, restore defaults
- Consumers read via `getShortcut` / `matchesShortcut` / `useAppShortcut`

## Scope
All items previously shown in Settings shortcut groups, plus TaskFlow module Ctrl shortcuts so KeyboardHelp stays accurate.
