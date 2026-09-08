import "../styles/pages/missing-states.css"
import { useEffect, useState } from 'react'
import { LoadingState, Alert } from '../components/ui'
import { useCustomUI } from '../hooks/useCustomUI'

function entryForSlug(source, slug) {
  return source?.pages?.[`custom:${slug}`] ?? null
}

export function CustomPage({ slug }) {
  const { prefs } = useCustomUI()
  const [entry, setEntry] = useState(() => entryForSlug(prefs, slug))
  const [error, setError] = useState(() => (prefs && !entryForSlug(prefs, slug) ? `Custom page "${slug}" not found. Ask Eve to create it.` : ''))

  useEffect(() => {
    const found = entryForSlug(prefs, slug)
    setEntry(found)
    setError(found || !prefs ? '' : `Custom page "${slug}" not found. Ask Eve to create it.`)
  }, [slug, prefs])

  useEffect(() => {
    const onUpdate = (e) => {
      const found = entryForSlug(e.detail?.preferences, slug)
      if (found) {
        setEntry(found)
        setError('')
      }
    }
    window.addEventListener('eve-ui-update', onUpdate)
    return () => window.removeEventListener('eve-ui-update', onUpdate)
  }, [slug])

  if (!prefs && !entry) return <LoadingState label={`Loading ${slug}…`} />
  if (error) return <Alert variant="error">{error}</Alert>
  if (!entry) return <Alert variant="info">No content.</Alert>

  return (
    <section className="custom-page" data-eve-target={`custom:${slug}`}>
      <div className="card custom-page-card">
        <p className="custom-page-desc">{entry.description}</p>
        {entry.code && (
          <pre className="custom-page-code">
            {entry.code}
          </pre>
        )}
        <p className="custom-page-hint">
          This page was created by Eve. Say “edit my {slug} page to …” to change it.
        </p>
      </div>
    </section>
  )
}
