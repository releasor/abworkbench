import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SHORTCUT_BY_ID, SHORTCUT_CATALOG, defaultShortcutMap } from './catalog'
import { normalizeAccelerator } from './parse'

interface ShortcutState {
  /** User overrides only; missing ids fall back to catalog defaults. */
  overrides: Record<string, string>
  getAccelerator: (id: string) => string
  setAccelerator: (id: string, accelerator: string) => void
  resetAll: () => void
  resetOne: (id: string) => void
  findConflicts: (id: string, accelerator: string) => string[]
}

function sanitizeOverrides(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [id, value] of Object.entries(input as Record<string, unknown>)) {
    if (!SHORTCUT_BY_ID[id]) continue
    if (typeof value !== 'string') continue
    const normalized = normalizeAccelerator(value)
    if (!normalized) continue
    if (normalized === SHORTCUT_BY_ID[id].defaultAccelerator) continue
    out[id] = normalized
  }
  return out
}

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set, get) => ({
      overrides: {},

      getAccelerator: (id) => {
        const override = get().overrides[id]
        if (override) return override
        return SHORTCUT_BY_ID[id]?.defaultAccelerator ?? ''
      },

      setAccelerator: (id, accelerator) => {
        if (!SHORTCUT_BY_ID[id]) return
        const normalized = normalizeAccelerator(accelerator)
        if (!normalized) return
        set((state) => {
          const next = { ...state.overrides }
          if (normalized === SHORTCUT_BY_ID[id].defaultAccelerator) delete next[id]
          else next[id] = normalized
          return { overrides: next }
        })
      },

      resetAll: () => set({ overrides: {} }),

      resetOne: (id) =>
        set((state) => {
          if (!(id in state.overrides)) return state
          const next = { ...state.overrides }
          delete next[id]
          return { overrides: next }
        }),

      findConflicts: (id, accelerator) => {
        const normalized = normalizeAccelerator(accelerator)
        if (!normalized) return []
        const conflicts: string[] = []
        for (const item of SHORTCUT_CATALOG) {
          if (item.id === id) continue
          const current = get().getAccelerator(item.id)
          if (normalizeAccelerator(current) === normalized) conflicts.push(item.id)
        }
        return conflicts
      },
    }),
    {
      name: 'abworkbench-shortcuts',
      partialize: (state) => ({ overrides: state.overrides }),
      merge: (persisted, current) => ({
        ...current,
        overrides: sanitizeOverrides((persisted as { overrides?: unknown } | undefined)?.overrides),
      }),
    },
  ),
)

export function getShortcutAccelerator(id: string): string {
  return useShortcutStore.getState().getAccelerator(id)
}

export function getAllShortcutAccelerators(): Record<string, string> {
  const map = defaultShortcutMap()
  const { overrides } = useShortcutStore.getState()
  for (const [id, value] of Object.entries(overrides)) map[id] = value
  return map
}
