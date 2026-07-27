export interface ParsedAccelerator {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  key: string
}

const KEY_ALIASES: Record<string, string> = {
  space: ' ',
  esc: 'escape',
  escape: 'escape',
  return: 'enter',
  enter: 'enter',
  del: 'delete',
  delete: 'delete',
  left: 'arrowleft',
  right: 'arrowright',
  up: 'arrowup',
  down: 'arrowdown',
  arrowleft: 'arrowleft',
  arrowright: 'arrowright',
  arrowup: 'arrowup',
  arrowdown: 'arrowdown',
  plus: '+',
  minus: '-',
}

/** Normalize user/Electron accelerator to a comparable canonical form. */
export function normalizeAccelerator(raw: string): string {
  const parsed = parseAccelerator(raw)
  if (!parsed) return ''
  return formatAccelerator(parsed)
}

export function parseAccelerator(raw: string): ParsedAccelerator | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const parts = trimmed.split('+').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null

  let ctrl = false
  let alt = false
  let shift = false
  let meta = false
  let key = ''

  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'ctrl' || lower === 'control' || lower === 'cmdorctrl' || lower === 'commandorcontrol') {
      ctrl = true
      continue
    }
    if (lower === 'cmd' || lower === 'command' || lower === 'meta' || lower === 'super' || lower === 'win') {
      meta = true
      continue
    }
    if (lower === 'alt' || lower === 'option') {
      alt = true
      continue
    }
    if (lower === 'shift') {
      shift = true
      continue
    }
    key = KEY_ALIASES[lower] ?? (part.length === 1 ? part.toLowerCase() : lower)
  }

  if (!key) return null
  return { ctrl, alt, shift, meta, key }
}

export function formatAccelerator(parsed: ParsedAccelerator): string {
  const parts: string[] = []
  if (parsed.ctrl) parts.push('Ctrl')
  if (parsed.alt) parts.push('Alt')
  if (parsed.shift) parts.push('Shift')
  if (parsed.meta) parts.push('Super')

  const displayKey =
    parsed.key === ' '
      ? 'Space'
      : parsed.key === 'escape'
        ? 'Escape'
        : parsed.key === 'delete'
          ? 'Delete'
          : parsed.key === 'enter'
            ? 'Enter'
            : parsed.key.startsWith('arrow')
              ? parsed.key.replace('arrow', 'Arrow').replace('left', 'Left').replace('right', 'Right').replace('up', 'Up').replace('down', 'Down')
              : parsed.key.length === 1
                ? parsed.key.toUpperCase()
                : parsed.key.charAt(0).toUpperCase() + parsed.key.slice(1)

  parts.push(displayKey)
  return parts.join('+')
}

/** Convert a KeyboardEvent into an accelerator string (for recording). */
export function acceleratorFromEvent(event: KeyboardEvent): string | null {
  const lower = event.key.toLowerCase()
  if (['control', 'shift', 'alt', 'meta'].includes(lower)) return null

  const key =
    event.code === 'Space' || event.key === ' '
      ? ' '
      : KEY_ALIASES[lower] ?? (event.key.length === 1 ? event.key.toLowerCase() : lower)

  return formatAccelerator({
    ctrl: event.ctrlKey || event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: false,
    key,
  })
}

export function acceleratorToKeys(raw: string): string[] {
  const normalized = normalizeAccelerator(raw)
  if (!normalized) return raw ? [raw] : []
  return normalized.split('+')
}

/** Match a KeyboardEvent against an accelerator. Ctrl also matches Meta (Cmd) for macOS. */
export function matchesAccelerator(event: KeyboardEvent, accelerator: string): boolean {
  const parsed = parseAccelerator(accelerator)
  if (!parsed) return false

  const wantCtrl = parsed.ctrl || parsed.meta
  const hasCtrl = event.ctrlKey || event.metaKey
  if (wantCtrl !== hasCtrl) return false
  if (parsed.alt !== event.altKey) return false
  if (parsed.shift !== event.shiftKey) return false

  const eventKey =
    event.code === 'Space' || event.key === ' '
      ? ' '
      : KEY_ALIASES[event.key.toLowerCase()] ?? (event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase())

  return eventKey === parsed.key
}

/** Electron accelerator string (CommandOrControl for Ctrl bindings). */
export function toElectronAccelerator(raw: string): string {
  const parsed = parseAccelerator(raw)
  if (!parsed) return raw
  const parts: string[] = []
  if (parsed.ctrl || parsed.meta) parts.push('CommandOrControl')
  if (parsed.alt) parts.push('Alt')
  if (parsed.shift) parts.push('Shift')
  const key =
    parsed.key === ' '
      ? 'Space'
      : parsed.key === 'escape'
        ? 'Escape'
        : parsed.key.length === 1
          ? parsed.key.toUpperCase()
          : parsed.key.charAt(0).toUpperCase() + parsed.key.slice(1)
  parts.push(key)
  return parts.join('+')
}
