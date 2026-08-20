import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCommandMacroSuggestions } from './commandMacros.ts'

test('buildCommandMacroSuggestions matches work and review macros', () => {
  const work = buildCommandMacroSuggestions('开始工作')
  const review = buildCommandMacroSuggestions('晚间复盘')

  assert.equal(work[0].id, 'macro-start-work')
  assert.deepEqual(work[0].steps, ['打开任务流', '进入专注模式', '开启防打扰'])
  assert.equal(review[0].id, 'macro-evening-review')
  assert.equal(review[0].label.includes('晚间复盘'), true)
})

test('buildCommandMacroSuggestions returns empty for unrelated query', () => {
  assert.deepEqual(buildCommandMacroSuggestions('随便搜'), [])
})
