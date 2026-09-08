import { Box, ChevronDown, Download, FolderOpen, Redo2, Save, Undo2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const MENU_ITEMS = {
  File: [{ label: 'Save project', action: 'save' }, { label: 'Export GLB', action: 'export-glb' }],
  Edit: [{ label: 'Undo', action: 'undo' }, { label: 'Redo', action: 'redo' }],
  View: [{ label: 'Toggle grid', action: 'grid' }, { label: 'Toggle axes', action: 'axes' }, { label: 'Reset camera', action: 'reset-camera' }, { label: 'Fullscreen viewport', action: 'fullscreen' }],
  Create: [{ label: 'Add cube', action: 'add-cube' }],
  Modeling: [{ label: 'Select tool', action: 'tool-select' }, { label: 'Move tool', action: 'tool-move' }, { label: 'Rotate tool', action: 'tool-rotate' }, { label: 'Scale tool', action: 'tool-scale' }],
  Sculpting: [{ label: 'Sculpt tool unavailable', action: 'tool-sculpt', disabled: true }],
  UV: [{ label: 'UV editing unavailable', action: 'tool-uv', disabled: true }],
  Shading: [{ label: 'Open properties inspector', action: 'inspector' }],
  Animation: [{ label: 'Play or pause timeline', action: 'timeline' }],
}

export function StudioTopBar({ project, projects, capabilities, onOpen, onSave, onImport, onExport, onCreatePrimitive, onUndo, onRedo, onMenuAction, canUndo, canRedo }) {
  const [openMenu, setOpenMenu] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const closeMenu = (event) => { if (!menuRef.current?.contains(event.target)) setOpenMenu(null) }
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpenMenu(null) }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeMenu); document.removeEventListener('keydown', closeOnEscape) }
  }, [])

  const runMenuAction = (action) => { setOpenMenu(null); onMenuAction?.(action) }

  return (
    <header className="modeling-topbar">
      <div className="modeling-brand-mark" aria-hidden="true">A</div>
      <div className="modeling-brand-copy">
        <strong>Avatar Studio</strong>
        <span>{project.name}{project.dirty ? ' · Unsaved changes' : ` · ${project.status === 'saved' ? 'Saved' : 'Local scene'}`}</span>
      </div>
      <nav className="modeling-menu" aria-label="Studio menu" ref={menuRef}>
        {Object.keys(MENU_ITEMS).map((item) => (
          <div className="modeling-menu-group" key={item}><button type="button" className="modeling-menu-item" aria-haspopup="menu" aria-expanded={openMenu === item} onClick={() => setOpenMenu((current) => current === item ? null : item)}>{item}<ChevronDown size={11} /></button>{openMenu === item && <div className="modeling-menu-dropdown" role="menu">{MENU_ITEMS[item].map(({ label, action, disabled }) => <button type="button" role="menuitem" key={action} onClick={() => runMenuAction(action)} disabled={disabled}>{label}</button>)}</div>}</div>
        ))}
      </nav>
      <div className="modeling-top-actions">
        <label className="modeling-action-button" title="Import model">
          <Upload size={15} /> Import
          <input type="file" accept=".vrm,.glb,.gltf,.obj,.fbx,.mtl,.bin,.png,.jpg,.jpeg,.webp" multiple onChange={onImport} hidden />
        </label>
        <button type="button" className="modeling-action-button" onClick={onCreatePrimitive}><Box size={15} /> Add cube</button>
        <button type="button" className="modeling-icon-button" onClick={onUndo} disabled={!canUndo} aria-label="Undo"><Undo2 size={15} /></button>
        <button type="button" className="modeling-icon-button" onClick={onRedo} disabled={!canRedo} aria-label="Redo"><Redo2 size={15} /></button>
        <button type="button" className="modeling-action-button is-primary" onClick={onSave}><Save size={15} /> Save</button>
        <div className="modeling-export-menu">
          <button type="button" className="modeling-action-button" onClick={() => onExport('glb')}><Download size={15} /> Export</button>
          <div className="modeling-export-options">
            <button type="button" onClick={() => onExport('glb')}>Export GLB</button>
            <button type="button" onClick={() => onExport('gltf')}>Export GLTF</button>
            <button type="button" onClick={() => onExport('vrm')} disabled={!capabilities?.exportVrm} title="VRM export is unavailable until a VRM-preserving exporter is implemented">Export VRM unavailable</button>
          </div>
        </div>
        <label className="modeling-project-picker">
          <FolderOpen size={14} />
          <select value={project.id || ''} onChange={(event) => onOpen(event.target.value)} aria-label="Open modeling project">
            <option value="">Local scene</option>
            {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>
    </header>
  )
}
