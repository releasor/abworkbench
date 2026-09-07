export type ShortcutScope = 'global' | 'page'

export interface ShortcutDefinition {
  id: string
  group: string
  label: string
  defaultAccelerator: string
  scope: ShortcutScope
  /** Electron globalShortcut (main process) */
  electron?: boolean
}

/** Canonical catalog — defaults and settings UI source of truth. */
export const SHORTCUT_CATALOG: ShortcutDefinition[] = [
  // Global
  { id: 'launcher', group: '全局', label: '打开启动器', defaultAccelerator: 'Alt+Space', scope: 'global', electron: true },
  { id: 'mainWindow', group: '全局', label: '显示 / 隐藏主程序窗口', defaultAccelerator: 'Ctrl+Alt+Space', scope: 'global', electron: true },
  { id: 'readerBossKey', group: '全局', label: '阅读老板键', defaultAccelerator: 'Ctrl+Shift+Q', scope: 'global', electron: true },
  { id: 'commandPalette', group: '全局', label: '打开命令面板', defaultAccelerator: 'Ctrl+K', scope: 'global' },
  { id: 'toggleSidebar', group: '全局', label: '切换侧边栏', defaultAccelerator: 'Ctrl+B', scope: 'global' },
  { id: 'pageDashboard', group: '全局', label: '切换到仪表盘', defaultAccelerator: 'Ctrl+1', scope: 'global' },
  { id: 'pageTaskflow', group: '全局', label: '切换到工作台', defaultAccelerator: 'Ctrl+2', scope: 'global' },
  { id: 'pageReminders', group: '全局', label: '切换到提醒', defaultAccelerator: 'Ctrl+6', scope: 'global' },
  { id: 'pageHotlist', group: '全局', label: '切换到今日热榜', defaultAccelerator: 'Ctrl+3', scope: 'global' },
  { id: 'pageMineradio', group: '全局', label: '切换到 Mineradio', defaultAccelerator: 'Ctrl+4', scope: 'global' },
  { id: 'pageSettings', group: '全局', label: '切换到设置', defaultAccelerator: 'Ctrl+5', scope: 'global' },
  { id: 'escapeClose', group: '全局', label: '关闭启动器 / 弹窗', defaultAccelerator: 'Escape', scope: 'global' },

  // Dashboard
  { id: 'dashboardQuickAdd', group: '仪表盘', label: '快速添加任务', defaultAccelerator: 'N', scope: 'page' },

  // Pomodoro
  { id: 'pomodoroToggle', group: '番茄钟', label: '开始 / 暂停', defaultAccelerator: 'Space', scope: 'page' },
  { id: 'pomodoroReset', group: '番茄钟', label: '重置计时器', defaultAccelerator: 'R', scope: 'page' },
  { id: 'pomodoroSkipBreak', group: '番茄钟', label: '跳过休息', defaultAccelerator: 'S', scope: 'page' },
  { id: 'pomodoroAmbient', group: '番茄钟', label: '环境音面板', defaultAccelerator: 'A', scope: 'page' },

  // Habits
  { id: 'habitsAdd', group: '每日打卡', label: '添加新的打卡项', defaultAccelerator: 'N', scope: 'page' },

  // Notes
  { id: 'notesNew', group: '笔记', label: '新建笔记', defaultAccelerator: 'N', scope: 'page' },
  { id: 'notesSearch', group: '笔记', label: '搜索笔记', defaultAccelerator: 'F', scope: 'page' },
  { id: 'notesClose', group: '笔记', label: '关闭当前笔记', defaultAccelerator: 'Escape', scope: 'page' },
  { id: 'notesNewGlobal', group: '笔记', label: '新建笔记 (全局)', defaultAccelerator: 'Ctrl+N', scope: 'page' },
  { id: 'notesPreview', group: '笔记', label: '预览 / 编辑切换', defaultAccelerator: 'Ctrl+P', scope: 'page' },
  { id: 'notesBold', group: '笔记', label: '粗体 (编辑中)', defaultAccelerator: 'Ctrl+B', scope: 'page' },
  { id: 'notesItalic', group: '笔记', label: '斜体 (编辑中)', defaultAccelerator: 'Ctrl+I', scope: 'page' },
  { id: 'notesSave', group: '笔记', label: '立即保存', defaultAccelerator: 'Ctrl+S', scope: 'page' },
]

export const SHORTCUT_BY_ID = Object.fromEntries(SHORTCUT_CATALOG.map((item) => [item.id, item])) as Record<
  string,
  ShortcutDefinition
>

export const SHORTCUT_GROUPS = (() => {
  const map = new Map<string, ShortcutDefinition[]>()
  for (const item of SHORTCUT_CATALOG) {
    const list = map.get(item.group) || []
    list.push(item)
    map.set(item.group, list)
  }
  return [...map.entries()].map(([label, shortcuts]) => ({ label, shortcuts }))
})()

export function defaultShortcutMap(): Record<string, string> {
  return Object.fromEntries(SHORTCUT_CATALOG.map((item) => [item.id, item.defaultAccelerator]))
}
