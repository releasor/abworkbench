import { safeGet } from '../../utils/safeLocalStorage'

export const WORKDAY_SETTINGS_KEY = 'abworkbench-workday-settings'

export interface WorkdaySettings {
  startTime: string
  endTime: string
  monthlySalary: number
  workdaysPerMonth: number
}

export interface WorkdayStatus {
  phase: 'before' | 'working' | 'done' | 'invalid'
  startAt: Date
  endAt: Date
  elapsedMs: number
  remainingMs: number
  progress: number
  todayEarned: number
  dailySalary: number
  perSecondSalary: number
}

export const DEFAULT_WORKDAY_SETTINGS: WorkdaySettings = {
  startTime: '09:00',
  endTime: '18:00',
  monthlySalary: 0,
  workdaysPerMonth: 22,
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

function parseTimeOnDate(now: Date, value: string): Date {
  const [hours, minutes] = value.split(':').map(Number)
  const result = new Date(now)
  result.setHours(hours, minutes, 0, 0)
  return result
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function readWorkdaySettings(): WorkdaySettings {
  return normalizeWorkdaySettings(safeGet(WORKDAY_SETTINGS_KEY, DEFAULT_WORKDAY_SETTINGS))
}

export function normalizeWorkdaySettings(value: Partial<WorkdaySettings> | null | undefined): WorkdaySettings {
  const startTime = isValidTime(value?.startTime) ? value.startTime : DEFAULT_WORKDAY_SETTINGS.startTime
  const endTime = isValidTime(value?.endTime) ? value.endTime : DEFAULT_WORKDAY_SETTINGS.endTime
  const monthlySalary = typeof value?.monthlySalary === 'number' && Number.isFinite(value.monthlySalary) && value.monthlySalary >= 0 ? value.monthlySalary : DEFAULT_WORKDAY_SETTINGS.monthlySalary
  const workdaysPerMonth = typeof value?.workdaysPerMonth === 'number' && Number.isFinite(value.workdaysPerMonth) && value.workdaysPerMonth > 0 ? value.workdaysPerMonth : DEFAULT_WORKDAY_SETTINGS.workdaysPerMonth
  const normalized = { startTime, endTime, monthlySalary, workdaysPerMonth }
  return parseMinutes(endTime) > parseMinutes(startTime) ? normalized : DEFAULT_WORKDAY_SETTINGS
}

function parseMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function buildWorkdayStatus(input: { now?: Date; settings: WorkdaySettings }): WorkdayStatus {
  const now = input.now || new Date()
  const settings = normalizeWorkdaySettings(input.settings)
  const startAt = parseTimeOnDate(now, settings.startTime)
  const endAt = parseTimeOnDate(now, settings.endTime)
  const durationMs = Math.max(1, endAt.getTime() - startAt.getTime())
  const elapsedMs = Math.min(Math.max(0, now.getTime() - startAt.getTime()), durationMs)
  const remainingMs = Math.min(Math.max(0, endAt.getTime() - now.getTime()), durationMs)
  const dailySalary = settings.workdaysPerMonth > 0 ? settings.monthlySalary / settings.workdaysPerMonth : 0
  const perSecondSalary = dailySalary / (durationMs / 1000)
  const todayEarned = roundMoney((elapsedMs / 1000) * perSecondSalary)
  const progress = Math.min(100, Math.max(0, Math.round((elapsedMs / durationMs) * 100)))
  const phase = now < startAt ? 'before' : now > endAt ? 'done' : 'working'

  return {
    phase,
    startAt,
    endAt,
    elapsedMs,
    remainingMs,
    progress,
    todayEarned,
    dailySalary: roundMoney(dailySalary),
    perSecondSalary,
  }
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

export function formatCurrency(value: number): string {
  return `¥${value.toFixed(2)}`
}
