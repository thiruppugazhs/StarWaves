import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { faqs } from '../data'

export function FAQ() {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(0)

  return (
    <section id="faq" className="cinema-faq" aria-labelledby="faq-title">
      <div className="cinema-faq__inner">
        <div style={{ textAlign: 'center' }}>
          <p className="cinema-eyebrow">Q&A — the fine print</p>
          <h2 id="faq-title" className="cinema-h2">
            Everything you need
            <br />
            to know
          </h2>
          <p className="cinema-lead">No mock data. No dark patterns. Just the real workspace.</p>
        </div>

        <div className="cinema-faq__list">
          {faqs.map((f, i) => {
            const isOpen = open === i
            return (
              <div key={f.q} className={`cinema-faq__item ${isOpen ? 'is-open' : ''}`}>
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
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="cinema-faq__a">{f.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
