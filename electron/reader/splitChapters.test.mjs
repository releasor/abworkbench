import assert from 'node:assert/strict'
import test from 'node:test'
import { splitChapters } from './splitChapters.ts'

test('splits on 第N章 headings', () => {
  const text = '前言\n第1章 开端\n内容甲\n第2章 发展\n内容乙'
  const chapters = splitChapters(text)
  assert.equal(chapters.length, 3)
  assert.match(chapters[1].title, /第1章/)
  assert.match(chapters[1].body, /内容甲/)
})

test('whole file is one chapter when no headings', () => {
  const chapters = splitChapters('只有一段没有章标题的正文')
  assert.equal(chapters.length, 1)
  assert.equal(chapters[0].title, '全文')
  assert.match(chapters[0].body, /只有一段/)
})

test('recognizes Chapter N', () => {
  const chapters = splitChapters('Chapter 1 Hello\nAAA\nChapter 2 World\nBBB')
  assert.ok(chapters.length >= 2)
  assert.match(chapters[0].title, /Chapter 1/i)
})
