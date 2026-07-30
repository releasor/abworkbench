import { useEffect, useState } from 'react'
import { BookOpen, Keyboard } from 'lucide-react'
import { SHORTCUT_BY_ID, useShortcutStore } from '../../shortcuts'
import ShortcutRecorder from './ShortcutRecorder'

interface ReaderSettingsProps {
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

interface ReaderSettingsState {
  opacity: number
  fontSize: number
  fontColor: string
  bossKey: string
  disguiseEnabled: boolean
  novelDir: string
  windowBounds: { x: number; y: number; width: number; height: number } | null
  bossKeyError?: string
}

const DEFAULTS: ReaderSettingsState = {
  opacity: 0.85,
  fontSize: 16,
  fontColor: '#e8e8e8',
  bossKey: 'Ctrl+Shift+Q',
  disguiseEnabled: false,
  novelDir: '',
  windowBounds: null,
}

export default function ReaderSettings({ onToast }: ReaderSettingsProps) {
  const [settings, setSettings] = useState<ReaderSettingsState>(DEFAULTS)
  const [recording, setRecording] = useState(false)
  const setAccelerator = useShortcutStore((s) => s.setAccelerator)
  const bossKey = useShortcutStore((s) => s.getAccelerator('readerBossKey'))

  useEffect(() => {
    queueMicrotask(() => {
      void window.electronAPI?.getReaderSettings?.().then((loaded) => {
        if (loaded) setSettings({ ...DEFAULTS, ...loaded })
      })
    })
  }, [])

  const save = async (next: ReaderSettingsState) => {
    setSettings(next)
    const saved = await window.electronAPI?.setReaderSettings?.(next)
    if (saved) {
      setSettings({ ...DEFAULTS, ...saved })
      if (saved.bossKeyError) onToast(saved.bossKeyError, 'error')
    }
  }

  const conflictIds = useShortcutStore.getState().findConflicts('readerBossKey', bossKey)
  const conflictLabel = conflictIds[0] ? SHORTCUT_BY_ID[conflictIds[0]]?.label : undefined

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-text">摸鱼阅读样式</h2>
        </div>
        <p className="text-xs text-text-muted mb-4">
          透明悬浮窗的阅读外观。也可在阅读窗内用 +/- 调节字号。
        </p>
        <div className="space-y-4">
          <label className="block text-sm text-text">
            透明度 {Math.round(settings.opacity * 100)}%
            <input
              type="range"
              min={20}
              max={100}
              value={Math.round(settings.opacity * 100)}
              onChange={(e) => {
                const opacity = Number(e.target.value) / 100
                void save({ ...settings, opacity })
              }}
              className="mt-2 w-full accent-primary"
            />
          </label>
          <label className="block text-sm text-text">
            字号 {settings.fontSize}px
            <input
              type="range"
              min={12}
              max={36}
              value={settings.fontSize}
              onChange={(e) => {
                void save({ ...settings, fontSize: Number(e.target.value) })
              }}
              className="mt-2 w-full accent-primary"
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-text">
            字体颜色
            <input
              type="color"
              value={settings.fontColor}
              onChange={(e) => {
                void save({ ...settings, fontColor: e.target.value })
              }}
              className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
            />
          </label>
        </div>
      </div>

      <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
        <div className="flex items-center gap-2 mb-4">
          <Keyboard size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-text">老板键</h2>
        </div>
        <p className="text-xs text-text-muted mb-3">
          默认立刻隐藏阅读窗。开启伪装后，热键在「假工作界面」与正文之间切换。
        </p>
        <div className="flex items-center gap-3 mb-4">
          <ShortcutRecorder
            value={bossKey}
            recording={recording}
            conflictLabel={conflictLabel}
            onStartRecording={() => setRecording(true)}
            onCancel={() => setRecording(false)}
            onChange={(next) => {
              setAccelerator('readerBossKey', next)
              setRecording(false)
              void save({ ...settings, bossKey: next })
              onToast(`老板键已更新为 ${next}`, 'success')
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={settings.disguiseEnabled}
            onChange={(e) => {
              void save({ ...settings, disguiseEnabled: e.target.checked })
            }}
            className="accent-primary"
          />
          启用伪装模式（假工作周报界面）
        </label>
        {settings.bossKeyError && (
          <p className="mt-2 text-xs text-red-400">{settings.bossKeyError}</p>
        )}
        {settings.novelDir && (
          <p className="mt-3 text-[11px] text-text-muted">最近小说目录：{settings.novelDir}</p>
        )}
      </div>
    </div>
  )
}
