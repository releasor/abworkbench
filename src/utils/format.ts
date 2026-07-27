export const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

export function getRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffMin = Math.floor((now - timestamp) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} 天前`
  const dayNum = Math.floor(timestamp / 86400000)
  const { y, m, d } = dayNumToYMD(dayNum)
  const nowDayNum = Math.floor(now / 86400000)
  const nowYear = dayNumToYMD(nowDayNum).y
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return y === nowYear ? `${mm}/${dd}` : `${y}/${mm}/${dd}`
}

/** Returns the duration in whole minutes between two timestamps (ms). */
export function durationMinutes(start: number, end: number): number {
  return Math.round((end - start) / 60000)
}

/** Format minutes as "X时X分" or "X分", with optional suffix like "前" or "后". */
export function fmtMin(m: number, suffix = ''): string {
  const base = m >= 60 ? `${Math.floor(m / 60)}时${m % 60}分` : `${m}分`
  return suffix ? base + suffix : base
}

/** Compute consecutive-day streak from a Set of date strings (yyyy-MM-dd). */
export function getHabitStreak(dateSet: Set<string>, todayStr: string, yesterdayStr: string): number {
  if (dateSet.size === 0) return 0
  if (!dateSet.has(todayStr) && !dateSet.has(yesterdayStr)) return 0
  const startStr = dateSet.has(todayStr) ? todayStr : yesterdayStr
  const [startY, startM, startD] = startStr.split('-').map(Number)
  let dayNum = Math.floor(Date.UTC(startY, startM - 1, startD) / 86400000)
  let streak = 0
  while (dateSet.has(dayNumToDateStr(dayNum))) { streak++; dayNum-- }
  return streak
}

const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

/** Resolve a day number to { y, m, d } using pure arithmetic. Shared by all date-formatting functions. */
export function dayNumToYMD(dayNum: number): { y: number; m: number; d: number } {
  let y = Math.floor(dayNum / 365) + 1970
  let yStart = Math.floor(Date.UTC(y, 0, 0) / 86400000)
  if (yStart > dayNum) { y--; yStart = Math.floor(Date.UTC(y, 0, 0) / 86400000) }
  else {
    const yStartNext = Math.floor(Date.UTC(y + 1, 0, 0) / 86400000)
    if (yStartNext <= dayNum) { y++; yStart = yStartNext }
  }
  const dayOfYear = dayNum - yStart
  const isLeap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  let m = 12
  for (let i = 12; i >= 1; i--) {
    const ms = MONTH_STARTS[i - 1] + (isLeap && i > 2 ? 1 : 0)
    if (dayOfYear > ms) { m = i; break }
  }
  const monthStart = MONTH_STARTS[m - 1] + (isLeap && m > 2 ? 1 : 0)
  return { y, m, d: dayOfYear - monthStart }
}

/** Convert a day number (Math.floor(timestamp / 86400000)) to 'yyyy-MM-dd' string. Pure arithmetic, no Date objects. */
export function dayNumToDateStr(dayNum: number): string {
  const { y, m, d } = dayNumToYMD(dayNum)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Get 'yyyy年M月' label from a timestamp. Pure arithmetic, no Date objects. */
export function getMonthLabel(ts: number): string {
  const { y, m } = dayNumToYMD(Math.floor(ts / 86400000))
  return `${y}年${m}月`
}

/** Convert a day number to 'MM/dd' display label. Pure arithmetic, no Date objects. */
export function dayNumToShortLabel(dayNum: number): string {
  const { m, d } = dayNumToYMD(dayNum)
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`
}

/** Convert a day number to 'yyyy年MM月dd日' full label. Pure arithmetic, no Date objects. */
export function dayNumToFullLabel(dayNum: number): string {
  const { y, m, d } = dayNumToYMD(dayNum)
  return `${y}年${String(m).padStart(2, '0')}月${String(d).padStart(2, '0')}日`
}

/** Format a timestamp as 'HH:mm' using pure arithmetic. */
export function fmtHHmm(ts: number): string {
  const totalSec = Math.floor(ts / 1000)
  const secInDay = ((totalSec % 86400) + 86400) % 86400 // handle negative offsets
  const h = Math.floor(secInDay / 3600)
  const min = Math.floor((secInDay % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Format a timestamp as 'HH:mm:ss' using pure arithmetic. */
export function fmtHHmmss(ts: number): string {
  const totalSec = Math.floor(ts / 1000)
  const secInDay = ((totalSec % 86400) + 86400) % 86400
  const h = Math.floor(secInDay / 3600)
  const min = Math.floor((secInDay % 3600) / 60)
  const s = secInDay % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function getRelativeTimeShort(timestamp: number): string | null {
  const diffMin = Math.floor((Date.now() - timestamp) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}时前`
  return null
}
