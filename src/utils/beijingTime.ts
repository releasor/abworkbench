/** Beijing (Asia/Shanghai) calendar helpers — product clock is always 北京时间. */

const TZ = 'Asia/Shanghai'
const PAD2: string[] = []
for (let i = 0; i < 60; i++) PAD2[i] = i < 10 ? `0${i}` : `${i}`

export interface BeijingParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function beijingParts(date: Date = new Date()): BeijingParts {
  const bag = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  }
}

export function beijingYMD(date: Date = new Date()): string {
  const p = beijingParts(date)
  return `${p.year}-${PAD2[p.month]}-${PAD2[p.day]}`
}

export function beijingDateTimeMinute(date: Date = new Date()): string {
  const p = beijingParts(date)
  return `${p.year}-${PAD2[p.month]}-${PAD2[p.day]}T${PAD2[p.hour]}:${PAD2[p.minute]}`
}

/** Approximate ms for a Beijing wall-clock datetime (no seconds). */
export function beijingWallToMs(ymdHm: string): number {
  // Treat as +08:00 offset
  const m = ymdHm.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return Number.NaN
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}:00+08:00`
  return Date.parse(iso)
}
