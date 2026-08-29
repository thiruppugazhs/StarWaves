import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  Clock,
  CornerDownLeft,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  buildSearchIndex,
  filterSearchItems,
  SEARCH_CATEGORIES,
} from '../../config/searchIndex'

const RECENT_SEARCHES_KEY = 'starwaves.recent_searches'
const MAX_RECENTS = 6

export function AdvancedSearchModal({
  isOpen,
  onClose,
  onNavigate,
  onCreate,
  callCenter,
  setDarkTheme,
  setEveOpen,
  setNotificationsOpen,
  onEveNewChat,
  onSignOut,
  workspaceData = {},
  initialQuery = '',
}) {
  const [query, setQuery] = useState(initialQuery)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Reset query & focus when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery)
      setSelectedCategory('all')
      setActiveIndex(0)
      window.requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [isOpen, initialQuery])

  // Build full search index
  const fullIndex = useMemo(() => {
    return buildSearchIndex(workspaceData)
  }, [workspaceData])

  // Filter items based on current query and category
  const filteredItems = useMemo(() => {
    return filterSearchItems(fullIndex, query, selectedCategory)
  }, [fullIndex, query, selectedCategory])

  // Group filtered items for presentation
  const groupedResults = useMemo(() => {
    const groups = {}
    filteredItems.forEach((item) => {
      const groupName = item.group || 'Other'
      if (!groups[groupName]) {
        groups[groupName] = []
      }
      groups[groupName].push(item)
    })
    return groups
  }, [filteredItems])

  // Flat list of visible items for keyboard navigation
  const flatItems = useMemo(() => {
    return filteredItems
  }, [filteredItems])

  // Adjust activeIndex if out of bounds
  useEffect(() => {
    if (activeIndex >= flatItems.length) {
      setActiveIndex(Math.max(0, flatItems.length - 1))
    }
  }, [flatItems.length, activeIndex])

  // Auto-scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector(`[data-item-index="${activeIndex}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeIndex])

  const saveRecentSearch = (item) => {
    try {
      const entry = {
        id: item.id,
        title: item.title,
        badge: item.badge,
        category: item.category,
        page: item.page,
        hash: item.hash,
        recordId: item.recordId,
        actionId: item.actionId,
        timestamp: Date.now(),
      }
      const existing = recentSearches.filter((r) => r.id !== item.id)
      const next = [entry, ...existing].slice(0, MAX_RECENTS)
      setRecentSearches(next)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
    } catch {
      // Ignore storage errors
    }
  }

  const clearRecentSearches = (e) => {
    e?.stopPropagation()
    setRecentSearches([])
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch {
      // Ignore storage errors
    }
  }

  const handleSelectItem = (item) => {
    if (!item) return
    saveRecentSearch(item)
    onClose()

    // 1. Settings Section with deep link hash
    if (item.hash) {
      onNavigate('setting')
      window.location.hash = `#${item.hash}`
      window.setTimeout(() => {
        const el = document.getElementById(item.hash)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          el.classList.add('notification-target-highlight')
          window.setTimeout(() => el.classList.remove('notification-target-highlight'), 1600)
        }
      }, 100)
      return
    }

    // 2. Quick Actions
    if (item.actionId) {
      switch (item.actionId) {
        case 'create-todo':
          if (onCreate) {
            onCreate('todo')
          } else {
            onNavigate('todo')
          }
          break
        case 'create-project':
          if (onCreate) {
            onCreate('project')
          } else {
            onNavigate('projects')
          }
          break
        case 'create-job':
          if (onCreate) {
            onCreate('job')
          } else {
            onNavigate('jobs')
          }
          break
        case 'create-document':
          if (onCreate) {
            onCreate('document')
          } else {
            onNavigate('documents')
          }
          break
        case 'new-eve-chat':
          if (onEveNewChat) onEveNewChat()
          onNavigate('eve')
          break
        case 'open-eve':
          if (setEveOpen) setEveOpen(true)
          break
        case 'call-eve':
          if (callCenter?.initiateEveCall) {
            callCenter.initiateEveCall()
          } else {
            onNavigate('eve-call')
          }
          break
        case 'toggle-theme':
          if (setDarkTheme) {
            setDarkTheme((current) => !current)
          }
          break
        case 'open-notifications':
          if (setNotificationsOpen) {
            setNotificationsOpen(true)
          }
          break
        case 'sign-out':
          if (onSignOut) {
            onSignOut()
          }
          break
        default:
          break
      }
      return
    }

    // 3. Workspace Detail Records
    if (item.recordType) {
      if (item.recordType === 'project' && item.recordId) {
        onNavigate('project-detail', item.recordId)
      } else if (item.recordType === 'document' && item.recordId) {
        onNavigate('document-opener', null, item.recordId)
      } else if (item.recordType === 'hackathon' && item.recordId) {
        onNavigate('hackathon-detail', null, null, item.recordId)
      } else if (item.page) {
        onNavigate(item.page)
      }
      return
    }

    // 4. Standard Page Navigation
    if (item.page) {
      onNavigate(item.page)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(0, flatItems.length - 1))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (flatItems[activeIndex]) {
        handleSelectItem(flatItems[activeIndex])
      }
    }
  }

  if (!isOpen) return null

  let runningIndex = -1

  return createPortal(
    <div
      className="search-palette-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="search-palette-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette and advanced search"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="search-palette-header">
          <Search size={19} className="search-palette-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="search-palette-input"
            placeholder="Search any page, section, record, or command…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            aria-label="Search query"
          />
          {query && (
            <button
              type="button"
              className="search-palette-clear"
              onClick={() => {
                setQuery('')
                setActiveIndex(0)
                inputRef.current?.focus()
              }}
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
          <button
            type="button"
            className="search-palette-close"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close search"
          >
            <kbd>Esc</kbd>
          </button>
        </div>

        {/* Category Pills Filter */}
        <div className="search-palette-categories">
          {SEARCH_CATEGORIES.map((cat) => {
            const count =
              cat.id === 'all'
                ? fullIndex.length
                : fullIndex.filter((item) => item.category === cat.id).length
            return (
              <button
                key={cat.id}
                type="button"
                className={`search-palette-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(cat.id)
                  setActiveIndex(0)
                  inputRef.current?.focus()
                }}
              >
                <span>{cat.label}</span>
                <span className="search-palette-pill-count">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Results List */}
        <div className="search-palette-body" ref={listRef}>
          {flatItems.length === 0 ? (
            <div className="search-palette-empty">
              <Search size={28} className="empty-icon" />
              <p className="empty-title">No matching results</p>
              <p className="empty-subtitle">
                No section, page, or record matched &ldquo;<strong>{query}</strong>&rdquo;. Try searching for &ldquo;profile&rdquo;, &ldquo;ai models&rdquo;, &ldquo;projects&rdquo;, or &ldquo;tasks&rdquo;.
              </p>
            </div>
          ) : (
            Object.entries(groupedResults).map(([groupName, items]) => (
              <div key={groupName} className="search-palette-group">
                <div className="search-palette-group-title">{groupName}</div>
                <div className="search-palette-group-items">
                  {items.map((item) => {
                    runningIndex += 1
                    const itemIndex = runningIndex
                    const isActive = itemIndex === activeIndex
                    const IconComponent = item.icon || Sparkles

                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-item-index={itemIndex}
                        className={`search-palette-item ${isActive ? 'active' : ''}`}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onClick={() => handleSelectItem(item)}
                      >
                        <span className="search-palette-item-icon">
                          <IconComponent size={16} />
                        </span>
                        <div className="search-palette-item-info">
                          <div className="search-palette-item-title-row">
                            <span className="search-palette-item-title">{item.title}</span>
                            {item.badge && (
                              <span className="search-palette-item-badge">{item.badge}</span>
                            )}
                          </div>
                          {item.subtitle && (
                            <p className="search-palette-item-subtitle">{item.subtitle}</p>
                          )}
                        </div>
                        {isActive && (
                          <span className="search-palette-item-enter">
                            <CornerDownLeft size={13} />
                            <span>Select</span>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}

          {/* Recent Searches (when query is empty and recents exist) */}
          {!query && recentSearches.length > 0 && selectedCategory === 'all' && (
            <div className="search-palette-recents">
              <div className="search-palette-recents-header">
                <span>
                  <Clock size={13} />
                  Recent Searches
                </span>
                <button
                  type="button"
                  className="search-palette-recents-clear"
                  onClick={clearRecentSearches}
                >
                  <Trash2 size={12} />
                  Clear
                </button>
              </div>
              <div className="search-palette-recents-chips">
                {recentSearches.map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    className="search-palette-recent-chip"
                    onClick={() => {
                      const found = fullIndex.find((i) => i.id === rec.id)
                      if (found) {
                        handleSelectItem(found)
                      } else {
                        setQuery(rec.title)
                      }
                    }}
                  >
                    <span>{rec.title}</span>
                    <ArrowRight size={11} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="search-palette-footer">
          <div className="search-palette-footer-hint">
            <kbd>↑</kbd> <kbd>↓</kbd> <span>Navigate</span>
          </div>
          <div className="search-palette-footer-hint">
            <kbd>↵</kbd> <span>Select</span>
          </div>
          <div className="search-palette-footer-hint">
            <kbd>Esc</kbd> <span>Close</span>
          </div>
          <div className="search-palette-footer-badge">
            StarWaves Command Palette
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
