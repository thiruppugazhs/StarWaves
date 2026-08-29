import { Contact, Plus, Upload } from 'lucide-react'
import { EmptyState, LoadingState } from '../../components/ui'
import { ContactCard } from './ContactCard'

export function ContactGrid({ loading, filteredContacts, searchQuery, onToggleStar, onEdit, onDelete, onCall, onMail, onOpenAddModal, onOpenImportModal }) {
  if (loading) {
    return <LoadingState message="Loading contacts directory…" />
  }
  if (filteredContacts.length === 0) {
    return (
      <EmptyState
        icon={Contact}
        title={searchQuery ? 'No matching contacts found' : 'No contacts saved yet'}
        description={
          searchQuery ? 'Try searching with different terms or category filters.' : 'Add contacts manually or import your entire address book directly from Google Contacts.'
        }
        action={
          !searchQuery ? (
            <div className="contacts-empty-actions">
              <button type="button" className="secondary-button" onClick={onOpenImportModal}>
                <Upload size={14} />
                <span>Import from Google</span>
              </button>
              <button type="button" className="primary-button" onClick={onOpenAddModal}>
                <Plus size={14} />
                <span>Create contact</span>
              </button>
            </div>
          ) : null
        }
      />
    )
  }
  return (
    <div className="contacts-grid" role="list">
      {filteredContacts.map((contact) => (
        <ContactCard key={contact.id} contact={contact} onToggleStar={onToggleStar} onEdit={onEdit} onDelete={onDelete} onCall={onCall} onMail={onMail} />
      ))}
    </div>
  )
}
