import { Contact, FileText, RefreshCw, Upload, X } from 'lucide-react'

export function ContactImportModal({ isOpen, onClose, isImporting, importProgressText, fileInputRef, onGoogleSync, onFileUpload }) {
  if (!isOpen) return null
  return (
    <div className="contact-modal-overlay" onClick={() => !isImporting && onClose()}>
      <div className="contact-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
        <div className="contact-modal-header">
          <h2 id="import-modal-title">Import Contacts</h2>
          <button type="button" className="contact-modal-close-btn" onClick={onClose} disabled={isImporting} aria-label="Close import dialog">
            <X size={16} />
          </button>
        </div>
        <div className="contact-import-content">
          {isImporting ? (
            <div className="contact-import-loading">
              <RefreshCw size={24} className="spin" />
              <p>{importProgressText || 'Processing contacts…'}</p>
            </div>
          ) : (
            <>
              <div className="contact-import-option-card">
                <div className="contact-import-option-header">
                  <div className="contact-import-badge-icon">
                    <Contact size={20} />
                  </div>
                  <div>
                    <h3>Direct Google Contacts Sync</h3>
                    <p>Connect your Google Account to import all names, phone numbers, emails, companies, and avatars directly via Google People API.</p>
                  </div>
                </div>
                <button type="button" className="primary-button" onClick={onGoogleSync} style={{ width: '100%', justifyContent: 'center' }}>
                  <Contact size={14} />
                  <span>Sync with Google Account</span>
                </button>
              </div>
              <div className="contact-import-divider">
                <span>or upload file</span>
              </div>
              <div className="contact-import-option-card file-zone">
                <div className="contact-import-option-header">
                  <div className="contact-import-badge-icon">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3>Upload Google Contacts File</h3>
                    <p>
                      Export your contacts from Google Contacts (contacts.google.com) as a <strong>Google CSV</strong> or <strong>vCard (.vcf)</strong> and upload it here.
                    </p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" id="contacts-file-input" accept=".csv, .vcf, .vcard, text/csv, text/vcard" style={{ display: 'none' }} onChange={onFileUpload} />
                <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()} style={{ width: '100%', justifyContent: 'center' }}>
                  <Upload size={14} />
                  <span>Select Google CSV / vCard File</span>
                </button>
              </div>
            </>
          )}
        </div>
        <div className="contact-modal-footer">
          <button type="button" className="secondary-button" onClick={onClose} disabled={isImporting}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
