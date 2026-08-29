export function ModalHeader({ eyebrow, title, onClose, closeLabel = 'Close' }) {
  return (
    <header className="modal-heading">
      <div>
        {eyebrow && <p>{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {onClose && <button className="icon-button" type="button" onClick={onClose} aria-label={closeLabel}>×</button>}
    </header>
  )
}
