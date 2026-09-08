import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import { eveCapabilities, eveDemoMessages, eveTerminalLines } from '../data'
import { useMagnetic } from './useMagnetic'

export function Eve({ onNavigate }) {
  const reduce = useReducedMotion()
  const magnetic = useMagnetic()
  const [typed, setTyped] = useState(reduce ? eveTerminalLines.length : 0)
  const [bubble, setBubble] = useState(0)

  useEffect(() => {
    if (reduce) {
      setTyped(eveTerminalLines.length)
      return undefined
    }
    setTyped(0)
    const id = window.setInterval(() => {
      setTyped((t) => {
        if (t >= eveTerminalLines.length) {
          window.clearInterval(id)
          return t
        }
        return t + 1
      })
    }, 420)
    return () => window.clearInterval(id)
  }, [reduce])

  useEffect(() => {
    if (reduce) return undefined
    const id = window.setInterval(() => {
      setBubble((b) => (b + 1) % eveDemoMessages.length)
    }, 3200)
    return () => window.clearInterval(id)
  }, [reduce])

  const current = eveDemoMessages[bubble]

  return (
    <section id="eve" className="cinema-eve" aria-labelledby="eve-title">
      <div className="cinema-eve__inner">
        <div className="cinema-eve__intro">
          <p className="cinema-eyebrow">Spotlight — Eve AI · Evolve</p>
          <h2 id="eve-title" className="cinema-h2 cinema-h2--display">
            An assistant that lives
            <br />
            inside your work
          </h2>
          <p className="cinema-lead">
            Not a tab. Eve reads files, remembers context, browses the web, manages WhatsApp and even calls you — all through the same tool loop.
          </p>
        </div>

        <div className="cinema-eve__grid">
          {eveCapabilities.map((c, i) => (
            <motion.article
              key={c.title}
              className="cinema-eve__card"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={reduce ? {} : { duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              whileHover={reduce ? undefined : { y: -4 }}
            >
              <div
                className={`cinema-eve__icon${c.tone === 'voice' ? ' cinema-eve__icon--voice' : ''}${c.tone === 'schedule' ? ' cinema-eve__icon--schedule' : ''}`}
                aria-hidden="true"
              >
                <c.icon size={18} />
              </div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
              <ul className="cinema-points">
                {c.points.map((p) => (
                  <li key={p}>
                    <Check size={12} aria-hidden="true" /> {p}
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>

        <motion.div
          className="cinema-voice"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={reduce ? {} : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="cinema-terminal" aria-label="Eve tool calls">
            <div className="cinema-terminal__top">
              <span className="cinema-dots">
                <i />
                <i />
                <i />
              </span>
              eve tools — workspace aware
            </div>
            <pre aria-hidden="true">{eveTerminalLines.slice(0, typed).join('\n')}<span className="cinema-terminal__caret">▊</span></pre>
            <div className="cinema-chat" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div
                  key={bubble}
                  className={`cinema-chat__bubble cinema-chat__bubble--${current.from}`}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={reduce ? {} : { opacity: 1, y: 0 }}
                  exit={reduce ? {} : { opacity: 0, y: -8 }}
                  transition={reduce ? {} : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <strong>{current.from === 'eve' ? 'eve' : 'you'}</strong>
                  <span>{current.text}</span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="cinema-wave" aria-hidden="true">
            <div className="cinema-wave__live">
              <span className="cinema-wave__dot" />
              Eve is speaking — live captions
            </div>
            <div className="cinema-bars" aria-hidden="true">
              {[12, 28, 18, 36, 22, 30, 16, 26, 14, 32, 20, 24].map((h, k) => (
                <motion.i
                  key={k}
                  style={{ height: h }}
                  animate={reduce ? undefined : { height: [h, h + 14, h] }}
                  transition={reduce ? undefined : { duration: 0.9 + k * 0.06, repeat: Infinity, ease: 'easeInOut', delay: k * 0.05 }}
                />
              ))}
            </div>
            <p className="cinema-wave__quote">
              “Your pipeline review is due. I found the open threads — want me to draft follow-ups?”
            </p>
            <motion.button
              type="button"
              className="cinema-cta cinema-cta--eve cinema-cta--small"
              onClick={() => onNavigate('/signup')}
              {...magnetic}
            >
              Talk to Eve <ArrowRight size={14} aria-hidden="true" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
