import { useState } from 'react'
import { createContact, updateContact } from '../../lib/contactsApi'

export function useContactForm({ setContacts, setError, setSuccessMessage }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    role: '',
    category: 'general',
    notes: '',
    starred: false,
  })

  const handleOpenAddModal = () => {
    setEditingContact(null)
    setFormValues({
      name: '',
      email: '',
      phone: '',
      company: '',
      role: '',
      category: 'general',
      notes: '',
      starred: false,
    })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (contact) => {
    setEditingContact(contact)
    setFormValues({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      role: contact.role || '',
      category: contact.category || 'general',
      notes: contact.notes || '',
      starred: Boolean(contact.starred),
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    if (isSaving) return
    setIsModalOpen(false)
    setEditingContact(null)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (!formValues.name.trim()) return
    setIsSaving(true)
    setError('')
    try {
      if (editingContact) {
        const updated = await updateContact(editingContact.id, formValues)
        setContacts((prev) => prev.map((c) => (c.id === editingContact.id ? updated : c)))
      } else {
        const created = await createContact(formValues)
        setContacts((prev) => [created, ...prev])
      }
      setIsModalOpen(false)
      setEditingContact(null)
      setSuccessMessage(editingContact ? 'Contact updated.' : 'Contact created.')
    } catch (err) {
      setError(err.message || 'Failed to save contact.')
    } finally {
      setIsSaving(false)
    }
  }

  return {
    isModalOpen,
    setIsModalOpen,
    editingContact,
    isSaving,
    formValues,
    setFormValues,
    handleOpenAddModal,
    handleOpenEditModal,
    handleCloseModal,
    handleFormSubmit,
  }
}
