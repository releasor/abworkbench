import assert from 'node:assert/strict'
import test from 'node:test'

import { getIsolatedCachePaths } from './desktopReliability.ts'

test('getIsolatedCachePaths keeps cache under user data directory', () => {
  const paths = getIsolatedCachePaths('C:/Users/demo/AppData/Roaming/Abworkbench')

  assert.equal(paths.cacheDir.endsWith('Abworkbench\\Cache') || paths.cacheDir.endsWith('Abworkbench/Cache'), true)
  assert.equal(paths.sessionDataDir.endsWith('Abworkbench\\SessionData') || paths.sessionDataDir.endsWith('Abworkbench/SessionData'), true)
})
