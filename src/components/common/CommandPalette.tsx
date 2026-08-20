import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Search,
  LayoutDashboard,
  CheckSquare,
  Timer,
  Target,
  StickyNote,
  Cloud,
  Keyboard,
  Settings,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Upload,
  Quote,
  FolderKanban,
  Wallet,
  HeartPulse,
  Bell,
  Palette,
  FileText,
  BookOpen,
  PictureInPicture2,
  PenLine,
  Zap,
  Radio,
} from 'lucide-react'
import type { Page } from '../layout/Sidebar'
import { useStore } from '../../store'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { useTranslation } from '../../i18n'
import { getRandomQuote } from '../../utils/quotes'
import { dayNumToDateStr } from '../../utils/format'
import { generateId } from '../../utils/id'
import { createDesktopBackup, downloadJsonBackup, getLegacyOrCurrentData, restoreTaskFlowBackup } from '../../utils/desktopBackup'
import { buildCommandCenterSuggestions, type CommandCenterSuggestion } from './commandCenter'
import { buildCommandMacroSuggestions, type CommandMacroSuggestion } from './commandMacros'
import { runLocalMacro } from './commandMacroRunner'
import { buildGlobalSearchResults, type GlobalSearchResult } from '../../utils/globalSearch'
import { buildQuickCreateDueAt, buildQuickCreateSubtasks, parseQuickCreateInput } from '../../modules/taskflow/utils/quickCreateParser'
import { appendLocalCollection, readLocalCollection } from '../../utils/localData'
import { getRecentCommandIds, recordCommandUse, sortCommandsByUsage } from './commandUsage'
import { formatLocalDateTimeMinute } from '../../modules/taskflow/dateUtils'
import { showToast } from '../../modules/taskflow/utils/toastEvent'
import clsx from 'clsx'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  pages: Page[]
  pageTitles: Record<Page, string>
  onNavigate: (page: Page) => void
  onOpenQuickCapture?: () => void
}

const pageIcons: Record<Page, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  taskflow: CheckSquare,
  pomodoro: Timer,
  habits: Target,
  notes: StickyNote,
  reminders: Bell,
  weather: Cloud,
  mineradio: Radio,
  settings: Settings,
}

const pageShortcuts: Partial<Record<Page, string>> = {
  dashboard: 'Ctrl+1',
  taskflow: 'Ctrl+2',
  pomodoro: 'Ctrl+3',
  habits: 'Ctrl+4',
  notes: 'Ctrl+5',
  reminders: 'Ctrl+6',
  weather: 'Ctrl+7',
  mineradio: 'Ctrl+8',
  settings: 'Ctrl+9',
}

interface Command {
  id: string
  label: string
  description?: string
  icon: typeof LayoutDashboard
  shortcut?: string
  action: () => void
  category: string
}

function makeCommandId(prefix: string): string {
  return `${prefix}-${generateId()}`
}

function appendWorkspaceReminder(input: { title: string; body: string; dueAt: string; repeat: string; projectId?: string }) {
  appendLocalCollection('abworkbench-reminders', {
    id: makeCommandId('reminder'),
    title: input.title,
    body: input.body,
    dueAt: input.dueAt,
    repeat: input.repeat,
    done: false,
    projectId: input.projectId,
  })
}

function getSuggestionIcon(suggestion: CommandCenterSuggestion): typeof LayoutDashboard {
  if (suggestion.kind === 'create-task') return CheckSquare
  if (suggestion.kind === 'create-note') return StickyNote
  if (suggestion.kind === 'quick-expense') return Wallet
  if (suggestion.kind === 'quick-health') return HeartPulse
  if (suggestion.kind === 'quick-reminder') return Bell
  return FileText
}

function getSearchResultIcon(result: GlobalSearchResult): typeof LayoutDashboard {
  if (result.type === 'task') return CheckSquare
  if (result.type === 'note') return StickyNote
  if (result.type === 'habit') return Target
  if (result.type === 'file') return FileText
  return FolderKanban
}

function readIndexedFilesForSearch(): Array<{ id: string; name: string; path: string; projectId?: string }> {
  return readLocalCollection('abworkbench-indexed-files', [])
}

export default function CommandPalette({ isOpen, onClose, pages, pageTitles, onNavigate, onOpenQuickCapture }: CommandPaletteProps) {
  const { t, tWith } = useTranslation()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeQuote, setActiveQuote] = useState<{ text: string; author: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const addNote = useStore((s) => s.addNote)
  const updateNote = useStore((s) => s.updateNote)
  const setActiveNote = useStore((s) => s.setActiveNote)
  const notes = useStore((s) => s.notes)
  const habits = useStore((s) => s.habits)
  const toggleThemeMode = useStore((s) => s.toggleThemeMode)
  const themeMode = useStore((s) => s.themeMode)
  const workspaceMode = useStore((s) => s.workspaceMode)
  const tasks = useTaskStore((s) => s.tasks)
  const categories = useTaskStore((s) => s.categories)
  const setTaskFilters = useTaskStore((s) => s.setFilters)
  const createTask = useTaskStore((s) => s.createTask)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed)
  const clearCompletedTodos = useStore((s) => s.clearCompletedTodos)
  const legacyCompletedCount = useStore((s) => {
    let count = 0
    for (const todo of s.todos) {
      if (todo.completed) count++
    }
    return count
  })
  const taskFlowCompletedCount = useTaskStore((s) => s.tasks.reduce((n, task) => (
    task.status === 'done' && !task.archived ? n + 1 : n
  ), 0))
  const completedCount = Math.max(legacyCompletedCount, taskFlowCompletedCount)

  const createNoteWithContent = useCallback((title: string, content: string) => {
    addNote()
    const noteId = useStore.getState().activeNoteId
    if (noteId) {
      updateNote(noteId, { title, content })
      setActiveNote(noteId)
    }
    onNavigate('notes')
    onClose()
  }, [addNote, onClose, onNavigate, setActiveNote, updateNote])

  const executeSuggestion = useCallback((suggestion: CommandCenterSuggestion) => {
    const timestamp = new Date().toLocaleString('zh-CN')
    if (suggestion.kind === 'create-task') {
      const parsed = parseQuickCreateInput(suggestion.payload, { projects: categories })
      void createTask({
        title: parsed.title || suggestion.payload,
        description: parsed.raw,
        category: parsed.projectId,
        tags: parsed.tags,
        dueDate: parsed.dueDate,
        estimatedMinutes: parsed.estimatedMinutes,
        energyLevel: parsed.energyLevel,
        nextAction: parsed.subtasks[0] || parsed.title,
        subtasks: buildQuickCreateSubtasks(parsed),
      })
      onNavigate('taskflow')
      onClose()
      return
    }
    if (suggestion.kind === 'create-note') {
      createNoteWithContent(suggestion.payload, '')
      return
    }
    if (suggestion.kind === 'quick-expense') {
      createNoteWithContent(`支出 - ${timestamp}`, `#支出\n\n- ${suggestion.payload}\n- 记录时间：${timestamp}`)
      return
    }
    if (suggestion.kind === 'quick-health') {
      createNoteWithContent(`健康 - ${timestamp}`, `#健康\n\n- ${suggestion.payload}\n- 记录时间：${timestamp}`)
      return
    }
    if (suggestion.kind === 'quick-reminder') {
      const parsed = parseQuickCreateInput(`提醒 ${suggestion.payload}`, { projects: categories })
      appendWorkspaceReminder({
        title: parsed.title || suggestion.payload,
        body: `Ctrl+K 创建：${suggestion.payload}\n记录时间：${timestamp}`,
        dueAt: buildQuickCreateDueAt(parsed) || formatLocalDateTimeMinute(new Date(Date.now() + 60 * 60 * 1000)),
        repeat: parsed.repeat,
        projectId: parsed.projectId,
      })
      onNavigate('dashboard')
      onClose()
      return
    }
    if (suggestion.kind === 'open-note' && suggestion.noteId) {
      setActiveNote(suggestion.noteId)
      onNavigate('notes')
      onClose()
    }
  }, [categories, createNoteWithContent, createTask, onClose, onNavigate, setActiveNote])

  const executeSearchResult = useCallback((result: GlobalSearchResult) => {
    if (result.type === 'task') {
      setTaskFilters({ search: result.title })
      onNavigate('taskflow')
    } else if (result.type === 'note') {
      setActiveNote(result.targetId)
      onNavigate('notes')
    } else if (result.type === 'habit') {
      try {
        sessionStorage.setItem('abworkbench-focus-habit', result.targetId)
      } catch {
        // ignore storage failures
      }
      onNavigate('habits')
    } else if (result.type === 'file') {
      void window.electronAPI?.openTarget?.(result.targetId)
    } else {
      setTaskFilters({ category: result.targetId })
      onNavigate('taskflow')
    }
    onClose()
  }, [onClose, onNavigate, setActiveNote, setTaskFilters])

  const executeMacro = useCallback((macro: CommandMacroSuggestion) => {
    const result = runLocalMacro(macro.id)
    if (macro.id === 'macro-evening-review') {
      const timestamp = new Date().toLocaleString('zh-CN')
      createNoteWithContent(`晚间复盘 - ${timestamp.slice(0, 10)}`, `# 晚间复盘\n\n- 完成：\n- 拖延：\n- 明天优先：\n\n创建时间：${timestamp}`)
      return
    }
    // TaskFlow macros: navigate then dispatch so TaskFlowPage can open filters/modals
    const taskflowMacros = new Set([
      'macro-daily-review',
      'macro-weekly-report',
      'macro-focus-mode',
      'macro-bulk-import',
      'macro-project-scan',
      'macro-clear-inbox',
      'macro-start-work',
    ])
    if (taskflowMacros.has(macro.id)) {
      onNavigate(result.targetPage)
      onClose()
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('abworkbench:macro', { detail: { id: macro.id } }))
      }, 120)
      return
    }
    onNavigate(result.targetPage)
    onClose()
  }, [createNoteWithContent, onClose, onNavigate])

  const commands: Command[] = useMemo(() => [
    ...pages.map((page) => ({
      id: `nav-${page}`,
      label: pageTitles[page],
      description: tWith('command.switchTo', pageTitles[page]),
      icon: pageIcons[page],
      shortcut: pageShortcuts[page],
      action: () => onNavigate(page),
      category: t('command.navigate'),
    })),
    {
      id: 'add-todo',
      label: t('command.quickAddTask'),
      description: t('command.quickAddTaskDesc'),
      icon: Plus,
      action: () => {
        if (onOpenQuickCapture) onOpenQuickCapture()
        else onNavigate('taskflow')
      },
      category: t('command.action'),
    },
    {
      id: 'new-note',
      label: t('command.addNote'),
      description: t('command.newNoteDesc'),
      icon: StickyNote,
      shortcut: 'Ctrl+N',
      action: () => {
        addNote()
        onNavigate('notes')
      },
      category: t('command.action'),
    },
    {
      id: 'start-pomodoro',
      label: t('command.startFocus'),
      description: t('command.startFocusDesc'),
      icon: Timer,
      action: () => {
        onNavigate('pomodoro')
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('abworkbench:pomodoro-start'))
        }, 120)
        onClose()
      },
      category: t('command.action'),
    },
    {
      id: 'daily-brief',
      label: '今日作战板',
      description: '打开今日任务、提醒与番茄摘要',
      icon: Zap,
      action: () => {
        window.dispatchEvent(new CustomEvent('abworkbench:daily-brief', { detail: { mode: 'morning' } }))
        onClose()
      },
      category: t('command.action'),
    },
    {
      id: 'evening-review',
      label: '晚间复盘',
      description: '打开晚间复盘并生成笔记',
      icon: FileText,
      action: () => {
        window.dispatchEvent(new CustomEvent('abworkbench:daily-brief', { detail: { mode: 'evening' } }))
        onClose()
      },
      category: t('command.action'),
    },
    {
      id: 'stealth-reader',
      label: t('command.openStealthReader'),
      description: t('command.openStealthReaderDesc'),
      icon: BookOpen,
      action: () => {
        void window.electronAPI?.openReader?.({ mode: 'auto' })
        onClose()
      },
      category: t('command.action'),
    },
    {
      id: 'stealth-reader-library',
      label: '打开摸鱼书架',
      description: '直接进入摸鱼阅读书架管理',
      icon: BookOpen,
      action: () => {
        void window.electronAPI?.openReader?.({ mode: 'library' })
        onClose()
      },
      category: t('command.action'),
    },
    {
      id: 'open-mini',
      label: '打开迷你窗',
      description: '悬浮小窗查看任务与提醒',
      icon: PictureInPicture2,
      action: () => {
        void window.electronAPI?.openMiniWindow?.()
        onClose()
      },
      category: t('command.action'),
    },
    {
      id: 'quick-capture',
      label: '快速捕获',
      description: '快速记下任务、笔记或提醒',
      icon: PenLine,
      action: () => {
        if (onOpenQuickCapture) onOpenQuickCapture()
        else void window.electronAPI?.openQuickCapture?.()
        onClose()
      },
      category: t('command.action'),
    },
    {
      id: 'toggle-theme',
      label: themeMode === 'dark' ? '切换到浅色主题' : '切换到深色主题',
      description: '立即切换当前界面主题',
      icon: Palette,
      action: () => {
        toggleThemeMode()
        onClose()
      },
      category: t('command.interface'),
    },
    {
      id: 'quick-expense-template',
      label: '快速记录支出',
      description: '输入示例：支出 午餐 36',
      icon: Wallet,
      action: () => setQuery('支出 '),
      category: t('command.action'),
    },
    {
      id: 'quick-health-template',
      label: '快速记录健康',
      description: '输入示例：健康 跑步 20 分钟',
      icon: HeartPulse,
      action: () => setQuery('健康 '),
      category: t('command.action'),
    },
    {
      id: 'quick-reminder-template',
      label: '快速记录提醒',
      description: '输入示例：提醒 明天 10 点交材料',
      icon: Bell,
      action: () => setQuery('提醒 '),
      category: t('command.action'),
    },
    {
      id: 'toggle-sidebar',
      label: sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapseSidebar'),
      description: t('command.toggleSidebarDesc'),
      icon: sidebarCollapsed ? PanelLeftOpen : PanelLeftClose,
      action: () => {
        toggleSidebar()
        onClose()
      },
      category: t('command.interface'),
    },
    {
      id: 'export-data',
      label: t('command.exportData'),
      description: t('command.exportDataDesc'),
      icon: Download,
      action: () => {
        const state = useStore.getState()
        const data = createDesktopBackup({
          todos: state.todos,
          notes: state.notes,
          pomodoroSessions: state.pomodoroSessions,
          habits: state.habits,
          userName: state.userName,
          accentColor: state.accentColor,
          themeMode: state.themeMode,
          dailyPomodoroGoal: state.dailyPomodoroGoal,
          pomodoroWorkDuration: state.pomodoroWorkDuration,
          pomodoroShortBreakDuration: state.pomodoroShortBreakDuration,
          pomodoroLongBreakDuration: state.pomodoroLongBreakDuration,
          pomodoroSoundEnabled: state.pomodoroSoundEnabled,
          pomodoroAutoStartBreaks: state.pomodoroAutoStartBreaks,
          pomodoroAutoStartWork: state.pomodoroAutoStartWork,
          weatherAutoLocate: state.weatherAutoLocate,
        })
        downloadJsonBackup(data, `abworkbench-backup-${dayNumToDateStr(Math.floor(Date.now() / 86400000))}.json`)
        onClose()
      },
      category: t('command.data'),
    },
    {
      id: 'import-data',
      label: t('command.importData'),
      description: t('command.importDataDesc'),
      icon: Upload,
      action: () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = (event) => {
          const file = (event.target as HTMLInputElement).files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = (readerEvent) => {
            try {
              const json = JSON.parse(readerEvent.target?.result as string)
              const data = getLegacyOrCurrentData(json)
              useStore.setState({
                ...(Array.isArray(data.todos) && { todos: data.todos }),
                ...(Array.isArray(data.notes) && { notes: data.notes }),
                ...(Array.isArray(data.pomodoroSessions) && { pomodoroSessions: data.pomodoroSessions }),
                ...(Array.isArray(data.habits) && { habits: data.habits }),
                ...(typeof data.userName === 'string' && { userName: data.userName }),
                ...(typeof data.accentColor === 'string' && { accentColor: data.accentColor }),
                ...(typeof data.dailyPomodoroGoal === 'number' && data.dailyPomodoroGoal > 0 && { dailyPomodoroGoal: data.dailyPomodoroGoal }),
                ...(typeof data.pomodoroWorkDuration === 'number' && data.pomodoroWorkDuration > 0 && {
                  pomodoroWorkDuration: data.pomodoroWorkDuration,
                  pomodoroShortBreakDuration: typeof data.pomodoroShortBreakDuration === 'number' ? data.pomodoroShortBreakDuration : 5,
                  pomodoroLongBreakDuration: typeof data.pomodoroLongBreakDuration === 'number' ? data.pomodoroLongBreakDuration : 15,
                }),
                ...(typeof data.pomodoroSoundEnabled === 'boolean' && { pomodoroSoundEnabled: data.pomodoroSoundEnabled }),
                ...(typeof data.pomodoroAutoStartBreaks === 'boolean' && { pomodoroAutoStartBreaks: data.pomodoroAutoStartBreaks }),
                ...(typeof data.pomodoroAutoStartWork === 'boolean' && { pomodoroAutoStartWork: data.pomodoroAutoStartWork }),
                ...(typeof data.weatherAutoLocate === 'boolean' && { weatherAutoLocate: data.weatherAutoLocate }),
              })
              restoreTaskFlowBackup(json)
            } catch {
              // Ignore invalid backup files.
            }
          }
          reader.readAsText(file)
        }
        input.click()
        onClose()
      },
      category: t('command.data'),
    },
    {
      id: 'clear-completed',
      label: t('command.clearCompleted'),
      description: tWith('command.clearCompletedDesc', completedCount),
      icon: CheckSquare,
      action: () => {
        const doneIds = useTaskStore.getState().tasks
          .filter((task) => task.status === 'done' && !task.archived)
          .map((task) => task.id)
        if (doneIds.length === 0) {
          clearCompletedTodos()
          showToast('没有可归档的已完成任务', 'info')
          onClose()
          return
        }
        useTaskStore.setState({ selectedIds: new Set(doneIds) })
        void useTaskStore.getState().batchArchive().then(() => {
          clearCompletedTodos()
          showToast(`已归档 ${doneIds.length} 个已完成任务`, 'success')
        }).catch(() => {
          showToast('归档失败，请稍后重试', 'error')
        })
        onClose()
      },
      category: t('command.action'),
    },
    {
      id: 'random-quote',
      label: t('command.randomQuote'),
      description: t('command.randomQuoteDesc'),
      icon: Quote,
      action: () => setActiveQuote(getRandomQuote()),
      category: t('command.action'),
    },
    {
      id: 'shortcuts',
      label: t('shortcuts.title'),
      description: t('command.shortcutsDesc'),
      icon: Keyboard,
      action: () => onNavigate('settings'),
      category: t('command.help'),
    },
  ], [pages, pageTitles, onNavigate, onClose, onOpenQuickCapture, addNote, toggleSidebar, sidebarCollapsed, clearCompletedTodos, completedCount, t, tWith, themeMode, toggleThemeMode])

  const dynamicCommands: Command[] = useMemo(() => {
    const macroCommands = buildCommandMacroSuggestions(query).map((macro) => ({
      id: macro.id,
      label: macro.label,
      description: `${macro.description} 步骤：${macro.steps.join(' / ')}`,
      icon: Keyboard,
      action: () => executeMacro(macro),
      category: '宏命令',
    }))
    const actionCommands = buildCommandCenterSuggestions(query, notes).map((suggestion) => ({
      id: suggestion.id,
      label: suggestion.label,
      description: suggestion.description,
      icon: getSuggestionIcon(suggestion),
      action: () => executeSuggestion(suggestion),
      category: suggestion.kind === 'open-note' ? '笔记搜索' : '快速行动',
    }))
    const searchCommands = buildGlobalSearchResults(query, {
      tasks,
      notes,
      habits,
      projects: categories,
      files: readIndexedFilesForSearch(),
    }).map((result) => ({
      id: `global-${result.type}-${result.id}`,
      label: `${result.type === 'task' ? '任务' : result.type === 'note' ? '笔记' : result.type === 'habit' ? '习惯' : '项目'}：${result.title}`,
      description: result.description,
      icon: getSearchResultIcon(result),
      action: () => executeSearchResult(result),
      category: '全局搜索',
    }))
    return [...macroCommands, ...actionCommands, ...searchCommands]
  }, [categories, executeMacro, executeSearchResult, executeSuggestion, habits, notes, query, tasks])

  const filtered = useMemo(() => {
    const normalizedQuery = query.toLowerCase()
    const matchedCommands = normalizedQuery
      ? commands.filter(
        (command) =>
          command.label.toLowerCase().includes(normalizedQuery) ||
          command.description?.toLowerCase().includes(normalizedQuery) ||
          command.category.toLowerCase().includes(normalizedQuery) ||
          command.shortcut?.toLowerCase().includes(normalizedQuery)
      )
      : commands
    const merged = normalizedQuery ? sortCommandsByUsage([...dynamicCommands, ...matchedCommands]) : sortCommandsByUsage(matchedCommands)
    if (workspaceMode !== 'deep') return merged
    return merged.filter(
      (command) => command.id !== 'stealth-reader' && command.id !== 'stealth-reader-library',
    )
  }, [commands, dynamicCommands, query, workspaceMode])

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        setQuery('')
        setSelectedIndex(0)
        setActiveQuote(null)
      })
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedIndex(0)
    })
  }, [query])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (event.key === 'Enter' && filtered[selectedIndex]) {
      event.preventDefault()
      recordCommandUse(filtered[selectedIndex].id)
      filtered[selectedIndex].action()
    } else if (event.key === 'Escape') {
      onClose()
    } else if (event.key >= '1' && event.key <= '9' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const index = parseInt(event.key) - 1
      if (index < filtered.length) {
        event.preventDefault()
        recordCommandUse(filtered[index].id)
        filtered[index].action()
      }
    }
  }

  if (!isOpen) return null

  const recentIds = getRecentCommandIds(undefined, 5)
  const recentCommands = !query
    ? recentIds
      .map((id) => commands.find((command) => command.id === id))
      .filter(Boolean) as Command[]
    : []
  const grouped: Record<string, Command[]> = {}
  for (const command of filtered) {
    if (!grouped[command.category]) grouped[command.category] = []
    grouped[command.category].push(command)
  }
  const displayGroups: [string, Command[]][] = !query && recentCommands.length > 0
    ? [[t('command.recent'), recentCommands], ...Object.entries(grouped)]
    : Object.entries(grouped)

  let flatIndex = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 modal-veil" />

      <div
        className="relative w-full max-w-lg glass-card overflow-hidden modal-panel-cinematic"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('shortcuts.commandPalette')}
      >
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search size={18} className="text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('command.searchPlaceholder')}
            aria-label={t('command.search')}
            className="flex-1 bg-transparent py-4 text-text outline-none placeholder:text-text-muted"
          />
          <kbd className="px-2 py-0.5 text-xs text-text-muted bg-surface rounded border border-border">
            ESC
          </kbd>
        </div>

        {activeQuote && (
          <div className="px-4 py-3 border-b border-border bg-primary/5">
            <p className="text-sm text-text italic leading-relaxed">"{activeQuote.text}"</p>
            <p className="text-xs text-text-muted mt-1.5 text-right">— {activeQuote.author}</p>
          </div>
        )}

        <div className="max-h-[300px] overflow-y-auto p-2" role="listbox">
          {displayGroups.map(([category, groupCommands]) => (
            <div key={category}>
              <div className="px-3 py-1.5 text-xs text-text-muted font-medium">{category}</div>
              {groupCommands.map((command) => {
                const Icon = command.icon
                const currentIndex = flatIndex++
                const isSelected = currentIndex === selectedIndex

                return (
                  <button
                    key={command.id}
                    onClick={() => {
                      recordCommandUse(command.id)
                      command.action()
                    }}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                    role="option"
                    aria-selected={isSelected}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                      isSelected ? 'bg-primary/15 text-text' : 'text-text-muted hover:bg-surface-lighter'
                    )}
                  >
                    {currentIndex < 9 && (
                      <span className={`text-[10px] font-mono w-4 text-center ${isSelected ? 'text-primary' : 'text-text-muted/50'}`}>
                        {currentIndex + 1}
                      </span>
                    )}
                    <Icon size={18} className={isSelected ? 'text-primary' : ''} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{command.label}</div>
                      {command.description && (
                        <div className="text-xs text-text-muted truncate">{command.description}</div>
                      )}
                    </div>
                    {command.shortcut && (
                      <kbd className="px-2 py-0.5 text-xs text-text-muted bg-surface rounded border border-border">
                        {command.shortcut}
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-text-muted">
              {t('command.noCommands')}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-text-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-surface rounded border border-border text-[10px]">↑↓</kbd>
              {t('command.navigate')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-surface rounded border border-border text-[10px]">↵</kbd>
              {t('command.select')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-surface rounded border border-border text-[10px]">1-9</kbd>
              {t('command.quick')}
            </span>
          </div>
          <span>{tWith('command.results', filtered.length)}</span>
        </div>
      </div>
    </div>
  )
}
