import { useEffect, useMemo } from 'react'
import { useTranslation } from '../../i18n'
import type { Page } from '../../navigation/pages'
import { PAGE_TITLE_KEYS } from '../../navigation/pages'
import { useStore } from '../../store'
import StaggeredMenu, { type StaggeredMenuItem } from '../common/StaggeredMenu'

type Props = {
  activePage: Page
  onPageChange: (page: Page) => void
  onOpenLauncher?: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NAV_PAGES: Page[] = ['dashboard', 'taskflow', 'hotlist', 'mineradio', 'settings']
const STAGGERED_MENU_COLORS = ['#7c3aed', '#0891b2'] as const

export default function AppStaggeredNav({
  onPageChange,
  onOpenLauncher,
  open,
  onOpenChange,
}: Props) {
  const { t } = useTranslation()
  const accentColor = useStore((s) => s.accentColor)

  const items = useMemo<StaggeredMenuItem[]>(() => {
    const launcher: StaggeredMenuItem = {
      label: '快搜',
      ariaLabel: '打开启动器',
      onClick: () => onOpenLauncher?.(),
    }
    const pages = NAV_PAGES.map((id) => ({
      label: t(PAGE_TITLE_KEYS[id]),
      ariaLabel: t(PAGE_TITLE_KEYS[id]),
      onClick: () => onPageChange(id),
    }))
    return [launcher, ...pages]
  }, [onOpenLauncher, onPageChange, t])

  const accent = accentColor || '#67e8f9'

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--sm-layer-a', STAGGERED_MENU_COLORS[0])
    root.setProperty('--sm-layer-b', STAGGERED_MENU_COLORS[1])
    root.setProperty('--sm-accent', accent)
  }, [accent])

  return (
    <StaggeredMenu
      position="left"
      isFixed
      open={open}
      onOpenChange={onOpenChange}
      items={items}
      displaySocials={false}
      displayItemNumbering
      logoUrl="/favicon.ico"
      menuButtonColor="#e9e9ef"
      openMenuButtonColor="#ffffff"
      changeMenuColorOnOpen
      colors={[...STAGGERED_MENU_COLORS]}
      accentColor={accent}
      closeOnClickAway
      className="app-staggered-nav"
    />
  )
}
