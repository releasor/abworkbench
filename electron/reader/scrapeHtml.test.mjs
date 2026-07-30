import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { extractChapterLinks, extractMainText, extractNextChapterHref } from './scrapeHtml.ts'

const dir = path.dirname(fileURLToPath(import.meta.url))
const html = fs.readFileSync(path.join(dir, 'fixtures/chapter-sample.html'), 'utf8')

test('extractMainText prefers #content', () => {
  assert.match(extractMainText(html), /第一段正文/)
})

test('extractNextChapterHref finds 下一章', () => {
  assert.equal(
    extractNextChapterHref(html, 'https://example.com/book/1.html'),
    'https://example.com/book/2.html',
  )
})

test('extractChapterLinks from list', () => {
  const links = extractChapterLinks(html, 'https://example.com/book/1.html')
  assert.ok(links.length >= 2)
  assert.ok(links.some((l) => /第1章/.test(l.title)))
})
