import { X } from 'lucide-react'
import { CustomDropdown } from '../../components/ui'
import { CATEGORY_OPTIONS } from './constants'

export function ContactFormModal({ isOpen, onClose, editingContact, isSaving, formValues, setFormValues, onSubmit }) {
  if (!isOpen) return null
  return (
    <div className="contact-modal-overlay" onClick={onClose}>
      <div className="contact-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
        <div className="contact-modal-header">
          <h2 id="contact-modal-title">{editingContact ? 'Edit Contact' : 'New Contact'}</h2>
          <button type="button" className="contact-modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="contact-modal-form">
          <div className="contact-form-group">
            <label htmlFor="contact-name">Full Name *</label>
            <input id="contact-name" type="text" className="contact-form-input" placeholder="e.g. Alex Johnson" value={formValues.name} onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))} required autoFocus />
          </div>
          <div className="contact-form-row-2col">
            <div className="contact-form-group">
              <label htmlFor="contact-email">Email Address</label>
              <input id="contact-email" type="email" className="contact-form-input" placeholder="alex@example.com" value={formValues.email} onChange={(e) => setFormValues((v) => ({ ...v, email: e.target.value }))} />
            </div>
            <div className="contact-form-group">
              <label htmlFor="contact-phone">Phone Number</label>
              <input id="contact-phone" type="tel" className="contact-form-input" placeholder="+1 (555) 000-0000" value={formValues.phone} onChange={(e) => setFormValues((v) => ({ ...v, phone: e.target.value }))} />
            </div>
          </div>
          <div className="contact-form-row-2col">
            <div className="contact-form-group">
              <label htmlFor="contact-company">Company / Organization</label>
              <input id="contact-company" type="text" className="contact-form-input" placeholder="Acme Corp" value={formValues.company} onChange={(e) => setFormValues((v) => ({ ...v, company: e.target.value }))} />
            </div>
            <div className="contact-form-group">
              <label htmlFor="contact-role">Job Title / Role</label>
              <input id="contact-role" type="text" className="contact-form-input" placeholder="Engineering Lead" value={formValues.role} onChange={(e) => setFormValues((v) => ({ ...v, role: e.target.value }))} />
            </div>
          </div>
          <div className="contact-form-group">
            <label>Category</label>
            <CustomDropdown value={formValues.category} onChange={(cat) => setFormValues((v) => ({ ...v, category: cat }))} ariaLabel="Contact Category" options={CATEGORY_OPTIONS} />
          </div>
          <div className="contact-form-group">
            <label htmlFor="contact-notes">Notes / Context</label>
            <textarea id="contact-notes" className="contact-form-textarea" placeholder="Met at hackathon, recruiter for Q4 roles, etc." value={formValues.notes} onChange={(e) => setFormValues((v) => ({ ...v, notes: e.target.value }))} />
          </div>
          <label className="contact-checkbox-label">
            <input type="checkbox" checked={formValues.starred} onChange={(e) => setFormValues((v) => ({ ...v, starred: e.target.checked }))} />
            <span>Add to Starred / Favorites</span>
          </label>
          <div className="contact-modal-footer">
            <button type="button" className="secondary-button" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isSaving || !formValues.name.trim()}>
              <span>{isSaving ? 'Saving…' : editingContact ? 'Save Changes' : 'Create Contact'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
