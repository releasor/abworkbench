import type { Priority } from '../types'
import { todayStr, dayOfWeek, nextDateStrN } from '../dateUtils';

const PRIORITY_KEYWORDS: Record<string, Priority> = {
  '紧急': 'urgent',
  '急': 'urgent',
  'urgent': 'urgent',
  '高': 'high',
  'high': 'high',
  '低': 'low',
  'low': 'low',
};

// Precompute regex patterns at module level to avoid recreating on every call
const PRIORITY_PATTERNS: { keyword: string; priority: Priority; startRegex: RegExp; endRegex: RegExp }[] =
  Object.entries(PRIORITY_KEYWORDS).map(([keyword, p]) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
      keyword,
      priority: p,
      startRegex: new RegExp(`^${escaped}[:\\s]+`, 'i'),
      endRegex: new RegExp(`[:\\s]+${escaped}$`, 'i'),
    };
  });

// Chinese weekday mapping: 一=1(Mon)..日=0(Sun)
const CN_WEEKDAY_MAP: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
// English weekday mapping
const EN_WEEKDAY_MAP: Record<string, number> = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 0 };

// Precompiled date patterns (order matters: longer patterns first)
// compute receives a pre-cached todayStr to avoid repeated Date object creation
const DATE_PATTERNS: { regex: RegExp; compute: (match: RegExpMatchArray, today: string) => string | null }[] = [
  // N天后 (N days later, e.g. "3天后", "5天")
  { regex: /(?:^|[\s,，]+)(\d{1,3})天后(?=[\s,，]|$)/, compute: (m, today) => nextDateStrN(today, Math.min(+m[1], 999)) },
  { regex: /(?:^|[\s,，]+)(\d{1,3})天(?=[\s,，]|$)/, compute: (m, today) => nextDateStrN(today, Math.min(+m[1], 999)) },
  // N weeks later
  { regex: /(?:^|[\s,，]+)(\d{1,2})周后(?=[\s,，]|$)/, compute: (m, today) => nextDateStrN(today, Math.min(+m[1], 52) * 7) },
  { regex: /(?:^|[\s,，]+)(\d{1,2})周(?=[\s,，]|$)/, compute: (m, today) => nextDateStrN(today, Math.min(+m[1], 52) * 7) },
  // N days/weeks later (English)
  { regex: /(?:^|[\s,，]+)in\s+(\d{1,3})\s+days?(?=[\s,，]|$)/i, compute: (m, today) => nextDateStrN(today, Math.min(+m[1], 999)) },
  { regex: /(?:^|[\s,，]+)in\s+(\d{1,2})\s+weeks?(?=[\s,，]|$)/i, compute: (m, today) => nextDateStrN(today, Math.min(+m[1], 52) * 7) },
  // 大后天 (3 days later)
  { regex: /(?:^|[\s,，]+)大后天(?=[\s,，]|$)/, compute: (_m, today) => nextDateStrN(today, 3) },
  // 后天 (day after tomorrow)
  { regex: /(?:^|[\s,，]+)后天(?=[\s,，]|$)/, compute: (_m, today) => nextDateStrN(today, 2) },
  // 明天
  { regex: /(?:^|[\s,，]+)明天(?=[\s,，]|$)/, compute: (_m, today) => nextDateStrN(today, 1) },
  // 今天
  { regex: /(?:^|[\s,，]+)今天(?=[\s,，]|$)/, compute: (_m, today) => today },
  // 下周X (next week weekday)
  { regex: /(?:^|[\s,，]+)下周([一二三四五六日天])(?=[\s,，]|$)/, compute: (m, today) => {
    const target = CN_WEEKDAY_MAP[m[1]];
    if (target === undefined) return null;
    const curDow = dayOfWeek(+today.slice(0, 4), +today.slice(5, 7), +today.slice(8, 10));
    const daysUntil = ((target - curDow + 7) % 7 || 7) + 7; // next week
    return nextDateStrN(today, daysUntil);
  }},
  // 周X (this week or next if already passed)
  { regex: /(?:^|[\s,，]+)周([一二三四五六日天])(?=[\s,，]|$)/, compute: (m, today) => {
    const target = CN_WEEKDAY_MAP[m[1]];
    if (target === undefined) return null;
    const curDow = dayOfWeek(+today.slice(0, 4), +today.slice(5, 7), +today.slice(8, 10));
    const daysUntil = (target - curDow + 7) % 7 || 7;
    return nextDateStrN(today, daysUntil);
  }},
  // 下周 (next week, Monday)
  { regex: /(?:^|[\s,，]+)下周(?=[\s,，]|$)/, compute: (_m, today) => {
    const curDow = dayOfWeek(+today.slice(0, 4), +today.slice(5, 7), +today.slice(8, 10));
    const daysToMonday = (1 - curDow + 7) % 7 || 7;
    return nextDateStrN(today, daysToMonday + 7);
  }},
  // tomorrow, today
  { regex: /(?:^|[\s,，]+)tomorrow(?=[\s,，]|$)/i, compute: (_m, today) => nextDateStrN(today, 1) },
  { regex: /(?:^|[\s,，]+)today(?=[\s,，]|$)/i, compute: (_m, today) => today },
  // next monday, next friday, etc.
  { regex: /(?:^|[\s,，]+)next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?=[\s,，]|$)/i, compute: (m, today) => {
    const target = EN_WEEKDAY_MAP[m[1].toLowerCase()];
    if (target === undefined) return null;
    const curDow = dayOfWeek(+today.slice(0, 4), +today.slice(5, 7), +today.slice(8, 10));
    const daysUntil = ((target - curDow + 7) % 7 || 7) + 7;
    return nextDateStrN(today, daysUntil);
  }},
  // monday, friday, etc. (this week or next if already passed)
  { regex: /(?:^|[\s,，]+)(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?=[\s,，]|$)/i, compute: (m, today) => {
    const target = EN_WEEKDAY_MAP[m[1].toLowerCase()];
    if (target === undefined) return null;
    const curDow = dayOfWeek(+today.slice(0, 4), +today.slice(5, 7), +today.slice(8, 10));
    const daysUntil = (target - curDow + 7) % 7 || 7;
    return nextDateStrN(today, daysUntil);
  }},
];

function extractDueDate(title: string): { title: string; dueDate: string | null } {
  // Cache todayStr once per call to avoid repeated Date object creation across patterns
  const today = todayStr();
  for (const { regex, compute } of DATE_PATTERNS) {
    const match = regex.exec(title);
    if (match) {
      const dueDate = compute(match, today);
      if (dueDate) {
        return { title: title.replace(regex, '').trim(), dueDate };
      }
    }
  }
  return { title, dueDate: null };
}

export function parseSmartInput(input: string): { title: string; priority: Priority; tags: string[]; dueDate: string | null } {
  let title = input.trim();
  let priority: Priority = 'medium';
  const tags: string[] = [];

  // Extract #tags using matchAll (stateless, no /g flag needed)
  for (const match of title.matchAll(/#(\S+)/g)) {
    tags.push(match[1]);
  }
  title = title.replace(/#(\S+)/g, '').trim();

  // Extract natural language date (before priority so "明天 紧急" works)
  const { title: cleanTitle, dueDate } = extractDueDate(title);
  title = cleanTitle;

  // Extract priority keywords (at start or end)
  for (const { priority: p, startRegex, endRegex } of PRIORITY_PATTERNS) {
    if (startRegex.test(title)) {
      priority = p;
      title = title.replace(startRegex, '').trim();
      break;
    }
    if (endRegex.test(title)) {
      priority = p;
      title = title.replace(endRegex, '').trim();
      break;
    }
  }

  return { title, priority, tags, dueDate };
}
