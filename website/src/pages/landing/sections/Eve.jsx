import { motion, useReducedMotion } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import { assistantCapabilities } from '../data'

export function Eve({ onNavigate }) {
  const reduce = useReducedMotion()
  return (
    <section id="assistant" className="cinema-eve" aria-labelledby="assistant-title">
      <div className="cinema-eve__inner">
        <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
          <p className="cinema-eyebrow">Spotlight — Autonomous AI Assistant</p>
          <h2 id="assistant-title" className="cinema-h2">
            An assistant you make
            <br />
            truly your own
          </h2>
          <p className="cinema-lead">
            Not a fixed bot. Name your companion, choose your brain (free built-in Google Gemini or bring your own OpenAI, Claude, or Groq key), and let it execute tools across your code, workspace, and schedules.
          </p>
        </div>

        <div className="cinema-eve__grid">
          {assistantCapabilities.map((c, i) => (
            <motion.article
              key={c.title}
              className="cinema-eve__card"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={reduce ? {} : { duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  display: 'grid',
                  placeItems: 'center',
                  background: '#FFFFFF',
                  color: '#000000',
                  border: '1px solid #FFFFFF',
                }}
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
          <div className="cinema-terminal" aria-hidden="true">
            <div className="cinema-terminal__top">
              <span className="cinema-dots">
                <i />
                <i />
                <i />
              </span>
              assistant tools — workspace aware
            </div>
            <pre>{`list_workspace_files({ workspace: "starwaves" })
search_workspace_files({ query: "auth callback" })
browse_web({ query: "Vercel cron serverless" })
send_whatsapp_message({ chatId: "#team", text: "Demo at 3pm" })
create_schedule({ cron: "0 9 * * 1", action: "call" })`}</pre>
          </div>

          <div className="cinema-wave" aria-hidden="true">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#FFFFFF', fontWeight: 800, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: '#FFFFFF', display: 'inline-block' }} />
              Assistant is speaking — live voice & captions
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
            <p style={{ margin: 0, color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>
              “Your pipeline review is due. I found 3 interviewing — want me to draft follow-ups?”
            </p>
            <button type="button" className="cinema-cta cinema-cta--primary cinema-cta--small" onClick={() => onNavigate('/signup')}>
              Create your assistant <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
