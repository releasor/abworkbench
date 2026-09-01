import type { MouseEvent, ReactNode } from 'react'
import { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react'
import { Plus, Edit3, FileText, Palette, Search, X, Sparkles, CheckCircle2, CheckSquare, History } from 'lucide-react'
import { useStore } from '../../store'
import { showToast } from '../../modules/taskflow/utils/toastEvent'
import { eventMatchesShortcut, useShortcutStore } from '../../shortcuts'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { useToday } from '../../hooks/useToday'
import { getRelativeTime, dayNumToYMD } from '../../utils/format'
import { findRelatedTasksForNote } from './noteTaskLinks'
import { Kbd } from '../common/Kbd'
import { NoteListItem } from './NoteListItem'
import clsx from 'clsx'

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4']

const MARKDOWN_SYNTAX = [
  { syntax: '# Heading', desc: 'Heading' },
  { syntax: '**Bold**', desc: 'Bold text' },
  { syntax: '*Italic*', desc: 'Italic text' },
  { syntax: '`Code`', desc: 'Inline code' },
  { syntax: '```', desc: 'Code block' },
  { syntax: '- List', desc: 'Bullet list' },
  { syntax: '- [ ] Task', desc: 'Task item' },
  { syntax: '~~Delete~~', desc: 'Strikethrough' },
  { syntax: '> Quote', desc: 'Quote block' },
  { syntax: '| A | B |', desc: 'Table' },
]

const WORD_MILESTONES = [
  { threshold: 1000, label: 'Deep note', color: 'text-purple-400' },
  { threshold: 500, label: 'Long note', color: 'text-primary' },
  { threshold: 250, label: 'Medium note', color: 'text-success' },
  { threshold: 100, label: 'Short note', color: 'text-emerald-400' },
]

const MD_TOOLBAR = [
  { label: 'B', title: 'Bold (Ctrl+B)' },
  { label: 'I', title: 'Italic (Ctrl+I)' },
  { label: '~', title: 'Strikethrough' },
  { label: '`', title: 'Code block' },
  { label: '-', title: 'Bullet list' },
  { label: '#', title: 'Heading' },
  { label: 'Task', title: 'Task item' },
  { label: '---', title: 'Divider' },
  { label: '{}', title: 'Code block' },
  { label: 'Link', title: 'Link' },
]


function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase()
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) return '#'
  return url
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"]/g, (ch) => {
    if (ch === '&') return '&amp;'
    if (ch === '<') return '&lt;'
    if (ch === '>') return '&gt;'
    return '&quot;'
  })
}

function renderMarkdown(text: string): string {
  // Extract links first (before escaping), store placeholders
  const links: string[] = []
  let processed = text.replace(/\[(.+?)\]\((.+?)\)/g, (_match, label, url) => {
    const placeholder = `%%LINK${links.length}%%`
    const safeUrl = sanitizeUrl(url)
    links.push(`<a href="${safeUrl}" class="text-primary underline" target="_blank" rel="noopener">${escapeHtml(label)}</a>`)
    return placeholder
  })

  // Auto-detect plain URLs (not already in markdown links)
  processed = processed.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]>"'])/g, (_match, url) => {
    const placeholder = `%%LINK${links.length}%%`
    const display = url.length > 50 ? url.slice(0, 47) + '...' : url
    links.push(`<a href="${escapeHtml(url)}" class="text-primary underline" target="_blank" rel="noopener">${escapeHtml(display)}</a>`)
    return placeholder
  })

  // Extract code blocks before escaping
  const codeBlocks: string[] = []
  processed = processed.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const placeholder = `%%CODEBLOCK${codeBlocks.length}%%`
    const langLabel = lang ? `<div class="text-[10px] text-text-muted px-3 py-1 border-b border-border">${escapeHtml(lang)}</div>` : ''
    codeBlocks.push(`<pre class="my-3 rounded-lg bg-surface-lighter border border-border overflow-hidden">${langLabel}<code class="block p-3 text-sm font-mono text-text overflow-x-auto">${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`)
    return placeholder
  })

  // Extract code spans before escaping
  const codeSpans: string[] = []
  processed = processed.replace(/`(.+?)`/g, (_match, code) => {
    const placeholder = `%%CODE${codeSpans.length}%%`
    codeSpans.push(`<code class="px-1.5 py-0.5 bg-surface-lighter rounded text-sm font-mono text-primary">${escapeHtml(code)}</code>`)
    return placeholder
  })

  const escaped = escapeHtml(processed)

  let result = escaped
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-text mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-text mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-text mt-4 mb-2">$1</h1>')
    .replace(/^---$/gm, '<hr class="my-4 border-border" />')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-text">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del class="text-text-muted">$1</del>')
    .replace(/^- \[x\] (.+)$/gm, '<div class="flex items-center gap-2 ml-4 mb-1"><input type="checkbox" checked disabled class="rounded accent-primary" /><span class="line-through text-text-muted">$1</span></div>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="flex items-center gap-2 ml-4 mb-1"><input type="checkbox" disabled class="rounded accent-primary" /><span>$1</span></div>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/^&gt; (.+)$/gm, '<blockquote class="pl-3 border-l-2 border-primary/30 text-text-muted italic">$1</blockquote>')

  // Tables
  result = result.replace(/((?:^\|.+\|$\n?)+)/gm, (match) => {
    const rows = match.trim().split('\n').filter((r) => !/^\|\s*[-:]+[-| :]*$/.test(r))
    if (rows.length === 0) return match
    const headerCells = rows[0].split('|').slice(1, -1)
    const bodyRows = rows.slice(1)
    const header = `<tr>${headerCells.map((c) => `<th class="px-3 py-2 text-left text-xs font-semibold text-text border-b border-border bg-surface-lighter/50">${c.trim()}</th>`).join('')}</tr>`
    const body = bodyRows.map((row) => {
      const cells = row.split('|').slice(1, -1)
      return `<tr>${cells.map((c) => `<td class="px-3 py-2 text-sm text-text border-b border-border/50">${c.trim()}</td>`).join('')}</tr>`
    }).join('')
    return `<table class="w-full my-3 border border-border rounded-lg overflow-hidden"><thead>${header}</thead><tbody>${body}</tbody></table>`
  })

  result = result.replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>')

  // Restore links, code blocks, and code spans in a single pass
  const placeholderMap: Record<string, string> = {}
  for (let i = 0; i < links.length; i++) placeholderMap[`%%LINK${i}%%`] = links[i]
  for (let i = 0; i < codeBlocks.length; i++) placeholderMap[`%%CODEBLOCK${i}%%`] = codeBlocks[i]
  for (let i = 0; i < codeSpans.length; i++) placeholderMap[`%%CODE${i}%%`] = codeSpans[i]
  result = result.replace(/%%(?:CODEBLOCK|CODE|LINK)\d+%%/g, (match) => placeholderMap[match] ?? match)

  // Wrap consecutive <li> elements in <ul>/<ol>
  result = result.replace(/(<li class="ml-4 list-disc">[\s\S]*?<\/li>(<br\/>)?)+/g, (match) => {
    const items = match.replace(/<br\/>/g, '')
    return `<ul class="my-2">${items}</ul>`
  })
  result = result.replace(/(<li class="ml-4 list-decimal">[\s\S]*?<\/li>(<br\/>)?)+/g, (match) => {
    const items = match.replace(/<br\/>/g, '')
    return `<ol class="my-2">${items}</ol>`
  })

  return result
    .replace(/^/, '<p class="mb-2">')
    .replace(/$/, '</p>')
}

function markdownFromHtml(root: HTMLElement): string {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
    if (!(node instanceof HTMLElement)) return ''

    const children = () => Array.from(node.childNodes).map(walk).join('')
    const text = () => children().replace(/\n{3,}/g, '\n\n')

    switch (node.tagName.toLowerCase()) {
      case 'h1': return `# ${text().trim()}\n\n`
      case 'h2': return `## ${text().trim()}\n\n`
      case 'h3': return `### ${text().trim()}\n\n`
      case 'strong':
      case 'b': return `**${text()}**`
      case 'em':
      case 'i': return `*${text()}*`
      case 'del':
      case 's': return `~~${text()}~~`
      case 'code': return node.closest('pre') ? text() : `\`${text()}\``
      case 'pre': return `\`\`\`\n${text().trimEnd()}\n\`\`\`\n\n`
      case 'blockquote':
        return `${text().trim().split('\n').map((line) => `> ${line}`).join('\n')}\n\n`
      case 'a': {
        const href = node.getAttribute('href') || ''
        return href ? `[${text()}](${href})` : text()
      }
      case 'img': return `![image](${node.getAttribute('src') || ''})`
      case 'li': return `- ${text().trim()}\n`
      case 'ul':
      case 'ol': return `${children()}\n`
      case 'br': return '\n'
      case 'hr': return '\n---\n\n'
      case 'div':
      case 'p': {
        const value = text().trim()
        return value ? `${value}\n\n` : '\n'
      }
      default: return children()
    }
  }

  return Array.from(root.childNodes)
    .map(walk)
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function NotesList() {
  const notes = useStore((s) => s.notes)
  const noteFolders = useStore((s) => s.noteFolders)
  const activeNoteId = useStore((s) => s.activeNoteId)
  const addNote = useStore((s) => s.addNote)
  const duplicateNote = useStore((s) => s.duplicateNote)
  const updateNote = useStore((s) => s.updateNote)
  const togglePinNote = useStore((s) => s.togglePinNote)
  const deleteNote = useStore((s) => s.deleteNote)
  const setActiveNote = useStore((s) => s.setActiveNote)
  const lastDeletedNoteRef = useRef<typeof notes[0] | null>(null)
  const addNoteFolder = useStore((s) => s.addNoteFolder)
  const tasks = useTaskStore((s) => s.tasks)
  const categories = useTaskStore((s) => s.categories)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const fetchCategories = useTaskStore((s) => s.fetchCategories)
  const { todayMidnightMs } = useToday()
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [showPreview, setShowPreview] = useState(false)

  const searchRegex = useMemo(
    () => deferredSearch ? new RegExp(`(${deferredSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi') : null,
    [deferredSearch]
  )
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const activeNote = useMemo(() => notes.find((n) => n.id === activeNoteId), [notes, activeNoteId])
  const relatedTasksByNoteId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof findRelatedTasksForNote>>()
    for (const note of notes) {
      map.set(note.id, findRelatedTasksForNote(note, tasks, categories))
    }
    return map
  }, [categories, notes, tasks])
  const activeRelatedTasks = activeNote ? relatedTasksByNoteId.get(activeNote.id) || [] : []

  useEffect(() => {
    void fetchTasks()
    void fetchCategories()
  }, [fetchCategories, fetchTasks])

  const countWords = useCallback((text: string) =>
    text.trim() ? text.trim().replace(/[一-鿿〿＀-￯]/g, (m) => ` ${m} `).split(/\s+/).filter(Boolean).length : 0, [])

  // Debounced content update to avoid persisting on every keystroke
  const [localContent, setLocalContent] = useState('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<{ id: string; content: string } | null>(null)
  const lastNoteIdRef = useRef<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      if (activeNote) {
        if (lastNoteIdRef.current !== activeNote.id) {
          // Switching notes: sync local content immediately
          setLocalContent(activeNote.content)
          lastNoteIdRef.current = activeNote.id
          setSaveStatus('idle')
        }
      } else {
        setLocalContent('')
        lastNoteIdRef.current = null
      }
    })
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        if (pendingSaveRef.current) {
          updateNote(pendingSaveRef.current.id, { content: pendingSaveRef.current.content })
          pendingSaveRef.current = null
        }
      }
    }
  }, [activeNote?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const debouncedUpdateContent = useCallback(
    (id: string, content: string) => {
      setLocalContent(content)
      setSaveStatus('saving')
      pendingSaveRef.current = { id, content }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        updateNote(id, { content })
        setSaveStatus('saved')
        pendingSaveRef.current = null
      }, 300)
    },
    [updateNote]
  )

  const flushPendingContent = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (pendingSaveRef.current) {
      updateNote(pendingSaveRef.current.id, { content: pendingSaveRef.current.content })
      pendingSaveRef.current = null
    }
  }, [updateNote])

  // Flush pending content on unmount, hide, or page close (Electron may hide without unmount)
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushPendingContent()
    }
    window.addEventListener('pagehide', flushPendingContent)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flushPendingContent)
      document.removeEventListener('visibilitychange', onHide)
      flushPendingContent()
    }
  }, [flushPendingContent])

  const renderedMarkdown = useMemo(() => renderMarkdown(localContent), [localContent])

  const editorStats = useMemo(() => {
    const ageDays = Math.floor((todayMidnightMs - (activeNote?.createdAt || 0)) / 86400000)
    const ageLabel = ageDays <= 0 ? null : ageDays <= 7 ? `${ageDays} 天前` : ageDays <= 30 ? `${Math.floor(ageDays / 7)} 周前` : `${Math.floor(ageDays / 30)} 月前`
    const wordCount = countWords(localContent)
    const milestone = WORD_MILESTONES.find((m) => wordCount >= m.threshold)
    const progress = Math.min(wordCount / 500, 1)
    const lineCount = localContent.split('\n').length
    const readingMin = localContent.length > 0 ? Math.max(1, Math.ceil(localContent.length / 400)) : 0
    const relativeTime = activeNote ? getRelativeTime(activeNote.updatedAt) : ''
    return { ageLabel, wordCount, milestone, progress, lineCount, readingMin, relativeTime }
  }, [localContent, activeNote, countWords, todayMidnightMs])

  const noteStats = useMemo(() => {
    const DAY = 86400000
    const todayDayNum = Math.floor(todayMidnightMs / DAY)
    const todayDay = (todayDayNum + 4) % 7
    const weekStartTime = todayMidnightMs - ((todayDay === 0 ? 6 : todayDay - 1) * DAY)
    const monthStartTime = todayMidnightMs - (dayNumToYMD(todayDayNum).d - 1) * DAY

    let pinnedCount = 0; let todayNew = 0; let weekNew = 0; let monthNew = 0; let totalChars = 0
    const todayCreatedIds = new Set<string>()
    for (const n of notes) {
      if (n.pinned) pinnedCount++
      totalChars += n.content.length
      if (n.createdAt >= todayMidnightMs) { todayNew++; todayCreatedIds.add(n.id) }
      if (n.createdAt >= weekStartTime) weekNew++
      if (n.createdAt >= monthStartTime) monthNew++
    }
    const avgChars = notes.length > 0 ? Math.round(totalChars / notes.length) : 0
    const readingMin = Math.max(1, Math.ceil(totalChars / 400))
    return { pinnedCount, todayNew, weekNew, monthNew, totalChars, avgChars, readingMin, todayCreatedIds }
  }, [notes, todayMidnightMs])

  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'title' | 'wordCount'>('updatedAt')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const allNoteTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const n of notes) { for (const t of n.tags || []) tagSet.add(t) }
    return [...tagSet].sort()
  }, [notes])

  const filteredNotes = useMemo(() => {
    const q = deferredSearch.toLowerCase()
    let list = q
      ? notes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q)
        )
      : notes

    if (selectedTag) {
      list = list.filter((n) => (n.tags || []).includes(selectedTag))
    }

    if (selectedFolderId) {
      list = list.filter((n) => n.folderId === selectedFolderId)
    }

    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'zh')
      if (sortBy === 'createdAt') return b.createdAt - a.createdAt
      if (sortBy === 'wordCount') return countWords(b.content) - countWords(a.content)
      return b.updatedAt - a.updatedAt
    }).map((n) => ({
      ...n,
      relativeTime: getRelativeTime(n.updatedAt),
      wordCount: countWords(n.content),
      readingMin: Math.max(1, Math.ceil(n.content.length / 400)),
    }))
  }, [notes, deferredSearch, countWords, sortBy, selectedTag, selectedFolderId])

  const highlightedNotes = useMemo(() => {
    if (!searchRegex) return null
    const map = new Map<string, { title: ReactNode[]; content: ReactNode[] }>()
    const hl = (text: string): ReactNode[] =>
      text.split(searchRegex!).map((part, i) =>
        part.toLowerCase() === deferredSearch.toLowerCase()
          ? <mark key={i} className="bg-warning/30 text-text rounded-sm px-0.5">{part}</mark>
          : part
      )
    for (const note of filteredNotes) {
      map.set(note.id, { title: hl(note.title), content: hl(note.content || '') })
    }
    return map
  }, [filteredNotes, searchRegex, deferredSearch])

  // Keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null)
  const visualEditorRef = useRef<HTMLDivElement>(null)
  const shortcutOverrides = useShortcutStore((s) => s.overrides)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (eventMatchesShortcut('notesSave', e)) {
        e.preventDefault()
        flushPendingContent()
        if (pendingSaveRef.current === null) setSaveStatus('saved')
        return
      }
      if (eventMatchesShortcut('notesClose', e)) {
        if (activeNoteId && target !== searchInputRef.current) {
          e.preventDefault()
          setActiveNote(null)
          return
        }
      }
      if (target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (eventMatchesShortcut('notesBold', e)) {
          e.preventDefault()
          document.execCommand('bold')
          return
        }
        if (eventMatchesShortcut('notesItalic', e)) {
          e.preventDefault()
          document.execCommand('italic')
          return
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && lastDeletedNoteRef.current) {
        e.preventDefault()
        const restored = lastDeletedNoteRef.current
        lastDeletedNoteRef.current = null
        useStore.setState((s) => ({
          notes: [restored, ...s.notes.filter((n) => n.id !== restored.id)],
          activeNoteId: restored.id,
        }))
        showToast('已恢复笔记', 'success')
        return
      }
      if (eventMatchesShortcut('notesNewGlobal', e) || eventMatchesShortcut('notesNew', e)) {
        e.preventDefault()
        addNote()
        return
      }
      if (eventMatchesShortcut('notesPreview', e)) {
        e.preventDefault()
        setShowPreview((prev) => !prev)
        return
      }
      if (target.tagName !== 'INPUT' && eventMatchesShortcut('notesSearch', e)) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [addNote, activeNoteId, flushPendingContent, setActiveNote, shortcutOverrides])

  const exportNote = (note: typeof notes[0]) => {
    flushPendingContent()
    const content = note.id === activeNote?.id ? localContent : (useStore.getState().notes.find((n) => n.id === note.id)?.content ?? note.content)
    const blob = new Blob([`# ${note.title}\n\n${content}`], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${note.title}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async (note: typeof notes[0]) => {
    flushPendingContent()
    const content = note.id === activeNote?.id ? localContent : (useStore.getState().notes.find((n) => n.id === note.id)?.content ?? note.content)
    const text = `# ${note.title}\n\n${content}`
    try {
      await navigator.clipboard.writeText(text)
      showToast('已复制到剪贴板', 'success')
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      showToast('已复制到剪贴板', 'success')
    }
  }

  const handleDeleteNote = useCallback((note: typeof notes[0]) => {
    flushPendingContent()
    const snapshot = useStore.getState().notes.find((n) => n.id === note.id) || note
    const content = note.id === activeNote?.id ? localContent : snapshot.content
    lastDeletedNoteRef.current = { ...snapshot, content }
    deleteNote(note.id)
    setShowColorPicker(null)
    showToast(`已删除笔记：${snapshot.title}（Ctrl+Z 可撤销）`, 'info', {
      label: '撤销',
      onClick: () => {
        const restored = lastDeletedNoteRef.current
        if (!restored) return
        lastDeletedNoteRef.current = null
        useStore.setState((s) => ({
          notes: [restored, ...s.notes.filter((n) => n.id !== restored.id)],
          activeNoteId: restored.id,
        }))
        showToast('已恢复笔记', 'success')
      },
    }, 10_000)
  }, [activeNote?.id, deleteNote, flushPendingContent, localContent])

  useEffect(() => {
    if (!activeNote || !visualEditorRef.current || showPreview) return
    if (document.activeElement === visualEditorRef.current) return
    visualEditorRef.current.innerHTML = renderMarkdown(localContent)
  }, [activeNote, localContent, showPreview])

  const syncVisualEditor = useCallback(() => {
    if (!activeNote || !visualEditorRef.current) return
    const content = markdownFromHtml(visualEditorRef.current)
    debouncedUpdateContent(activeNote.id, content)
  }, [activeNote, debouncedUpdateContent])

  const applyVisualCommand = useCallback((tool: typeof MD_TOOLBAR[number]) => {
    const editor = visualEditorRef.current
    if (!editor) return
    setShowPreview(false)
    editor.focus()

    const label = tool.label
    if (label === 'B') document.execCommand('bold')
    else if (label === 'I') document.execCommand('italic')
    else if (label === '~') document.execCommand('strikeThrough')
    else if (label === '`') document.execCommand('formatBlock', false, 'pre')
    else if (label === '-') document.execCommand('insertUnorderedList')
    else if (label === '#') document.execCommand('formatBlock', false, 'h2')
    else if (label === 'Task') document.execCommand('insertHTML', false, '<div>- [ ] Task</div>')
    else if (label === '---') document.execCommand('insertHorizontalRule')
    else if (label === '{}') document.execCommand('formatBlock', false, 'pre')
    else if (label === 'Link') {
      const url = window.prompt('Link URL')
      if (url) document.execCommand('createLink', false, url)
    }

    requestAnimationFrame(syncVisualEditor)
  }, [syncVisualEditor])

  return (
    <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)] xl:h-[calc(100vh-128px)] animate-fade-in">
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-[20px] border border-border bg-surface/80 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="border-b border-border px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-text">灵感收纳箱</h2>
              <p className="mt-0.5 text-[10px] text-text-muted">
                {notes.length} 篇 · {noteStats.pinnedCount} 置顶 · 本周 {noteStats.weekNew}
              </p>
            </div>
            <button onClick={addNote} className="btn-primary h-7 shrink-0 rounded-lg px-2.5 text-[11px]">
              <Plus size={13} />
              新建
            </button>
          </div>
        </div>

        {/* Folder list */}
        {noteFolders.length > 0 && (
          <div className="flex flex-wrap gap-1 px-2.5 pb-1">
            <button
              onClick={() => setSelectedFolderId('')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${!selectedFolderId ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              全部
            </button>
            {noteFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id === selectedFolderId ? '' : folder.id)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${selectedFolderId === folder.id ? 'text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                style={selectedFolderId === folder.id ? { backgroundColor: folder.color } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: folder.color }} />
                {folder.name}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1.5 px-2.5 pb-1">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && searchQuery) { e.preventDefault(); setSearchQuery('') } }}
              placeholder="搜索..."
              aria-label="搜索笔记"
              className="input-field h-8 rounded-lg pl-8 pr-7 text-[11px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="清除搜索"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="rounded-lg border border-border bg-background/45 px-2 py-1 text-[10px] text-text-muted">
              找到 <span className="font-semibold text-primary">{filteredNotes.length}</span> 个结果
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 px-2.5 pb-1">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-1.5 py-1 text-[10px] text-text-muted focus:border-primary focus:outline-none"
          >
            <option value="updatedAt">最近编辑</option>
            <option value="createdAt">创建时间</option>
            <option value="title">标题</option>
            <option value="wordCount">字数</option>
          </select>
          {allNoteTags.length > 0 && (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-1.5 py-1 text-[10px] text-text-muted focus:border-primary focus:outline-none"
            >
              <option value="">全部标签</option>
              {allNoteTags.map((tag) => (
                <option key={tag} value={tag}>#{tag}</option>
              ))}
            </select>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-1.5">
          {filteredNotes.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-border bg-background/45 p-8 text-center">
              <FileText size={40} className="mx-auto mb-3 text-text-muted opacity-50" />
              <p className="text-sm text-text-muted">{searchQuery ? '没有找到匹配的笔记' : '还没有笔记'}</p>
              {!searchQuery && (
                <p className="mt-3 text-xs text-text-muted">
                  按 <Kbd>Ctrl</Kbd> + <Kbd>N</Kbd> 新建第一篇
                </p>
              )}
            </div>
          ) : (
            filteredNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isActive={activeNoteId === note.id}
                highlighted={highlightedNotes?.get(note.id)}
                onSelect={() => {
                  setActiveNote(note.id)
                  setShowColorPicker(null)
                }}
                onPin={() => togglePinNote(note.id)}
                onDuplicate={() => duplicateNote(note.id)}
                onCopy={() => void copyToClipboard(note)}
                onExport={() => exportNote(note)}
                onDelete={() => handleDeleteNote(note)}
                onColorChange={(color) => updateNote(note.id, { color })}
              />
            ))
          )}
        </div>

        <div className="border-t border-border bg-background/30 px-2.5 py-1 text-[9px] text-text-muted">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span>{searchQuery && filteredNotes.length !== notes.length ? `${filteredNotes.length} / ${notes.length}` : notes.length} 篇笔记</span>
            {noteStats.todayNew > 0 && <span className="text-success">今日 {noteStats.todayNew} 篇</span>}
            {noteStats.monthNew > noteStats.weekNew && <span>本月 {noteStats.monthNew} 篇</span>}
            {notes.length > 0 && <span>{noteStats.totalChars.toLocaleString()} 字符</span>}
            {notes.length > 0 && <span>约 {noteStats.readingMin} 分钟阅读</span>}
          </div>
        </div>
      </aside>

      <main className="min-h-[520px] overflow-hidden rounded-[24px] border border-border bg-surface/80 shadow-2xl shadow-black/20 backdrop-blur-xl xl:min-h-0">
        {activeNote ? (
          <div className="flex h-full min-h-0 flex-col">
            <header
              className="relative overflow-visible border-b border-border px-3 py-2.5 md:px-4"
              style={{ background: `linear-gradient(135deg, ${activeNote.color}20, transparent 58%)` }}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <div className="relative">
                    <button
                      onClick={() => setShowColorPicker(showColorPicker === activeNote.id ? null : activeNote.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-lg transition-transform hover:scale-105"
                      style={{ backgroundColor: activeNote.color }}
                      title="更改颜色"
                      aria-label="更改颜色"
                    >
                      <Palette size={16} />
                    </button>
                    {showColorPicker === activeNote.id && (
                      <div className="absolute left-0 top-14 z-20">
                        <ColorPalette
                          selected={activeNote.color}
                          onPick={(color) => {
                            updateNote(activeNote.id, { color })
                            setShowColorPicker(null)
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={activeNote.title}
                      onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                      className="w-full bg-transparent text-2xl font-semibold leading-tight text-text outline-none placeholder:text-text-muted"
                      placeholder="笔记标题"
                      aria-label="笔记标题"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                      <span>最后编辑：{editorStats.relativeTime}</span>
                      {editorStats.ageLabel && <span>创建于 {editorStats.ageLabel}</span>}
                      {saveStatus === 'saving' && <span className="text-warning animate-pulse">保存中...</span>}
                      {saveStatus === 'saved' && <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 size={12} />已保存</span>}
                      {(activeNote.versions || []).length > 0 && (
                        <button
                          onClick={() => setShowVersions(!showVersions)}
                          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-text-muted transition hover:border-primary/30 hover:text-primary"
                        >
                          <History size={11} />
                          历史版本 ({(activeNote.versions || []).length})
                        </button>
                      )}
                    </div>

                    {/* Version history panel */}
                    {showVersions && (activeNote.versions || []).length > 0 && (
                      <div className="mt-3 rounded-2xl border border-border bg-background/50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-text">历史版本</span>
                          <button onClick={() => setShowVersions(false)} className="text-xs text-text-muted hover:text-text">关闭</button>
                        </div>
                        <div className="max-h-40 space-y-1.5 overflow-y-auto">
                          {[...(activeNote.versions || [])].reverse().map((v, i) => {
                            const idx = (activeNote.versions || []).length - 1 - i
                            return (
                              <div key={idx} className="flex items-center gap-2 rounded-xl bg-surface/50 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] text-text-muted">{new Date(v.savedAt).toLocaleString('zh-CN')}</div>
                                  <div className="mt-0.5 truncate text-xs text-text">{v.content.slice(0, 60) || '空白'}</div>
                                </div>
                                <button
                                  onClick={() => {
                                    updateNote(activeNote.id, { content: v.content })
                                    setShowVersions(false)
                                  }}
                                  className="flex-shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] text-text-muted transition hover:border-primary/30 hover:text-primary"
                                >
                                  恢复
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {(activeNote.tags || []).map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                          #{tag}
                          <button
                            onClick={() => updateNote(activeNote.id, { tags: (activeNote.tags || []).filter((t) => t !== tag) })}
                            className="ml-0.5 rounded-full hover:bg-primary/20 transition"
                            aria-label={`移除标签 ${tag}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder="添加标签..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault()
                            const val = (e.target as HTMLInputElement).value.trim().replace(/^#/, '')
                            if (val && !(activeNote.tags || []).includes(val)) {
                              updateNote(activeNote.id, { tags: [...(activeNote.tags || []), val] })
                            }
                            ;(e.target as HTMLInputElement).value = ''
                          }
                        }}
                        className="min-w-[80px] flex-1 bg-transparent text-xs text-text outline-none placeholder:text-text-muted"
                      />
                    </div>

                    {/* Folder assignment */}
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={activeNote.folderId || ''}
                        onChange={(e) => updateNote(activeNote.id, { folderId: e.target.value || undefined })}
                        className="rounded-lg border border-border bg-background/60 px-2 py-1 text-xs text-text-muted focus:border-primary focus:outline-none"
                      >
                        <option value="">未分类</option>
                        {noteFolders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowNewFolder(!showNewFolder)}
                        className="text-xs text-text-muted hover:text-primary transition"
                        title="新建文件夹"
                      >
                        +
                      </button>
                      {showNewFolder && (
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newFolderName.trim()) {
                              addNoteFolder(newFolderName.trim(), '#3b82f6')
                              setNewFolderName('')
                              setShowNewFolder(false)
                            }
                          }}
                          placeholder="文件夹名"
                          className="w-20 rounded-lg border border-border bg-background/60 px-2 py-1 text-xs outline-none"
                          autoFocus
                        />
                      )}
                    </div>

                    {activeRelatedTasks.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activeRelatedTasks.slice(0, 5).map((task) => (
                          <span
                            key={task.id}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
                            title={task.title}
                          >
                            <CheckSquare size={12} />
                            <span className="truncate">{task.title}</span>
                            <span className="text-text-muted">{task.status === 'done' ? '已完成' : '进行中'}</span>
                          </span>
                        ))}
                        {activeRelatedTasks.length > 5 && (
                          <span className="rounded-full bg-surface-lighter px-2.5 py-1 text-[11px] text-text-muted">
                            +{activeRelatedTasks.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <MetricPill label="字符" value={localContent.length} />
                  <MetricPill label="词" value={editorStats.wordCount} />
                  <MetricPill label="行" value={editorStats.lineCount} />
                  {editorStats.readingMin > 0 && <MetricPill label="阅读" value={`${editorStats.readingMin} 分钟`} />}
                </div>
              </div>
            </header>

            <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-background/30 px-3 py-2">
              {MD_TOOLBAR.map((tool) => (
                <button
                  key={tool.label}
                  title={tool.title}
                  aria-label={tool.title}
                  onClick={() => applyVisualCommand(tool)}
                  className="rounded-xl border border-border bg-surface/70 px-2.5 py-1.5 text-[11px] font-mono text-text-muted transition-all hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
                >
                  {tool.label}
                </button>
              ))}
              <button
                onClick={() => setShowPreview(!showPreview)}
                aria-expanded={showPreview}
                aria-label={showPreview ? '切换到编辑模式' : '切换到预览模式'}
                className={clsx(
                  'ml-auto rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-all',
                  showPreview ? 'border-primary/35 bg-primary/15 text-primary' : 'border-border bg-surface/70 text-text-muted hover:text-text',
                )}
                title={showPreview ? '编辑模式 (Ctrl+P)' : '预览模式 (Ctrl+P)'}
              >
                {showPreview ? '编辑模式' : '预览模式'}
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
              {showPreview ? (
                <div
                  className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-background/45 p-5 text-sm leading-7 text-text"
                  dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
                />
              ) : (
                <div
                  ref={visualEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Visual note editor"
                  onInput={syncVisualEditor}
                  onBlur={syncVisualEditor}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                      e.preventDefault()
                      setShowPreview((prev) => !prev)
                    }
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      document.execCommand('insertText', false, '  ')
                      requestAnimationFrame(syncVisualEditor)
                    }
                  }}
                  className="note-visual-editor min-h-0 flex-1 w-full overflow-auto rounded-2xl border border-border bg-surface-light/45 p-5 text-base leading-8 text-text outline-none transition-all focus:border-primary/40"
                  data-placeholder="开始写作..."
                />
              )}
            </div>

            <footer className="border-t border-border px-4 py-2">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
                <div className="flex items-center gap-2">
                  {editorStats.wordCount >= 50 && (
                    <>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-lighter">
                        <span
                          className="block h-full rounded-full bg-primary/70 transition-all duration-500"
                          style={{ width: `${editorStats.progress * 100}%` }}
                        />
                      </span>
                      {editorStats.milestone && <span className={`font-medium ${editorStats.milestone.color}`}>{editorStats.milestone.label}</span>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Kbd>Ctrl</Kbd><span>+</span><Kbd>P</Kbd><span>切换预览</span>
                  <Kbd>N</Kbd><span>新建</span>
                </div>
              </div>
            </footer>
          </div>
        ) : (
          <div className="flex h-full min-h-[520px] items-center justify-center p-6">
            <div className="max-w-xl text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-warning/10 text-warning">
                <Edit3 size={42} />
              </div>
              <h2 className="text-2xl font-semibold text-text">选择一篇笔记开始编辑</h2>
              <p className="mt-2 text-sm text-text-muted">也可以按 <Kbd>Ctrl</Kbd> + <Kbd>N</Kbd> 创建一篇新的灵感记录。</p>
              <div className="mt-6 rounded-[28px] border border-border bg-background/45 p-5 text-left">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-text">
                  <Sparkles size={16} className="text-primary" />
                  Markdown 语法参考
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {MARKDOWN_SYNTAX.map((item) => (
                    <div key={item.syntax} className="rounded-2xl border border-border bg-surface/65 p-3">
                      <code className="font-mono text-primary">{item.syntax}</code>
                      <div className="mt-1 text-[11px] text-text-muted">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function ColorPalette({
  selected,
  onPick,
}: {
  selected: string
  onPick: (color: string, event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <div className="mt-3 grid grid-cols-8 gap-2 rounded-2xl border border-border bg-surface/95 p-2 shadow-2xl shadow-black/25 backdrop-blur-xl">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={(event) => onPick(color, event)}
          title={color}
          aria-label={`选择颜色 ${color}`}
          className={clsx(
            'h-7 w-7 rounded-xl border transition-all hover:-translate-y-0.5',
            selected === color ? 'border-white/80 shadow-lg scale-105' : 'border-white/10',
          )}
          style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #000))` }}
        />
      ))}
    </div>
  )
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background/45 px-2 py-1 text-right">
      <div className="text-[9px] text-text-muted">{label}</div>
      <div className="text-xs font-semibold text-text">{value}</div>
    </div>
  )
}
