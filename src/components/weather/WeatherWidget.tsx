import type { ReactNode } from 'react'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  Wind,
  Droplets,
  Eye,
  Sunrise,
  Sunset,
  MapPin,
  RefreshCw,
  ChevronDown,
  Search,
  X,
  Crosshair,
  Umbrella,
  Thermometer,
  Gauge,
} from 'lucide-react'
import { getRelativeTimeShort, WEEKDAY_NAMES, fmtMin, fmtHHmm } from '../../utils/format'
import { useStore } from '../../store'
import { useTranslation } from '../../i18n'

interface WeatherData {
  city: string
  temp: number
  feelsLike: number
  humidity: number
  windSpeed: number
  windDirection: string
  visibility: number
  uvIndex: number
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy'
  description: string
  sunrise: string
  sunset: string
  hourlyTemp: Array<{ label: string; temp: number; icon: string }>
  hourlyForecast: Array<{
    time: string
    temp: number
    feelsLike: number
    condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy'
    humidity: number
    windSpeed: number
    precipitation: number
  }>
  forecast: Array<{
    day: string
    temp: number
    high: number
    low: number
    condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy'
  }>
}

const conditionIcons = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: CloudSnow,
}

const conditionColors = {
  sunny: 'text-yellow-400',
  cloudy: 'text-gray-400',
  rainy: 'text-blue-400',
  snowy: 'text-white',
}

const conditionAnimations = {
  sunny: 'animate-weather-sun',
  cloudy: 'animate-weather-cloudy',
  rainy: 'animate-weather-rain',
  snowy: 'animate-weather-snow',
}

const conditionPanels = {
  sunny: 'from-amber-500/18 via-sky-500/10 to-transparent',
  cloudy: 'from-slate-400/18 via-sky-500/8 to-transparent',
  rainy: 'from-blue-500/22 via-cyan-500/10 to-transparent',
  snowy: 'from-sky-200/18 via-blue-400/10 to-transparent',
}

const CONDITIONS: WeatherData['condition'][] = ['sunny', 'cloudy', 'rainy', 'sunny', 'cloudy', 'sunny', 'cloudy']
const SKELETON_KEYS = [1, 2, 3, 4]
const PERIOD_RANGES: Array<[number, number]> = [[5, 8], [8, 11], [11, 14], [14, 17], [17, 20], [20, 5]]

function getHourlyCondition(hour: number, dayNum: number): WeatherData['condition'] {
  if (hour >= 0 && hour < 6) return 'cloudy'
  if ((dayNum + hour) % 11 === 0) return 'rainy'
  if (hour >= 7 && hour <= 17) return (hour + dayNum) % 5 === 0 ? 'cloudy' : 'sunny'
  return 'cloudy'
}

function getDaylightInfo(sunriseMin: number, sunsetMin: number, daylightMin: number, nowMs: number) {
  const secInDay = ((Math.floor(nowMs / 1000) % 86400) + 86400) % 86400
  const nowMin = Math.floor(secInDay / 60)
  const elapsed = nowMin - sunriseMin
  const progress = Math.max(0, Math.min(1, elapsed / daylightMin))
  const isDaytime = nowMin >= sunriseMin && nowMin <= sunsetMin
  const remainingMin = Math.max(0, sunsetMin - nowMin)
  return { nowMin, elapsed, progress, isDaytime, remainingMin, remainingH: Math.floor(remainingMin / 60), remainingM: remainingMin % 60 }
}

// City temperature offsets (relative to Beijing baseline)
const CITY_OFFSETS: Record<string, { temp: number; label: string }> = {
  '北京': { temp: 0, label: '北京' },
  '上海': { temp: 2, label: '上海' },
  '广州': { temp: 8, label: '广州' },
  '深圳': { temp: 9, label: '深圳' },
  '杭州': { temp: 3, label: '杭州' },
  '成都': { temp: 1, label: '成都' },
  '武汉': { temp: 4, label: '武汉' },
  '西安': { temp: -1, label: '西安' },
  '南京': { temp: 3, label: '南京' },
  '重庆': { temp: 4, label: '重庆' },
  '天津': { temp: -1, label: '天津' },
  '苏州': { temp: 3, label: '苏州' },
  '长沙': { temp: 5, label: '长沙' },
  '郑州': { temp: 1, label: '郑州' },
  '青岛': { temp: 0, label: '青岛' },
  '大连': { temp: -2, label: '大连' },
  '厦门': { temp: 6, label: '厦门' },
  '昆明': { temp: -3, label: '昆明' },
  '哈尔滨': { temp: -10, label: '哈尔滨' },
  '沈阳': { temp: -6, label: '沈阳' },
  '福州': { temp: 5, label: '福州' },
  '泉州': { temp: 6, label: '泉州' },
  '漳州': { temp: 7, label: '漳州' },
  '东莞': { temp: 9, label: '东莞' },
  '佛山': { temp: 8, label: '佛山' },
  '合肥': { temp: 2, label: '合肥' },
  '石家庄': { temp: -1, label: '石家庄' },
  '贵阳': { temp: -2, label: '贵阳' },
  '南宁': { temp: 7, label: '南宁' },
  '海口': { temp: 12, label: '海口' },
  '三亚': { temp: 14, label: '三亚' },
  '无锡': { temp: 3, label: '无锡' },
  '宁波': { temp: 3, label: '宁波' },
  '温州': { temp: 5, label: '温州' },
  '济南': { temp: 0, label: '济南' },
  '太原': { temp: -3, label: '太原' },
  '兰州': { temp: -4, label: '兰州' },
  '南昌': { temp: 4, label: '南昌' },
  '长春': { temp: -8, label: '长春' },
  '呼和浩特': { temp: -6, label: '呼和浩特' },
  '乌鲁木齐': { temp: -8, label: '乌鲁木齐' },
  '拉萨': { temp: -12, label: '拉萨' },
}

const CITY_LIST = Object.keys(CITY_OFFSETS)

// eslint-disable-next-line react-refresh/only-export-components
export function generateMockWeather(city: string = '北京'): WeatherData {
  const ts = Date.now()
  const hour = Math.floor((Math.floor(ts / 1000) % 86400) / 3600)
  const dayNum = Math.floor(ts / 86400000)
  const seasonOffset = Math.sin((dayNum / 365) * Math.PI * 2 - Math.PI / 2) * 8
  const cityOffset = CITY_OFFSETS[city]?.temp ?? 0
  const baseTemp = (hour < 6 || hour > 20 ? 16 : hour < 12 ? 21 : hour < 18 ? 25 : 22) + seasonOffset + cityOffset

  const humidity = 35 + Math.round(Math.sin(hour * 0.3) * 15)
  const windSpeed = 8 + Math.round(Math.sin(hour * 0.5 + 1) * 6)
  const hourlyForecast = Array.from({ length: 24 }, (_, i) => {
    const forecastHour = (hour + i) % 24
    const label = i === 0 ? '现在' : `${String(forecastHour).padStart(2, '0')}:00`
    const daylightCurve = Math.sin(((forecastHour - 6) / 14) * Math.PI)
    const tempOffset = (forecastHour >= 6 && forecastHour <= 20 ? daylightCurve * 7 : -4) + Math.sin((dayNum + i) * 0.8) * 1.8
    const condition = getHourlyCondition(forecastHour, dayNum + Math.floor((hour + i) / 24))
    const rainBoost = condition === 'rainy' ? 45 : condition === 'cloudy' ? 18 : 4
    const forecastTemp = Math.round(baseTemp + tempOffset - (condition === 'rainy' ? 2 : 0))
    const forecastHumidity = Math.max(25, Math.min(92, humidity + Math.round(Math.sin((forecastHour + i) * 0.35) * 12) + (condition === 'rainy' ? 20 : 0)))
    const forecastWind = Math.max(2, windSpeed + Math.round(Math.sin((forecastHour + 2) * 0.6) * 4))
    return {
      time: label,
      temp: forecastTemp,
      feelsLike: Math.round(forecastTemp + (forecastHumidity > 70 ? 2 : 0) - (forecastWind > 18 ? 1 : 0)),
      condition,
      humidity: forecastHumidity,
      windSpeed: forecastWind,
      precipitation: Math.max(0, Math.min(95, rainBoost + Math.round(Math.sin((forecastHour + dayNum) * 0.7) * 12))),
    }
  })

  const hourlyTemp = [
    { label: '清晨', temp: Math.round(baseTemp - 4 + seasonOffset * 0.3), icon: '🌅' },
    { label: '上午', temp: Math.round(baseTemp - 1), icon: '☀️' },
    { label: '中午', temp: Math.round(baseTemp + 3), icon: '🌤️' },
    { label: '下午', temp: Math.round(baseTemp + 2), icon: '⛅' },
    { label: '傍晚', temp: Math.round(baseTemp - 1), icon: '🌇' },
    { label: '夜间', temp: Math.round(baseTemp - 5), icon: '🌙' },
  ]

  // UV index: 0 at night, peaks at midday, higher when sunny
  const uvBase = hour >= 6 && hour <= 18 ? Math.sin(((hour - 6) / 12) * Math.PI) * 8 : 0
  const uvIndex = Math.round(uvBase * (hour >= 6 && hour <= 18 ? 1 : 0.3))

  // Wind direction: varies by time of day
  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  const windDirection = directions[Math.floor((hour + dayNum) % 8)]

  return {
    city: CITY_OFFSETS[city]?.label ?? city,
    temp: Math.round(baseTemp),
    feelsLike: Math.round(baseTemp + 2),
    humidity,
    windSpeed,
    windDirection,
    visibility: 10 + Math.round(Math.sin(hour * 0.2) * 3),
    uvIndex,
    condition: hour >= 6 && hour <= 18 ? 'sunny' : 'cloudy',
    description: hour >= 6 && hour <= 18 ? '晴朗' : '多云',
    sunrise: '05:23',
    sunset: '19:45',
    hourlyTemp,
    hourlyForecast,
    forecast: Array.from({ length: 7 }, (_, i) => {
      const dayTemp = Math.round(baseTemp + Math.sin(i * 1.2 + dayNum * 0.1) * 5)
      const high = dayTemp + Math.round(3 + Math.random() * 4)
      const low = dayTemp - Math.round(3 + Math.random() * 4)
      return {
        day: i === 0 ? '今天' : WEEKDAY_NAMES[(dayNum + 4 + i) % 7],
        temp: dayTemp,
        high,
        low,
        condition: CONDITIONS[(dayNum + i) % CONDITIONS.length],
      }
    }),
  }
}

async function detectCity(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=zh`,
            {
              headers: {
                Accept: 'application/json',
                'User-Agent': 'Abworkbench/1.0 (personal desktop weather)',
              },
            },
          )
          const data = await resp.json()
          const addr = data.address || {}
          // Check all relevant address fields for a matching city
          const fields: string[] = [
            addr.city, addr.town, addr.county, addr.state,
            addr.city_district, addr.suburb, addr.village,
          ].filter(Boolean)
          const displayName: string = data.display_name || ''
          // Try each field first, then fallback to display_name
          for (const field of fields) {
            const matched = CITY_LIST.find(c => field.includes(c))
            if (matched) return resolve(matched)
          }
          const matched = CITY_LIST.find(c => displayName.includes(c))
          resolve(matched || null)
        } catch { resolve(null) }
      },
      () => resolve(null),
      { timeout: 8000 }
    )
  })
}

export default function WeatherWidget() {
  const weatherCity = useStore((s) => s.weatherCity)
  const setWeatherCity = useStore((s) => s.setWeatherCity)
  const weatherAutoLocate = useStore((s) => s.weatherAutoLocate)
  const { t, tWith } = useTranslation()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [locating, setLocating] = useState(false)
  const autoLocateDone = useRef(false)
  const [lastUpdated, setLastUpdated] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [citySearch, setCitySearch] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Auto-locate on mount
  useEffect(() => {
    if (!weatherAutoLocate || autoLocateDone.current) return
    autoLocateDone.current = true
    detectCity().then((city) => {
      if (city) setWeatherCity(city)
    })
  }, [weatherAutoLocate, setWeatherCity])

  // Load weather when city changes
  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true)
    })
    const delay = 300 + Math.random() * 400
    const timer = setTimeout(() => {
      setWeather(generateMockWeather(weatherCity))
      setLastUpdated(Date.now())
      setLoading(false)
    }, delay)
    return () => clearTimeout(timer)
  }, [weatherCity])

  // Close city picker on outside click
  useEffect(() => {
    if (!showCityPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCityPicker(false)
        setCitySearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCityPicker])

  const filteredCities = useMemo(() => {
    if (!citySearch) return CITY_LIST
    const q = citySearch.toLowerCase()
    return CITY_LIST.filter(c => c.toLowerCase().includes(q))
  }, [citySearch])

  // Pre-compute all weather derivations (must be before early returns — Rules of Hooks)
  const weatherStats = useMemo(() => {
    if (!weather) return null
    // Warnings
    const warnings: Array<{ icon: string; text: string; color: string; bg: string }> = []
    if (weather.feelsLike >= 38) warnings.push({ icon: '🔴', text: `高温预警：体感温度 ${weather.feelsLike}°C，避免长时间户外活动`, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' })
    else if (weather.feelsLike >= 33) warnings.push({ icon: '🟠', text: `高温提醒：体感温度 ${weather.feelsLike}°C，注意防暑`, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' })
    if (weather.feelsLike <= 0) warnings.push({ icon: '🔵', text: `严寒预警：体感温度 ${weather.feelsLike}°C，注意防冻保暖`, color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/20' })
    if (weather.uvIndex >= 8) warnings.push({ icon: '🟡', text: `紫外线极强 (${weather.uvIndex})，务必做好防晒`, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' })
    if (weather.windSpeed >= 25) warnings.push({ icon: '💨', text: `大风预警：风速 ${weather.windSpeed} km/h，注意安全`, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' })
    if (weather.visibility <= 3) warnings.push({ icon: '🌫️', text: `低能见度：${weather.visibility} km，驾车注意安全`, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' })
    // Comfort level
    const t = weather.feelsLike; const h = weather.humidity; const w = weather.windSpeed
    let comfort: string; let comfortColor: string
    if (t > 35 || (t > 30 && h > 70)) { comfort = '酷热'; comfortColor = 'text-red-400' }
    else if (t > 28) { comfort = '炎热'; comfortColor = 'text-orange-400' }
    else if (t > 23 && h < 60) { comfort = '舒适'; comfortColor = 'text-green-400' }
    else if (t > 23) { comfort = '闷热'; comfortColor = 'text-yellow-400' }
    else if (t > 15) { comfort = '凉爽'; comfortColor = 'text-cyan-400' }
    else if (t > 5) { comfort = '较冷'; comfortColor = 'text-blue-400' }
    else { comfort = '寒冷'; comfortColor = 'text-blue-300' }
    if (w > 20 && t < 20) { comfort = '风寒'; comfortColor = 'text-blue-300' }

    // Advice
    const advice: Array<{ icon: string; text: string }> = []
    if (weather.condition === 'sunny' && weather.temp > 30) advice.push({ icon: '🥵', text: '天气炎热，注意防暑降温，多喝水' })
    else if (weather.condition === 'sunny' && weather.temp > 20) advice.push({ icon: '😎', text: '天气晴好，适合户外活动' })
    else if (weather.condition === 'sunny') advice.push({ icon: '☀️', text: '阳光明媚，心情也会好起来' })
    else if (weather.condition === 'rainy') advice.push({ icon: '☂️', text: '记得带伞，路面湿滑注意安全' })
    else if (weather.condition === 'snowy') advice.push({ icon: '🧣', text: '下雪天路滑，出门注意保暖' })
    else advice.push({ icon: '☁️', text: '多云天气，适合散步' })
    if (weather.windSpeed > 15) advice.push({ icon: '💨', text: '风力较大，外出注意防风' })
    if (weather.humidity > 70) advice.push({ icon: '💧', text: '湿度较高，注意防潮除湿' })
    if (weather.visibility < 8) advice.push({ icon: '🌫️', text: '能见度较低，驾车注意安全' })
    if (weather.feelsLike >= 33) advice.push({ icon: '👕', text: '穿着轻薄透气衣物，注意防暑' })
    else if (weather.feelsLike >= 26) advice.push({ icon: '👕', text: '短袖短裤即可，注意防晒' })
    else if (weather.feelsLike >= 20) advice.push({ icon: '👔', text: '穿着舒适，适合轻薄外套' })
    else if (weather.feelsLike >= 13) advice.push({ icon: '🧥', text: '建议穿外套或薄毛衣' })
    else if (weather.feelsLike >= 5) advice.push({ icon: '🧥', text: '注意保暖，穿厚外套' })
    else advice.push({ icon: '🧣', text: '天冷注意保暖，穿羽绒服' })
    if (weather.uvIndex >= 8) advice.push({ icon: '🧴', text: '紫外线极强，务必做好防晒' })
    else if (weather.uvIndex >= 6) advice.push({ icon: '🧴', text: '紫外线较强，建议涂抹防晒霜' })
    else if (weather.uvIndex >= 3) advice.push({ icon: '🕶️', text: '紫外线中等，长时间户外注意防晒' })
    const tomorrow = weather.forecast[1]
    if (tomorrow) {
      if (tomorrow.condition === 'rainy' && weather.condition !== 'rainy') advice.push({ icon: '🌂', text: '明天有雨，提前准备雨具' })
      if (tomorrow.condition === 'snowy' && weather.condition !== 'snowy') advice.push({ icon: '🌨️', text: '明天可能下雪，注意保暖' })
      if (tomorrow.high > weather.temp + 8) advice.push({ icon: '🌡️', text: '明天将明显升温，注意调整穿着' })
      if (tomorrow.low < weather.temp - 8) advice.push({ icon: '🥶', text: '明天将明显降温，注意添衣' })
    }

    // Hourly temp stats (single pass)
    let hourlyHigh = -Infinity; let hourlyLow = Infinity
    for (const ht of weather.hourlyTemp) {
      if (ht.temp > hourlyHigh) hourlyHigh = ht.temp
      if (ht.temp < hourlyLow) hourlyLow = ht.temp
    }
    let nextRainHour: string | null = null
    let hourlyForecastHigh = -Infinity
    let hourlyForecastLow = Infinity
    for (const item of weather.hourlyForecast) {
      if (item.temp > hourlyForecastHigh) hourlyForecastHigh = item.temp
      if (item.temp < hourlyForecastLow) hourlyForecastLow = item.temp
      if (!nextRainHour && item.precipitation >= 50) nextRainHour = item.time
    }

    // Current period index
    const hour = Math.floor((Math.floor(now / 1000) % 86400) / 3600)
    let currentPeriodIdx = -1
    for (let i = 0; i < PERIOD_RANGES.length; i++) {
      if (i === 5 ? (hour >= 20 || hour < 5) : (hour >= PERIOD_RANGES[i][0] && hour < PERIOD_RANGES[i][1])) {
        currentPeriodIdx = i; break
      }
    }

    // Forecast stats (single pass)
    let sunnyDays = 0; let rainyDays = 0; let highSum = 0; let lowSum = 0
    let bestDayIdx = 0; let bestDayTemp = -Infinity
    let globalMin = Infinity; let globalMax = -Infinity
    for (let i = 0; i < weather.forecast.length; i++) {
      const d = weather.forecast[i]
      if (d.condition === 'sunny') sunnyDays++
      if (d.condition === 'rainy') rainyDays++
      highSum += d.high; lowSum += d.low
      if (d.high > globalMax) globalMax = d.high
      if (d.low < globalMin) globalMin = d.low
      if (i > 0 && d.condition === 'sunny' && d.temp > bestDayTemp) { bestDayTemp = d.temp; bestDayIdx = i }
    }
    const forecastRange = globalMax - globalMin || 1

    // Sunrise/sunset
    const [sunriseH, sunriseM] = weather.sunrise.split(':').map(Number)
    const [sunsetH, sunsetM] = weather.sunset.split(':').map(Number)
    const sunriseMin = sunriseH * 60 + sunriseM
    const sunsetMin = sunsetH * 60 + sunsetM
    const daylightMin = sunsetMin - sunriseMin

    return { warnings, comfort, comfortColor, advice, hourlyHigh, hourlyLow, hourlyForecastHigh, hourlyForecastLow, nextRainHour, currentPeriodIdx, sunnyDays, rainyDays, avgHigh: Math.round(highSum / weather.forecast.length), avgLow: Math.round(lowSum / weather.forecast.length), bestDayIdx, globalMin, forecastRange, sunriseMin, sunsetMin, daylightMin }
  }, [weather, now])

  const daylightInfo = useMemo(() => {
    if (!weatherStats) return null
    return getDaylightInfo(weatherStats.sunriseMin, weatherStats.sunsetMin, weatherStats.daylightMin, now)
  }, [weatherStats, now])

  const detailItems = useMemo(() => {
    if (!weather) return []
    return [
      { icon: Droplets, label: t('weather.humidity'), value: `${weather.humidity}%`, sub: weather.humidity < 30 ? t('weather.humidityDry') : weather.humidity < 60 ? t('weather.humidityComfortable') : weather.humidity < 80 ? t('weather.humidityHumid') : t('weather.humidityDamp'), color: 'text-blue-400' },
      { icon: Wind, label: t('weather.wind'), value: `${weather.windSpeed} km/h`, sub: `${weather.windDirection}${t('common.north') === 'N' ? '' : '风'} · ${weather.windSpeed <= 1 ? t('weather.windCalm') : weather.windSpeed <= 5 ? t('weather.windLight') : weather.windSpeed <= 11 ? t('weather.windGentle') : weather.windSpeed <= 19 ? t('weather.windModerate') : weather.windSpeed <= 28 ? t('weather.windFresh') : t('weather.windStrong')}`, color: 'text-cyan-400' },
      { icon: Eye, label: t('weather.visibility'), value: `${weather.visibility} km`, color: 'text-purple-400' },
      { icon: Sun, label: t('weather.uv'), value: `${weather.uvIndex}`, sub: weather.uvIndex <= 2 ? t('weather.uvWeak') : weather.uvIndex <= 5 ? t('weather.uvModerate') : weather.uvIndex <= 7 ? t('weather.uvStrong') : weather.uvIndex <= 10 ? t('weather.uvVeryStrong') : t('weather.uvExtreme'), color: weather.uvIndex <= 2 ? 'text-green-400' : weather.uvIndex <= 5 ? 'text-yellow-400' : weather.uvIndex <= 7 ? 'text-orange-400' : 'text-red-400' },
    ]
  }, [weather, t])

  if (loading || !weatherStats || !weather || !daylightInfo) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-12 w-32" />
              <div className="skeleton h-4 w-16" />
            </div>
            <div className="skeleton h-16 w-16 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SKELETON_KEYS.map((i) => (
            <div key={i} className="glass-card p-4 space-y-2">
              <div className="skeleton h-3 w-12" />
              <div className="skeleton h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const { warnings, comfort, comfortColor, advice, hourlyHigh, hourlyLow, hourlyForecastHigh, hourlyForecastLow, nextRainHour, currentPeriodIdx, sunnyDays, rainyDays, avgHigh, avgLow, bestDayIdx, globalMin, forecastRange, sunriseMin, sunsetMin, daylightMin } = weatherStats
  const { nowMin: dlNowMin, elapsed: dlElapsed, progress: dlProgress, isDaytime, remainingH: dlRemainingH, remainingM: dlRemainingM } = daylightInfo

  const MainIcon = conditionIcons[weather.condition]

  return (
    <div className="space-y-6 animate-fade-in">
      {warnings.length > 0 && (
        <div className="grid gap-2">
          {warnings.map((w, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg shadow-black/10 ${w.bg}`}>
              <span className="text-base">{w.icon}</span>
              <span className={`text-sm font-medium ${w.color}`}>{w.text}</span>
            </div>
          ))}
        </div>
      )}

      <section className="relative overflow-hidden rounded-[36px] border border-border bg-surface/80 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className={`absolute inset-0 bg-gradient-to-br ${conditionPanels[weather.condition]}`} />
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/6 blur-3xl" />
        <div className="relative grid gap-6 p-5 md:grid-cols-[1.4fr_1fr] md:p-7">
          <div className="min-w-0">
            <div className="mb-7 flex flex-wrap items-center gap-2 text-text-muted" ref={pickerRef}>
              <div className="relative">
                <button
                  onClick={() => setShowCityPicker(prev => !prev)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background/55 px-3 py-2 text-sm font-medium text-text transition-all hover:border-primary/40 hover:bg-surface-lighter"
                >
                  <MapPin size={16} className="text-primary" />
                  {weather.city}
                  <ChevronDown size={13} className={`transition-transform ${showCityPicker ? 'rotate-180' : ''}`} />
                </button>
                {showCityPicker && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-3xl border border-border bg-surface/95 shadow-2xl shadow-black/35 backdrop-blur-xl">
                    <div className="border-b border-border p-3">
                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                          type="text"
                          value={citySearch}
                          onChange={(e) => setCitySearch(e.target.value)}
                          placeholder={t('weather.searchCity')}
                          className="input-field h-10 rounded-2xl pl-9 pr-9 text-sm"
                          autoFocus
                        />
                        {citySearch && (
                          <button
                            onClick={() => setCitySearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                            aria-label="清空搜索"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto p-2">
                      {filteredCities.length === 0 ? (
                        <div className="col-span-2 px-3 py-6 text-center text-sm text-text-muted">{t('weather.noCityFound')}</div>
                      ) : (
                        filteredCities.map((city) => (
                          <button
                            key={city}
                            onClick={() => {
                              setWeatherCity(city)
                              setShowCityPicker(false)
                              setCitySearch('')
                            }}
                            className={`rounded-2xl px-3 py-2 text-left text-sm transition-all hover:bg-surface-lighter ${
                              city === weatherCity ? 'bg-primary/10 font-semibold text-primary' : 'text-text'
                            }`}
                          >
                            {city}
                            {city === weatherCity && <span className="ml-1 text-[10px] text-primary">✓</span>}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={async () => {
                  setLocating(true)
                  const city = await detectCity()
                  if (city) setWeatherCity(city)
                  setLocating(false)
                }}
                disabled={locating}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background/55 text-text-muted transition-all hover:border-primary/40 hover:text-text disabled:opacity-50"
                aria-label={t('weather.autoLocate')}
                title={t('weather.autoLocate')}
              >
                <Crosshair size={16} className={locating ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => {
                  setRefreshing(true)
                  const delay = 200 + Math.random() * 300
                  setTimeout(() => {
                    setWeather(generateMockWeather(weatherCity))
                    setLastUpdated(Date.now())
                    setRefreshing(false)
                  }, delay)
                }}
                disabled={refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-background/55 px-3 text-sm text-text-muted transition-all hover:border-primary/40 hover:text-text disabled:opacity-50 md:ml-2"
                aria-label={t('weather.refresh')}
                title={t('weather.refresh')}
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                刷新
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="text-[5.5rem] font-black leading-none tracking-[-0.08em] text-text md:text-[7rem]">
                {weather.temp}<span className="ml-2 align-top text-4xl font-semibold tracking-normal text-text-muted">°C</span>
              </div>
              <div className="mb-3">
                <div className="text-2xl font-semibold text-text">{weather.description}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                  <span>{t('weather.feels')} {weather.feelsLike}°C</span>
                  {weather.feelsLike > weather.temp && <span className="text-orange-400">{t('weather.hotterThanActual')}</span>}
                  {weather.feelsLike < weather.temp && <span className="text-blue-400">{t('weather.colderThanActual')}</span>}
                  <span className={`rounded-full bg-background/50 px-2 py-1 ${comfortColor}`}>{comfort}</span>
                </div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-2">
              <MiniMetric icon={<Thermometer size={15} />} label="高低温" value={`${hourlyForecastLow}° / ${hourlyForecastHigh}°`} />
              <MiniMetric icon={<Umbrella size={15} />} label="降雨提醒" value={nextRainHour ? `${nextRainHour}` : '暂无'} />
              <MiniMetric icon={<Gauge size={15} />} label="舒适度" value={comfort} valueClassName={comfortColor} />
            </div>

            <div className="mt-5 text-xs text-text-muted">
              {t('weather.updatedAt')} {fmtHHmm(lastUpdated)}
              <span className="ml-1">({getRelativeTimeShort(lastUpdated) || t('weather.ago')})</span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[30px] border border-white/10 bg-background/35 p-5 shadow-inner shadow-white/5">
            <div className="flex justify-end">
              <MainIcon className={`h-28 w-28 md:h-36 md:w-36 ${conditionColors[weather.condition]} ${conditionAnimations[weather.condition]} opacity-90 drop-shadow-2xl`} />
            </div>
            <div className="mt-6 space-y-3">
              {advice.slice(0, 3).map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-surface/55 p-3">
                  <div className="text-xl">{item.icon}</div>
                  <div className="text-sm leading-5 text-text">{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {detailItems.map((detail) => {
          const Icon = detail.icon
          return (
            <div key={detail.label} className="rounded-[26px] border border-border bg-surface/75 p-4 shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-primary/30">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-lighter ${detail.color}`}>
                  <Icon size={18} />
                </div>
                {'sub' in detail && detail.sub && <span className={`min-w-0 truncate text-right text-[11px] font-medium ${detail.color}`} title={detail.sub}>{detail.sub}</span>}
              </div>
              <div className="text-xs text-text-muted">{detail.label}</div>
              <div className="mt-1 text-2xl font-semibold text-text">{detail.value}</div>
            </div>
          )
        })}
      </div>

      <section className="rounded-[30px] border border-border bg-surface/75 p-5 shadow-xl shadow-black/10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/12 text-orange-400">
              <Sunrise size={19} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">日光轨迹</h3>
              <p className="text-xs text-text-muted">{isDaytime ? `${t('weather.daylight')} ${fmtMin(daylightMin)}` : t('weather.night')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold text-text">
            <span>{weather.sunrise}</span>
            <span className="h-px w-8 bg-border" />
            <span>{weather.sunset}</span>
            <Sunset size={17} className="text-orange-500" />
          </div>
        </div>
        <div className="relative h-4 overflow-hidden rounded-full bg-surface-lighter">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${dlProgress * 100}%`,
              background: isDaytime
                ? 'linear-gradient(90deg, #f59e0b, #fb923c, #38bdf8)'
                : 'linear-gradient(90deg, #1d4ed8, #8b5cf6)',
            }}
          />
          {isDaytime && (
            <div
              className="absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-orange-300 shadow-[0_0_24px_rgba(251,146,60,0.8)] ring-4 ring-orange-300/20 transition-all duration-1000"
              style={{ left: `calc(${dlProgress * 100}% - 12px)` }}
            />
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-text-muted">
            {isDaytime ? t('weather.sunriseTime') : t('weather.sunsetTime')} {isDaytime ? fmtMin(dlElapsed, t('weather.ago')) : fmtMin(sunriseMin + 1440 - dlNowMin, t('weather.ago'))}
          </span>
          <span className={`font-medium ${isDaytime ? 'text-orange-400' : 'text-purple-400'}`}>
            {isDaytime ? tWith('weather.remainingDaylight', dlRemainingH, dlRemainingM) : (dlNowMin > sunsetMin ? t('weather.afterSunset') : t('weather.beforeDawn'))}
          </span>
        </div>
      </section>

      <section className="rounded-[30px] border border-border bg-surface/75 p-5 shadow-xl shadow-black/10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text">逐小时预报</h3>
            <p className="mt-1 text-xs text-text-muted">
              未来 24 小时 · {hourlyForecastLow}°/{hourlyForecastHigh}°
              {nextRainHour && <span className="ml-2 text-blue-400">预计 {nextRainHour} 降雨概率升高</span>}
            </p>
          </div>
          <div className="hidden items-center gap-3 rounded-full border border-border bg-background/45 px-3 py-1.5 text-xs text-text-muted sm:flex">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" />晴</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" />雨</span>
          </div>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {weather.hourlyForecast.map((item, index) => {
            const Icon = conditionIcons[item.condition]
            const isNow = index === 0
            const isRainLikely = item.precipitation >= 50
            const tempPosition = ((item.temp - hourlyForecastLow) / Math.max(hourlyForecastHigh - hourlyForecastLow, 1)) * 46
            return (
              <div
                key={`${item.time}-${index}`}
                className={`relative min-w-[112px] overflow-hidden rounded-[24px] border p-3 transition-all hover:-translate-y-0.5 ${
                  isNow
                    ? 'border-primary/45 bg-primary/10 shadow-lg shadow-primary/10'
                    : isRainLikely
                      ? 'border-blue-500/30 bg-blue-500/10'
                      : 'border-border/70 bg-background/45 hover:border-primary/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`text-xs font-semibold ${isNow ? 'text-primary' : 'text-text-muted'}`}>{item.time}</div>
                  {isNow && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">当前</span>}
                </div>
                <div className="mt-4 h-16">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-lighter transition-all"
                    style={{ transform: `translateY(${46 - tempPosition}px)` }}
                  >
                    <Icon size={22} className={conditionColors[item.condition]} />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-semibold text-text">{item.temp}°</div>
                <div className="text-[11px] text-text-muted">体感 {item.feelsLike}° · {item.windSpeed} km/h</div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-text-muted">降雨</span>
                    <span className={isRainLikely ? 'font-semibold text-blue-400' : 'text-text-muted'}>{item.precipitation}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className={`h-full rounded-full ${isRainLikely ? 'bg-blue-400' : 'bg-primary/70'}`}
                      style={{ width: `${item.precipitation}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[30px] border border-border bg-surface/75 p-5 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text">{t('weather.todayTemp')}</h3>
              <p className="mt-1 text-xs text-text-muted">温差 {hourlyHigh - hourlyLow}° · 最高 <span className="text-orange-400">{hourlyHigh}°</span> / 最低 <span className="text-blue-400">{hourlyLow}°</span></p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6 xl:grid-cols-3 2xl:grid-cols-6">
            {weather.hourlyTemp.map((h, i) => {
              const isHighest = h.temp === hourlyHigh
              const isLowest = h.temp === hourlyLow
              const prevTemp = i > 0 ? weather.hourlyTemp[i - 1].temp : null
              const diff = prevTemp !== null ? h.temp - prevTemp : 0
              const isCurrentPeriod = i === currentPeriodIdx
              return (
                <div key={h.label} className={`rounded-3xl border p-3 text-center transition-all ${isCurrentPeriod ? 'border-primary/40 bg-primary/10' : isHighest ? 'border-orange-500/25 bg-orange-500/10' : isLowest ? 'border-blue-500/25 bg-blue-500/10' : 'border-border bg-background/45'}`}>
                  <div className="mb-2 text-2xl">{h.icon}</div>
                  <div className="mb-1 text-[11px] text-text-muted">{h.label}</div>
                  <div className={`text-lg font-semibold ${isHighest ? 'text-orange-400' : isLowest ? 'text-blue-400' : 'text-text'}`}>{h.temp}°</div>
                  {diff !== 0 && <div className={`text-[11px] ${diff > 0 ? 'text-orange-400' : 'text-blue-400'}`}>{diff > 0 ? '↑' : '↓'}{Math.abs(diff)}°</div>}
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-[30px] border border-border bg-surface/75 p-5 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-text">{t('weather.weeklyForecast')}</h3>
              <p className="mt-1 text-xs text-text-muted">
                {sunnyDays > 0 && <span className="text-yellow-400">{tWith('weather.sunnyDays', sunnyDays)}</span>}
                {sunnyDays > 0 && rainyDays > 0 && <span> · </span>}
                {rainyDays > 0 && <span className="text-blue-400">{tWith('weather.rainyDays', rainyDays)}</span>}
                {(sunnyDays > 0 || rainyDays > 0) && <span> · </span>}
                <span>{tWith('weather.tempRange', avgLow, avgHigh)}</span>
              </p>
            </div>
            {bestDayIdx > 0 && weather.forecast[bestDayIdx].condition === 'sunny' && (
              <span className="rounded-full border border-yellow-500/25 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">{t('weather.bestDay')}: {weather.forecast[bestDayIdx].day}</span>
            )}
          </div>
          <div className="grid gap-2">
            {weather.forecast.map((day, i) => {
              const Icon = conditionIcons[day.condition]
              const isToday = i === 0
              const isBestDay = i === bestDayIdx && !isToday && weather.forecast[bestDayIdx].condition === 'sunny'
              const diff = !isToday ? day.temp - weather.forecast[0].temp : 0
              const barLeft = ((day.low - globalMin) / forecastRange) * 100
              const barWidth = ((day.high - day.low) / forecastRange) * 100
              return (
                <div
                  key={day.day}
                  className={`grid grid-cols-[4.5rem_2.5rem_1fr_4.5rem] items-center gap-3 rounded-2xl border px-3 py-2 transition-all ${
                    isToday ? 'border-primary/35 bg-primary/10' :
                    isBestDay ? 'border-yellow-500/25 bg-yellow-500/10' :
                    'border-border/70 bg-background/40 hover:border-primary/25'
                  }`}
                >
                  <div className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-text'}`}>{day.day === '今天' ? t('weather.today') : day.day}</div>
                  <Icon size={22} className={`${conditionColors[day.condition]} ${isToday ? conditionAnimations[day.condition] : ''}`} />
                  <div>
                    <div className="relative h-2 rounded-full bg-surface-lighter">
                      <div
                        className="absolute h-full rounded-full bg-gradient-to-r from-blue-400 via-cyan-400 to-orange-400"
                        style={{ left: `${barLeft}%`, width: `${Math.max(barWidth, 8)}%` }}
                      />
                    </div>
                    {!isToday && Math.abs(diff) >= 2 && (
                      <div className={`mt-1 text-[10px] ${diff > 0 ? 'text-orange-400' : 'text-blue-400'}`}>{diff > 0 ? '升温' : '降温'} {Math.abs(diff)}°</div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 text-sm font-semibold">
                    <span className="text-blue-400">{day.low}°</span>
                    <span className="text-text-muted">/</span>
                    <span className="text-orange-400">{day.high}°</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function MiniMetric({
  icon,
  label,
  value,
  valueClassName = 'text-text',
}: {
  icon: ReactNode
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-3xl border border-border bg-background/45 p-3 shadow-inner shadow-white/5">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-2xl bg-surface-lighter text-primary">
        {icon}
      </div>
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className={`mt-1 truncate text-sm font-semibold ${valueClassName}`}>{value}</div>
    </div>
  )
}
