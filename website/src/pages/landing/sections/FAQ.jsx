import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { faqs } from '../data'

export function FAQ({ onNavigate }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(0)

  return (
    <section id="faq" className="cinema-faq" aria-labelledby="faq-title">
      <div className="cinema-faq__inner cinema-faq__inner--split">
        <div className="cinema-faq__side">
          <p className="cinema-eyebrow">Q&A — the fine print</p>
          <h2 id="faq-title" className="cinema-h2 cinema-h2--display">
            Everything you need
            <br />
            to know
          </h2>
          <p className="cinema-lead">No dark patterns. Just the real workspace.</p>
          <button type="button" className="cinema-cta cinema-cta--ghost cinema-cta--small" onClick={() => onNavigate('/signup')}>
            Still curious? Start free <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="cinema-faq__list">
          {faqs.map((f, i) => {
            const isOpen = open === i
            return (
              <motion.div
                key={f.q}
                className={`cinema-faq__item ${isOpen ? 'is-open' : ''}`}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={reduce ? {} : { duration: 0.4, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                layout={reduce ? undefined : 'position'}
              >
                <button
                  type="button"
                  className="cinema-faq__q"
                  aria-expanded={isOpen}
                  aria-controls={`faq-a-${i}`}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span>{f.q}</span>
                  <span className="cinema-faq__chev" aria-hidden="true">
                    <ChevronDown size={16} />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-a-${i}`}
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={reduce ? {} : { height: 'auto', opacity: 1 }}
                      exit={reduce ? {} : { height: 0, opacity: 0 }}
                      transition={reduce ? {} : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="cinema-faq__answer-wrap"
                    >
                      <div className="cinema-faq__a">{f.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
