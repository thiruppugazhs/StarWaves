import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { API_URL } from '../../lib/request'
import { startPreview } from '../../lib/studioApi'

export function PreviewPane({ projectId, refreshKey, deviceMode = 'desktop' }) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const loadPreview = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    setError('')
    try {
      const result = await startPreview(projectId)
      let url = result.preview_url || ''
      if (url.startsWith('/')) {
        const base = API_URL.replace(/\/api\/v1\/?$/, '')
        url = `${base}${url}`
      }
      setPreviewUrl(url)
    } catch (previewError) {
      setError(previewError.message || 'Could not start the preview.')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadPreview()
  }, [loadPreview, refreshKey])

  if (error) {
    return (
      <div className="studio-preview-empty">
        <p role="alert">{error}</p>
        <button type="button" className="secondary-button" onClick={loadPreview}>
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    )
  }

  if (!previewUrl) {
    return (
      <div className="studio-preview-empty">
        {isLoading ? <p>Preparing preview…</p> : <p>No preview available yet.</p>}
      </div>
    )
  }

  return (
    <div className={`studio-preview studio-preview-${deviceMode}`}>
      <div className="studio-preview-frame-container">
        <iframe
          key={`${previewUrl}-${refreshKey}`}
          src={previewUrl}
          title="App preview"
          sandbox="allow-scripts allow-forms allow-popups"
          className="studio-preview-frame"
        />
      </div>
    </div>
  )
}
