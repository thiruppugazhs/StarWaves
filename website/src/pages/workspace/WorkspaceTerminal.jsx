import { Terminal as TerminalIcon } from 'lucide-react'

export function WorkspaceTerminal({ isTauri }) {
  if (!isTauri) {
    return (
      <div className="workspace-terminal">
        <div className="workspace-terminal-header">
          <TerminalIcon size={14} />
          <span>Terminal</span>
        </div>
        <div className="workspace-terminal-placeholder">
          <p>Terminal is available in the Starwaves desktop app</p>
        </div>
      </div>
    )
  }

  // Tauri terminal — will be implemented with xterm.js when Tauri shell plugin is ready
  return (
    <div className="workspace-terminal">
      <div className="workspace-terminal-header">
        <TerminalIcon size={14} />
        <span>Terminal</span>
      </div>
      <div className="workspace-terminal-placeholder">
        <p>Terminal integration coming soon</p>
      </div>
    </div>
  )
}
