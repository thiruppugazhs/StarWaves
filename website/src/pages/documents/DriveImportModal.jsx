import { FileText, FolderInput } from 'lucide-react'
import { Modal, SearchBar } from '../../components/ui'

function formatMimeType(mimeType, name) {
  if (!mimeType) return 'Document'
  if (mimeType.includes('google-apps.document')) return 'Google Doc'
  if (mimeType.includes('google-apps.spreadsheet')) return 'Google Sheet'
  if (mimeType.includes('google-apps.presentation')) return 'Google Slides'
  if (mimeType.includes('google-apps.form')) return 'Google Form'
  if (mimeType.includes('google-apps.folder')) return 'Google Drive Folder'
  if (mimeType.includes('spreadsheetml') || mimeType.includes('excel')) return 'Excel Spreadsheet'
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'Word Document'
  if (mimeType.includes('presentationml') || mimeType.includes('powerpoint')) return 'PowerPoint Presentation'
  if (mimeType.includes('pdf')) return 'PDF Document'
  if (mimeType.includes('image')) return 'Image'
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'Archive'
  if (mimeType.includes('text/plain')) return 'Text File'
  if (mimeType.includes('text/markdown')) return 'Markdown Document'
  const ext = name?.split('.').pop()?.toUpperCase()
  return ext ? `${ext} File` : 'Document'
}

export function DriveImportModal({
  driveOpen,
  setDriveOpen,
  driveLoading,
  driveError,
  driveFiles,
  filteredDriveFiles,
  driveQuery,
  setDriveQuery,
  onImportFile,
  onRetry,
  projectId,
}) {
  return (
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
        {driveError && <div className="drive-state error"><strong>Could not load Drive</strong><span>{driveError}</span><div><button onClick={onRetry}>Try again</button>{driveError.includes('disabled or blocked') && <a href={`https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${projectId}`} target="_blank" rel="noreferrer">Enable Drive API</a>}</div></div>}
        {!driveLoading && !driveError && !driveFiles.length && <div className="drive-state">No recent files found.</div>}
        {!driveLoading && !driveError && driveQuery && !filteredDriveFiles.length && <div className="drive-state">No files match “{driveQuery}”.</div>}
        {!driveLoading && !driveError && filteredDriveFiles.map((file) => (
          <button key={file.id} type="button" className="drive-file-item" onClick={() => onImportFile(file)}>
            <span className="drive-file-icon"><FileText size={17} /></span>
            <div className="drive-file-copy">
              <strong>{file.name}</strong>
              <small>{formatMimeType(file.mimeType, file.name)}</small>
            </div>
            <FolderInput size={16} />
          </button>
        ))}
      </div>
    </Modal>
  )
}
