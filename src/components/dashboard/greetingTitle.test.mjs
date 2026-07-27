import assert from 'node:assert/strict'
import test from 'node:test'

import { formatGreetingTitle } from './greetingTitle.ts'

test('formatGreetingTitle omits the default friend fallback when no name is set', () => {
  assert.equal(formatGreetingTitle('早上好', ''), '早上好')
})

test('formatGreetingTitle includes the user name when one is set', () => {
  assert.equal(formatGreetingTitle('早上好', '小明'), '早上好，小明')
})
