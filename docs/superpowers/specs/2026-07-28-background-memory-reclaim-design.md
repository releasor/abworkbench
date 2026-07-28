# 后台内存优化：主窗口可销毁 + 启动器常温热

**Goal:** 托盘常挂时降低内存；启动器高频秒开；主界面按需打开。

## Behavior
- 主窗口关闭/隐藏：默认**立即** `destroy` Renderer（可配置关闭此行为）
- 再次 `Ctrl+Alt+Space` / 托盘打开：无窗口则 `createWindow`，有则 show
- 启动器：首次创建后仅 `hide`，不销毁
- 翻译窗 / 迷你窗：关闭即销毁（保持现状或补齐）

## Settings
- `reclaimMainWindowWhenHidden: boolean`（默认 `true`）写入 `launcher-settings.json`

## Non-goals (phase 1)
- 不改 Everything 策略
- 不强制卸载 React 各页（销毁窗口即可）
