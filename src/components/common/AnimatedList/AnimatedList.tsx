import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  type MouseEventHandler,
  type UIEvent,
} from 'react'
import { motion, useInView } from 'motion/react'
import { scrollGradientOpacities } from './scrollGradientOpacities'
import './AnimatedList.css'

interface AnimatedItemProps {
  children: ReactNode
  delay?: number
  index: number
  onMouseEnter?: MouseEventHandler<HTMLDivElement>
  onClick?: MouseEventHandler<HTMLDivElement>
}

const AnimatedItem: React.FC<AnimatedItemProps> = ({
  children,
  delay = 0,
  index,
  onMouseEnter,
  onClick,
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.5, once: true })
  return (
    <motion.div
      ref={ref}
      data-index={index}
      className="animated-list-item"
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={{ duration: 0.2, delay }}
    >
      {children}
    </motion.div>
  )
}

export interface AnimatedListProps {
  items?: string[]
  onItemSelect?: (item: string, index: number) => void
  showGradients?: boolean
  enableArrowNavigation?: boolean
  className?: string
  itemClassName?: string
  displayScrollbar?: boolean
  initialSelectedIndex?: number
  /** Custom row renderer; falls back to plain text when omitted. */
  renderItem?: (item: string, index: number, selected: boolean) => ReactNode
}

const DEFAULT_ITEMS = [
  'Item 1',
  'Item 2',
  'Item 3',
  'Item 4',
  'Item 5',
  'Item 6',
  'Item 7',
  'Item 8',
  'Item 9',
  'Item 10',
  'Item 11',
  'Item 12',
  'Item 13',
  'Item 14',
  'Item 15',
]

const AnimatedList: React.FC<AnimatedListProps> = ({
  items = DEFAULT_ITEMS,
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = false,
  className = '',
  itemClassName = '',
  displayScrollbar = true,
  initialSelectedIndex = -1,
  renderItem,
}) => {
  const listRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(initialSelectedIndex)
  const [keyboardNav, setKeyboardNav] = useState<boolean>(false)
  const [topGradientOpacity, setTopGradientOpacity] = useState<number>(0)
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState<number>(1)

  const handleItemMouseEnter = useCallback((index: number) => {
    setSelectedIndex(index)
  }, [])

  const handleItemClick = useCallback(
    (item: string, index: number) => {
      setSelectedIndex(index)
      onItemSelect?.(item, index)
    },
    [onItemSelect],
  )

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const { top, bottom } = scrollGradientOpacities(
      target.scrollTop,
      target.scrollHeight,
      target.clientHeight,
    )
    setTopGradientOpacity(top)
    setBottomGradientOpacity(bottom)
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const { top, bottom } = scrollGradientOpacities(el.scrollTop, el.scrollHeight, el.clientHeight)
    setTopGradientOpacity(top)
    setBottomGradientOpacity(bottom)
  }, [items])

  useEffect(() => {
    if (!enableArrowNavigation) return
    const listEl = listRef.current
    if (!listEl) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!listEl.contains(document.activeElement) && document.activeElement !== listEl) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setKeyboardNav(true)
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setKeyboardNav(true)
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          e.preventDefault()
          onItemSelect?.(items[selectedIndex], selectedIndex)
        }
      }
    }

    listEl.addEventListener('keydown', handleKeyDown)
    return () => listEl.removeEventListener('keydown', handleKeyDown)
  }, [items, selectedIndex, onItemSelect, enableArrowNavigation])

  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) return
    const container = listRef.current
    const selectedItem = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null
    if (selectedItem) {
      const extraMargin = 50
      const containerScrollTop = container.scrollTop
      const containerHeight = container.clientHeight
      const itemTop = selectedItem.offsetTop
      const itemBottom = itemTop + selectedItem.offsetHeight
      if (itemTop < containerScrollTop + extraMargin) {
        container.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' })
      } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
        container.scrollTo({
          top: itemBottom - containerHeight + extraMargin,
          behavior: 'smooth',
        })
      }
    }
    setKeyboardNav(false)
  }, [selectedIndex, keyboardNav])

  return (
    <div className={`scroll-list-container ${className}`.trim()}>
      <div
        ref={listRef}
        className={`scroll-list ${!displayScrollbar ? 'no-scrollbar' : ''}`.trim()}
        onScroll={handleScroll}
        tabIndex={enableArrowNavigation ? 0 : undefined}
        role={enableArrowNavigation ? 'listbox' : undefined}
      >
        {items.map((item, index) => {
          const selected = selectedIndex === index
          return (
            <AnimatedItem
              key={`${index}-${item}`}
              delay={0.1}
              index={index}
              onMouseEnter={() => handleItemMouseEnter(index)}
              onClick={() => handleItemClick(item, index)}
            >
              {renderItem ? (
                renderItem(item, index, selected)
              ) : (
                <div className={`item ${selected ? 'selected' : ''} ${itemClassName}`.trim()}>
                  <p className="item-text">{item}</p>
                </div>
              )}
            </AnimatedItem>
          )
        })}
      </div>
      {showGradients ? (
        <>
          <div className="top-gradient" style={{ opacity: topGradientOpacity }} aria-hidden="true" />
          <div className="bottom-gradient" style={{ opacity: bottomGradientOpacity }} aria-hidden="true" />
        </>
      ) : null}
    </div>
  )
}

export default AnimatedList
