/**
 * Safe TaskFlow gray → semantic token migration.
 * Replaces whole Tailwind tokens only (avoids bg-gray-50 eating bg-gray-500).
 */
import fs from 'node:fs'
import path from 'node:path'

const root = 'src/modules/taskflow'

/** Longer / more specific tokens first */
const MAP = [
  ['dark:hover:bg-gray-700', ''],
  ['dark:hover:bg-gray-800', ''],
  ['dark:hover:bg-gray-600', ''],
  ['dark:hover:text-gray-300', ''],
  ['dark:hover:text-gray-200', ''],
  ['dark:hover:ring-offset-gray-800', ''],
  ['dark:bg-gray-950/80', 'bg-surface/80'],
  ['dark:bg-gray-950', 'bg-surface'],
  ['dark:bg-gray-900/20', ''],
  ['dark:bg-gray-900', ''],
  ['dark:bg-gray-800/50', ''],
  ['dark:bg-gray-800', ''],
  ['dark:bg-gray-700', ''],
  ['dark:bg-gray-600', ''],
  ['dark:bg-gray-100', ''],
  ['dark:text-gray-100', ''],
  ['dark:text-gray-200', ''],
  ['dark:text-gray-300', ''],
  ['dark:text-gray-400', ''],
  ['dark:text-gray-500', ''],
  ['dark:text-gray-600', ''],
  ['dark:border-gray-800', ''],
  ['dark:border-gray-700', ''],
  ['dark:border-gray-600', ''],
  ['dark:border-gray-200', ''],
  ['dark:divide-gray-800', ''],
  ['hover:bg-gray-100', 'hover:bg-surface-lighter'],
  ['hover:bg-gray-50', 'hover:bg-surface-lighter'],
  ['hover:bg-gray-200', 'hover:bg-surface-lighter'],
  ['hover:bg-gray-300', 'hover:bg-surface-lighter'],
  ['hover:bg-gray-600', 'hover:bg-surface-lighter'],
  ['hover:text-gray-900', 'hover:text-text'],
  ['hover:text-gray-700', 'hover:text-text'],
  ['hover:text-gray-600', 'hover:text-text'],
  ['hover:text-gray-300', 'hover:text-text'],
  ['bg-gray-950/30', 'bg-surface/40'],
  ['bg-gray-950', 'bg-surface'],
  ['bg-gray-900', 'bg-surface'],
  ['bg-gray-800', 'bg-surface-light'],
  ['bg-gray-700', 'bg-surface-lighter'],
  ['bg-gray-600', 'bg-surface-lighter'],
  ['bg-gray-500', 'bg-surface-lighter'],
  ['bg-gray-300', 'bg-surface-lighter'],
  ['bg-gray-200', 'bg-surface-lighter'],
  ['bg-gray-100', 'bg-surface-lighter'],
  ['bg-gray-50', 'bg-surface-lighter'],
  ['text-gray-950', 'text-text'],
  ['text-gray-900', 'text-text'],
  ['text-gray-800', 'text-text'],
  ['text-gray-700', 'text-text'],
  ['text-gray-600', 'text-text-muted'],
  ['text-gray-500', 'text-text-muted'],
  ['text-gray-400', 'text-text-muted'],
  ['text-gray-300', 'text-text-muted'],
  ['text-gray-200', 'text-text'],
  ['border-gray-900', 'border-border'],
  ['border-gray-800', 'border-border'],
  ['border-gray-700', 'border-border'],
  ['border-gray-600', 'border-border'],
  ['border-gray-500', 'border-border'],
  ['border-gray-300', 'border-border'],
  ['border-gray-200', 'border-border'],
  ['border-gray-100', 'border-border'],
  ['divide-gray-800', 'divide-border'],
  ['divide-gray-200', 'divide-border'],
  ['divide-gray-100', 'divide-border'],
  ['ring-gray-700', 'ring-border'],
  ['ring-gray-200', 'ring-border'],
  ['placeholder-gray-500', 'placeholder:text-text-muted'],
]

function walk(dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

function replaceToken(text, from, to) {
  // Match token boundaries: start / whitespace / quote / backtick / { 
  // and end similarly; preserve opacity suffix like /50
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[\\s"'\\\`{])(${escaped})(\\/[\\d.]+)?(?=$|[\\s"'\\\`}/])`, 'g')
  return text.replace(re, (_, pre, _tok, opacity = '') => `${pre}${to}${opacity || ''}`)
}

function cleanClasses(cls) {
  return cls.replace(/\s{2,}/g, ' ').trim()
}

let changed = 0
for (const file of walk(root)) {
  let text = fs.readFileSync(file, 'utf8')
  const orig = text
  for (const [from, to] of MAP) text = replaceToken(text, from, to)
  text = text.replace(/className="([^"]*)"/g, (_, cls) => `className="${cleanClasses(cls)}"`)
  text = text.replace(/className=\{`([^`]*)`\}/g, (_, cls) => `className={\`${cleanClasses(cls)}\`}`)
  if (text !== orig) {
    fs.writeFileSync(file, text)
    changed++
    console.log('updated', file)
  }
}
console.log('filesChanged', changed)
