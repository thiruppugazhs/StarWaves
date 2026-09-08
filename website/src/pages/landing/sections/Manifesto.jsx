import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { manifesto } from '../data'

const cardVariants = {
  hidden: { opacity: 0, y: 26, filter: 'blur(8px)' },
  show: (i) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 },
  }),
}

const toneClass = {
  work: 'is-work',
  studio: 'is-studio',
  eve: 'is-eve',
}

export function Manifesto() {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 40%'] })
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section id="manifesto" ref={ref} className="cinema-manifesto" aria-labelledby="manifesto-title">
      <div className="cinema-section-head">
        <p className="cinema-eyebrow">The manifesto — Code · Create · Evolve</p>
        <h2 id="manifesto-title" className="cinema-h2 cinema-h2--display">
          A workspace that feels
          <br />
          like a film set
        </h2>
        <p className="cinema-lead">
          Three lights, one stage. Every panel placed with intention — depth without the noise.
        </p>
        {!reduce && (
          <motion.span className="cinema-manifesto__rule" aria-hidden="true" style={{ scaleX: lineScale }} />
        )}
      </div>

      <div className="cinema-manifesto__grid">
        {manifesto.map((m, i) => (
          <motion.article
            key={m.kicker}
            className={`cinema-card cinema-card--numeral ${toneClass[m.accent] ?? 'is-work'}`}
            custom={i}
            variants={reduce ? undefined : cardVariants}
            initial={reduce ? false : 'hidden'}
            whileInView={reduce ? undefined : 'show'}
            viewport={{ once: true, margin: '-80px' }}
            whileHover={reduce ? undefined : { y: -4 }}
          >
            <span className="cinema-card__numeral" aria-hidden="true">
              {m.numeral}
            </span>
            <div className="cinema-card__icon" aria-hidden="true">
              <m.icon size={18} />
            </div>
            <p className="cinema-card__kicker">{m.kicker}</p>
            <h3>{m.title}</h3>
            <p>{m.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
