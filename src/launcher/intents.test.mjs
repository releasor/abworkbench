import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildLauncherItems,
  containsCJK,
  detectLocalPath,
  detectUrl,
  evaluateExpression,
  formatCalcResult,
  looksLikeMathExpression,
  looksTranslatable,
  matchCommands,
  stripFileSearchPrefix,
  stripTranslatePrefix,
  stripWebSearchPrefix,
} from './intents.ts'

test('stripTranslatePrefix recognizes 翻译 / fy / translate prefixes', () => {
  assert.equal(stripTranslatePrefix('翻译 你好世界'), '你好世界')
  assert.equal(stripTranslatePrefix('fy hello world'), 'hello world')
  assert.equal(stripTranslatePrefix('translate 早上好'), '早上好')
  assert.equal(stripTranslatePrefix('你好世界'), null)
})

test('stripFileSearchPrefix recognizes find / 文件 prefixes', () => {
  assert.equal(stripFileSearchPrefix('find package.json'), 'package.json')
  assert.equal(stripFileSearchPrefix('文件 周报'), '周报')
  assert.equal(stripFileSearchPrefix('ss report'), 'report')
  assert.equal(stripFileSearchPrefix('report'), null)
})

test('containsCJK and looksTranslatable detect translatable text', () => {
  assert.equal(containsCJK('你好'), true)
  assert.equal(containsCJK('hello'), false)
  assert.equal(looksTranslatable('你好世界'), true)
  assert.equal(looksTranslatable('hello world'), true)
  assert.equal(looksTranslatable('12'), false)
})

test('detectUrl accepts urls and domains only', () => {
  assert.equal(detectUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1')
  assert.equal(detectUrl('example.com'), 'https://example.com')
  assert.equal(detectUrl('www.example.com'), 'https://www.example.com')
  assert.equal(detectUrl('not a url'), null)
  assert.equal(detectUrl('翻译 x.com'), null)
  assert.equal(detectUrl('  https://github.com/prizm  '), 'https://github.com/prizm')
})

test('detectLocalPath recognizes Windows directories and files', () => {
  assert.deepEqual(detectLocalPath('E:\\Prizm\\abworkbench\\release\\'), {
    path: 'E:\\Prizm\\abworkbench\\release\\',
    pathKind: 'dir',
  })
  assert.deepEqual(detectLocalPath('E:/Prizm/abworkbench/release/'), {
    path: 'E:\\Prizm\\abworkbench\\release\\',
    pathKind: 'dir',
  })
  assert.deepEqual(
    detectLocalPath('E:\\Prizm\\abworkbench\\release\\Abworkbench Setup 1.0.0.exe'),
    {
      path: 'E:\\Prizm\\abworkbench\\release\\Abworkbench Setup 1.0.0.exe',
      pathKind: 'file',
    },
  )
  assert.deepEqual(
    detectLocalPath('"E:\\Prizm\\abworkbench\\release\\Abworkbench Setup 1.0.0.exe"'),
    {
      path: 'E:\\Prizm\\abworkbench\\release\\Abworkbench Setup 1.0.0.exe',
      pathKind: 'file',
    },
  )
  assert.equal(detectLocalPath('release\\'), null)
  assert.equal(detectLocalPath('github.com'), null)
})

test('buildLauncherItems opens typed local paths directly', () => {
  const dir = buildLauncherItems('E:\\Prizm\\abworkbench\\release\\')
  assert.equal(dir[0]?.kind, 'path')
  assert.equal(dir[0]?.pathKind, 'dir')
  assert.equal(dir.length, 1)

  const file = buildLauncherItems('E:\\Prizm\\abworkbench\\release\\Abworkbench Setup 1.0.0.exe')
  assert.equal(file[0]?.kind, 'path')
  assert.equal(file[0]?.pathKind, 'file')
  assert.equal(file.length, 1)
})

test('math expression detection and safe evaluation', () => {
  assert.equal(looksLikeMathExpression('1+2*3'), true)
  assert.equal(looksLikeMathExpression('(1+2)*3'), true)
  assert.equal(looksLikeMathExpression('1024'), false)
  assert.equal(looksLikeMathExpression('abc+1'), false)

  assert.equal(evaluateExpression('1+2*3'), 7)
  assert.equal(evaluateExpression('(1+2)*3'), 9)
  assert.equal(evaluateExpression('10/4'), 2.5)
  assert.equal(evaluateExpression('2^10'), 1024)
  assert.equal(evaluateExpression('-3+5'), 2)
  assert.equal(evaluateExpression('2(3+4)'), 14)
  assert.equal(evaluateExpression('1/0'), null)
  assert.equal(evaluateExpression('1+'), null)
})

test('formatCalcResult trims floating point noise', () => {
  assert.equal(formatCalcResult(7), '7')
  assert.equal(formatCalcResult(2.5), '2.5')
  assert.equal(formatCalcResult(0.1 + 0.2), '0.3')
})

test('matchCommands matches labels and keywords', () => {
  const matches = matchCommands('翻译', [])
  assert.equal(matches.length, 0)
  const withDefaults = matchCommands('fanqie')
  assert.equal(withDefaults[0].id, 'nav-pomodoro')
})

test('matchCommands finds stealth reader by 摸鱼 / novel', () => {
  assert.ok(matchCommands('摸鱼').some((c) => c.id === 'stealth-reader'))
  assert.ok(matchCommands('novel').some((c) => c.id === 'stealth-reader'))
  assert.ok(matchCommands('阅读').some((c) => c.id === 'stealth-reader'))
})

test('buildLauncherItems puts calculator result first', () => {
  const items = buildLauncherItems('1+2*3')
  assert.equal(items[0].kind, 'calc')
  assert.equal(items[0].result, '7')
})

test('stripWebSearchPrefix recognizes 搜索 / search prefixes', () => {
  assert.equal(stripWebSearchPrefix('搜索 react hooks'), 'react hooks')
  assert.equal(stripWebSearchPrefix('search typescript'), 'typescript')
  assert.equal(stripWebSearchPrefix('g vite'), 'vite')
  assert.equal(stripWebSearchPrefix('react hooks'), null)
})

test('buildLauncherItems offers websearch translate and file search for bare text', () => {
  const items = buildLauncherItems('性能优化方案')
  const kinds = items.map((item) => item.kind)
  assert.ok(kinds.includes('websearch'))
  assert.ok(kinds.includes('translate'))
  assert.ok(kinds.includes('everything'))
  const translate = items.find((item) => item.kind === 'translate')
  assert.equal(translate.text, '性能优化方案')
  const web = items.find((item) => item.kind === 'websearch')
  assert.equal(web.query, '性能优化方案')
})

test('buildLauncherItems opens typed urls directly', () => {
  const items = buildLauncherItems('github.com')
  assert.equal(items.length, 1)
  assert.equal(items[0].kind, 'url')
  assert.equal(items[0].url, 'https://github.com')
})

test('buildLauncherItems explicit prefixes produce explicit intents', () => {
  const translate = buildLauncherItems('fy good morning')[0]
  assert.equal(translate.kind, 'translate')
  assert.equal(translate.explicit, true)
  assert.equal(translate.text, 'good morning')

  const web = buildLauncherItems('搜索 electron')[0]
  assert.equal(web.kind, 'websearch')
  assert.equal(web.explicit, true)
  assert.equal(web.query, 'electron')

  const file = buildLauncherItems('find main.ts')[0]
  assert.equal(file.kind, 'everything')
  assert.equal(file.explicit, true)
  assert.equal(file.query, 'main.ts')
})

test('buildLauncherItems returns empty for blank input', () => {
  assert.deepEqual(buildLauncherItems('   '), [])
})
