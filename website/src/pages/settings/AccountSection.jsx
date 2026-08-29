import { useState } from 'react'
import { LogOut, Trash2 } from 'lucide-react'
import { clearAuthSession, deleteAccount } from '../../lib/authApi'
import { clearGmailAuthorization } from '../../lib/firebase'
import { Modal, SectionHeading } from '../../components/ui'

export function AccountSection({ user, onSignOut }) {
  const [accountDeleting, setAccountDeleting] = useState(false)
  const [accountDeleteMessage, setAccountDeleteMessage] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  const deleteAccountHandler = async (event) => {
    event.preventDefault()
    if (deleteConfirmation !== user.name) return
    setAccountDeleting(true)
    setAccountDeleteMessage('')
    try {
      await deleteAccount()
      clearAuthSession()
      clearGmailAuthorization()
    } catch (error) {
      setAccountDeleteMessage(error.message || 'Your account could not be deleted.')
      setAccountDeleting(false)
    }
  }

  const openDeleteModal = () => {
    setDeleteConfirmation('')
    setAccountDeleteMessage('')
    setDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    if (accountDeleting) return
    setDeleteModalOpen(false)
    setDeleteConfirmation('')
    setAccountDeleteMessage('')
  }

  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut()
    } else {
      clearAuthSession()
    }
  }

  return (
    <div className="setting-section delete-account-section" id="settings-account">
      <SectionHeading
        title="Account & security"
        description="Manage session access or permanently remove your account."
      />

      <div className="account-actions-wrapper">
        <div className="account-action-card">
          <div>
            <h3>Sign out of account</h3>
            <p>
              Sign out of your active StarWaves session on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
          >
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>

        <div className="delete-account-card">
          <div>
            <h3>Delete your account</h3>
            <p>
              This permanently deletes your account and cannot be undone.
            </p>
            {accountDeleteMessage && (
              <strong role="alert">{accountDeleteMessage}</strong>
            )}
          </div>
          <button
            type="button"
            onClick={openDeleteModal}
            disabled={accountDeleting}
          >
            <Trash2 size={15} />
            <span>{accountDeleting ? 'Deleting…' : 'Delete account'}</span>
          </button>
        </div>
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        className="delete-account-modal"
        backdropClassName="delete-account-backdrop"
        hideHeading
      >
        <div className="delete-account-modal-icon">
          <Trash2 size={21} />
        </div>
        <h2 id="delete-account-title">Delete account?</h2>
        <p>
          This permanently deletes your StarWaves account and cannot be
          undone.
        </p>

        <form onSubmit={deleteAccountHandler}>
          <label htmlFor="delete-account-confirmation">
            Type <strong>{user.name}</strong> to confirm
          </label>
          <input
            id="delete-account-confirmation"
            value={deleteConfirmation}
            onChange={(event) => {
              setDeleteConfirmation(event.target.value)
              setAccountDeleteMessage('')
            }}
            placeholder={user.name}
            autoComplete="off"
            data-modal-initial-focus
          />
          {accountDeleteMessage && (
            <p className="delete-account-modal-error" role="alert">
              {accountDeleteMessage}
            </p>
          )}
          <div className="delete-account-modal-actions">
            <button
              className="delete-account-cancel"
              type="button"
              onClick={closeDeleteModal}
              disabled={accountDeleting}
            >
              Cancel
            </button>
            <button
              className="delete-account-confirm"
              type="submit"
              disabled={
                accountDeleting || deleteConfirmation !== user.name
              }
            >
              <Trash2 size={15} />
              {accountDeleting ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
