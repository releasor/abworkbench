import { useCallback, useEffect, useRef } from 'react'
import { SHORTCUT_BY_ID } from './catalog'
import { toElectronAccelerator } from './parse'
import { useShortcutStore } from './store'

function fromElectronAccelerator(value: string): string {
  return value.replace(/^CommandOrControl/i, 'Ctrl')
}

/**
 * Keep Electron global shortcuts (launcher / main window / reader boss key)
 * in sync with the renderer shortcut store.
 */
export function useSyncElectronShortcuts() {
  const launcher = useShortcutStore((s) => s.getAccelerator('launcher'))
  const mainWindow = useShortcutStore((s) => s.getAccelerator('mainWindow'))
  const readerBossKey = useShortcutStore((s) => s.getAccelerator('readerBossKey'))
  const ready = useRef(false)

  const pushLauncher = useCallback(async (hotkey: string, mainWindowHotkey: string) => {
    if (!window.electronAPI?.getLauncherSettings || !window.electronAPI?.setLauncherSettings) return
    const current = await window.electronAPI.getLauncherSettings()
    if (!current) return
    const nextHotkey = toElectronAccelerator(hotkey)
    const nextMain = toElectronAccelerator(mainWindowHotkey)
    if (current.hotkey === nextHotkey && current.mainWindowHotkey === nextMain) return
    await window.electronAPI.setLauncherSettings({
      ...current,
      hotkey: nextHotkey,
      mainWindowHotkey: nextMain,
    })
  }, [])

  const pushBossKey = useCallback(async (bossKey: string) => {
    if (!window.electronAPI?.getReaderSettings || !window.electronAPI?.setReaderSettings) return
    const current = await window.electronAPI.getReaderSettings()
    if (!current) return
    const next = toElectronAccelerator(bossKey).replace(/^CommandOrControl/i, 'Ctrl')
    if (current.bossKey === next) return
    await window.electronAPI.setReaderSettings({
      ...current,
      bossKey: next,
    })
  }, [])

  useEffect(() => {
    void (async () => {
      const loaded = await window.electronAPI?.getLauncherSettings?.()
      if (loaded?.hotkey) {
        const normalized = fromElectronAccelerator(loaded.hotkey)
        if (normalized !== useShortcutStore.getState().getAccelerator('launcher')) {
          useShortcutStore.getState().setAccelerator('launcher', normalized)
        }
      }
      if (loaded?.mainWindowHotkey) {
        const normalized = fromElectronAccelerator(loaded.mainWindowHotkey)
        if (normalized !== useShortcutStore.getState().getAccelerator('mainWindow')) {
          useShortcutStore.getState().setAccelerator('mainWindow', normalized)
        }
      }
      const reader = await window.electronAPI?.getReaderSettings?.()
      if (reader?.bossKey) {
        const normalized = fromElectronAccelerator(reader.bossKey)
        if (normalized !== useShortcutStore.getState().getAccelerator('readerBossKey')) {
          useShortcutStore.getState().setAccelerator('readerBossKey', normalized)
        }
      }
      // Clear a stale renderer override that still points launcher at Ctrl+Alt+Space.
      const launcherNow = useShortcutStore.getState().getAccelerator('launcher')
      const mainNow = useShortcutStore.getState().getAccelerator('mainWindow')
      if (launcherNow === 'Ctrl+Alt+Space' && mainNow === 'Ctrl+Alt+Space') {
        useShortcutStore.getState().resetOne('launcher')
      }
      ready.current = true
      await pushLauncher(
        useShortcutStore.getState().getAccelerator('launcher'),
        useShortcutStore.getState().getAccelerator('mainWindow'),
      )
      await pushBossKey(useShortcutStore.getState().getAccelerator('readerBossKey'))
    })()
  }, [pushBossKey, pushLauncher])

  useEffect(() => {
    if (!ready.current) return
    if (!SHORTCUT_BY_ID.launcher || !SHORTCUT_BY_ID.mainWindow) return
    void pushLauncher(launcher, mainWindow)
  }, [launcher, mainWindow, pushLauncher])

  useEffect(() => {
    if (!ready.current) return
    if (!SHORTCUT_BY_ID.readerBossKey) return
    void pushBossKey(readerBossKey)
  }, [pushBossKey, readerBossKey])
}
