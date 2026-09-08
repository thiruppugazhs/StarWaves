import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { navLinks } from '../data'
import { useMagnetic } from './useMagnetic'

export function Nav({ onNavigate }) {
  const reduce = useReducedMotion()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 })
  const magnetic = useMagnetic()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const sections = navLinks
      .map((l) => document.getElementById(l.href.replace('#', '')))
      .filter(Boolean)
    if (!sections.length) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`)
        })
      },
      { rootMargin: '-38% 0px -55% 0px' },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open ])

  const scrollTo = (href) => {
    setOpen(false)
    const id = href.replace('#', '')
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <motion.nav
      className={`cinema-nav${scrolled ? ' is-scrolled' : ''}`}
      aria-label="Primary"
      initial={reduce ? false : { y: -24, opacity: 0 }}
      animate={reduce ? {} : { y: 0, opacity: 1 }}
      transition={reduce ? {} : { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
    >
      <button type="button" className="cinema-nav__brand" onClick={() => onNavigate('/')} aria-label="StarWaves home">
        <img src="/logo.png" alt="" aria-hidden="true" className="cinema-nav__mark" />
        <span>StarWaves</span>
      </button>

      <div className="cinema-nav__links" role="list">
        {navLinks.map((l) => (
          <a
            key={l.href}
            href={l.href}
            role="listitem"
            aria-current={active === l.href ? 'true' : undefined}
            className={active === l.href ? 'is-active' : undefined}
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
        <button type="button" className="cinema-cta cinema-cta--ghost cinema-cta--small cinema-nav__login" onClick={() => onNavigate('/login')}>
          Log in
        </button>
        <motion.button
          type="button"
          className="cinema-cta cinema-cta--primary cinema-cta--small"
          onClick={() => onNavigate('/signup')}
          {...magnetic}
        >
          Start free <ArrowRight size={14} aria-hidden="true" />
        </motion.button>
        <button
          type="button"
          className="cinema-nav__menu"
          aria-expanded={open}
          aria-controls="cinema-mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </div>

      {!reduce && (
        <motion.span className="cinema-nav__progress" aria-hidden="true" style={{ scaleX: progress }} />
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="cinema-mobile-menu"
            className="cinema-nav__drawer"
            initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={reduce ? {} : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? {} : { opacity: 0, y: -8, scale: 0.98 }}
            transition={reduce ? {} : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                aria-current={active === l.href ? 'true' : undefined}
                className={active === l.href ? 'is-active' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  scrollTo(l.href)
                }}
              >
                {l.label}
              </a>
            ))}
            <button type="button" className="cinema-cta cinema-cta--ghost cinema-cta--small" onClick={() => onNavigate('/login')}>
              Log in
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
