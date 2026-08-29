import { Building, Mail, Pencil, Phone, Star, Trash2 } from 'lucide-react'
import { getInitials } from './constants'

export function ContactCard({ contact, onToggleStar, onEdit, onDelete, onCall, onMail }) {
  return (
    <div className="contact-card" role="listitem">
      <div className="contact-card-top">
        <div className="contact-profile-info">
          <div className="contact-avatar" aria-hidden="true">
            {contact.avatarUrl ? <img src={contact.avatarUrl} alt="" /> : getInitials(contact.name)}
          </div>
          <div className="contact-name-block">
            <h2 className="contact-name">{contact.name}</h2>
            {(contact.role || contact.company) && (
              <p className="contact-role-company">
                {contact.role}
                {contact.role && contact.company && ' • '}
                {contact.company}
              </p>
            )}
          </div>
        </div>
        <div className="contact-card-actions">
          <button
            type="button"
            className={`contact-star-btn ${contact.starred ? 'starred' : ''}`}
            onClick={() => onToggleStar(contact)}
            aria-label={contact.starred ? 'Unstar contact' : 'Star contact'}
            title={contact.starred ? 'Starred' : 'Add to Starred'}
          >
            <Star size={15} fill={contact.starred ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      {contact.category && contact.category !== 'general' && (
        <div className="contact-meta-badge">
          <span>{contact.category}</span>
        </div>
      )}
      <div className="contact-details-list">
        {contact.email && (
          <div className="contact-detail-row">
            <Mail size={13} />
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </div>
        )}
        {contact.phone && (
          <div className="contact-detail-row">
            <Phone size={13} />
            <a href={`tel:${contact.phone}`}>{contact.phone}</a>
          </div>
        )}
        {contact.company && !contact.role && (
          <div className="contact-detail-row">
            <Building size={13} />
            <span>{contact.company}</span>
          </div>
        )}
      </div>
      {contact.notes && (
        <p className="contact-notes-box" title={contact.notes}>
          {contact.notes}
        </p>
      )}
      <div className="contact-card-footer">
        <div className="contact-footer-quick-actions">
          {(contact.phone || contact.email) && (
            <button type="button" className="contact-quick-btn" onClick={() => onCall(contact)} title={`Call ${contact.name}`}>
              <Phone size={12} />
              <span>Call</span>
            </button>
          )}
          {contact.email && (
            <button type="button" className="contact-quick-btn" onClick={() => onMail(contact)} title={`Send email to ${contact.email}`}>
              <Mail size={12} />
              <span>Email</span>
            </button>
          )}
        </div>
        <div className="contact-footer-manage-actions">
          <button type="button" className="contact-action-icon-btn" onClick={() => onEdit(contact)} title="Edit contact" aria-label={`Edit ${contact.name}`}>
            <Pencil size={13} />
          </button>
          <button type="button" className="contact-action-icon-btn delete" onClick={() => onDelete(contact.id)} title="Delete contact" aria-label={`Delete ${contact.name}`}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
