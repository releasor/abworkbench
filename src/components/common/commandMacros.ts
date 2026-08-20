export type CommandMacroId = 'macro-start-work' | 'macro-clear-inbox' | 'macro-evening-review' | 'macro-project-scan' | 'macro-daily-review' | 'macro-weekly-report' | 'macro-focus-mode' | 'macro-bulk-import'

export interface CommandMacroSuggestion {
  id: CommandMacroId
  label: string
  description: string
  query: string[]
  steps: string[]
}

export const COMMAND_MACROS: CommandMacroSuggestion[] = [
  {
    id: 'macro-start-work',
    label: '宏命令：开始工作',
    description: '打开任务流，进入专注模式，并开启防打扰标记。',
    query: ['开始工作', 'start work', '进入工作'],
    steps: ['打开任务流', '进入专注模式', '开启防打扰'],
  },
  {
    id: 'macro-clear-inbox',
    label: '宏命令：清空收件箱',
    description: '打开任务流，按紧急度处理未完成待办。',
    query: ['清空收件箱', 'inbox zero', '处理收件箱'],
    steps: ['打开任务流', '按紧急度排序', '处理待办'],
  },
  {
    id: 'macro-evening-review',
    label: '宏命令：晚间复盘',
    description: '生成晚间复盘笔记并进入笔记页。',
    query: ['晚间复盘', '晚上复盘', 'evening review'],
    steps: ['生成复盘笔记', '打开笔记', '记录明日建议'],
  },
  {
    id: 'macro-project-scan',
    label: '宏命令：项目巡检',
    description: '打开任务流，筛选长期未更新的风险任务。',
    query: ['项目巡检', 'project scan', '检查项目'],
    steps: ['打开任务流', '筛选陈旧任务', '确认下一步'],
  },
  {
    id: 'macro-daily-review',
    label: '宏命令：今日复盘',
    description: '打开今日复盘面板，查看完成情况和明日建议。',
    query: ['今日复盘', 'daily review', '每日复盘', '复盘'],
    steps: ['打开任务流', '弹出今日复盘', '查看完成统计'],
  },
  {
    id: 'macro-weekly-report',
    label: '宏命令：周报',
    description: '打开周报面板，查看本周数据和趋势。',
    query: ['周报', 'weekly report', '本周总结', '周总结'],
    steps: ['打开任务流', '弹出周报', '查看周度数据'],
  },
  {
    id: 'macro-focus-mode',
    label: '宏命令：专注模式',
    description: '进入当前任务的专注模式，屏蔽干扰。',
    query: ['专注模式', 'focus mode', '专注', '深度工作'],
    steps: ['打开任务流', '进入专注模式', '屏蔽干扰'],
  },
  {
    id: 'macro-bulk-import',
    label: '宏命令：批量导入',
    description: '打开批量导入面板，从文本快速创建多个任务。',
    query: ['批量导入', 'bulk import', '批量创建', '导入任务'],
    steps: ['打开任务流', '弹出批量导入', '粘贴任务列表'],
  },
]

export function buildCommandMacroSuggestions(queryText: string): CommandMacroSuggestion[] {
  const query = queryText.trim().toLowerCase()
  if (!query) return []
  return COMMAND_MACROS.filter((macro) => macro.query.some((keyword) => keyword.toLowerCase().includes(query) || query.includes(keyword.toLowerCase())))
}
