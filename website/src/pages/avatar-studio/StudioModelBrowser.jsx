import { Box, Brush, ChevronRight, FileBox, Folder, Image, Layers3, Search, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'

const FILTERS = [
  { id: 'all', label: 'All', icon: Layers3 },
  { id: 'vrm', label: 'VRM', icon: Box },
  { id: 'live2d', label: 'Live2D', icon: Brush },
  { id: 'uploaded', label: 'Uploaded', icon: FileBox },
]

export function StudioModelBrowser({ models, activeModelId, onSelectModel, onImport }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const visibleModels = useMemo(() => models.filter((model) => {
    const matchesFilter = filter === 'all' || (filter === 'uploaded' ? model.id.startsWith('upload:') : model.renderer === filter)
    return matchesFilter && model.label.toLowerCase().includes(query.toLowerCase())
  }), [filter, models, query])

  return (
    <aside className="modeling-browser" aria-label="Model library">
      <div className="modeling-panel-heading">
        <div><span className="modeling-panel-kicker">Library</span><h2>Models</h2></div>
        <label className="modeling-upload-compact" title="Upload model">
          <Upload size={14} />
          <input type="file" accept=".vrm,.glb,.gltf,.obj,.fbx,.mtl,.bin,.png,.jpg,.jpeg,.webp" multiple onChange={onImport} hidden />
        </label>
      </div>
      <div className="modeling-browser-tabs" role="tablist" aria-label="Asset type">
        {['Models', 'Assets', 'Materials', 'Textures', 'Animations'].map((tab) => <button type="button" key={tab} className={tab === 'Models' ? 'is-active' : ''} disabled={tab !== 'Models'} title={tab === 'Models' ? undefined : `${tab} browser is available when its scene data is loaded`}>{tab}</button>)}
      </div>
      <label className="modeling-search-field"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models" aria-label="Search models" /></label>
      <div className="modeling-filter-list">
        {FILTERS.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}><Icon size={14} /> <span>{label}</span><small>{id === 'all' ? models.length : models.filter((model) => id === 'uploaded' ? model.id.startsWith('upload:') : model.renderer === id).length}</small></button>)}
      </div>
      <div className="modeling-model-grid">
        {visibleModels.map((model) => {
          const active = model.id === activeModelId
          return <button type="button" key={model.id} className={`modeling-model-card ${active ? 'is-active' : ''}`} onClick={() => onSelectModel(model)} aria-pressed={active}>
            <span className="modeling-model-art"><Folder size={24} /></span>
            <span className="modeling-model-card-copy"><strong>{model.label}</strong><small>{model.renderer?.toUpperCase()}</small></span>
            <ChevronRight className="modeling-model-arrow" size={14} />
          </button>
        })}
        {visibleModels.length === 0 && <div className="modeling-empty-library"><Image size={20} /><span>No matching models.</span></div>}
      </div>
    </aside>
  )
}
