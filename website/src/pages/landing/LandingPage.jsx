import { useEffect, useState } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { Nav } from './sections/Nav'
import { Hero } from './sections/Hero'
import { Manifesto } from './sections/Manifesto'
import { Showcase } from './sections/Showcase'
import { Eve } from './sections/Eve'
import { Features } from './sections/Features'
import { Workflow } from './sections/Workflow'
import { FAQ } from './sections/FAQ'
import { Finale, Footer } from './sections/Finale'
import './cinema.css'

export function LandingPage({ user, onNavigate }) {
  const reduce = useReducedMotion()
  const [curtain, setCurtain] = useState(!reduce)

  useEffect(() => {
    if (reduce) return undefined
    const t = setTimeout(() => setCurtain(false), 900)
    return () => clearTimeout(t)
  }, [reduce])

  // user prop is accepted for contract; all CTAs still go to /signup or /login per spec
  void user

  return (
    <MotionConfig reducedMotion={reduce ? 'always' : 'user'}>
      <AnimatePresence>
        {curtain && (
          <motion.div
            aria-hidden="true"
              style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              display: 'grid',
              placeItems: 'center',
              background: '#000000',
              color: '#fff',
            }}
            initial={{ y: 0 }}
            exit={{ y: '-100%', transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ textAlign: 'center', display: 'grid', gap: 12, justifyItems: 'center' }}
            >
              <span
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  background: '#FFFFFF',
                  color: '#000000',
                  border: '1px solid #FFFFFF',
                  fontWeight: 950,
                  fontSize: 22,
                  letterSpacing: '-0.04em',
                }}
              >
                S
              </span>
              <span style={{ fontWeight: 900, letterSpacing: '-0.04em', fontSize: 16, color: '#CBD5E1' }}>STARWAVES</span>
              <span style={{ fontSize: 10, fontWeight: 850, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748B' }}>Feature presentation</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="main-content" className="cinema" tabIndex={-1} style={{ outline: 'none' }}>
        <Nav onNavigate={onNavigate} />
        <Hero onNavigate={onNavigate} />
        <Manifesto />
        <Showcase onNavigate={onNavigate} />
        <Eve onNavigate={onNavigate} />
        <Features />
        <Workflow />
        <FAQ />
        <Finale onNavigate={onNavigate} />
        <Footer onNavigate={onNavigate} />
      </main>
    </MotionConfig>
  )
}
