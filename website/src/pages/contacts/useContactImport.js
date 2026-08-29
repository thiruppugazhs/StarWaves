import { useState, useRef } from 'react'
import { createContact } from '../../lib/contactsApi'
import { beginGoogleContactsOAuth, importGoogleContacts, parseGoogleContactsCsv, parseVCard } from '../../lib/googleContacts'

export function useContactImport({ contacts, loadAllContacts, setError, setSuccessMessage }) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgressText, setImportProgressText] = useState('')
  const fileInputRef = useRef(null)

  const handleGoogleOAuthSync = async () => {
    setIsImporting(true)
    setError('')
    setImportProgressText('Connecting with Google…')
    try {
      await beginGoogleContactsOAuth()
      setImportProgressText('Fetching contacts from Google People API…')
      const result = await importGoogleContacts()
      await loadAllContacts()
      setIsImportModalOpen(false)
      setSuccessMessage(`Successfully imported ${result.imported_count} new contact${result.imported_count === 1 ? '' : 's'} from Google!`)
    } catch (err) {
      setError(err.message || 'Google Contacts import failed.')
    } finally {
      setIsImporting(false)
      setImportProgressText('')
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    setError('')
    setImportProgressText(`Reading ${file.name}…`)
    try {
      const text = await file.text()
      let parsedContacts = []
      if (file.name.endsWith('.vcf') || file.name.endsWith('.vcard')) {
        parsedContacts = parseVCard(text)
      } else {
        parsedContacts = parseGoogleContactsCsv(text)
      }
      if (!parsedContacts.length) {
        throw new Error('No valid contacts found in the selected file.')
      }
      setImportProgressText(`Importing ${parsedContacts.length} contacts…`)
      const existingEmails = new Set(contacts.filter((c) => c.email).map((c) => c.email.toLowerCase().trim()))
      const existingPhones = new Set(contacts.filter((c) => c.phone).map((c) => c.phone.replace(/[\s-]/g, '').trim()))
      const existingNames = new Set(contacts.map((c) => c.name.toLowerCase().trim()))
      let count = 0
      for (const item of parsedContacts) {
        const em = (item.email || '').toLowerCase().trim()
        const ph = (item.phone || '').replace(/[\s-]/g, '').trim()
        const nm = (item.name || '').toLowerCase().trim()
        if (em && existingEmails.has(em)) continue
        if (ph && existingPhones.has(ph)) continue
        if (!em && !ph && existingNames.has(nm)) continue
        await createContact(item)
        if (em) existingEmails.add(em)
        if (ph) existingPhones.add(ph)
        if (nm) existingNames.add(nm)
        count++
      }
      await loadAllContacts()
      setIsImportModalOpen(false)
      setSuccessMessage(`Successfully imported ${count} contact${count === 1 ? '' : 's'} from ${file.name}!`)
    } catch (err) {
      setError(err.message || 'File import failed.')
    } finally {
      setIsImporting(false)
      setImportProgressText('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return {
    isImportModalOpen,
    setIsImportModalOpen,
    isImporting,
    importProgressText,
    fileInputRef,
    handleGoogleOAuthSync,
    handleFileUpload,
  }
}
