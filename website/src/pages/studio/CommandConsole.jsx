import { useState } from 'react'
import { Play, TerminalSquare } from 'lucide-react'
import { runStudioCommand } from '../../lib/studioApi'

const QUICK_COMMANDS = [
  'npm install',
  'npm run build',
  'git status',
]

export function CommandConsole({ projectId, onCommandFinished }) {
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState('')

  const run = async (rawCommand) => {
    const clean = (rawCommand ?? command).trim()
    if (!clean || isRunning) return
    setIsRunning(true)
    setError('')
    setOutput((current) => [...current, { kind: 'input', text: `$ ${clean}` }])
    try {
      const result = await runStudioCommand(projectId, clean)
      setOutput((current) => [
        ...current,
        {
          kind: result.exit_code === 0 ? 'stdout' : 'stderr',
          text: [result.stdout, result.stderr].filter(Boolean).join('\n') || `(exit code ${result.exit_code})`,
        },
      ])
      onCommandFinished?.(result)
    } catch (runError) {
      setError(runError.message || 'Command failed to run.')
    } finally {
      setIsRunning(false)
      setCommand('')
    }
  }

  return (
    <section className="studio-console" aria-label="Command console">
      <div className="studio-console-output" role="log" aria-live="polite">
        {output.length === 0 && (
          <p className="studio-console-hint">
            <TerminalSquare size={13} /> Run installs, builds, tests, and git commands here.
          </p>
        )}
        {output.map((entry, index) => (
          <pre key={index} className={`studio-console-line ${entry.kind}`}>{entry.text}</pre>
        ))}
      </div>

      {error && <p className="studio-form-error" role="alert">{error}</p>}

      <div className="studio-console-input-row">
        <div className="studio-console-quick">
          {QUICK_COMMANDS.map((quick) => (
            <button
              key={quick}
              type="button"
              className="studio-quick-cmd"
              onClick={() => run(quick)}
              disabled={isRunning}
            >
              {quick}
            </button>
          ))}
        </div>
        <form
          className="studio-console-form"
          onSubmit={(e) => {
            e.preventDefault()
            run()
          }}
        >
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="npm install && npm run build"
            aria-label="Command"
            disabled={isRunning}
          />
          <button
            type="submit"
            className="primary-button"
            disabled={!command.trim() || isRunning}
            aria-label="Run command"
          >
            <Play size={14} />
            {isRunning ? 'Running…' : 'Run'}
          </button>
        </form>
      </div>
    </section>
  )
}
