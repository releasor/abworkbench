import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

test('TaskFlow theme customizer uses shared app accent color store instead of legacy standalone storage key', () => {
  const source = readFileSync(join(process.cwd(), 'src/modules/taskflow/components/ThemeCustomizer.tsx'), 'utf8')

  assert.equal(source.includes("localStorage.getItem('accentColor')"), false)
  assert.equal(source.includes("localStorage.setItem('accentColor'"), false)
  assert.equal(source.includes("useStore"), true)
})
