import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_WORKDAY_SETTINGS,
  buildWorkdayStatus,
  formatCountdown,
  normalizeWorkdaySettings,
} from './workday.ts'

test('buildWorkdayStatus calculates countdown and earned salary during work hours', () => {
  const status = buildWorkdayStatus({
    now: new Date('2026-06-09T12:00:00+08:00'),
    settings: {
      startTime: '09:00',
      endTime: '18:00',
      monthlySalary: 22000,
      workdaysPerMonth: 22,
    },
  })

  assert.equal(status.phase, 'working')
  assert.equal(status.remainingMs, 6 * 60 * 60 * 1000)
  assert.equal(status.progress, 33)
  assert.equal(status.todayEarned, 333.33)
})

test('buildWorkdayStatus clamps earned salary before and after work', () => {
  const before = buildWorkdayStatus({
    now: new Date('2026-06-09T08:00:00+08:00'),
    settings: DEFAULT_WORKDAY_SETTINGS,
  })
  const after = buildWorkdayStatus({
    now: new Date('2026-06-09T19:00:00+08:00'),
    settings: { ...DEFAULT_WORKDAY_SETTINGS, monthlySalary: 22000, workdaysPerMonth: 22 },
  })

  assert.equal(before.phase, 'before')
  assert.equal(before.todayEarned, 0)
  assert.equal(after.phase, 'done')
  assert.equal(after.todayEarned, 1000)
})

test('formatCountdown includes hours minutes and seconds', () => {
  assert.equal(formatCountdown(3661000), '01:01:01')
})

test('normalizeWorkdaySettings keeps invalid values safe', () => {
  assert.deepEqual(normalizeWorkdaySettings({ startTime: 'bad', endTime: '07:00', monthlySalary: -1, workdaysPerMonth: 0 }), DEFAULT_WORKDAY_SETTINGS)
})

test('normalizeWorkdaySettings rejects non-finite salary numbers', () => {
  assert.deepEqual(
    normalizeWorkdaySettings({
      startTime: '09:00',
      endTime: '18:00',
      monthlySalary: Number.POSITIVE_INFINITY,
      workdaysPerMonth: Number.NaN,
    }),
    DEFAULT_WORKDAY_SETTINGS,
  )
})
