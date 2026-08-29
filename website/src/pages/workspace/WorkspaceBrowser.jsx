import { useEffect, useState } from 'react'
import { ArrowUpRight, Globe, RefreshCw, X } from 'lucide-react'

const BROWSER_URL_KEY = 'starwaves.workspace.browser-url'

function storageKey(workspaceId) {
  return `${BROWSER_URL_KEY}:${workspaceId || 'default'}`
}

function loadStoredUrl(workspaceId) {
  try {
    return localStorage.getItem(storageKey(workspaceId)) || ''
  } catch {
    return ''
  }
}

function persistUrl(workspaceId, url) {
  try {
    localStorage.setItem(storageKey(workspaceId), url)
  } catch {
    // Persistence is best-effort (private mode); navigation still works.
  }
}

function normalizeUrl(raw) {
  const value = raw.trim()
  if (!value) return ''
  if (/^javascript:/i.test(value) || /^data:/i.test(value) || /^file:/i.test(value)) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      const parsed = new URL(value)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
      return value
    } catch {
      return ''
    }
  }
  return `https://${value}`
}

export function WorkspaceBrowser({ workspaceId, initialUrl, htmlContent, onClose }) {
  const [draft, setDraft] = useState(() => initialUrl || loadStoredUrl(workspaceId))
  const [url, setUrl] = useState(() => initialUrl || loadStoredUrl(workspaceId))
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (htmlContent) return
    const stored = initialUrl || loadStoredUrl(workspaceId)
    setDraft(stored)
    setUrl(stored)
  }, [workspaceId, initialUrl, htmlContent])

  const handleNavigate = (event) => {
    event.preventDefault()
    const next = normalizeUrl(draft)
    if (!next) return
    setUrl(next)
    persistUrl(workspaceId, next)
  }

  const handleReload = () => setReloadKey((current) => current + 1)

  const isHtmlPreview = Boolean(htmlContent)

  return (
    <section className="workspace-browser" aria-label="Workspace browser">
      <div className="workspace-browser-bar">
        <Globe size={13} aria-hidden="true" />
        {isHtmlPreview ? (
          <span className="workspace-browser-url workspace-browser-url-label">
            HTML Preview
          </span>
        ) : (
          <form onSubmit={handleNavigate}>
            <input
              type="text"
              className="workspace-browser-url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Enter URL — e.g. localhost:5173"
              aria-label="Browser URL"
              spellCheck="false"
            />
          </form>
        )}
        <button
          type="button"
          className="workspace-browser-btn"
          onClick={handleReload}
          disabled={!isHtmlPreview && !url}
          title="Reload"
          aria-label="Reload"
        >
          <RefreshCw size={13} />
        </button>
        {!isHtmlPreview && (
          <a
            className="workspace-browser-btn"
            href={url || undefined}
            target="_blank"
            rel="noreferrer"
            title="Open in new tab"
            aria-label="Open in new tab"
            onClick={(e) => !url && e.preventDefault()}
            aria-disabled={!url}
          >
            <ArrowUpRight size={13} />
          </a>
        )}
        <button
          type="button"
          className="workspace-browser-btn"
          onClick={onClose}
          title="Close browser"
          aria-label="Close browser"
        >
          <X size={13} />
        </button>
      </div>
      {isHtmlPreview ? (
        <iframe
          key={`srcdoc-${reloadKey}`}
          className="workspace-browser-frame"
          srcDoc={htmlContent}
          title="HTML preview"
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
        />
      ) : url ? (
        <iframe
          key={`${url}-${reloadKey}`}
          className="workspace-browser-frame"
          src={url}
          title="Workspace browser"
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
        />
      ) : (
        <div className="workspace-browser-empty">
          <span className="workspace-browser-empty-icon" aria-hidden="true">
            <Globe size={22} />
          </span>
          <p>
            Browse any URL side-by-side with your code. Some sites block
            embedding — use <ArrowUpRight size={12} /> to open them in a new tab.
          </p>
        </div>
      )}
    </section>
  )
}
