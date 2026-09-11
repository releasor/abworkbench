import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const CHECKED_FILES = [
  'src/App.tsx',
  'src/components/layout/Header.tsx',
  'src/components/settings/SettingsPage.tsx',
  'src/modules/taskflow/hooks/useTaskStore.ts',
]

test('user-facing Chinese strings do not contain mojibake placeholders', () => {
  const offenders = CHECKED_FILES
    .map((file) => ({ file, content: readFileSync(join(process.cwd(), file), 'utf8') }))
    .filter(({ content }) => content.includes('????'))
    .map(({ file }) => file)

  assert.deepEqual(offenders, [])
})

test('production source does not write debug output to console.log', () => {
  const taskflowSources = [
    'src/modules/taskflow/hooks/useTaskStore.ts',
    'src/modules/taskflow/utils/api.ts',
    'src/modules/taskflow/utils/offlineAdapter.ts',
    'src/modules/taskflow/utils/toastEvent.ts',
  ]
  const offenders = taskflowSources
    .map((file) => ({ file, content: readFileSync(join(process.cwd(), file), 'utf8') }))
    .filter(({ content }) => content.includes('console.log'))
    .map(({ file }) => file)

  assert.deepEqual(offenders, [])
})
