import { useState, useMemo } from 'react'
import {
  ChevronRight,
  ChevronDown,
  File,
  FileCode,
  FileText,
  FileJson,
  FileImage,
  FileArchive,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
} from 'lucide-react'

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const name = fileName.toLowerCase()
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt'].includes(ext)) return FileCode
  if (['json', 'yaml', 'yml', 'toml', 'xml'].includes(ext)) return FileJson
  if (['md', 'txt', 'rst', 'log'].includes(ext)) return FileText
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return FileImage
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return FileArchive
  if (name === 'dockerfile' || name === '.gitignore' || name === '.sdignore') return FileCode
  return File
}

function buildTree(flatFiles) {
  const root = { children: {} }
  for (const file of flatFiles) {
    const parts = file.path.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          isDirectory: i < parts.length - 1 || file.is_directory,
          size: file.size,
          children: {},
        }
      }
      current = current.children[part]
    }
  }
  return root.children
}

function sortEntries(entries) {
  return Object.values(entries).sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function TreeNode({ node, activeFile, onFileSelect, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const children = useMemo(() => sortEntries(node.children || {}), [node.children])
  const hasChildren = children.length > 0
  const isActive = activeFile === node.path
  const FileIcon = node.isDirectory ? null : getFileIcon(node.name)

  if (node.isDirectory) {
    return (
      <div className="tree-node">
        <button
          className={`tree-item tree-directory${expanded ? ' expanded' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 10}px` }}
          onClick={() => setExpanded(!expanded)}
          title={node.path}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {expanded ? <FolderOpen size={15} className="tree-folder-icon" /> : <Folder size={15} className="tree-folder-icon" />}
          <span className="tree-item-name">{node.name}</span>
        </button>
        {expanded && hasChildren && (
          <div className="tree-children">
            {children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                activeFile={activeFile}
                onFileSelect={onFileSelect}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="tree-node">
      <button
        className={`tree-item tree-file${isActive ? ' active' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 10}px` }}
        onClick={() => onFileSelect(node.path)}
        title={node.path}
      >
        <span className="tree-file-icon">
          {FileIcon && <FileIcon size={15} />}
        </span>
        <span className="tree-item-name">{node.name}</span>
      </button>
    </div>
  )
}

function isHiddenPlaceholder(name) {
  return name === '.keep' || name === '.gitkeep'
}

export function WorkspaceFileTree({
  files,
  activeFile,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
}) {
  const visibleFiles = useMemo(() => files.filter((f) => !isHiddenPlaceholder(f.name) && f.name !== '.sdignore'), [files])
  const tree = useMemo(() => buildTree(visibleFiles), [visibleFiles])
  const sorted = useMemo(() => sortEntries(tree), [tree])

  return (
    <div className="workspace-file-tree">
      <div className="file-tree-header">
        <span className="file-tree-title">Explorer</span>
        <div className="file-tree-actions">
          <button
            className="file-tree-action"
            onClick={onCreateFile}
            title="New file…"
            aria-label="New file"
          >
            <FilePlus size={14} />
          </button>
          <button
            className="file-tree-action"
            onClick={onCreateFolder}
            title="New folder…"
            aria-label="New folder"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>
      <div className="file-tree-content">
        {sorted.length === 0 ? (
          <div className="file-tree-empty-v2">
            <div className="file-tree-empty-illustration">
              <FolderOpen size={42} strokeWidth={1.4} />
            </div>
            <h4>Your workspace is empty</h4>
            <p>
              This workspace is a folder. Create files or folders to start coding — use the editor for text, Markdown,
              JSON, Python, JS and more.
            </p>
            <div className="file-tree-empty-actions">
              <button className="primary-button small" onClick={onCreateFile}>
                <FilePlus size={14} /> New File
              </button>
              <button className="secondary-button small" onClick={onCreateFolder}>
                <FolderPlus size={14} /> New Folder
              </button>
            </div>
            <span className="file-tree-empty-hint">Tip: paths like <code>src/app.js</code> auto-create folders</span>
          </div>
        ) : (
          sorted.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              activeFile={activeFile}
              onFileSelect={onFileSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}


