import { Box, ChevronDown, ChevronRight, Eye, EyeOff, GitBranch, Layers3, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function buildTree(nodes) {
  const byParent = new Map()
  nodes.forEach((node) => {
    const key = node.parentId || null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(node)
  })
  return byParent
}

function collectMatchingIds(nodes, query) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const matching = new Set()
  nodes.forEach((node) => {
    if (!query || node.name.toLowerCase().includes(query.toLowerCase())) {
      let current = node
      while (current) {
        matching.add(current.id)
        current = byId.get(current.parentId)
      }
    }
  })
  return matching
}

function NodeRow({ node, childrenByParent, depth, expanded, onToggleExpand, selectedNodeId, onSelect, onRename, onToggleVisibility, query, editingId, editingName, setEditingId, setEditingName }) {
  const children = childrenByParent.get(node.id) || []
  const isEditing = editingId === node.id
  const commitRename = () => {
    onRename?.(node.id, editingName)
    setEditingId(null)
  }
  return <>
    <div className={`modeling-outliner-node ${selectedNodeId === node.id ? 'is-selected' : ''}`} role="treeitem" aria-selected={selectedNodeId === node.id} style={{ '--node-depth': depth }}>
      <button type="button" className="modeling-outliner-select" onClick={() => onSelect(node.id)} onDoubleClick={() => { setEditingId(node.id); setEditingName(node.name) }}>
        {children.length ? <span className="modeling-node-expander" role="button" aria-label={`${expanded.has(node.id) ? 'Collapse' : 'Expand'} ${node.name}`} onClick={(event) => { event.stopPropagation(); onToggleExpand(node.id) }}>{expanded.has(node.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span> : <span className="modeling-node-expander" />}
        {node.isMesh ? <Box size={13} /> : <GitBranch size={13} />}
        {isEditing ? <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onBlur={commitRename} onKeyDown={(event) => { if (event.key === 'Enter') commitRename(); if (event.key === 'Escape') setEditingId(null) }} aria-label={`Rename ${node.name}`} /> : <span title={query ? node.name : undefined}>{node.name}</span>}
      </button>
      <button type="button" className="modeling-node-visibility" onClick={() => onToggleVisibility(node)} aria-label={`${node.visible === false ? 'Show' : 'Hide'} ${node.name}`}>{node.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}</button>
    </div>
    {expanded.has(node.id) && children.map((child) => <NodeRow key={child.id} node={child} childrenByParent={childrenByParent} depth={depth + 1} expanded={expanded} onToggleExpand={onToggleExpand} selectedNodeId={selectedNodeId} onSelect={onSelect} onRename={onRename} onToggleVisibility={onToggleVisibility} query={query} editingId={editingId} editingName={editingName} setEditingId={setEditingId} setEditingName={setEditingName} />)}
  </>
}

export function StudioOutliner({ nodes, selectedNodeId, onSelect, onRename, onToggleVisibility }) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const childrenByParent = useMemo(() => buildTree(nodes), [nodes])
  const matchingIds = useMemo(() => collectMatchingIds(nodes, query), [nodes, query])
  const roots = childrenByParent.get(null) || nodes.filter((node) => !node.parentId)

  useEffect(() => {
    const rootIds = roots.map((node) => node.id)
    setExpanded((current) => {
      if (rootIds.every((id) => current.has(id))) return current
      return new Set([...current, ...rootIds])
    })
  }, [roots])

  const toggleExpanded = (id) => setExpanded((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const visibleRoots = query ? roots.filter((node) => matchingIds.has(node.id)) : roots
  return <section className="modeling-outliner" aria-label="Scene outliner">
    <div className="modeling-panel-heading compact"><div><span className="modeling-panel-kicker">Scene</span><h2>Outliner</h2></div><Layers3 size={16} /></div>
    <label className="modeling-search-field"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search objects" aria-label="Search scene objects" /></label>
    <div className="modeling-outliner-tree" role="tree">
      {visibleRoots.map((node) => <NodeRow key={node.id} node={node} childrenByParent={childrenByParent} depth={0} expanded={expanded} onToggleExpand={toggleExpanded} selectedNodeId={selectedNodeId} onSelect={onSelect} onRename={onRename} onToggleVisibility={onToggleVisibility} query={query} editingId={editingId} editingName={editingName} setEditingId={setEditingId} setEditingName={setEditingName} />)}
      {visibleRoots.length === 0 && <p className="modeling-muted-copy">{query ? 'No objects match this search.' : 'Load a model to inspect its scene.'}</p>}
    </div>
  </section>
}
