/** Header chrome bridge for Hotlist refresh (page body registers, Header renders). */

export type HotlistHeaderChrome = {
  refreshing: boolean
  disabled: boolean
  label: string
  onRefresh: (() => void) | null
}

const idle: HotlistHeaderChrome = {
  refreshing: false,
  disabled: true,
  label: '刷新',
  onRefresh: null,
}

let chrome: HotlistHeaderChrome = idle
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function getHotlistHeaderChrome(): HotlistHeaderChrome {
  return chrome
}

export function setHotlistHeaderChrome(next: HotlistHeaderChrome | null): void {
  chrome = next ?? idle
  emit()
}

export function subscribeHotlistHeaderChrome(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
