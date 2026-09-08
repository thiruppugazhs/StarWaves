import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Check, LogIn } from 'lucide-react'
import { marqueeModules } from '../data'
import { useMagnetic } from './useMagnetic'

export function Finale({ onNavigate }) {
  const reduce = useReducedMotion()
  const magnetic = useMagnetic()

  return (
    <section className="cinema-finale" aria-labelledby="finale-title">
      <div className="cinema-finale__rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="cinema-finale__glow" aria-hidden="true" />
      <motion.div
        className="cinema-finale__inner"
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={reduce ? {} : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="cinema-eyebrow">The final act — Evolve</p>
        <h2 id="finale-title" className="cinema-finale__title">
          Build a workspace
          <br />
          <span>that moves with your ambition</span>
        </h2>
        <p>
          Join builders, competitors and teams running their whole operating system on StarWaves. Free to start — your data stays yours.
        </p>

        <div className="cinema-finale__ctas">
          <motion.button
            type="button"
            className="cinema-cta cinema-cta--primary cinema-cta--hero"
            onClick={() => onNavigate('/signup')}
            {...magnetic}
          >
            Create your account <ArrowRight size={16} aria-hidden="true" />
          </motion.button>
          <button type="button" className="cinema-cta cinema-cta--ghost cinema-cta--hero" onClick={() => onNavigate('/login')}>
            <LogIn size={16} aria-hidden="true" /> Log in
          </button>
        </div>
        <p className="cinema-micro">
          <Check size={12} aria-hidden="true" /> No credit card required · 12 modules · One canvas
        </p>
      </motion.div>

      <div className="cinema-marquee cinema-marquee--finale" aria-hidden="true">
        <div className="cinema-marquee__track">
          {[...marqueeModules, ...marqueeModules].map((m, i) => (
            <span key={`${m}-${i}`} className="cinema-marquee__item">
              {m} <i>✦</i>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

const footerCols = [
  { title: 'Story', links: [{ label: 'Manifesto', id: 'manifesto' }, { label: 'Showcase', id: 'showcase' }, { label: 'Eve AI', id: 'eve' }] },
  { title: 'Flow', links: [{ label: 'Workflow', id: 'workflow' }, { label: 'FAQ', id: 'faq' }] },
]

export function Footer({ onNavigate }) {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <footer className="cinema-footer" aria-label="Footer">
      <div className="cinema-footer__inner">
        <div className="cinema-footer__brand-block">
          <div className="cinema-footer__brand">
            <img src="/logo.png" alt="" aria-hidden="true" className="cinema-nav__mark" />
            <span className="cinema-footer__word">StarWaves</span>
            <span className="cinema-footer__copy">© {new Date().getFullYear()}</span>
          </div>
          <p className="cinema-footer__tag">
            One canvas for tasks, code, contests — and Eve AI. Code · Create · Evolve.
          </p>
        </div>

        <nav className="cinema-footer__cols" aria-label="Footer sections">
          {footerCols.map((col) => (
            <div key={col.title} className="cinema-footer__col">
              <p>{col.title}</p>
              {col.links.map((l) => (
                <button key={l.id} type="button" onClick={() => scrollTo(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
          ))}
          <div className="cinema-footer__col">
            <p>Legal</p>
            <button type="button" onClick={() => onNavigate('/privacy')}>
              Privacy
            </button>
            <button type="button" onClick={() => onNavigate('/terms')}>
              Terms
            </button>
          </div>
          <div className="cinema-footer__col">
            <p>Account</p>
            <button type="button" onClick={() => onNavigate('/signup')}>
              Sign up
            </button>
            <button type="button" onClick={() => onNavigate('/login')}>
              Log in
            </button>
          </div>
        </nav>
      </div>
      <p className="cinema-footer__giant" aria-hidden="true">
        STARWAVES
      </p>
    </footer>
  )
}
