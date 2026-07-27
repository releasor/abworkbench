import assert from 'node:assert/strict'
import test from 'node:test'

import { getPeriod, stripMarkdown } from './notePreview.ts'

test('stripMarkdown turns rich note markdown into compact plain preview text', () => {
  const markdown = `# 今日复盘

- [x] 完成 **核心任务**
- [ ] 跟进 [项目文档](https://example.com)

> 保留重点

\`npm run build\`

\`\`\`ts
const value = 1
\`\`\``

  assert.equal(stripMarkdown(markdown), '今日复盘 ✓ 完成 核心任务 ○ 跟进 项目文档 保留重点 npm run build [代码]')
})

test('getPeriod labels hours as morning afternoon or evening', () => {
  assert.equal(getPeriod(8), '上午')
  assert.equal(getPeriod(12), '下午')
  assert.equal(getPeriod(17), '下午')
  assert.equal(getPeriod(18), '晚上')
})
