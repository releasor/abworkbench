import assert from 'node:assert/strict'
import test from 'node:test'

import { APP_PAGES, PAGE_TITLE_KEYS } from './pages.ts'

test('app navigation exposes only active workspace pages', () => {
  assert.deepEqual(APP_PAGES, ['dashboard', 'taskflow', 'pomodoro', 'habits', 'notes', 'reminders', 'weather', 'mineradio', 'settings'])
  assert.deepEqual(Object.keys(PAGE_TITLE_KEYS), APP_PAGES)
})
