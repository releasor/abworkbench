import fs from 'node:fs'
import path from 'node:path'

const root = 'src/modules/taskflow'

const replacements = [
  [/dark:bg-gray-950\/80/g, 'bg-surface/80'],
  [/dark:bg-gray-950/g, 'bg-surface'],
  [/dark:hover:bg-gray-600/g, ''],
  [/dark:hover:bg-gray-700/g, ''],
  [/hover:bg-gray-300/g, 'hover:bg-surface-lighter'],
  [/hover:bg-gray-600/g, 'hover:bg-surface-lighter'],
  [/bg-gray-950\/30/g, 'bg-surface/40'],
  [/bg-gray-300/g, 'bg-surface-lighter'],
  [/bg-gray-600/g, 'bg-surface-lighter'],
  [/text-gray-950/g, 'text-text'],
  [/text-gray-200/g, 'text-text'],
  [/text-gray-200/g, 'text-text'],
  [/border-gray-500/g, 'border-border'],
  [/border-gray-900/g, 'border-border'],
  [/divide-gray-100/g, 'divide-border'],
  [/divide-gray-800/g, 'divide-border'],
  [/dark:divide-gray-800/g, ''],
  [/dark:hover:ring-offset-gray-800/g, ''],
  [/text-gray-200/g, 'text-text'],
  [/placeholder-gray-500/g, 'placeholder:text-text-muted'],
  [/hover:bg-surface-lighter0/g, 'hover:bg-surface-light'],
  [/className="text-gray-200 dark:text-text"/g, 'className="text-surface-lighter"'],
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
