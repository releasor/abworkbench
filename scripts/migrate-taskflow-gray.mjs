import fs from 'node:fs'
import path from 'node:path'

const root = 'src/modules/taskflow'
const replacements = [
  [/dark:hover:bg-gray-700/g, ''],
  [/dark:hover:bg-gray-800/g, ''],
  [/dark:hover:text-gray-300/g, ''],
  [/dark:hover:text-gray-200/g, ''],
  [/hover:bg-gray-100/g, 'hover:bg-surface-lighter'],
  [/hover:bg-gray-50/g, 'hover:bg-surface-lighter'],
  [/hover:bg-gray-200/g, 'hover:bg-surface-lighter'],
  [/hover:text-gray-600/g, 'hover:text-text'],
  [/hover:text-gray-700/g, 'hover:text-text'],
  [/hover:text-gray-900/g, 'hover:text-text'],
  [/hover:text-gray-300/g, 'hover:text-text'],
  [/dark:bg-gray-900\/20/g, ''],
  [/dark:bg-gray-800\/50/g, ''],
  [/dark:bg-gray-800/g, ''],
  [/dark:bg-gray-700/g, ''],
  [/dark:bg-gray-900/g, ''],
  [/dark:bg-gray-100/g, ''],
  [/dark:text-gray-100/g, ''],
  [/dark:text-gray-200/g, ''],
  [/dark:text-gray-300/g, ''],
  [/dark:text-gray-400/g, ''],
  [/dark:text-gray-500/g, ''],
  [/dark:text-gray-600/g, ''],
  [/dark:border-gray-600/g, ''],
  [/dark:border-gray-700/g, ''],
  [/dark:border-gray-800/g, ''],
  [/dark:border-gray-200/g, ''],
  [/bg-gray-50/g, 'bg-surface-lighter'],
  [/bg-gray-100/g, 'bg-surface-lighter'],
  [/bg-gray-200/g, 'bg-surface-lighter'],
  [/bg-gray-700/g, 'bg-surface-lighter'],
  [/bg-gray-800/g, 'bg-surface-light'],
  [/bg-gray-900/g, 'bg-surface'],
  [/text-gray-900/g, 'text-text'],
  [/text-gray-800/g, 'text-text'],
  [/text-gray-700/g, 'text-text'],
  [/text-gray-600/g, 'text-text-muted'],
  [/text-gray-500/g, 'text-text-muted'],
  [/text-gray-400/g, 'text-text-muted'],
  [/text-gray-300/g, 'text-text-muted'],
  [/border-gray-100/g, 'border-border'],
  [/border-gray-200/g, 'border-border'],
  [/border-gray-300/g, 'border-border'],
  [/border-gray-600/g, 'border-border'],
  [/border-gray-700/g, 'border-border'],
  [/border-gray-800/g, 'border-border'],
  [/divide-gray-200/g, 'divide-border'],
  [/divide-gray-700/g, 'divide-border'],
  [/ring-gray-200/g, 'ring-border'],
  [/ring-gray-700/g, 'ring-border'],
]

function walk(dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(p)
  }
  return out
}

function cleanClasses(cls) {
  return cls.replace(/\s{2,}/g, ' ').trim()
}

let changed = 0
for (const file of walk(root)) {
  let text = fs.readFileSync(file, 'utf8')
  const orig = text
  for (const [re, to] of replacements) text = text.replace(re, to)
  text = text.replace(/className="([^"]*)"/g, (_, cls) => `className="${cleanClasses(cls)}"`)
  text = text.replace(/className=\{`([^`]*)`\}/g, (_, cls) => `className={\`${cleanClasses(cls)}\`}`)
  if (text !== orig) {
    fs.writeFileSync(file, text)
    changed++
    console.log('updated', file)
  }
}
console.log('filesChanged', changed)
