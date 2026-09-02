import { HolidayUtil, Solar } from 'lunar-javascript'

export interface DayCalendarInfo {
  solar: Solar
  lunarLabel: string
  lunarFull: string
  solarTerm: string
  festival: string
  holidayName: string | null
  isRestDay: boolean
  isWorkDay: boolean
  yi: string[]
  ji: string[]
  yearGanZhi: string
  yearShengXiao: string
  constellation: string
  positions: {
    xi: string
    cai: string
    fu: string
    yangGui: string
    yinGui: string
  }
}

export function solarFromDate(date: Date): Solar {
  return Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function getDayCalendarInfo(date: Date): DayCalendarInfo {
  const solar = solarFromDate(date)
  const lunar = solar.getLunar()
  const holiday = HolidayUtil.getHoliday(date.getFullYear(), date.getMonth() + 1, date.getDate())
  const lunarFestivals = lunar.getFestivals()
  const solarFestivals = solar.getFestivals()
  const festival = [...lunarFestivals, ...solarFestivals][0] || ''
  const solarTerm = lunar.getJieQi() || ''
  const lunarDay = lunar.getDayInChinese()
  const lunarLabel = solarTerm || festival || (lunarDay === '初一' ? `${lunar.getMonthInChinese()}月` : lunarDay)

  return {
    solar,
    lunarLabel,
    lunarFull: lunar.toString(),
    solarTerm,
    festival,
    holidayName: holiday ? holiday.getName() : null,
    isRestDay: Boolean(holiday && !holiday.isWork()),
    isWorkDay: Boolean(holiday && holiday.isWork()),
    yi: lunar.getDayYi(),
    ji: lunar.getDayJi(),
    yearGanZhi: lunar.getYearInGanZhi(),
    yearShengXiao: lunar.getYearShengXiao(),
    constellation: solar.getXingZuo(),
    positions: {
      xi: lunar.getDayPositionXi(),
      cai: lunar.getDayPositionCai(),
      fu: lunar.getDayPositionFu(),
      yangGui: lunar.getDayPositionYangGui(),
      yinGui: lunar.getDayPositionYinGui(),
    },
  }
}

export function getWeekdayLabel(date: Date): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
}

export function getWeekOfYear(date: Date): number {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const first = new Date(target.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((target.getTime() - first.getTime()) / 86400000) + 1
  const firstWeekday = first.getDay() || 7
  return Math.ceil((dayOfYear + firstWeekday - 1) / 7)
}

export function getDayOfYear(date: Date): number {
  const first = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date.getTime() - first.getTime()) / 86400000)
}

export function mondayStartOffset(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

export function eachDayInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const cursor = new Date(year, month, 1)
  while (cursor.getMonth() === month) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}
