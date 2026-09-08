import { MotionConfig, useReducedMotion } from 'framer-motion'
import { Nav } from './sections/Nav'
import { Hero } from './sections/Hero'
import { Manifesto } from './sections/Manifesto'
import { Showcase } from './sections/Showcase'
import { Eve } from './sections/Eve'
import { Features } from './sections/Features'
import { Workflow } from './sections/Workflow'
import { FAQ } from './sections/FAQ'
import { Finale, Footer } from './sections/Finale'
import './cinema-base.css'
import './cinema-hero.css'
import './cinema-sections.css'
import './cinema-motion.css'

export function LandingPage({ user, onNavigate }) {
  const reduce = useReducedMotion()

  // user prop is accepted for contract; all CTAs still go to /signup or /login per spec
  void user

  return (
    <MotionConfig reducedMotion={reduce ? 'always' : 'user'}>
      <main id="main-content" className="cinema" tabIndex={-1} style={{ outline: 'none' }}>
        <Nav onNavigate={onNavigate} />
        <Hero onNavigate={onNavigate} />
        <Manifesto />
        <Showcase onNavigate={onNavigate} />
        <Eve onNavigate={onNavigate} />
        <Features />
        <Workflow />
        <FAQ onNavigate={onNavigate} />
        <Finale onNavigate={onNavigate} />
        <Footer onNavigate={onNavigate} />
      </main>
    </MotionConfig>
  )
}
