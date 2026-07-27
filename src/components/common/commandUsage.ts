const USAGE_KEY = 'abworkbench-command-usage'

interface CommandUsageRecord {
  count: number
  lastUsedAt: number
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage
  return typeof localStorage === 'undefined' ? null : localStorage
}

function readUsage(storage?: StorageLike): Record<string, CommandUsageRecord> {
  const target = getStorage(storage)
  if (!target) return {}
  try {
    const parsed = JSON.parse(target.getItem(USAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeUsage(usage: Record<string, CommandUsageRecord>, storage?: StorageLike) {
  const target = getStorage(storage)
  if (target) target.setItem(USAGE_KEY, JSON.stringify(usage))
}

export function recordCommandUse(commandId: string, storage?: StorageLike, now = Date.now()) {
  const usage = readUsage(storage)
  const current = usage[commandId] || { count: 0, lastUsedAt: 0 }
  usage[commandId] = { count: current.count + 1, lastUsedAt: now }
  writeUsage(usage, storage)
}

export function getRecentCommandIds(storage?: StorageLike, limit = 5): string[] {
  return Object.entries(readUsage(storage))
    .sort(([, a], [, b]) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit)
    .map(([id]) => id)
}

export function sortCommandsByUsage<T extends { id: string }>(commands: T[], storage?: StorageLike): T[] {
  const usage = readUsage(storage)
  return [...commands].sort((a, b) => {
    const aUsage = usage[a.id]
    const bUsage = usage[b.id]
    const aScore = (aUsage?.count || 0) * 10000000000000 + (aUsage?.lastUsedAt || 0)
    const bScore = (bUsage?.count || 0) * 10000000000000 + (bUsage?.lastUsedAt || 0)
    return bScore - aScore
  })
}
