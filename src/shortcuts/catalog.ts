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
  { id: 'quickCapture', group: '全局', label: '快速捕获（后台可用）', defaultAccelerator: 'Ctrl+Shift+Space', scope: 'global', electron: true },
  { id: 'readerBossKey', group: '全局', label: '摸鱼阅读老板键', defaultAccelerator: 'Ctrl+Shift+Q', scope: 'global', electron: true },
  { id: 'commandPalette', group: '全局', label: '打开命令面板', defaultAccelerator: 'Ctrl+K', scope: 'global' },
  { id: 'toggleSidebar', group: '全局', label: '切换侧边栏', defaultAccelerator: 'Ctrl+B', scope: 'global' },
  { id: 'pageDashboard', group: '全局', label: '切换到仪表盘', defaultAccelerator: 'Ctrl+1', scope: 'global' },
  { id: 'pageTaskflow', group: '全局', label: '切换到任务流', defaultAccelerator: 'Ctrl+2', scope: 'global' },
  { id: 'pagePomodoro', group: '全局', label: '切换到番茄钟', defaultAccelerator: 'Ctrl+3', scope: 'global' },
  { id: 'pageHabits', group: '全局', label: '切换到每日打卡', defaultAccelerator: 'Ctrl+4', scope: 'global' },
  { id: 'pageNotes', group: '全局', label: '切换到笔记', defaultAccelerator: 'Ctrl+5', scope: 'global' },
  { id: 'pageWeather', group: '全局', label: '切换到天气', defaultAccelerator: 'Ctrl+6', scope: 'global' },
  { id: 'pageSettings', group: '全局', label: '切换到设置', defaultAccelerator: 'Ctrl+7', scope: 'global' },
  { id: 'escapeClose', group: '全局', label: '关闭启动器 / 弹窗', defaultAccelerator: 'Escape', scope: 'global' },

  // Dashboard
  { id: 'dashboardQuickAdd', group: '仪表盘', label: '快速添加任务', defaultAccelerator: 'N', scope: 'page' },

  // Pomodoro
  { id: 'pomodoroToggle', group: '番茄钟', label: '开始 / 暂停', defaultAccelerator: 'Space', scope: 'page' },
  { id: 'pomodoroReset', group: '番茄钟', label: '重置计时器', defaultAccelerator: 'R', scope: 'page' },
  { id: 'pomodoroSkipBreak', group: '番茄钟', label: '跳过休息', defaultAccelerator: 'S', scope: 'page' },
  { id: 'pomodoroAmbient', group: '番茄钟', label: '环境音面板', defaultAccelerator: 'A', scope: 'page' },

  // Task list (TodoList / 任务流列表页遗留快捷键)
  { id: 'taskListQuickAdd', group: '任务流', label: '快速添加任务', defaultAccelerator: 'N', scope: 'page' },
  { id: 'taskListFilter', group: '任务流', label: '切换筛选 (全部/进行中/已完成/逾期)', defaultAccelerator: 'F', scope: 'page' },
  { id: 'taskListCompletedBottom', group: '任务流', label: '已完成置底切换', defaultAccelerator: 'D', scope: 'page' },
  { id: 'taskListSort', group: '任务流', label: '切换排序方式', defaultAccelerator: 'S', scope: 'page' },

  // TaskFlow module
  { id: 'tfNewTask', group: '任务流', label: '新建任务 (Ctrl)', defaultAccelerator: 'Ctrl+N', scope: 'page' },
  { id: 'tfSelectAll', group: '任务流', label: '选择全部任务', defaultAccelerator: 'Ctrl+A', scope: 'page' },
  { id: 'tfDelete', group: '任务流', label: '删除选中任务', defaultAccelerator: 'Delete', scope: 'page' },
  { id: 'tfUndo', group: '任务流', label: '撤销删除', defaultAccelerator: 'Ctrl+Z', scope: 'page' },
  { id: 'tfTogglePin', group: '任务流', label: '置顶 / 取消置顶', defaultAccelerator: 'P', scope: 'page' },
  { id: 'tfSnooze', group: '任务流', label: '推迟 1 天', defaultAccelerator: 'S', scope: 'page' },
  { id: 'tfViewBoard', group: '任务流', label: '看板视图', defaultAccelerator: '1', scope: 'page' },
  { id: 'tfViewList', group: '任务流', label: '列表视图', defaultAccelerator: '2', scope: 'page' },
  { id: 'tfViewCalendar', group: '任务流', label: '日历视图', defaultAccelerator: '3', scope: 'page' },
  { id: 'tfStats', group: '任务流', label: '统计面板', defaultAccelerator: 'Ctrl+/', scope: 'page' },
  { id: 'tfCompleted', group: '任务流', label: '已完成任务', defaultAccelerator: 'Ctrl+E', scope: 'page' },
  { id: 'tfHelp', group: '任务流', label: '快捷键帮助', defaultAccelerator: '?', scope: 'page' },
  { id: 'tfFocusMode', group: '任务流', label: '专注模式', defaultAccelerator: 'F', scope: 'page' },
  { id: 'tfTimeline', group: '任务流', label: '时间线', defaultAccelerator: 'Ctrl+T', scope: 'page' },
  { id: 'tfPomodoro', group: '任务流', label: '番茄钟面板', defaultAccelerator: 'Ctrl+P', scope: 'page' },
  { id: 'tfDailyReview', group: '任务流', label: '每日回顾', defaultAccelerator: 'Ctrl+R', scope: 'page' },
  { id: 'tfWeeklyReport', group: '任务流', label: '每周报告', defaultAccelerator: 'Ctrl+G', scope: 'page' },
  { id: 'tfSearch', group: '任务流', label: '聚焦搜索框', defaultAccelerator: '/', scope: 'page' },
  { id: 'tfDarkMode', group: '任务流', label: '切换暗色模式', defaultAccelerator: 'Ctrl+D', scope: 'page' },
  { id: 'tfSound', group: '任务流', label: '切换提示音', defaultAccelerator: 'Ctrl+M', scope: 'page' },
  { id: 'tfStatusForward', group: '任务流', label: '选中任务状态前进', defaultAccelerator: 'Ctrl+ArrowRight', scope: 'page' },
  { id: 'tfStatusBackward', group: '任务流', label: '选中任务状态后退', defaultAccelerator: 'Ctrl+ArrowLeft', scope: 'page' },

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
