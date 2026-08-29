import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { ArrowRight, ChevronDown, Check, Sparkles, Play } from 'lucide-react'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.18 } },
}
const item = {
  hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
}

export function Hero({ onNavigate }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const ySlow = useTransform(scrollYProgress, [0, 1], [0, 80])
  const yFast = useTransform(scrollYProgress, [0, 1], [0, 160])
  const opacity = useTransform(scrollYProgress, [0, 0.65], [1, 0])

  const scrollToShowcase = () => {
    document.getElementById('showcase')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section ref={ref} className="cinema-hero" aria-labelledby="hero-title">
      <div className="cinema-hero__grid" aria-hidden="true" />
      <motion.div className="cinema-hero__glow" aria-hidden="true" style={reduce ? undefined : { y: ySlow }} />
      <motion.div className="cinema-hero__glow" aria-hidden="true" style={reduce ? undefined : { y: yFast, scale: 0.9, left: '72%' }} />
      <div className="cinema-hero__vignette" aria-hidden="true" />

      <motion.div
        className="cinema-hero__inner"
        variants={reduce ? undefined : container}
        initial={reduce ? false : 'hidden'}
        animate={reduce ? undefined : 'show'}
        style={reduce ? undefined : { opacity, y: ySlow }}
      >
        <motion.div variants={reduce ? undefined : item} className="cinema-kicker" aria-label="Live workspace">
          <i aria-hidden="true" />
          Live workspace • Linear sharp
          <Sparkles size={12} aria-hidden="true" style={{ opacity: 0.9 }} />
        </motion.div>

        <motion.h1 id="hero-title" className="cinema-title" variants={reduce ? undefined : item}>
          Your work and growth,
          <br />
          <span className="cinema-title__accent">finally in sync.</span>
        </motion.h1>

        <motion.p className="cinema-sub" variants={reduce ? undefined : item}>
          StarWaves brings <strong>tasks, calendars, coding contests, hackathons, projects, jobs, documents, mail, WhatsApp</strong> and your{' '}
          <strong>autonomous AI assistant</strong> into one dark, cinematic workspace — so flow never breaks.
        </motion.p>

        <motion.div className="cinema-hero__ctas" variants={reduce ? undefined : item}>
          <button type="button" className="cinema-cta cinema-cta--primary cinema-cta--hero" onClick={() => onNavigate('/signup')}>
            Start your workspace <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button type="button" className="cinema-cta cinema-cta--ghost cinema-cta--hero" onClick={scrollToShowcase}>
            <Play size={16} aria-hidden="true" /> Watch the reel
          </button>
        </motion.div>

        <motion.div className="cinema-hero__proof" variants={reduce ? undefined : item} aria-label="Trusted workflows">
          {['Board → Calendar → List', 'ICS + Google sync', 'Monaco inside', 'Autonomous AI built-in'].map((t) => (
            <span key={t} className="cinema-chip">
              <Check size={14} aria-hidden="true" /> {t}
            </span>
          ))}
        </motion.div>

        <motion.div
          className="cinema-stage"
          variants={reduce ? undefined : item}
          aria-hidden="true"
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="cinema-stage__glow" />
          <div className="cinema-frame">
            <div className="cinema-frame__top">
              <span className="cinema-dots">
                <i />
                <i />
                <i />
              </span>
              <span>starwaves.app — command center • Live</span>
              <span style={{ color: '#22C55E', fontWeight: 800 }}>● synced</span>
            </div>
            <div className="cinema-frame__body">
              <div className="cinema-kpis">
                <div className="cinema-kpi cinema-kpi--accent">
                  <small>Today</small>
                  <strong>5 open • 2 done</strong>
                  <span>Next up: Codeforces 14:35 UTC</span>
                </div>
                <div className="cinema-kpi">
                  <small>Pipeline</small>
                  <strong>3 interviewing • 1 offer</strong>
                  <span>Stripe • Anthropic • Vercel</span>
                </div>
                <div className="cinema-kpi">
                  <small>Workspace</small>
                  <strong>starwaves/src/app.js</strong>
                  <span>Monaco • AI can edit this file</span>
                </div>
              </div>
              <div className="cinema-tasks">
                <div className="cinema-task">
                  <i>
                    <Check size={10} />
                  </i>
                  Review CF Round #980 solutions — <em style={{ color: '#94A3B8', fontStyle: 'normal' }}>done</em>
                </div>
                <div className="cinema-task">
                  <i />
                  Prepare architecture doc for StarWaves v2
                </div>
                <div className="cinema-task">
                  <i />
                  Submit application — Staff AI Engineer
                </div>
                <div className="cinema-task done">
                  <i>
                    <Check size={10} />
                  </i>
                  Ship automated schedule: call every Mon 9am
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.button
        type="button"
        className="cinema-scroll"
        onClick={scrollToShowcase}
        aria-label="Scroll to showcase"
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce ? {} : { opacity: 1 }}
        transition={reduce ? {} : { delay: 1.2, duration: 0.6 }}
      >
        Scroll to explore <ChevronDown size={16} aria-hidden="true" />
      </motion.button>
    </section>
  )
}
