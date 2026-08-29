import { useState, useEffect, useMemo, useCallback } from 'react'
import { listContacts, deleteContact, toggleContactStarred } from '../../lib/contactsApi'

export function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const loadAllContacts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listContacts()
      setContacts(data)
    } catch (err) {
      setError(err.message || 'Failed to load contacts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAllContacts()
  }, [loadAllContacts])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 5000)
    return () => clearTimeout(timer)
  }, [successMessage])

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesSearch =
        !searchQuery.trim() ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.role || '').toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false
      if (activeCategory === 'all') return true
      if (activeCategory === 'starred') return c.starred
      return c.category === activeCategory
    })
  }, [contacts, searchQuery, activeCategory])

  const handleDelete = async (contactId) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return
    try {
      await deleteContact(contactId)
      setContacts((prev) => prev.filter((c) => c.id !== contactId))
      setSuccessMessage('Contact deleted.')
    } catch (err) {
      setError(err.message || 'Failed to delete contact.')
    }
  }

  const handleToggleStar = async (contact) => {
    const nextStarred = !contact.starred
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, starred: nextStarred } : c)))
    try {
      await toggleContactStarred(contact.id, nextStarred)
    } catch (err) {
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, starred: contact.starred } : c)))
      setError(err.message || 'Failed to update contact.')
    }
  }

  return {
    contacts,
    setContacts,
    loading,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    filteredContacts,
    loadAllContacts,
    handleDelete,
    handleToggleStar,
  }
}
