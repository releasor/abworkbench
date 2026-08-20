export interface WorkspaceTemplate {
  id: string
  kind: 'task' | 'note' | 'reminder'
  label: string
  description: string
  payload: string
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 'tpl-task-release',
    kind: 'task',
    label: '发版检查清单',
    description: '上线前核对项',
    payload: '发版检查 / 跑测试 / 更新 CHANGELOG / 备份数据 / 通知相关人',
  },
  {
    id: 'tpl-task-interview',
    kind: 'task',
    label: '面试准备',
    description: '面试前准备任务',
    payload: '面试准备 / 复习简历项目 / 准备自我介绍 / 确认时间和地点',
  },
  {
    id: 'tpl-note-meeting',
    kind: 'note',
    label: '会议纪要',
    description: '标准会议笔记',
    payload: '# 会议纪要\n\n- 时间：\n- 参与人：\n- 议题：\n- 结论：\n- 待办：\n',
  },
  {
    id: 'tpl-note-review',
    kind: 'note',
    label: '每日复盘',
    description: '三行晚间复盘',
    payload: '# 每日复盘\n\n## 今天完成了什么\n\n## 哪里可以更好\n\n## 明天最重要的一件事\n',
  },
  {
    id: 'tpl-reminder-standup',
    kind: 'reminder',
    label: '提交日报',
    description: '工作日提醒',
    payload: '提醒 工作日 18:00 提交日报 每周',
  },
  {
    id: 'tpl-reminder-stand',
    kind: 'reminder',
    label: '站立活动',
    description: '每小时起身',
    payload: '提醒 站立活动一下 每日',
  },
]
