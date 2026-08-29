import { motion, useReducedMotion } from 'framer-motion'
import { features } from '../data'

export function Features() {
  const reduce = useReducedMotion()
  return (
    <section id="features" className="cinema-features" aria-labelledby="features-title">
      <div className="cinema-section-head">
        <p className="cinema-eyebrow">The ensemble — 8 modules</p>
        <h2 id="features-title" className="cinema-h2">
          Everything important,
          <br />
          without the noise
        </h2>
        <p className="cinema-lead">A cohesive suite stitched by a command palette, not scattered tabs. Each surface lit for its role.</p>
      </div>

      <div className="cinema-features__grid">
        {features.map((f, i) => (
          <motion.article
            key={f.title}
            className="cinema-feat"
            initial={reduce ? false : { opacity: 0, y: 16, filter: 'blur(6px)' }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-60px' }}
            transition={reduce ? {} : { duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            whileHover={reduce ? undefined : { y: -2 }}
          >
            <div className="cinema-feat__icon" style={{ background: f.tint }} aria-hidden="true">
              <f.icon size={18} />
            </div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
