import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import { showcaseScenes } from '../data'

export function Showcase({ onNavigate }) {
  const reduce = useReducedMotion()
  const outerRef = useRef(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: outerRef, offset: ['start start', 'end end'] })
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  useEffect(() => {
    if (reduce) return undefined
    const unsub = scrollYProgress.on('change', (v) => {
      const idx = Math.min(showcaseScenes.length - 1, Math.floor(v * showcaseScenes.length + 0.0001))
      setActive(idx)
    })
    return () => unsub()
  }, [scrollYProgress, reduce])

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
        <div className="cinema-showcase__inner">
          <div style={{ textAlign: 'center' }}>
            <p className="cinema-eyebrow">The reel — product showcase</p>
            <h2 id="showcase-title" className="cinema-h2">
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
                className="cinema-tab"
                onClick={() => (reduce ? setActive(i) : scrollToIndex(i))}
              >
                <s.icon size={14} aria-hidden="true" /> {s.label}
              </button>
            ))}
          </div>

          <div className="cinema-reel">
            <div className="cinema-reel__copy">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase', color: scene.color }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: scene.color, display: 'inline-block' }} aria-hidden="true" />
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
              <div style={{ marginTop: 6 }}>
                <button type="button" className="cinema-cta cinema-cta--primary cinema-cta--small" onClick={() => onNavigate('/signup')}>
                  Open {scene.label} <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
              {!reduce && (
                <div className="cinema-progress" aria-hidden="true" style={{ marginTop: 10 }}>
                  <motion.i style={{ width: progressWidth }} />
                </div>
              )}
            </div>

            <div className="cinema-reel__art" aria-hidden="true">
              <AnimatePresence mode="wait">
                <motion.div
                  key={scene.id}
                  className="cinema-art__grid"
                  initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98, filter: 'blur(6px)' }}
                  animate={reduce ? {} : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  exit={reduce ? {} : { opacity: 0, y: -10, scale: 0.98, filter: 'blur(6px)' }}
                  transition={reduce ? {} : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  {scene.id === 'dashboard' && (
                    <>
                      <div className="cinema-mini">
                        <strong>Today • 4 events</strong>
                        <span>2 tasks • 1 contest • 1 interview</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="cinema-mini">
                          <strong>78% sprint</strong>
                          <span>12 active tasks</span>
                        </div>
                        <div className="cinema-mini">
                          <strong>1,648 Expert</strong>
                          <span>Codeforces +42</span>
                        </div>
                      </div>
                      <div className="cinema-mini" style={{ background: 'linear-gradient(135deg, rgba(124,92,255,0.18), rgba(6,182,214,0.12))' }}>
                        <strong>Command palette ⌘K</strong>
                        <span>22 pages + deep settings + AI tools</span>
                      </div>
                    </>
                  )}
                  {scene.id === 'workspace' && (
                    <>
                      <div className="cinema-mini">
                        <strong>Explorer — starwaves/</strong>
                        <span>src/ • app.js • services/ • sql/ — 42 files</span>
                      </div>
                      <div className="cinema-mini" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                        <strong style={{ fontFamily: 'inherit' }}>monaco editor</strong>
                        <span>// Assistant just wrote this file via tool call</span>
                      </div>
                      <div className="cinema-mini">
                        <strong>3 tabs • UTF-8 • Ln 42, Col 18</strong>
                        <span>Dirty dot • breadcrumb • minimap</span>
                      </div>
                    </>
                  )}
                  {scene.id === 'calendar' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, k) => (
                          <div key={`${d}-${k}`} className="cinema-mini" style={{ textAlign: 'center', padding: 10, background: k === 2 ? '#fff' : undefined, color: k === 2 ? '#0A0A0A' : undefined }}>
                            <strong style={{ color: 'inherit' }}>{d}</strong>
                            <span style={{ color: k === 2 ? '#475569' : undefined }}>{20 + k}</span>
                          </div>
                        ))}
                      </div>
                      <div className="cinema-mini">
                        <strong>Sprint demo • Today</strong>
                        <span>Google Calendar + ICS + contest feed</span>
                      </div>
                      <div className="cinema-mini">
                        <strong>CF Round #982 — Tomorrow 14:35 UTC</strong>
                        <span>Reminder set • 1 click</span>
                      </div>
                    </>
                  )}
                  {scene.id === 'assistant' && (
                    <>
                      <div className="cinema-mini">
                        <strong>you → assistant</strong>
                        <span>“Review my pipeline and call me Mon 9am if I miss it”</span>
                      </div>
                      <div className="cinema-mini" style={{ background: 'linear-gradient(135deg, rgba(124,92,255,0.22), rgba(225,29,72,0.14))' }}>
                        <strong>assistant → schedule created</strong>
                        <span>cron 0 9 * * 1 • action: call • saved + notified</span>
                      </div>
                      <div className="cinema-mini">
                        <strong>Voice • streaming • memory</strong>
                        <span>Built-in Gemini or BYOK • tool loop • web browse</span>
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {reduce && <p style={{ textAlign: 'center', color: '#64748B', fontSize: 11, margin: 0 }}>Tap a scene above to switch (reduced motion)</p>}
        </div>
      </div>
    </section>
  )
}
