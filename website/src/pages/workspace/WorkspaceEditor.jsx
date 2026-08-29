import { useCallback, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { X, FileCode, FolderOpen, FilePlus, Save, Circle, Play } from 'lucide-react'

const EXTENSION_LANGUAGE_MAP = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  rb: 'ruby',
  php: 'php',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  html: 'html',
  xml: 'xml',
  json: 'json',
  md: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  sql: 'sql',
  sh: 'shell',
  bat: 'bat',
  ps1: 'powershell',
  dockerfile: 'dockerfile',
  gitignore: 'plaintext',
  sdignore: 'plaintext',
  env: 'plaintext',
  txt: 'plaintext',
}

function getLanguage(filePath) {
  const name = filePath.split('/').pop().toLowerCase()
  if (name === 'dockerfile') return 'dockerfile'
  const ext = name.split('.').pop()
  return EXTENSION_LANGUAGE_MAP[ext] || 'plaintext'
}

function getLanguageLabel(filePath) {
  const lang = getLanguage(filePath)
  const map = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    rust: 'Rust',
    go: 'Go',
    java: 'Java',
    csharp: 'C#',
    css: 'CSS',
    html: 'HTML',
    json: 'JSON',
    markdown: 'Markdown',
    yaml: 'YAML',
    sql: 'SQL',
    shell: 'Shell',
    dockerfile: 'Dockerfile',
    plaintext: 'Text',
  }
  return map[lang] || lang
}

function getTheme() {
  return document.documentElement.classList.contains('dark-theme')
    ? 'vs-dark'
    : 'vs'
}

function isHtmlFile(filePath) {
  return filePath?.split('.').pop().toLowerCase() === 'html'
}

export function WorkspaceEditor({
  tabs,
  activeTab,
  onTabSelect,
  onTabClose,
  onContentChange,
  onSave,
  isFileDirty,
  onCreateFile,
  onRunHtml,
}) {
  const editorRef = useRef(null)
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 })

  const handleMount = useCallback((editor) => {
    editorRef.current = editor
    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [2048 | 49],
      run: () => onSave(activeTab),
    })
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, column: e.position.column })
    })
  }, [onSave, activeTab])

  const activeTabData = tabs.find((tab) => tab.path === activeTab)

  if (tabs.length === 0) {
    return (
      <div className="workspace-editor">
        <div className="workspace-editor-empty-v2">
          <div className="workspace-empty-illustration">
            <FileCode size={48} strokeWidth={1.3} />
          </div>
          <h3>No file open</h3>
          <p>
            Select a file from the Explorer to start editing. Each file lives inside your workspace folder — edit with
            syntax highlighting and save with <kbd>Ctrl</kbd> + <kbd>S</kbd>.
          </p>
          <div className="workspace-empty-actions">
            <button className="primary-button" onClick={onCreateFile}>
              <FilePlus size={15} /> New File
            </button>
            <span className="workspace-empty-hint">or choose a file on the left</span>
          </div>
        </div>
      </div>
    )
  }

  const breadcrumbParts = activeTab ? activeTab.split('/') : []
  const isDirty = activeTab ? isFileDirty(activeTab) : false

  return (
    <div className="workspace-editor">
      <div className="workspace-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.path}
            className={`workspace-tab${tab.path === activeTab ? ' active' : ''}`}
            onClick={() => onTabSelect(tab.path)}
            title={tab.path}
          >
            <span className="workspace-tab-name">
              {isFileDirty(tab.path) && <span className="workspace-tab-dot" aria-label="Unsaved changes" />}
              <FileCode size={13} className="workspace-tab-icon" />
              {tab.name}
            </span>
            <span
              className="workspace-tab-close"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.path)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation()
                  onTabClose(tab.path)
                }
              }}
            >
              <X size={12} />
            </span>
          </button>
        ))}
      </div>

      {activeTab && (
        <div className="workspace-breadcrumb">
          <FolderOpen size={13} />
          <span className="workspace-breadcrumb-path">
            {breadcrumbParts.map((part, idx) => (
              <span key={idx} className="breadcrumb-segment">
                {idx > 0 && <span className="breadcrumb-sep">/</span>}
                <span className={idx === breadcrumbParts.length - 1 ? 'breadcrumb-active' : ''}>{part}</span>
              </span>
            ))}
          </span>
          {isDirty && <span className="breadcrumb-dirty"><Circle size={8} fill="currentColor" /> Unsaved</span>}
          {isHtmlFile(activeTab) && onRunHtml && (
            <button
              type="button"
              className="breadcrumb-run-btn"
              onClick={onRunHtml}
              title="Run HTML — preview in the browser panel"
              aria-label="Run HTML preview"
            >
              <Play size={11} />
              Run
            </button>
          )}
        </div>
      )}

      {activeTabData && (
        <>
          <div className="workspace-editor-monaco">
            <Editor
              key={activeTab}
              height="100%"
              language={getLanguage(activeTab)}
              value={activeTabData.content}
              theme={getTheme()}
              onChange={(value) => onContentChange(activeTab, value ?? '')}
              onMount={handleMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                renderWhitespace: 'selection',
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>
          <div className="workspace-editor-footer">
            <div className="workspace-footer-left">
              <span className="footer-lang">{getLanguageLabel(activeTab)}</span>
              <span className="footer-sep">·</span>
              <span>UTF-8</span>
              <span className="footer-sep">·</span>
              <span>{activeTabData.content.split('\n').length} lines</span>
            </div>
            <div className="workspace-footer-right">
              <span>Ln {cursorPos.line}, Col {cursorPos.column}</span>
              {isDirty ? (
                <span className="footer-dirty"><Circle size={7} fill="currentColor" /> Unsaved</span>
              ) : (
                <span className="footer-saved"><Save size={12} /> Saved</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
