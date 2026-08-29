import { Plus, Upload } from 'lucide-react'
import { Alert, FilterPills, SearchBar } from '../../components/ui'
import { CATEGORIES } from './constants'
import { useContacts } from './useContacts'
import { useContactForm } from './useContactForm'
import { useContactImport } from './useContactImport'
import { ContactGrid } from './ContactGrid'
import { ContactFormModal } from './ContactFormModal'
import { ContactImportModal } from './ContactImportModal'

export function ContactsPage({ callCenter, onNavigate }) {
  const { contacts, setContacts, loading, error, setError, successMessage, setSuccessMessage, searchQuery, setSearchQuery, activeCategory, setActiveCategory, filteredContacts, loadAllContacts, handleDelete, handleToggleStar } =
    useContacts()

  const { isModalOpen, editingContact, isSaving, formValues, setFormValues, handleOpenAddModal, handleOpenEditModal, handleCloseModal, handleFormSubmit } = useContactForm({
    setContacts,
    setError,
    setSuccessMessage,
  })

  const { isImportModalOpen, setIsImportModalOpen, isImporting, importProgressText, fileInputRef, handleGoogleOAuthSync, handleFileUpload } = useContactImport({
    contacts,
    loadAllContacts,
    setError,
    setSuccessMessage,
  })

  const handleCallContact = (contact) => {
    const target = contact.phone || contact.email
    if (!target) return
    if (callCenter?.dial) {
      callCenter.dial(target, 'audio')
    } else {
      onNavigate?.('calls')
    }
  }

  const handleMailContact = (contact) => {
    if (!contact.email) return
    window.location.href = `mailto:${encodeURIComponent(contact.email)}`
  }

  return (
    <main className="contacts-page">
      <header className="contacts-header">
        <div className="contacts-header-info">
          <p className="contacts-header-kicker">Communication</p>
          <h1>Contacts</h1>
          <p>Manage your personal and professional network, phone directory, and communication links.</p>
        </div>
        <div className="contacts-header-actions">
          <button type="button" className="secondary-button" onClick={() => setIsImportModalOpen(true)} title="Import contacts from Google">
            <Upload size={14} />
            <span>Import Contacts</span>
          </button>
          <button type="button" className="primary-button" onClick={handleOpenAddModal}>
            <Plus size={14} />
            <span>New Contact</span>
          </button>
        </div>
      </header>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" onDismiss={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      <div className="contacts-controls">
        <SearchBar className="contacts-search-box" placeholder="Search contacts by name, email, phone, or company…" ariaLabel="Search contacts" value={searchQuery} onChange={setSearchQuery} />
        <FilterPills className="contacts-filter-tabs" items={CATEGORIES} activeId={activeCategory} onChange={setActiveCategory} ariaLabel="Contact categories" />
      </div>

      <ContactGrid
        loading={loading}
        filteredContacts={filteredContacts}
        searchQuery={searchQuery}
        onToggleStar={handleToggleStar}
        onEdit={handleOpenEditModal}
        onDelete={handleDelete}
        onCall={handleCallContact}
        onMail={handleMailContact}
        onOpenAddModal={handleOpenAddModal}
        onOpenImportModal={() => setIsImportModalOpen(true)}
      />

      <ContactImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        isImporting={isImporting}
        importProgressText={importProgressText}
        fileInputRef={fileInputRef}
        onGoogleSync={handleGoogleOAuthSync}
        onFileUpload={handleFileUpload}
      />

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingContact={editingContact}
        isSaving={isSaving}
        formValues={formValues}
        setFormValues={setFormValues}
        onSubmit={handleFormSubmit}
      />
    </main>
  )
}
