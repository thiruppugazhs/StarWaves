import "../styles/pages/documents.css"
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, FileText, RefreshCw } from 'lucide-react'
import { loadGoogleWorkspaceEditor } from '../lib/googleDriveApi'

export function DocumentOpenerPage({ document, onBack }) {
  const [state, setState] = useState({ loading: true, error: '', data: null })

  const loadEditor = useCallback(async () => {
    if (!document) {
      setState({ loading: false, error: 'Document not found.', data: null })
      return
    }
    setState({ loading: true, error: '', data: null })
    try {
      const data = await loadGoogleWorkspaceEditor(document.id)
      setState({ loading: false, error: '', data })
    } catch (error) {
      setState({ loading: false, error: error.message || 'Could not open this document.', data: null })
    }
  }, [document])

  useEffect(() => { loadEditor() }, [loadEditor])

  return (
    <section className="document-opener-page">
      <button className="document-opener-back" onClick={onBack}><ArrowLeft size={16} /> Back to Documents</button>
      <div className="document-opener-card">
        <span className="document-opener-icon"><FileText size={25} /></span>
        <p>Google Workspace</p>
        <h1>{document?.name ?? 'Document'}</h1>
        <span className="document-opener-type">{document?.type ?? 'FILE'}</span>
        {state.loading && <div className="document-opener-state">Connecting to Google Workspace…</div>}
        {!state.loading && state.error && <div className="document-opener-state error"><strong>Unable to open document</strong><span>{state.error}</span><button onClick={loadEditor}><RefreshCw size={14} /> Try again</button></div>}
        {!state.loading && state.data && <div className="document-opener-state"><span>Open this file in Google Workspace for real-time collaborative editing.</span><a className="primary-button" href={state.data.editor_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open in Google Workspace</a></div>}
      </div>
    </section>
  )
}
