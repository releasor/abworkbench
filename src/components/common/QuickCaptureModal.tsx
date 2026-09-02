import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CheckSquare, HeartPulse, History, StickyNote, Wallet, X, Zap } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../../store'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { buildQuickCreateDueAt, buildQuickCreateSubtasks, parseQuickCreateInput } from '../../modules/taskflow/utils/quickCreateParser'
import { showToast } from '../../modules/taskflow/utils/toastEvent'
import { appendLocalCollection } from '../../utils/localData'
import { useShortcutStore } from '../../shortcuts'
import { formatLocalDateTimeMinute } from '../../modules/taskflow/dateUtils'
import { listCaptureHistory, pushCaptureHistory } from '../../utils/captureHistory'
import { generateId } from '../../utils/id'

interface QuickCaptureModalProps {
  isOpen: boolean
  onClose: () => void
}

type CaptureMode = 'task' | 'note' | 'reminder' | 'expense' | 'health'

const MODES: Array<{ id: CaptureMode; label: string; icon: typeof Zap }> = [
  { id: 'task', label: '任务', icon: CheckSquare },
  { id: 'note', label: '笔记', icon: StickyNote },
  { id: 'reminder', label: '提醒', icon: Bell },
  { id: 'expense', label: '支出', icon: Wallet },
  { id: 'health', label: '健康', icon: HeartPulse },
]

export default function QuickCaptureModal({ isOpen, onClose }: QuickCaptureModalProps) {
  const [mode, setMode] = useState<CaptureMode>('task')
  const [text, setText] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const createTask = useTaskStore((state) => state.createTask)
  const createCategory = useTaskStore((state) => state.createCategory)
  const categories = useTaskStore((state) => state.categories)
  const addNote = useStore((state) => state.addNote)
  const updateNote = useStore((state) => state.updateNote)
  const quickCaptureHotkey = useShortcutStore((s) => s.getAccelerator('quickCapture'))
  const history = useMemo(() => (isOpen ? listCaptureHistory() : []), [isOpen])

  useEffect(() => {
    if (!isOpen) return
    window.setTimeout(() => inputRef.current?.focus(), 30)
    let cancelled = false
    void window.electronAPI?.readClipboard?.().then((clip) => {
      if (cancelled || !clip?.text) return
      setText((prev) => prev || clip.text.slice(0, 2000))
    }).catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const remember = (itemMode: CaptureMode, title: string, raw: string) => {
    pushCaptureHistory({ id: `cap-${generateId()}`, mode: itemMode, title, raw, createdAt: Date.now() })
  }

  const submit = async () => {
    const value = text.trim()
    if (!value) return

    if (mode === 'note') {
      addNote()
      const note = useStore.getState().notes[0]
      if (note) updateNote(note.id, { title: value.split('\n')[0].slice(0, 36) || '快速笔记', content: value })
      remember('note', value.slice(0, 36), value)
      showToast('已保存快速笔记', 'success')
    } else if (mode === 'expense') {
      addNote()
      const note = useStore.getState().notes[0]
      const title = `支出 - ${value.slice(0, 24)}`
      if (note) updateNote(note.id, { title, content: `#支出\n\n- ${value}\n- 记录时间：${formatLocalDateTimeMinute()}` })
      remember('expense', title, value)
      showToast('已记录支出', 'success')
    } else if (mode === 'health') {
      addNote()
      const note = useStore.getState().notes[0]
      const title = `健康 - ${value.slice(0, 24)}`
      if (note) updateNote(note.id, { title, content: `#健康\n\n- ${value}\n- 记录时间：${formatLocalDateTimeMinute()}` })
      remember('health', title, value)
      showToast('已记录健康', 'success')
    } else if (mode === 'reminder') {
      const parsed = parseQuickCreateInput(`提醒 ${value}`, { projects: categories })
      appendLocalCollection('abworkbench-reminders', {
        id: `reminder-${generateId()}`,
        title: parsed.title || value,
        dueAt: buildQuickCreateDueAt(parsed) || formatLocalDateTimeMinute(new Date(Date.now() + 60 * 60 * 1000)),
        repeat: parsed.repeat,
        done: false,
        projectId: parsed.projectId,
      })
      remember('reminder', parsed.title || value, value)
      showToast('已保存提醒', 'success')
    } else {
      const parsed = parseQuickCreateInput(value, { projects: categories })
      if (parsed.kind === 'note') {
        addNote()
        const note = useStore.getState().notes[0]
        if (note) updateNote(note.id, { title: parsed.title || value.slice(0, 36), content: parsed.raw })
        remember('note', parsed.title || value, value)
        showToast('已保存快速笔记', 'success')
      } else if (parsed.kind === 'reminder') {
        appendLocalCollection('abworkbench-reminders', {
          id: `reminder-${generateId()}`,
          title: parsed.title || value,
          dueAt: buildQuickCreateDueAt(parsed) || formatLocalDateTimeMinute(new Date(Date.now() + 60 * 60 * 1000)),
          repeat: parsed.repeat,
          done: false,
          projectId: parsed.projectId,
        })
        remember('reminder', parsed.title || value, value)
        showToast('已保存提醒', 'success')
      } else if (parsed.kind === 'project') {
        await createCategory({ name: parsed.title || value, color: '#3b82f6', icon: 'folder' })
        showToast('已创建项目', 'success')
      } else {
        await createTask({
          title: parsed.title || value,
          description: parsed.raw,
          status: 'todo',
          priority: parsed.raw.includes('紧急') || parsed.raw.includes('高优先') ? 'high' : 'medium',
          category: parsed.projectId || categories[0]?.id || 'cat-work',
          tags: parsed.tags,
          dueDate: parsed.dueDate,
          estimatedMinutes: parsed.estimatedMinutes,
          energyLevel: parsed.energyLevel,
          nextAction: parsed.subtasks[0] || parsed.title,
          subtasks: buildQuickCreateSubtasks(parsed),
          recurring: null,
        })
        remember('task', parsed.title || value, value)
        showToast('已快速创建任务', 'success')
      }
    }

    setText('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button className="absolute inset-0 modal-veil liquid-glass-veil" onClick={onClose} aria-label="关闭快速捕获" />
      <section className="liquid-glass-panel modal-panel-cinematic relative w-full max-w-xl overflow-hidden p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/15 p-3 text-primary"><Zap className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-semibold text-text">全能 Inbox</h2>
              <p className="text-xs text-text-muted">{quickCaptureHotkey} · 支持任务/笔记/提醒/支出/健康</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setShowHistory((v) => !v)} className="rounded-xl p-2 text-text-muted hover:bg-white/10" title="捕获历史"><History size={16} /></button>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-text-muted hover:bg-white/10"><X size={16} /></button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {MODES.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={clsx('segment-tab interactive-press inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold', mode === item.id ? 'bg-primary/20 text-primary' : 'liquid-glass-chip text-text-muted')}
              >
                <Icon size={12} />{item.label}
              </button>
            )
          })}
        </div>

        {showHistory && (
          <div className="mb-3 max-h-32 space-y-1 overflow-auto rounded-2xl liquid-glass-chip p-2">
            {history.length === 0 ? <p className="px-2 py-1 text-xs text-text-muted">暂无历史</p> : history.map((item) => (
              <button key={item.id} type="button" className="block w-full truncate rounded-xl px-2 py-1 text-left text-xs text-text hover:bg-white/10" onClick={() => { setMode(item.mode); setText(item.raw); setShowHistory(false) }}>
                [{item.mode}] {item.title}
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void submit()
            }
          }}
          placeholder={mode === 'task' ? '任务内容，可用：明天 / 紧急 / 标签#工作 / 子项' : mode === 'reminder' ? '提醒内容，可用：明天下午3点 / 每周' : '输入内容…'}
          className="min-h-[120px] w-full resize-none rounded-2xl liquid-glass-chip px-4 py-3 text-sm text-text outline-none focus:border-primary/40"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-text-muted">Ctrl/Cmd + Enter 提交 · 到期按北京时间</p>
          <button type="button" onClick={() => void submit()} className="btn-primary rounded-2xl px-4 py-2 text-sm font-semibold">保存</button>
        </div>
      </section>
    </div>
  )
}
