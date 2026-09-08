import { useRef, useState, useEffect } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { workflow } from '../data'

export function Workflow() {
  const reduce = useReducedMotion()
  const outerRef = useRef(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: outerRef, offset: ['start start', 'end end'] })
  const fill = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])
  const numeralX = useTransform(scrollYProgress, [0, 1], [40, -40])

  useEffect(() => {
    if (reduce) return undefined
    const unsub = scrollYProgress.on('change', (v) => {
      const idx = Math.min(workflow.length - 1, Math.floor(v * workflow.length + 0.0001))
      setActive(idx)
    })
    return () => unsub()
  }, [scrollYProgress, reduce])

  return (
    <section id="workflow" ref={outerRef} className="cinema-workflow" aria-labelledby="workflow-title" style={{ height: reduce ? 'auto' : '220vh' }}>
      <div className="cinema-workflow__sticky">
        <div className="cinema-workflow__inner">
          <div className="cinema-workflow__intro">
            <p className="cinema-eyebrow">The process — pinned timeline · Build</p>
            <h2 id="workflow-title" className="cinema-h2 cinema-h2--display">
              From scattered tabs
              <br />
              to single source of truth
            </h2>
            <p className="cinema-lead">A three-beat arc that pins and progresses as you scroll — like a title sequence drawing itself.</p>
          </div>

          {!reduce && (
            <div className="cinema-rail" aria-hidden="true">
              <motion.i style={{ width: fill }} />
            </div>
          )}

          <div className="cinema-steps" aria-live="polite">
            {workflow.map((s, i) => (
              <motion.article
                key={s.step}
                className={`cinema-step cinema-step--${s.tone ?? 'work'} ${active === i ? 'is-active' : ''}`}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={reduce ? {} : { duration: 0.45, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              >
                {!reduce && (
                  <motion.span className="cinema-step__ghost" aria-hidden="true" style={{ x: numeralX }}>
                    {s.step}
                  </motion.span>
                )}
                <span className="cinema-step__num" aria-hidden="true">
                  {s.step}
                </span>
                <div className="cinema-step__icon" aria-hidden="true">
                  <s.icon size={18} />
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </motion.article>
            ))}
          </div>

          {reduce && <p className="cinema-reduced-note">All three steps visible — reduced motion</p>}
        </div>
      </div>
    </section>
  )
}
