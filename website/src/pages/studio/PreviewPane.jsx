import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { API_URL } from '../../lib/request'
import { startPreview } from '../../lib/studioApi'

function resolvePreviewUrl(rawUrl) {
  if (!rawUrl) return ''
  const baseUrl = /^https?:\/\//i.test(API_URL)
    ? API_URL
    : new URL(API_URL, window.location.origin).toString()
  return new URL(rawUrl, baseUrl).toString()
}

export function PreviewPane({ projectId, refreshKey, deviceMode = 'desktop' }) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFrameLoading, setIsFrameLoading] = useState(false)
  const [hasPreviewOutput, setHasPreviewOutput] = useState(null)
  const [error, setError] = useState('')

  const loadPreview = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    setIsFrameLoading(false)
    setHasPreviewOutput(null)
    setPreviewUrl('')
    setError('')
    try {
      const result = await startPreview(projectId)
      if (!result.has_build_output) {
        setHasPreviewOutput(false)
        return
      }
      const url = resolvePreviewUrl(result.preview_url)
      if (!url) throw new Error('The preview URL was empty.')
      setHasPreviewOutput(true)
      setIsFrameLoading(true)
      setPreviewUrl(url)
    } catch (previewError) {
      setHasPreviewOutput(null)
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
        {isLoading ? (
          <p>Preparing preview…</p>
        ) : hasPreviewOutput === false ? (
          <>
            <p>No preview is available yet.</p>
            <small>Ask Eve to build the project files, then try again.</small>
            <button type="button" className="secondary-button" onClick={loadPreview}>
              <RefreshCw size={14} />
              Retry
            </button>
          </>
        ) : (
          <p>No preview available yet.</p>
        )}
      </div>
    )
  }

  return (
    <div className={`studio-preview studio-preview-${deviceMode}`}>
      <div className="studio-preview-frame-container">
        {isFrameLoading && <div className="studio-preview-loading" role="status">Loading preview…</div>}
        <iframe
          key={`${previewUrl}-${refreshKey}`}
          src={previewUrl}
          title="App preview"
          sandbox="allow-scripts allow-forms allow-popups"
          className="studio-preview-frame"
          onLoad={() => setIsFrameLoading(false)}
          onError={() => {
            setPreviewUrl('')
            setHasPreviewOutput(null)
            setError('The preview could not be loaded. Check the project build and try again.')
          }}
        />
      </div>
    </div>
  )
}
