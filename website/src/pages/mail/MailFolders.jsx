import '../../styles/pages/mail-folders.css'
import { ChevronDown, Inbox, MailPlus, Plus, User } from 'lucide-react'
import { FOLDERS } from './mailUtils'

export function MailFolders({
  folder,
  onSelectFolder,
  accounts,
  account,
  selectedAccountEmail,
  onSelectAccount,
  accountMenuOpen,
  onToggleAccountMenu,
  onAddAccount,
  onCompose,
  unreadCount = 0,
}) {
  return (
    <aside className="mail-folders">
      <div className="mail-mobile-compose">
        <button onClick={onCompose}>
          <MailPlus size={17} /><span>Compose</span>
        </button>
      </div>

      <button
        className={`mail-all-inboxes ${!selectedAccountEmail ? 'active' : ''}`}
        onClick={() => onSelectAccount(null)}
      >
        <Inbox size={18} />
        <span>All inboxes</span>
      </button>

      {FOLDERS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={folder === id ? 'active' : ''}
          onClick={() => onSelectFolder(id)}
        >
          <Icon size={18} />
          <span>{label}</span>
          {id === 'INBOX' && unreadCount > 0 && <strong>{unreadCount}</strong>}
        </button>
      ))}

      <div className="mail-account-menu">
        <button
          className="mail-account-trigger"
          aria-expanded={accountMenuOpen}
          onClick={onToggleAccountMenu}
          title={selectedAccountEmail || account || 'Choose account'}
        >
          <User size={18} />
          <span>{selectedAccountEmail || account || 'Choose account'}</span>
          <ChevronDown size={15} />
        </button>
        {accountMenuOpen && (
          <div className="mail-account-dropdown" role="menu">
            {accounts.map((acc) => (
              <button key={acc.id || acc.email} role="menuitem" onClick={() => onSelectAccount(acc.email)}>
                <span>{acc.email}</span>
              </button>
            ))}
            <button role="menuitem" onClick={onAddAccount}>
              <Plus size={16} />
              <span>Add Gmail account</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
