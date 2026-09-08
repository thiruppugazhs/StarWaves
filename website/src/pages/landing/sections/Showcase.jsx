import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import { showcaseScenes } from '../data'

const AUTOPLAY_MS = 6000

export function Showcase({ onNavigate }) {
  const reduce = useReducedMotion()
  const outerRef = useRef(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const { scrollYProgress } = useScroll({ target: outerRef, offset: ['start start', 'end end'] })
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])
  const dolly = useTransform(scrollYProgress, [0, 1], [0.96, 1.04])

  useEffect(() => {
    if (reduce) return undefined
    const unsub = scrollYProgress.on('change', (v) => {
      const idx = Math.min(showcaseScenes.length - 1, Math.floor(v * showcaseScenes.length + 0.0001))
      setActive(idx)
    })
    return () => unsub()
  }, [scrollYProgress, reduce])

  useEffect(() => {
    if (reduce || paused) return undefined
    const id = window.setInterval(() => {
      setActive((a) => (a + 1) % showcaseScenes.length)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [reduce, paused])

  const scrollToIndex = (idx) => {
    if (!outerRef.current) return
    const rect = outerRef.current.getBoundingClientRect()
    const top = window.scrollY + rect.top
    const height = rect.height - window.innerHeight
    const target = top + (idx / showcaseScenes.length) * height + 8
    window.scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' })
  }

  const scene = showcaseScenes[active]

  return (
    <section id="showcase" ref={outerRef} className="cinema-showcase" aria-labelledby="showcase-title" style={{ height: reduce ? 'auto' : '260vh' }}>
      <div className="cinema-showcase__sticky">
        <div className="cinema-showcase__bg" aria-hidden="true" />
        <motion.div
          className="cinema-showcase__inner"
          style={reduce ? { '--cinema-scene': scene.color } : { '--cinema-scene': scene.color, scale: dolly }}
          onHoverStart={() => setPaused(true)}
          onHoverEnd={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="cinema-showcase__intro">
            <p className="cinema-eyebrow">The reel — product showcase</p>
            <h2 id="showcase-title" className="cinema-h2 cinema-h2--display">
              Four scenes. One stage.
            </h2>
            <p className="cinema-lead">Scroll to move the camera. Each scene is pinned, lit and cross-faded like a dolly shot.</p>
          </div>

          <div className="cinema-tabs" role="tablist" aria-label="Product scenes">
            {showcaseScenes.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active === i}
                className={`cinema-tab${active === i ? ' is-active' : ''}`}
                onClick={() => (reduce ? setActive(i) : scrollToIndex(i))}
              >
                {active === i && !reduce && (
                  <motion.span className="cinema-tab__pill" layoutId="cinema-tab-pill" aria-hidden="true" />
                )}
                <span className="cinema-tab__content" aria-hidden={false}>
                  <s.icon size={14} aria-hidden="true" /> {s.label}
                </span>
              </button>
            ))}
          </div>

          <div className="cinema-reel" aria-live="polite">
            <div className="cinema-reel__copy">
              <AnimatePresence mode="wait">
                <motion.div
                  key={scene.id}
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  animate={reduce ? {} : { opacity: 1, y: 0 }}
                  exit={reduce ? {} : { opacity: 0, y: -10 }}
                  transition={reduce ? {} : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="cinema-scene-label">
                    <i aria-hidden="true" />
                    Scene {String(active + 1).padStart(2, '0')} — {scene.label}
                  </span>
                  <h3>{scene.headline}</h3>
                  <p>{scene.copy}</p>
                  <ul className="cinema-bullets">
                    {scene.bullets.map((b) => (
                      <li key={b}>
                        <i aria-hidden="true">
                          <Check size={10} />
                        </i>
                        {b}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
              <div className="cinema-reel__cta">
                <button type="button" className="cinema-cta cinema-cta--primary cinema-cta--small" onClick={() => onNavigate('/signup')}>
                  Open {scene.label} <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
              {!reduce && (
                <div className="cinema-progress cinema-progress--spaced" aria-hidden="true">
                  <motion.i style={{ width: progressWidth }} />
                </div>
              )}
            </div>

            <div className="cinema-reel__art" aria-hidden="true">
              <AnimatePresence mode="wait">
                <motion.div
                  key={scene.id}
                  className="cinema-art__grid"
                  initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96, filter: 'blur(6px)' }}
                  animate={reduce ? {} : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  exit={reduce ? {} : { opacity: 0, y: -12, scale: 0.98, filter: 'blur(6px)' }}
                  transition={reduce ? {} : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  {scene.id === 'dashboard' && (
                    <>
                      <div className="cinema-mini cinema-mini--hero">
                        <strong>Today • live timeline</strong>
                        <span>Tasks • contest • interview in one view</span>
                      </div>
                      <div className="cinema-art__split">
                        <div className="cinema-mini">
                          <strong>Sprint pulse</strong>
                          <span>Active tasks at a glance</span>
                        </div>
                        <div className="cinema-mini">
                          <strong>Contest radar</strong>
                          <span>Upcoming rounds + reminders</span>
                        </div>
                      </div>
                      <div className="cinema-mini cinema-mini--palette">
                        <strong>Command palette ⌘K</strong>
                        <span>Pages + settings + Eve tools</span>
                      </div>
                    </>
                  )}
                  {scene.id === 'workspace' && (
                    <>
                      <div className="cinema-mini">
                        <strong>Explorer — starwaves/</strong>
                        <span>Source tree with breadcrumbs</span>
                      </div>
                      <div className="cinema-mini cinema-mini--mono">
                        <strong>monaco editor</strong>
                        <span>// Eve just drafted this with you</span>
                      </div>
                      <div className="cinema-mini">
                        <strong>Tabs • minimap • search</strong>
                        <span>Real editor, zero mock chrome</span>
                      </div>
                    </>
                  )}
                  {scene.id === 'calendar' && (
                    <>
                      <div className="cinema-week">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, k) => (
                          <div key={`${d}-${k}`} className={`cinema-mini cinema-mini--day${k === 2 ? ' cinema-mini--active-day' : ''}`}>
                            <strong>{d}</strong>
                            <span>{20 + k}</span>
                          </div>
                        ))}
                      </div>
                      <div className="cinema-mini">
                        <strong>Sprint demo • Today</strong>
                        <span>Google Calendar + ICS + contest feed</span>
                      </div>
                      <div className="cinema-mini">
                        <strong>Contest round — Tomorrow</strong>
                        <span>Reminder set • one click</span>
                      </div>
                    </>
                  )}
                  {scene.id === 'eve' && (
                    <>
                      <div className="cinema-mini">
                        <strong>you → eve</strong>
                        <span>“Review my pipeline and call me Mon 9am if I miss it”</span>
                      </div>
                      <div className="cinema-mini cinema-mini--eve">
                        <strong>eve → schedule created</strong>
                        <span>cron Mon 9am • action: call • saved + notified</span>
                      </div>
                      <div className="cinema-mini">
                        <strong>Voice • streaming • memory</strong>
                        <span>Vector recall • tool loop • web browse</span>
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {reduce && <p className="cinema-reduced-note">Tap a scene above to switch (reduced motion)</p>}
        </motion.div>
      </div>
    </section>
  )
}
