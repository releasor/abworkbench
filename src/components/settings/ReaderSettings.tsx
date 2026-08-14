import { useEffect, useState } from 'react'
import { BookOpen, Keyboard } from 'lucide-react'
import { SHORTCUT_BY_ID, useShortcutStore } from '../../shortcuts'
import { useTranslation } from '../../i18n'
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
  const { t, tWith } = useTranslation()
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
          <h2 className="text-lg font-semibold text-text">{t('settings.reader.title')}</h2>
        </div>
        <p className="text-xs text-text-muted mb-4">
          {t('settings.reader.desc')}
        </p>
        <div className="space-y-4">
          <label className="block text-sm text-text">
            {t('settings.reader.opacity')} {Math.round(settings.opacity * 100)}%
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
            {t('settings.reader.fontSize')} {settings.fontSize}px
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
            {t('settings.reader.fontColor')}
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
          <h2 className="text-lg font-semibold text-text">{t('settings.reader.bossKey')}</h2>
        </div>
        <p className="text-xs text-text-muted mb-3">
          {t('settings.reader.bossKeyDesc')}
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
              onToast(tWith('settings.reader.bossKeyUpdated', next), 'success')
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
          {t('settings.reader.disguise')}
        </label>
        {settings.bossKeyError && (
          <p className="mt-2 text-xs text-red-400">{settings.bossKeyError}</p>
        )}
        {settings.novelDir && (
          <p className="mt-3 text-[11px] text-text-muted">{t('settings.reader.novelDir')}：{settings.novelDir}</p>
        )}
      </div>
    </div>
  )
}
