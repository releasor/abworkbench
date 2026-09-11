export type LauncherMenuActionId =
  | 'open'
  | 'reveal'
  | 'copy-path'
  | 'pin'
  | 'unpin'
  | 'remove'
  | 'reader-library'

export type LauncherMenuItem = {
  id: LauncherMenuActionId
  label: string
  danger?: boolean
}

/** Context actions for recent / search app entries. */
export function buildAppContextMenuItems(opts: {
  pinned?: boolean
  canReveal?: boolean
}): LauncherMenuItem[] {
  const items: LauncherMenuItem[] = [{ id: 'open', label: '打开' }]
  if (opts.canReveal !== false) {
    items.push({ id: 'reveal', label: '打开所在位置' })
  }
  items.push(
    opts.pinned
      ? { id: 'unpin', label: '取消固定' }
      : { id: 'pin', label: '固定到最近' },
    { id: 'remove', label: '从最近移除', danger: true },
  )
  return items
}

/** Context actions for recent files/folders and Everything results. */
export function buildPathContextMenuItems(opts: {
  isDir?: boolean
  canRemove?: boolean
}): LauncherMenuItem[] {
  const items: LauncherMenuItem[] = [
    { id: 'open', label: opts.isDir ? '打开目录' : '打开' },
    { id: 'reveal', label: opts.isDir ? '在资源管理器中打开' : '打开所在文件夹' },
    { id: 'copy-path', label: '复制路径' },
  ]
  if (opts.canRemove) {
    items.push({ id: 'remove', label: '从最近移除', danger: true })
  }
  return items
}

export function buildReaderContextMenuItems(): LauncherMenuItem[] {
  return [{ id: 'reader-library', label: '进入书架' }]
}
