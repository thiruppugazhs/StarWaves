import { useRef, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { getGroupModuleKey, navigationItems } from '../config/navigation'
import { StarWavesLogo } from './StarWavesLogo'

export function Sidebar({
  activePage,
  isExpanded,
  isOpen,
  onClose,
  onNavigate,
  onToggleExpand,
}) {
  const sidebarRef = useRef(null)
  const itemRefs = useRef(new Map())
  const [hoveredItem, setHoveredItem] = useState(null)
  const navigationGroups = Array.from(new Set(navigationItems.map(({ group }) => group)))

  const setItemRef = (id) => (node) => {
    if (node) itemRefs.current.set(id, node)
    else itemRefs.current.delete(id)
  }

  const handleNavigate = (page) => {
    onNavigate(page)
    onClose()
    setHoveredItem(null)
  }

  const handleMouseEnter = (e, label) => {
    if (!isExpanded && window.innerWidth > 900) {
      const rect = e.currentTarget.getBoundingClientRect()
      setHoveredItem({
        label,
        top: rect.top + rect.height / 2,
      })
    }
  }

  const handleFocus = (e, label) => {
    if (!isExpanded && window.innerWidth > 900) {
      const rect = e.currentTarget.getBoundingClientRect()
      setHoveredItem({
        label,
        top: rect.top + rect.height / 2,
      })
    }
  }

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`sidebar ${isExpanded ? 'expanded' : ''} ${isOpen ? 'open' : ''}`}
        onScroll={() => setHoveredItem(null)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <div className="sidebar-header-row">
          <div
            className="sidebar-brand"
            onClick={isExpanded ? () => handleNavigate('dashboard') : onToggleExpand}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && (isExpanded ? handleNavigate('dashboard') : onToggleExpand())}
            title={isExpanded ? 'StarWaves Dashboard' : 'Expand navigation'}
            aria-label={isExpanded ? 'StarWaves Dashboard' : 'Expand navigation'}
          >
            <StarWavesLogo size={28} />
            {isExpanded && <span className="sidebar-brand-name">StarWaves</span>}
          </div>

          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggleExpand}
            aria-label={isExpanded ? 'Collapse navigation' : 'Expand navigation'}
            title={isExpanded ? 'Collapse navigation' : 'Expand navigation'}
          >
            {isExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>

          {isOpen && (
            <button
              type="button"
              className="close-button"
              onClick={onClose}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav aria-label="Main navigation">
          {navigationGroups.map((group) => (
            <div className="sidebar-nav-group" key={group} data-group={getGroupModuleKey(group)}>
              <span className="sidebar-nav-group-label">{group}</span>
              {navigationItems
                .filter((item) => item.group === group)
                .map(({ id, label, icon: Icon, module: itemModule }) => (
                  <button
                    key={id}
                    ref={setItemRef(id)}
                    className={`nav-item ${activePage === id ? 'active' : ''}`}
                    data-module={itemModule || id}
                    onClick={() => handleNavigate(id)}
                    onMouseEnter={(e) => handleMouseEnter(e, label)}
                    onMouseLeave={() => setHoveredItem(null)}
                    onFocus={(e) => handleFocus(e, label)}
                    onBlur={() => setHoveredItem(null)}
                    aria-current={activePage === id ? 'page' : undefined}
                    aria-label={label}
                    title={!isExpanded ? label : undefined}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-footer-toggle"
            onClick={onToggleExpand}
            onMouseEnter={(e) => handleMouseEnter(e, isExpanded ? 'Collapse navigation' : 'Expand navigation')}
            onMouseLeave={() => setHoveredItem(null)}
            onFocus={(e) => handleFocus(e, isExpanded ? 'Collapse navigation' : 'Expand navigation')}
            onBlur={() => setHoveredItem(null)}
            aria-label={isExpanded ? 'Collapse navigation' : 'Expand navigation'}
            title={!isExpanded ? (isExpanded ? 'Collapse navigation' : 'Expand navigation') : undefined}
          >
            {isExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            {isExpanded && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {!isExpanded && hoveredItem && (
        <div
          className="sidebar-tooltip-pill"
          style={{ top: `${hoveredItem.top}px` }}
          role="tooltip"
        >
          {hoveredItem.label}
        </div>
      )}

      {isOpen && (
        <button
          className="backdrop"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}
    </>
  )
}
