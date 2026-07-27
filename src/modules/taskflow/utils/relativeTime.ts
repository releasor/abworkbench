const UNITS: [number, string][] = [
  [31536000000, '年'],
  [2592000000, '个月'],
  [86400000, '天'],
  [3600000, '小时'],
  [60000, '分钟'],
  [1000, '秒'],
];

export function formatRelativeTime(date: Date | string): string {
  const ms = typeof date === 'string' ? Date.parse(date) : date.getTime();
  const diff = Date.now() - ms;
  const absDiff = Math.abs(diff);
  const suffix = diff >= 0 ? '前' : '后';

  if (absDiff < 1000) return '刚刚';

  for (const [unitMs, label] of UNITS) {
    if (absDiff >= unitMs) {
      const count = Math.floor(absDiff / unitMs);
      return `${count}${label}${suffix}`;
    }
  }
  return '刚刚';
}
