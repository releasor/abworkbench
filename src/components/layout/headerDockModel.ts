import type { Page } from '../../navigation/pages.ts'

/** Keep in sync with HEADER_QUICK_NAV_PAGES in headerQuickNav.ts */
export const HEADER_DOCK_NAV_ORDER = ['pomodoro', 'habits', 'notes', 'weather'] as const

export type HeaderDockNavPage = (typeof HEADER_DOCK_NAV_ORDER)[number]

export type HeaderDockBadgeTone = 'primary' | 'success'

export type HeaderDockNavSlot = {
  kind: 'nav'
  id: HeaderDockNavPage
  label: string
  active: boolean
  badgeText: string | null
  badgeTone: HeaderDockBadgeTone
}

export type HeaderDockSlot = HeaderDockNavSlot

export type HeaderDockBadgeMap = {
  pomodoro?: string | null
  habits?: string | null
  notes?: string | null
  weather?: string | null
  pomodoroGoalMet?: boolean
  habitsAllDone?: boolean
}

export function buildHeaderDockSlots(input: {
  activePage: Page
  labels: Record<HeaderDockNavPage, string>
  badges: HeaderDockBadgeMap
}): HeaderDockSlot[] {
  return HEADER_DOCK_NAV_ORDER.map((id) => {
    const badge = input.badges[id]
    const badgeText = typeof badge === 'string' ? badge : null
    const badgeTone: HeaderDockBadgeTone =
      id === 'pomodoro' && input.badges.pomodoroGoalMet
        ? 'success'
        : id === 'habits' && input.badges.habitsAllDone
          ? 'success'
          : 'primary'

    return {
      kind: 'nav',
      id,
      label: input.labels[id],
      active: input.activePage === id,
      badgeText,
      badgeTone,
    }
  })
}
