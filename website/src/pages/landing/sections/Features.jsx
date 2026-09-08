import { motion, useReducedMotion } from 'framer-motion'
import { features } from '../data'

export function Features() {
  const reduce = useReducedMotion()

  const onSpotlight = (event) => {
    if (reduce) return
    const el = event.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
    el.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
  }

  return (
    <section id="features" className="cinema-features" aria-labelledby="features-title">
      <div className="cinema-section-head">
        <p className="cinema-eyebrow">The ensemble — 8 modules · Create</p>
        <h2 id="features-title" className="cinema-h2 cinema-h2--display">
          Everything important,
          <br />
          without the noise
        </h2>
        <p className="cinema-lead">A cohesive suite stitched by a command palette, not scattered tabs. Each surface lit for its role.</p>
      </div>

      <div className="cinema-features__grid cinema-features__grid--bento">
        {features.map((f, i) => (
          <motion.article
            key={f.title}
            className={`cinema-feat cinema-feat--${f.tone ?? 'work'}${f.size === 'large' ? ' cinema-feat--large' : ''}`}
            initial={reduce ? false : { opacity: 0, y: 18, filter: 'blur(6px)' }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-60px' }}
            transition={reduce ? {} : { duration: 0.5, delay: (i % 4) * 0.06, ease: [0.16, 1, 0.3, 1] }}
            whileHover={reduce ? undefined : { y: -3 }}
            onPointerMove={onSpotlight}
          >
            <span className="cinema-feat__spot" aria-hidden="true" />
            <div className="cinema-feat__icon" aria-hidden="true">
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
