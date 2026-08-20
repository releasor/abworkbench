/**
 * Shared date utilities.
 * Product calendar day is Beijing time (Asia/Shanghai) via beijingTime helpers.
 */

import { beijingDateTimeMinute, beijingParts, beijingYMD } from '../../utils/beijingTime.ts'

/** Get today's date as YYYY-MM-DD (Beijing calendar). */
export function todayStr(now: Date = new Date()): string {
  return beijingYMD(now)
}

/** Format a Date as local/Beijing YYYY-MM-DD. */
export function formatLocalYMD(date: Date = new Date()): string {
  return beijingYMD(date)
}

/** Day key from epoch ms. */
export function dayKeyFromMs(ms: number): string {
  if (!Number.isFinite(ms)) return ''
  return beijingYMD(new Date(ms))
}

/** Day key from ISO / datetime string. */
export function dayKeyFromIso(iso?: string | null): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) {
    // Already a date-only string
    if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10)
    return ''
  }
  return dayKeyFromMs(ms)
}

/** Format as YYYY-MM-DDTHH:mm in Beijing wall clock. */
export function formatLocalDateTimeMinute(date: Date = new Date()): string {
  return beijingDateTimeMinute(date)
}

/** Chinese weekday labels indexed 0=Sun, 1=Mon, ..., 6=Sat. */
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * Sakamoto's algorithm for day-of-week. Returns 0=Sun, 1=Mon, ..., 6=Sat.
 * Pure arithmetic — no Date objects.
 */
export function dayOfWeek(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (m < 3) y--;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1] + d) % 7;
}

// Cumulative days before each month (non-leap). Index 0 = Jan, 12 = sentinel.
const CUM_DAYS = [0, 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
const MONTH_DAYS_NONLEAP = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const PAD2_CACHE: string[] = [];
for (let i = 0; i < 32; i++) PAD2_CACHE[i] = i < 10 ? `0${i}` : `${i}`;

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Day-of-year (1-based) from YYYY-MM-DD string. */
function dayOfYear(s: string): number {
  const m = (s.charCodeAt(5) - 48) * 10 + (s.charCodeAt(6) - 48);
  const d = (s.charCodeAt(8) - 48) * 10 + (s.charCodeAt(9) - 48);
  return CUM_DAYS[m] + d + (m > 2 && isLeap(+s.slice(0, 4)) ? 1 : 0);
}

/** Convert day-of-year back to MM-DD string. */
function doyToMonthDay(y: number, doy: number): string {
  const leap = isLeap(y);
  let m = 1;
  while (m < 12) {
    const daysInMonth = MONTH_DAYS_NONLEAP[m] + (m === 2 && leap ? 1 : 0);
    if (doy <= daysInMonth) break;
    doy -= daysInMonth;
    m++;
  }
  return `${PAD2_CACHE[m]}-${PAD2_CACHE[doy]}`;
}

/**
 * Previous calendar date as ISO string. Pure arithmetic — no Date objects.
 * Handles month/year boundaries and leap years correctly.
 */
export function prevDateStr(dateStr: string): string {
  const y = +dateStr.slice(0, 4);
  const doy = dayOfYear(dateStr);
  if (doy > 1) {
    return `${y}-${doyToMonthDay(y, doy - 1)}`;
  }
  // Jan 1 → Dec 31 of previous year
  const py = y - 1;
  return `${py}-12-31`;
}

/**
 * Decrement a date string by N days in O(1) for typical cases.
 * Pure arithmetic — no Date objects, no loops for same-year decrements.
 */
export function prevDateStrN(dateStr: string, n: number): string {
  let y = +dateStr.slice(0, 4);
  let doy = dayOfYear(dateStr) - n;
  while (doy <= 0) {
    y--;
    doy += isLeap(y) ? 366 : 365;
  }
  return `${y}-${doyToMonthDay(y, doy)}`;
}

/**
 * Next calendar date as ISO string. Pure arithmetic — no Date objects.
 * Handles month/year boundaries and leap years correctly.
 */
export function nextDateStr(dateStr: string): string {
  const y = +dateStr.slice(0, 4);
  const doy = dayOfYear(dateStr);
  const daysInYear = isLeap(y) ? 366 : 365;
  if (doy < daysInYear) {
    return `${y}-${doyToMonthDay(y, doy + 1)}`;
  }
  // Dec 31 → Jan 1 of next year
  return `${y + 1}-01-01`;
}

/**
 * Increment a date string by N days in O(1) for typical cases.
 * Pure arithmetic — no Date objects, no loops for same-year increments.
 */
export function nextDateStrN(dateStr: string, n: number): string {
  let y = +dateStr.slice(0, 4);
  let doy = dayOfYear(dateStr) + n;
  let daysInYear = isLeap(y) ? 366 : 365;
  while (doy > daysInYear) {
    doy -= daysInYear;
    y++;
    daysInYear = isLeap(y) ? 366 : 365;
  }
  return `${y}-${doyToMonthDay(y, doy)}`;
}

/**
 * Compute consecutive days ending at `fromDate` where `completionDates` has entries.
 * Returns 0 if `fromDate` itself is not in the set.
 */
export function computeStreak(completionDates: Set<string>, fromDate: string): number {
  let streak = 0;
  let d = fromDate;
  while (completionDates.has(d)) {
    streak++;
    d = prevDateStr(d);
  }
  return streak;
}

/** Re-export for callers that need wall-clock parts. */
export { beijingParts }
