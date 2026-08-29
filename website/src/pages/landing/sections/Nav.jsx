import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { navLinks } from '../data'

export function Nav({ onNavigate }) {
  const reduce = useReducedMotion()
  const scrollTo = (href) => {
    const id = href.replace('#', '')
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <motion.nav
      className="cinema-nav"
      aria-label="Primary"
      initial={reduce ? false : { y: -18, opacity: 0 }}
      animate={reduce ? {} : { y: 0, opacity: 1 }}
      transition={reduce ? {} : { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
    >
      <button type="button" className="cinema-nav__brand" onClick={() => onNavigate('/')} aria-label="StarWaves home">
        <span className="cinema-nav__mark" aria-hidden="true">S</span>
        <span>StarWaves</span>
      </button>

      <div className="cinema-nav__links" role="list">
        {navLinks.map((l) => (
          <a
            key={l.href}
            href={l.href}
            role="listitem"
            onClick={(e) => {
              e.preventDefault()
              scrollTo(l.href)
            }}
          >
            {l.label}
          </a>
        ))}
      </div>

      <div className="cinema-nav__actions">
        <button type="button" className="cinema-cta cinema-cta--ghost cinema-cta--small" onClick={() => onNavigate('/login')}>
          Log in
        </button>
        <button type="button" className="cinema-cta cinema-cta--primary cinema-cta--small" onClick={() => onNavigate('/signup')}>
          Start free <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </motion.nav>
  )
}
