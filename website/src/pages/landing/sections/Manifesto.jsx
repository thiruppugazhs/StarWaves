import { motion, useReducedMotion } from 'framer-motion'
import { manifesto } from '../data'

const cardVariants = {
  hidden: { opacity: 0, y: 22, filter: 'blur(6px)' },
  show: (i) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 },
  }),
}

const tints = {
  mono: '#FFFFFF',
  violet: '#FFFFFF',
  amber: '#FFFFFF',
  cyan: '#FFFFFF',
}

export function Manifesto() {
  const reduce = useReducedMotion()
  return (
    <section id="manifesto" className="cinema-manifesto" aria-labelledby="manifesto-title">
      <div className="cinema-section-head">
        <p className="cinema-eyebrow">The manifesto — three acts</p>
        <h2 id="manifesto-title" className="cinema-h2" style={{ whiteSpace: 'pre-line' }}>
          A workspace that feels
          <br />
          like a film set
        </h2>
        <p className="cinema-lead">
          Every panel placed with intention. No clutter, no rainbow dashboards — just depth, light and velocity.
        </p>
      </div>

      <div className="cinema-manifesto__grid">
        {manifesto.map((m, i) => (
          <motion.article
            key={m.kicker}
            className="cinema-card"
            custom={i}
            variants={reduce ? undefined : cardVariants}
            initial={reduce ? false : 'hidden'}
            whileInView={reduce ? undefined : 'show'}
            viewport={{ once: true, margin: '-80px' }}
          >
            <div className="cinema-card__icon" style={{ background: tints[m.accent] }} aria-hidden="true">
              <m.icon size={18} />
            </div>
            <p className="cinema-card__kicker">{m.kicker}</p>
            <h3 style={{ whiteSpace: 'pre-line' }}>{m.title}</h3>
            <p>{m.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
