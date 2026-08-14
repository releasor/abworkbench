import { useCallback, useEffect, useState } from 'react'
import { Keyboard, Languages, FileSearch, Plus, Trash2, RefreshCw, Info } from 'lucide-react'
import ShortcutRecorder from './ShortcutRecorder'
import { SHORTCUT_BY_ID, useShortcutStore } from '../../shortcuts'

interface TranslateProviderConfig {
  id: string
  name: string
  urlTemplate: string
  builtin?: boolean
}

interface LauncherSettingsConfig {
  hotkey: string
  mainWindowHotkey: string
  quickCaptureHotkey: string
  esPath: string
  everythingHttpUrl: string
  defaultProviderId: string
  providers: TranslateProviderConfig[]
}

interface LauncherSettingsProps {
  onToast: (message: string, type: 'success' | 'error' | 'info') => void
}

type EverythingStatus = { installed: boolean; running: boolean; mode: 'cli' | 'http' | null; detail: string } | null

export default function LauncherSettings({ onToast }: LauncherSettingsProps) {
  const [settings, setSettings] = useState<LauncherSettingsConfig | null>(null)
  const [esPathDraft, setEsPathDraft] = useState('')
  const [httpUrlDraft, setHttpUrlDraft] = useState('')
  const [status, setStatus] = useState<EverythingStatus>(null)
  const [checking, setChecking] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [recordingHotkey, setRecordingHotkey] = useState(false)
  const launcherHotkey = useShortcutStore((s) => s.getAccelerator('launcher'))
  const setAccelerator = useShortcutStore((s) => s.setAccelerator)
  const findConflicts = useShortcutStore((s) => s.findConflicts)

  useEffect(() => {
    void window.electronAPI?.getLauncherSettings?.().then((loaded) => {
      if (!loaded) return
      setSettings({
        ...loaded,
        mainWindowHotkey: loaded.mainWindowHotkey || 'Ctrl+Alt+Space',
        quickCaptureHotkey: loaded.quickCaptureHotkey || 'Ctrl+Shift+Space',
      })
      setEsPathDraft(loaded.esPath)
      setHttpUrlDraft(loaded.everythingHttpUrl)
    })
  }, [])

  const persist = useCallback(async (next: LauncherSettingsConfig) => {
    const saved = await window.electronAPI?.setLauncherSettings?.(next)
    if (saved) setSettings(saved)
    return saved
  }, [])

  const saveEsPath = useCallback(async () => {
    if (!settings) return
    const saved = await persist({ ...settings, esPath: esPathDraft.trim(), everythingHttpUrl: httpUrlDraft.trim() })
    if (saved) onToast('Everything 配置已保存', 'success')
  }, [esPathDraft, httpUrlDraft, onToast, persist, settings])

  const setDefaultProvider = useCallback(async (providerId: string) => {
    if (!settings) return
    await persist({ ...settings, defaultProviderId: providerId })
    onToast('默认翻译引擎已更新', 'success')
  }, [onToast, persist, settings])

  const updateProviderUrl = useCallback(async (providerId: string, urlTemplate: string) => {
    if (!settings) return
    const providers = settings.providers.map((p) => (p.id === providerId ? { ...p, urlTemplate } : p))
    setSettings({ ...settings, providers })
  }, [settings])

  const saveProviderUrl = useCallback(async (providerId: string) => {
    if (!settings) return
    const provider = settings.providers.find((p) => p.id === providerId)
    if (!provider || !/^https?:\/\//i.test(provider.urlTemplate)) {
      onToast('翻译入口必须是 http(s) 链接', 'error')
      return
    }
    await persist(settings)
    onToast('翻译入口已保存', 'success')
  }, [onToast, persist, settings])

  const addProvider = useCallback(async () => {
    if (!settings) return
    const name = newName.trim()
    const url = newUrl.trim()
    if (!name || !/^https?:\/\//i.test(url)) {
      onToast('请填写名称和合法的 http(s) 链接', 'error')
      return
    }
    const id = `custom-${Date.now().toString(36)}`
    const providers = [...settings.providers, { id, name, urlTemplate: url }]
    const saved = await persist({ ...settings, providers })
    if (saved) {
      setNewName('')
      setNewUrl('')
      onToast('已添加翻译引擎', 'success')
    }
  }, [newName, newUrl, onToast, persist, settings])

  const removeProvider = useCallback(async (providerId: string) => {
    if (!settings) return
    if (settings.providers.length <= 1) {
      onToast('至少保留一个翻译引擎', 'error')
      return
    }
    const providers = settings.providers.filter((p) => p.id !== providerId)
    const defaultProviderId = settings.defaultProviderId === providerId ? providers[0].id : settings.defaultProviderId
    await persist({ ...settings, providers, defaultProviderId })
    onToast('已删除翻译引擎', 'info')
  }, [onToast, persist, settings])

  const checkEverything = useCallback(async () => {
    setChecking(true)
    try {
      const result = await window.electronAPI?.everythingStatus?.({
        esPath: esPathDraft.trim() || undefined,
        httpUrl: httpUrlDraft.trim() || undefined,
      })
      setStatus(result || null)
    } finally {
      setChecking(false)
    }
  }, [esPathDraft, httpUrlDraft])

  useEffect(() => {
    const timer = window.setTimeout(() => void checkEverything(), 0)
    return () => window.clearTimeout(timer)
  }, [checkEverything])

  if (!settings) {
    return <div className="rounded-[30px] border border-border bg-surface/80 p-6 text-sm text-text-muted">正在读取启动器配置…</div>
  }

  const conflictIds = findConflicts('launcher', launcherHotkey)
  const conflictLabel = conflictIds[0] ? SHORTCUT_BY_ID[conflictIds[0]]?.label : undefined

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
        <div className="flex items-center gap-2 mb-4">
          <Keyboard size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-text">全局召唤</h2>
        </div>
        <p className="text-xs text-text-muted mb-3">
          软件常驻后台（关闭窗口会最小化到系统托盘），随时按快捷键召唤 utools 风格启动器。也可在「快捷键」页统一管理并恢复默认。
        </p>
        <div className="flex items-center gap-3">
          <ShortcutRecorder
            value={launcherHotkey}
            recording={recordingHotkey}
            conflictLabel={conflictLabel}
            onStartRecording={() => setRecordingHotkey(true)}
            onCancel={() => setRecordingHotkey(false)}
            onChange={(next) => {
              setAccelerator('launcher', next)
              setRecordingHotkey(false)
              onToast(`全局快捷键已更新为 ${next}`, 'success')
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-text-muted/70">
          点击后按下新组合键。启动器默认 Alt+Space；主程序窗口请用 Ctrl+Alt+Space（可在「快捷键」页修改）。若被其他软件占用会回退到默认键。
        </p>
      </div>

      <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
        <div className="flex items-center gap-2 mb-4">
          <Languages size={20} className="text-cyan-400" />
          <h2 className="text-lg font-semibold text-text">翻译引擎</h2>
        </div>
        <p className="text-xs text-text-muted mb-4">
          在启动器中输入文字即可翻译。URL 中的 <code className="rounded bg-surface-lighter px-1">{'{q}'}</code> 会被替换为要翻译的内容；不含 <code className="rounded bg-surface-lighter px-1">{'{q}'}</code> 的入口会在页面加载后自动填入文本。
        </p>
        <div className="space-y-2">
          {settings.providers.map((provider) => (
            <div key={provider.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-3">
              <input
                type="radio"
                name="default-provider"
                checked={settings.defaultProviderId === provider.id}
                onChange={() => void setDefaultProvider(provider.id)}
                title="设为默认"
                className="accent-primary"
              />
              <span className="w-24 flex-shrink-0 text-sm font-medium text-text">{provider.name}</span>
              <input
                type="text"
                value={provider.urlTemplate}
                onChange={(e) => updateProviderUrl(provider.id, e.target.value)}
                onBlur={() => void saveProviderUrl(provider.id)}
                className="flex-1 min-w-0 rounded-lg border border-border bg-surface-lighter px-2.5 py-1.5 text-xs text-text-muted outline-none focus:border-primary"
              />
              {settings.providers.length > 1 && (
                <button
                  onClick={() => void removeProvider(provider.id)}
                  title="删除"
                  className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="引擎名称"
            className="w-32 rounded-lg border border-border bg-surface-lighter px-2.5 py-1.5 text-xs text-text outline-none focus:border-primary"
          />
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://…（用 {q} 表示翻译内容）"
            className="flex-1 rounded-lg border border-border bg-surface-lighter px-2.5 py-1.5 text-xs text-text outline-none focus:border-primary"
          />
          <button onClick={() => void addProvider()} className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-xs">
            <Plus size={14} /> 添加
          </button>
        </div>
      </div>

      <div className="rounded-[30px] border border-border bg-surface/80 p-6 shadow-xl shadow-black/5">
        <div className="flex items-center gap-2 mb-4">
          <FileSearch size={20} className="text-emerald-400" />
          <h2 className="text-lg font-semibold text-text">Everything 全局搜索</h2>
        </div>
        <p className="text-xs text-text-muted mb-3">
          接入 voidtools Everything 实现全盘文件秒搜。优先使用 es.exe（命令行）；找不到时自动改用下方 HTTP 服务。安装包已内置便携版 Everything，首次搜索会自动复制到用户目录并拉起，无需单独安装。
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-28 flex-shrink-0 text-xs text-text-muted">es.exe 路径</span>
            <input
              type="text"
              value={esPathDraft}
              onChange={(e) => setEsPathDraft(e.target.value)}
              placeholder="自动检测（如 C:\Program Files\Everything\es.exe）"
              className="flex-1 rounded-xl border border-border bg-surface-lighter px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 flex-shrink-0 text-xs text-text-muted">HTTP 服务地址</span>
            <input
              type="text"
              value={httpUrlDraft}
              onChange={(e) => setHttpUrlDraft(e.target.value)}
              placeholder="http://127.0.0.1:23581"
              className="flex-1 rounded-xl border border-border bg-surface-lighter px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => void saveEsPath()} className="btn-primary px-4 py-2 text-sm">保存</button>
          <button
            onClick={() => void checkEverything()}
            disabled={checking}
            className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> 检测
          </button>
        </div>
        {status && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Info size={13} className={status.installed && status.running ? 'text-success' : 'text-warning'} />
            <span className="text-text-muted">{status.detail}</span>
          </div>
        )}
      </div>
    </div>
  )
}
