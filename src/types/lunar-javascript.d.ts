declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    getLunar(): Lunar
    getFestivals(): string[]
    getXingZuo(): string
    getWeek(): number
  }

  export class Lunar {
    toString(): string
    getDayInChinese(): string
    getMonthInChinese(): string
    getYearInChinese(): string
    getYearInGanZhi(): string
    getYearShengXiao(): string
    getJieQi(): string
    getFestivals(): string[]
    getDayYi(): string[]
    getDayJi(): string[]
    getDayPositionXi(): string
    getDayPositionCai(): string
    getDayPositionFu(): string
    getDayPositionYangGui(): string
    getDayPositionYinGui(): string
  }

  export class HolidayUtil {
    static getHoliday(year: number, month: number, day: number): {
      getName(): string
      isWork(): boolean
    } | null
  }
}
