import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye } from 'lucide-react'

export function EveThoughtHistory({ thinking }) {
  const [open, setOpen] = useState(false)
  if (!thinking) return null
  const preview = thinking.length > 72 ? `${thinking.slice(0, 72)}…` : thinking
  return (
    <div className={`eve-thought-container ${open ? 'open' : 'collapsed'}`}>
      <button type="button" className="eve-thought-header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="eve-thought-header-left">
          <Eye size={13} />
          <span>Thought</span>
          {!open && <span className="eve-thought-preview">{preview}</span>}
        </span>
        <span className="eve-thought-toggle" aria-hidden="true">
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      {open && <div className="eve-thought-content">{thinking}</div>}
    </div>
  )
}
