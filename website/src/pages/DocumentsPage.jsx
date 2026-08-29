import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Files,
  FolderInput,
  HardDrive,
  Pencil,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  beginGoogleDriveOAuth,
  loadGoogleDriveFiles,
  uploadGoogleDriveFile,
} from '../lib/googleDriveApi'
import { deleteDocument, persistDocument } from '../lib/documentsApi'
import { ConfirmDialog, Modal, PageHeader, SearchBar } from '../components/ui'

const emptyDocument = {
  name: '',
  category: 'General',
  description: '',
  tags: '',
  file: null,
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentsPage({ documents, setDocuments, createIntent, onOpenDocument }) {
  const [openDocuments, setOpenDocuments] = useState(
    () => new Set([documents[0]?.id]),
  )
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyDocument)
  const [driveOpen, setDriveOpen] = useState(false)
  const [driveFiles, setDriveFiles] = useState([])
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState('')
  const [driveQuery, setDriveQuery] = useState('')
  const [documentSaving, setDocumentSaving] = useState(false)
  const [documentSaveError, setDocumentSaveError] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  const handleDeleteDocument = async (documentId) => {
    setDeleteId(documentId)
  }

  const confirmDeleteDocument = async () => {
    const documentId = deleteId
    setDeleteId(null)
    if (!documentId) return
    try {
      await deleteDocument(documentId)
      setDocuments((current) => current.filter((doc) => doc.id !== documentId))
    } catch (err) {
      setDocumentSaveError(err.message || 'Could not delete document.')
    }
  }

  const filteredDriveFiles = useMemo(() => {
    const query = driveQuery.trim().toLowerCase()
    if (!query) return driveFiles
    return driveFiles.filter(
      (file) =>
        file.name.toLowerCase().includes(query) ||
        file.mimeType.toLowerCase().includes(query),
    )
  }, [driveFiles, driveQuery])

  useEffect(() => {
    if (createIntent?.type === 'document') {
      setEditingId(null)
      setForm(emptyDocument)
      setDocumentSaveError('')
      setEditorOpen(true)
    }
  }, [createIntent?.requestId, createIntent?.type])

  const toggleDocument = (documentId) => {
    setOpenDocuments((current) => {
      const next = new Set(current)
      if (next.has(documentId)) next.delete(documentId)
      else next.add(documentId)
      return next
    })
  }

  const openUpload = () => {
    setEditingId(null)
    setForm(emptyDocument)
    setDocumentSaveError('')
    setEditorOpen(true)
  }

  const openEdit = (document) => {
    setEditingId(document.id)
    setForm({
      name: document.name,
      category: document.category,
      description: document.description,
      tags: document.tags.join(', '),
      file: null,
    })
    setDocumentSaveError('')
    setEditorOpen(true)
  }

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const connectGoogleDrive = async () => {
    setDriveOpen(true)
    setDriveLoading(true)
    setDriveError('')
    setDriveQuery('')
    try {
      const payload = await loadGoogleDriveFiles()
      setDriveFiles(payload.files ?? [])
    } catch (error) {
      if (
        error.message === 'Connect Google Drive first.' ||
        error.message?.includes('Google Drive') ||
        error.message?.includes('409')
      ) {
        try {
          await beginGoogleDriveOAuth()
          const payload = await loadGoogleDriveFiles()
          setDriveFiles(payload.files ?? [])
          return
        } catch (oauthError) {
          setDriveError(oauthError.message || 'Google Drive authorization was cancelled.')
          return
        }
      }
      setDriveError(error.message || 'Google Drive could not be connected.')
    } finally {
      setDriveLoading(false)
    }
  }

  const importDriveFile = async (file) => {
    const workspaceTypes = {
      'application/vnd.google-apps.document': 'Google Doc',
      'application/vnd.google-apps.spreadsheet': 'Google Sheet',
      'application/vnd.google-apps.presentation': 'Google Slides',
      'application/vnd.google-apps.form': 'Google Form',
    }
    const type =
      workspaceTypes[file.mimeType] ??
      file.name.split('.').pop()?.toUpperCase() ??
      'DRIVE'
    setDriveLoading(true)
    setDriveError('')
    try {
      const savedDocument = await persistDocument({
        id: `drive-${file.id}`,
        name: file.name,
        category: 'Google Drive',
        description: `Imported from Google Drive as ${type}.`,
        tags: ['Google Drive', ...(workspaceTypes[file.mimeType] ? ['Workspace'] : [])],
        type,
        size: file.size ? formatFileSize(Number(file.size)) : 'Cloud file',
        modifiedAt: file.modifiedTime ?? new Date().toISOString(),
        url: file.webViewLink ?? `https://drive.google.com/open?id=${file.id}`,
        driveFileId: file.id,
      })
      setDocuments((current) => [
        savedDocument,
        ...current.filter((document) => document.id !== savedDocument.id),
      ])
      setDriveOpen(false)
    } catch (error) {
      setDriveError(error.message || 'The imported file could not be saved.')
    } finally {
      setDriveLoading(false)
    }
  }

  const saveDocument = async (event) => {
    event.preventDefault()
    setDocumentSaving(true)
    setDocumentSaveError('')
    try {
      const existing = documents.find((document) => document.id === editingId)
      const file = form.file
      let driveFile = null
      if (file) {
        driveFile = await uploadGoogleDriveFile(file)
      }

      const updatedDocument = {
        ...(existing ?? {}),
        id: existing?.id ?? `drive-${driveFile.id}`,
        name: form.name || driveFile?.name || file?.name || 'Untitled document',
        category: form.category,
        description: form.description,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        type:
          file?.name.split('.').pop()?.toUpperCase() ??
          existing?.type ??
          'FILE',
        size: driveFile?.size
          ? formatFileSize(Number(driveFile.size))
          : file
            ? formatFileSize(file.size)
            : existing?.size ?? 'Unknown',
        modifiedAt:
          driveFile?.modifiedTime ??
          (file ? new Date().toISOString() : existing?.modifiedAt),
        url:
          driveFile?.webViewLink ??
          (driveFile?.id
            ? `https://drive.google.com/open?id=${driveFile.id}`
            : existing?.url ?? '#'),
        driveFileId: driveFile?.id ?? existing?.driveFileId,
      }

      const savedDocument = await persistDocument(updatedDocument)
      setDocuments((current) =>
        editingId
          ? current.map((document) =>
              document.id === editingId ? savedDocument : document,
            )
          : [savedDocument, ...current],
      )
      setEditorOpen(false)
    } catch (error) {
      setDocumentSaveError(
        error.code === 'auth/popup-closed-by-user'
          ? 'Google Drive upload was cancelled.'
          : error.code === 'auth/credential-already-in-use'
            ? 'This Google account is already linked to another StarWaves account.'
            : error.message || 'The document could not be uploaded.',
      )
    } finally {
      setDocumentSaving(false)
    }
  }

  return (
    <section className="documents-page">
      <PageHeader
        eyebrow="Files & resources"
        title="Documents"
        actions={
          <button className="primary-button document-upload-button" onClick={openUpload}>
            <Upload size={16} />
            Upload document
          </button>
        }
      />

      <section className="document-cloud-tools">
        <button onClick={connectGoogleDrive}>
          <span className="google-drive-mark">△</span>
          <div><strong>Google Drive</strong><small>Import recent files into StarWaves</small></div>
          <FolderInput size={17} />
        </button>
        <div className="workspace-create-tools">
          <div><strong>Google Workspace</strong><small>Create a new cloud document</small></div>
          <a href="https://docs.new" target="_blank" rel="noreferrer">Docs</a>
          <a href="https://sheets.new" target="_blank" rel="noreferrer">Sheets</a>
          <a href="https://slides.new" target="_blank" rel="noreferrer">Slides</a>
        </div>
      </section>

      <div className="document-list">
        {documents.map((document) => {
          const isOpen = openDocuments.has(document.id)
          const modifiedAt = new Date(document.modifiedAt)

          return (
            <article
              className={`contest-site-card document-list-card ${
                isOpen ? 'open' : ''
              }`}
              key={document.id}
            >
              <button
                className="contest-site-header"
                onClick={() => toggleDocument(document.id)}
                aria-expanded={isOpen}
              >
                <span className="contest-site-logo">
                  <FileText size={18} />
                </span>
                <span className="contest-site-copy">
                  <strong
                    className="document-title-link"
                    role="link"
                    tabIndex={0}
                    onClick={(event) => { event.stopPropagation(); onOpenDocument(document.id) }}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onOpenDocument(document.id) } }}
                  >{document.name}</strong>
                  <small>{document.description}</small>
                </span>
                <span className="project-status">{document.type}</span>
                <ChevronDown size={18} />
              </button>

              {isOpen && (
                <div className="contest-site-content document-detail-content">
                  <div className="document-detail-grid">
                    <div className="document-detail-item">
                      <Files size={17} />
                      <div>
                        <span>Category</span>
                        <strong>{document.category}</strong>
                      </div>
                    </div>
                    <div className="document-detail-item">
                      <HardDrive size={17} />
                      <div>
                        <span>File size</span>
                        <strong>{document.size}</strong>
                      </div>
                    </div>
                    <div className="document-detail-item">
                      <CalendarClock size={17} />
                      <div>
                        <span>Last modified</span>
                        <strong>
                          {modifiedAt.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="document-list-footer">
                    <div className="document-tags">
                      {document.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <div className="document-actions">
                      <button onClick={() => openEdit(document)}>
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button onClick={() => handleDeleteDocument(document.id)}>
                        <Trash2 size={14} />
                        Delete
                      </button>
                      <a href={document.url} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} />
                        Open
                      </a>
                      <a
                        className="primary-document-action"
                        href={document.url}
                        download
                      >
                        <Download size={14} />
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>


      {!documents.length && (
        <section className="document-empty-state">
          <span><Files size={22} /></span>
          <h2>No documents yet</h2>
          <p>Upload a file or import one from Google Drive to get started.</p>
          <div>
            <button onClick={openUpload}><Upload size={15} /> Upload document</button>
            <button onClick={connectGoogleDrive}><FolderInput size={15} /> Import from Drive</button>
          </div>
        </section>
      )}

      <Modal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        className="document-modal"
        subtitle="Documents"
        title={editingId ? 'Edit document' : 'Upload document'}
      >
        <form className="project-edit-form" onSubmit={saveDocument}>
          <label>
            File
            <input
              type="file"
              onChange={(event) =>
                updateField('file', event.target.files?.[0] ?? null)
              }
              required={!editingId}
              disabled={documentSaving}
            />
            <small className="document-upload-note">
              The selected file will be stored in your Google Drive.
            </small>
          </label>
          <div className="project-edit-form-row document-form-row">
            <label>
              Document name
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Uses the file name if empty"
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(event) =>
                  updateField('category', event.target.value)
                }
              >
                <option>General</option>
                <option>Career</option>
                <option>Projects</option>
                <option>Learning</option>
                <option>Personal</option>
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              rows="3"
              value={form.description}
              onChange={(event) =>
                updateField('description', event.target.value)
              }
            />
          </label>
          <label>
            Tags
            <input
              value={form.tags}
              onChange={(event) => updateField('tags', event.target.value)}
              placeholder="Resume, Career, Application"
            />
          </label>
          {documentSaveError && (
            <div className="document-save-error" role="alert">
              {documentSaveError}
            </div>
          )}
          <div className="todo-modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditorOpen(false)}
              disabled={documentSaving}
            >
              Cancel
            </button>
            <button
              className="primary-button document-save-button"
              type="submit"
              disabled={documentSaving}
            >
              {editingId ? <Save size={16} /> : <Upload size={16} />}
              {documentSaving
                ? 'Uploading to Drive…'
                : editingId
                  ? 'Save changes'
                  : 'Upload to Drive'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={driveOpen}
        onClose={() => setDriveOpen(false)}
        className="drive-modal"
        subtitle="Google Drive"
        title="Import a document"
      >
        {!driveLoading && !driveError && driveFiles.length > 0 && (
          <SearchBar
            value={driveQuery}
            onChange={setDriveQuery}
            placeholder="Search Drive files"
            ariaLabel="Search Google Drive files"
            className="drive-search-bar"
            data-modal-initial-focus
          />
        )}
        <div className="drive-file-list">
          {driveLoading && <div className="drive-state">Loading your recent Drive files…</div>}
          {driveError && <div className="drive-state error"><strong>Could not load Drive</strong><span>{driveError}</span><div><button onClick={connectGoogleDrive}>Try again</button>{driveError.includes('disabled or blocked') && <a href={`https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${import.meta.env.VITE_FIREBASE_PROJECT_ID}`} target="_blank" rel="noreferrer">Enable Drive API</a>}</div></div>}
          {!driveLoading && !driveError && !driveFiles.length && <div className="drive-state">No recent files found.</div>}
          {!driveLoading && !driveError && driveQuery && !filteredDriveFiles.length && <div className="drive-state">No files match “{driveQuery}”.</div>}
          {!driveLoading && !driveError && filteredDriveFiles.map((file) => (
            <button key={file.id} className="drive-file-item" onClick={() => importDriveFile(file)}>
              <span><FileText size={17} /></span>
              <div><strong>{file.name}</strong><small>{file.mimeType.replace('application/vnd.google-apps.', 'Google ')}</small></div>
              <FolderInput size={16} />
            </button>
          ))}
        </div>
      </Modal>
      <ConfirmDialog isOpen={Boolean(deleteId)} message="Are you sure you want to delete this document?" onCancel={() => setDeleteId(null)} onConfirm={confirmDeleteDocument} />
    </section>
  )
}
