import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Animated sliding-indicator tab navigation.
 *
 * Props:
 *   tabs      - Array<{ id: string, label: string, icon?: LucideIcon }>
 *   activeTab - string — the currently active tab id
 *   onChange  - (id: string) => void
 *   className - optional extra class on the <nav> wrapper
 *   iconSize  - icon size in px (default 15)
 *   role      - aria role (default 'tablist')
 *   ariaLabel - aria-label string
 */
export function TabNav({
  tabs,
  activeTab,
  onChange,
  className = '',
  iconSize = 15,
  role = 'tablist',
  ariaLabel,
}) {
  const navRef = useRef(null)
  const itemRefs = useRef(new Map())
  const [indicatorStyle, setIndicatorStyle] = useState(null)

  useLayoutEffect(() => {
    const nav = navRef.current
    const activeItem = itemRefs.current.get(activeTab)
    if (!nav || !activeItem) return

    const updateIndicator = () => {
      setIndicatorStyle({
        width: `${activeItem.offsetWidth}px`,
        height: `${activeItem.offsetHeight}px`,
        transform: `translate3d(${activeItem.offsetLeft}px, ${activeItem.offsetTop}px, 0)`,
      })
    }

    updateIndicator()

    const ro = new ResizeObserver(updateIndicator)
    ro.observe(nav)
    ro.observe(activeItem)
    window.addEventListener('resize', updateIndicator)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateIndicator)
    }
  }, [activeTab])

  return (
    <nav
      ref={navRef}
      className={`tab-nav ${className}`.trim()}
      role={role}
      aria-label={ariaLabel}
    >
      <span
        className={`tab-nav-indicator ${indicatorStyle ? 'visible' : ''}`}
        style={indicatorStyle ?? undefined}
        aria-hidden="true"
      />
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={activeTab === id}
          className={`tab-nav-item ${activeTab === id ? 'active' : ''}`}
          ref={(node) => {
            if (node) itemRefs.current.set(id, node)
            else itemRefs.current.delete(id)
          }}
          onClick={() => onChange(id)}
        >
          {Icon && <Icon size={iconSize} />}
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
