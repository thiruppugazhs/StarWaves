import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, LogIn } from 'lucide-react'

export function Finale({ onNavigate }) {
  const reduce = useReducedMotion()
  return (
    <section className="cinema-finale" aria-labelledby="finale-title">
      <div className="cinema-finale__glow" aria-hidden="true" />
      <motion.div
        className="cinema-finale__inner"
        initial={reduce ? false : { opacity: 0, y: 18 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={reduce ? {} : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="cinema-eyebrow">The final act</p>
        <h2 id="finale-title">
          Build a workspace
          <br />
          that moves with your ambition
        </h2>
        <p>
          Join builders, competitors and teams who run their whole operating system on StarWaves. Free to start — your data stays yours.
        </p>

        <div className="cinema-finale__ctas">
          <button type="button" className="cinema-cta cinema-cta--primary cinema-cta--hero" onClick={() => onNavigate('/signup')}>
            Create your account <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button type="button" className="cinema-cta cinema-cta--ghost cinema-cta--hero" onClick={() => onNavigate('/login')}>
            <LogIn size={16} aria-hidden="true" /> Log in
          </button>
        </div>
        <p className="cinema-micro">No credit card required • Cancel anytime • 14 modules • One canvas</p>
      </motion.div>
    </section>
  )
}

export function Footer({ onNavigate }) {
  return (
    <footer className="cinema-footer" aria-label="Footer">
      <div className="cinema-footer__inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#CBD5E1', fontWeight: 850, letterSpacing: '-0.02em' }}>
          <span className="cinema-nav__mark" aria-hidden="true" style={{ width: 28, height: 28, fontSize: 12 }}>
            S
          </span>
          StarWaves
          <span style={{ color: '#64748B', fontWeight: 600, fontSize: 12, marginLeft: 6 }}>© {new Date().getFullYear()} — All rights reserved</span>
        </div>

        <nav className="cinema-footer__links" aria-label="Footer navigation">
          <button type="button" onClick={() => document.getElementById('manifesto')?.scrollIntoView({ behavior: 'smooth' })}>
            Manifesto
          </button>
          <button type="button" onClick={() => document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })}>
            Showcase
          </button>
          <button type="button" onClick={() => document.getElementById('assistant')?.scrollIntoView({ behavior: 'smooth' })}>
            AI Assistant
          </button>
          <button type="button" onClick={() => onNavigate('/privacy')}>
            Privacy
          </button>
          <button type="button" onClick={() => onNavigate('/terms')}>
            Terms
          </button>
          <button type="button" onClick={() => onNavigate('/signup')}>
            Sign up
          </button>
          <button type="button" onClick={() => onNavigate('/login')}>
            Log in
          </button>
        </nav>
      </div>
    </footer>
  )
}
