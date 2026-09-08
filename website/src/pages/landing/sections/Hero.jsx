import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { ArrowRight, Check, ChevronDown, Play } from 'lucide-react'
import { heroProof, marqueeModules } from '../data'
import { useMagnetic } from './useMagnetic'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
}
const item = {
  hidden: { opacity: 0, y: 22, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
}
const word = {
  hidden: { opacity: 0, y: 26, rotateX: -38, filter: 'blur(8px)' },
  show: (i) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.25 + i * 0.06 },
  }),
}

const HEADLINE_A = ['Your', 'work', 'and', 'growth,']
const HEADLINE_B = ['finally', 'in', 'sync.']

export function Hero({ onNavigate }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const magnetic = useMagnetic()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const ySlow = useTransform(scrollYProgress, [0, 1], [0, 80])
  const yFast = useTransform(scrollYProgress, [0, 1], [0, 170])
  const fade = useTransform(scrollYProgress, [0, 0.65], [1, 0])
  const stageScale = useTransform(scrollYProgress, [0, 1], [1, 0.96])

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const orbX = useSpring(mx, { stiffness: 60, damping: 20 })
  const orbY = useSpring(my, { stiffness: 60, damping: 20 })
  const tiltX = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 120, damping: 16 })
  const tiltY = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), { stiffness: 120, damping: 16 })

  const onPointerMove = (event) => {
    if (reduce || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    mx.set((event.clientX - rect.left) / rect.width - 0.5)
    my.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  const scrollToShowcase = () => {
    document.getElementById('showcase')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section ref={ref} className="cinema-hero" aria-labelledby="hero-title" onPointerMove={onPointerMove}>
      <div className="cinema-hero__grid" aria-hidden="true" />
      <div className="cinema-hero__photo" aria-hidden="true" />
      <motion.div className="cinema-hero__glow" aria-hidden="true" style={reduce ? undefined : { y: ySlow }} />
      <motion.div className="cinema-hero__glow" aria-hidden="true" style={reduce ? undefined : { y: yFast, scale: 0.9, left: '72%' }} />
      {!reduce && (
        <motion.div className="cinema-hero__orb" aria-hidden="true" style={{ x: orbX, y: orbY }} />
      )}
      <div className="cinema-hero__vignette" aria-hidden="true" />
      <motion.div className="cinema-scenery" aria-hidden="true" style={reduce ? undefined : { y: yFast }}>
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" focusable="false">
          <defs>
            <linearGradient id="cinema-ridge-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="cinema-svg-stop-ridge" />
              <stop offset="100%" className="cinema-svg-stop-bg" />
            </linearGradient>
            <filter id="cinema-tide-soft" x="-40%" y="-60%" width="180%" height="220%">
              <feGaussianBlur stdDeviation="28" />
            </filter>
          </defs>
          <g filter="url(#cinema-tide-soft)">
            <path
              d="M-160,560 C350,480 600,660 1000,560 S1350,500 1600,580"
              fill="none"
              className="cinema-svg-tide"
              strokeWidth="110"
            />
            <path
              d="M-160,710 C400,620 700,770 1100,685 S1400,640 1600,705"
              fill="none"
              className="cinema-svg-tide cinema-svg-tide--eve"
              strokeWidth="150"
            />
          </g>
          <path
            d="M0,820 L120,740 L260,790 L400,710 L560,800 L720,730 L900,810 L1080,740 L1240,800 L1440,750 L1440,900 L0,900 Z"
            fill="url(#cinema-ridge-fade)"
          />
          <path
            d="M0,870 L180,810 L360,860 L540,800 L760,870 L950,815 L1150,865 L1300,830 L1440,860 L1440,900 L0,900 Z"
            className="cinema-svg-ridge-front"
          />
          <polyline
            points="0,870 180,810 360,860 540,800 760,870 950,815 1150,865 1300,830 1440,860"
            fill="none"
            className="cinema-svg-ridge-rim"
            strokeWidth="1.5"
          />
        </svg>
      </motion.div>

      <motion.div
        className="cinema-hero__inner"
        variants={reduce ? undefined : container}
        initial={reduce ? false : 'hidden'}
        animate={reduce ? undefined : 'show'}
        style={reduce ? undefined : { opacity: fade, y: ySlow }}
      >
        <motion.h1 id="hero-title" className="cinema-title cinema-title--display" variants={reduce ? undefined : item}>
          <span className="cinema-title__line" aria-label="Your work and growth,">
            {HEADLINE_A.map((w, i) => (
              <motion.span
                key={w}
                className="cinema-title__word"
                custom={i}
                variants={reduce ? undefined : word}
                initial={reduce ? false : 'hidden'}
                animate={reduce ? undefined : 'show'}
                aria-hidden="true"
              >
                {w}
              </motion.span>
            ))}
          </span>
          <br />
          <span className="cinema-title__line cinema-title__accent" aria-label="finally in sync.">
            {HEADLINE_B.map((w, i) => (
              <motion.span
                key={w}
                className="cinema-title__word"
                custom={i + HEADLINE_A.length}
                variants={reduce ? undefined : word}
                initial={reduce ? false : 'hidden'}
                animate={reduce ? undefined : 'show'}
                aria-hidden="true"
              >
                {w}
              </motion.span>
            ))}
          </span>
        </motion.h1>

        <motion.p className="cinema-sub" variants={reduce ? undefined : item}>
          StarWaves fuses <strong>tasks, calendars, contests, projects, jobs, documents, mail, WhatsApp</strong> and{' '}
          <strong>Eve AI</strong> into one cinematic stage — Code keeps the signal, Create sets the scene, Evolve never forgets.
        </motion.p>

        <motion.div className="cinema-hero__ctas" variants={reduce ? undefined : item}>
          <motion.button
            type="button"
            className="cinema-cta cinema-cta--primary cinema-cta--hero"
            onClick={() => onNavigate('/signup')}
            {...magnetic}
          >
            Start your workspace <ArrowRight size={16} aria-hidden="true" />
          </motion.button>
          <button type="button" className="cinema-cta cinema-cta--ghost cinema-cta--hero" onClick={scrollToShowcase}>
            <Play size={16} aria-hidden="true" /> Watch the reel
          </button>
        </motion.div>

        <motion.div
          className="cinema-stage"
          variants={reduce ? undefined : item}
          style={reduce ? undefined : { scale: stageScale, rotateX: tiltX, rotateY: tiltY, transformStyle: 'preserve-3d' }}
          aria-hidden="true"
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
              <span className="cinema-frame__live">● synced</span>
            </div>
            <div className="cinema-frame__body">
              <div className="cinema-kpis">
                <div className="cinema-kpi cinema-kpi--accent">
                  <small>Today</small>
                  <strong>Focus queue • live</strong>
                  <span>Tasks, contest and interview in one view</span>
                </div>
                <div className="cinema-kpi cinema-kpi--growth">
                  <small>Pipeline</small>
                  <strong>Applications → interviews</strong>
                  <span>Every stage tracked, nothing slips</span>
                </div>
                <div className="cinema-kpi cinema-kpi--workspace">
                  <small>Workspace</small>
                  <strong>Monaco • Eve inside</strong>
                  <span>Files Eve can read and edit with you</span>
                </div>
              </div>
              <div className="cinema-tasks">
                <div className="cinema-task">
                  <i>
                    <Check size={10} />
                  </i>
                  Review contest solutions — <em className="cinema-task__done-label">done</em>
                </div>
                <div className="cinema-task">
                  <i />
                  Prepare architecture doc for v2
                </div>
                <div className="cinema-task">
                  <i />
                  Draft follow-ups for this week
                </div>
                <div className="cinema-task done">
                  <i>
                    <Check size={10} />
                  </i>
                  Ship Eve schedule: call every Mon 9am
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="cinema-marquee" aria-label="Included modules">
        <div className="cinema-marquee__track" aria-hidden="true">
          {[...marqueeModules, ...marqueeModules].map((m, i) => (
            <span key={`${m}-${i}`} className="cinema-marquee__item">
              <Check size={12} aria-hidden="true" /> {m}
            </span>
          ))}
        </div>
        <div className="cinema-hero__proof">
          {heroProof.map((t) => (
            <span key={t} className="cinema-chip">
              <Check size={14} aria-hidden="true" /> {t}
            </span>
          ))}
        </div>
      </div>

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
