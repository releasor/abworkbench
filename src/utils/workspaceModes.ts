export type WorkspaceMode = 'focus' | 'night' | 'minimal' | 'dashboard'

export interface WorkspaceModeOption {
  mode: WorkspaceMode
  label: string
  description: string
}

export const WORKSPACE_MODE_OPTIONS: WorkspaceModeOption[] = [
  { mode: 'focus', label: '专注模式主题', description: '降低干扰，突出任务、番茄和下一步行动。' },
  { mode: 'night', label: '夜间主题', description: '更低亮度和更柔和对比，适合晚间复盘。' },
  { mode: 'minimal', label: '极简工作台', description: '压缩装饰和阴影，保留核心信息密度。' },
  { mode: 'dashboard', label: '数据仪表盘模式', description: '强化统计、趋势和健康指标的可读性。' },
]

export function getWorkspaceModeOption(mode: WorkspaceMode): WorkspaceModeOption {
  return WORKSPACE_MODE_OPTIONS.find((option) => option.mode === mode) || WORKSPACE_MODE_OPTIONS[0]
}

