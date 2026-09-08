import { ArrowLeft } from 'lucide-react'
import { StarWavesLogo } from '../StarWavesLogo'
import '../../styles/pages/auth-split.css'

const DEFAULT_PANEL = {
  kicker: 'Account recovery',
  title: 'We\'ll get you back in.',
  body: 'Three quick steps — identify, verify, reset — and your workspace is yours again.',
}

export function AuthShell({ backLabel, onBack, onHome, panel, children }) {
  const copy = { ...DEFAULT_PANEL, ...(panel ?? {}) }

  return (
    <main id="main-content" className="auth-cinematic" tabIndex={-1}>
      <div className="auth-cinematic__bg" aria-hidden="true" />
      <div className="auth-split">
        <aside className="auth-split__brand" aria-label="About StarWaves">
          <span className="auth-split__floor" aria-hidden="true" />
          <span className="auth-split__horizon" aria-hidden="true" />
          <button type="button" className="auth-split__brand-row" onClick={onHome} aria-label="StarWaves home">
            <StarWavesLogo size={22} />
            <span>StarWaves</span>
          </button>
          <p className="auth-split__kicker">{copy.kicker}</p>
          <p className="auth-split__title">{copy.title}</p>
          <p className="auth-split__body">{copy.body}</p>
          <p className="auth-split__triad">Code · Create · Evolve</p>
        </aside>
        <div className="auth-split__form">
          <div className="auth-split__form-inner">
            <div className="auth-split__top">
              <button type="button" className="auth-back" onClick={onBack}>
                <ArrowLeft size={16} /> {backLabel}
              </button>
            </div>
            {children}
            <p className="auth-cinematic__foot">Plan clearly. Build consistently.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
