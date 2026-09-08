import "../styles/pages/usage.css"
import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { EmptyState, LoadingState } from '../components/ui'
import { getUsageSummary, getUsageLogs } from '../lib/usageApi'

// Series colors resolve from the single palette in styles/tokens.css
// (--chart-1..6). var() works in HTML inline styles and in SVG via the
// CSS `stroke` property (see trend path below), so charts follow themes.
const MODEL_COLORS = {
  'GLM-5.3': 'var(--chart-1)',
  'GLM-5-Turbo': 'var(--chart-2)',
  'glm-5.3': 'var(--chart-1)',
  'glm-5-turbo': 'var(--chart-2)',
}

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)']

function getModelColor(name, idx) {
  if (MODEL_COLORS[name]) return MODEL_COLORS[name]
  return PALETTE[idx % PALETTE.length]
}

function formatTokens(n) {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1000).toFixed(1)}k`
  return String(v)
}

function formatFull(n) {
  return Number(n || 0).toLocaleString()
}

function getHeatLevel(tokens) {
  if (tokens === 0) return 0
  if (tokens < 100000) return 1
  if (tokens < 800000) return 2
  if (tokens < 2000000) return 3
  return 4
}

function clampTooltipX(x) {
  if (typeof window === 'undefined') return x + 12
  return Math.min(window.innerWidth - 180, Math.max(8, x + 12))
}

function getTrendTooltipTop(y) {
  return Math.max(8, y - 170)
}

export function UsagePage() {
  const [days, setDays] = useState(30)
  const [activityMode, setActivityMode] = useState('Daily')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [donutTip, setDonutTip] = useState(null)
  const [trendTip, setTrendTip] = useState(null)
  const [heatmapTip, setHeatmapTip] = useState(null)
  const [activeDonut, setActiveDonut] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await getUsageSummary(days)
      // prime logs endpoint for future detailed view (not rendered in dark summary)
      getUsageLogs({ limit: 100, days }).catch(() => {})
      setSummary(s)
    } catch (e) {
      setError(e.message || 'Failed to load usage')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const topMetrics = useMemo(() => {
    if (!summary) return null
    const total = summary.total_tokens || 0
    const peak = summary.peak_tokens || 0
    const longest = summary.longest_session_tokens || 0
    return {
      total: formatTokens(total),
      peak: formatTokens(peak),
      longest,
      longestLabel: longest ? formatTokens(longest) : '0',
      currentStreak: `${summary.current_streak || 0} d`,
      longestStreak: `${summary.longest_streak || 0} d`,
    }
  }, [summary])

  // Heatmap: last 182 days (26 weeks × 7 days) — honest, no fake data
  const heatmap = useMemo(() => {
    const dailyMap = {}
    for (const d of summary?.daily || []) dailyMap[d.date] = d.tokens
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 181)
    const base = []
    let cumulative = 0
    for (let i = 0; i < 182; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const k = d.toISOString().slice(0, 10)
      const tokens = dailyMap[k] || 0
      cumulative += tokens
      base.push({ key: `${k}-${i}`, tokens, date: k, idx: i })
    }

    // Derive level per activityMode
    if (activityMode === 'Weekly') {
      const weekSums = Array.from({ length: 26 }, () => 0)
      for (const cell of base) {
        const w = Math.floor(cell.idx / 7)
        weekSums[w] += cell.tokens
      }
      return base.map((c) => {
        const w = Math.floor(c.idx / 7)
        return { ...c, level: getHeatLevel(weekSums[w]) }
      })
    }
    if (activityMode === 'Cumulative') {
      let cum = 0
      return base.map((c) => {
        cum += c.tokens
        return { ...c, level: getHeatLevel(cum) }
      })
    }
    // Daily
    return base.map((c) => ({ ...c, level: getHeatLevel(c.tokens) }))
  }, [summary, activityMode])

  const heatmapMonths = useMemo(() => {
    if (!heatmap.length) return []
    const seen = new Set()
    const labels = []
    for (const cell of heatmap) {
      const d = new Date(cell.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!seen.has(key)) {
        seen.add(key)
        labels.push(d.toLocaleDateString('en-US', { month: 'short' }))
      }
    }
    return labels
  }, [heatmap])

  // Trend chart data — honest; no synthetic spikes when empty
  const trend = useMemo(() => {
    if (!summary) return { labels: [], series: [] }
    const byModelDaily = summary.daily_by_model || []
    const models = summary.model_list?.length
      ? summary.model_list.slice(0, 4)
      : (summary.by_model || []).slice(0, 4).map((m) => m.model)
    if (models.length === 0) return { labels: [], series: [] }
    const modelSeries = models.map((m, idx) => ({ name: m, color: getModelColor(m, idx), points: [] }))
    const mapByDate = {}
    for (const entry of byModelDaily) {
      mapByDate[entry.date] = entry.by_model
    }
    const labels = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      labels.push({ key, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
      for (const s of modelSeries) {
        s.points.push(mapByDate[key]?.[s.name] || 0)
      }
    }
    return { labels, series: modelSeries }
  }, [summary, days])

  const maxTrend = useMemo(() => Math.max(1, ...trend.series.flatMap((s) => s.points)), [trend])

  // Donut data — honest; empty when no usage
  const donut = useMemo(() => {
    const total = summary?.total_tokens || 0
    const models = summary?.by_model || []
    if (models.length === 0 || total === 0) {
      return { total, segments: [] }
    }
    const segs = models.slice(0, 5).map((m, i) => ({
      name: m.model,
      tokens: m.tokens,
      color: getModelColor(m.model, i),
      pct: total ? Math.round((m.tokens / total) * 100) : 0,
    }))
    return { total, segments: segs }
  }, [summary])

  const donutCirc = 2 * Math.PI * 60
  let donutOffset = 0

  if (loading) return <div className="usage-page-dark"><LoadingState label="Loading usage…" /></div>

  const hasTrendData = trend.series.length > 0 && trend.series.some((s) => s.points.some((v) => v > 0))
  const hasHeatmapData = heatmap.some((c) => c.tokens > 0)

  return (
    <div className="usage-page-dark">
      <div className="usage-stats-header">
        <div className="usage-stats-title">Usage stats</div>
        <div className="usage-app-pill">App usage</div>
      </div>

      <div className="usage-top-card">
        <div className="usage-top-item">
          <div className="usage-top-value">{topMetrics?.total || '—'}</div>
          <div className="usage-top-label">Total tokens</div>
        </div>
        <div className="usage-top-item">
          <div className="usage-top-value">{topMetrics?.peak || '—'}</div>
          <div className="usage-top-label">Peak tokens</div>
        </div>
        <div className="usage-top-item">
          <div className="usage-top-value">{topMetrics?.longestLabel || '0'}</div>
          <div className="usage-top-label">Longest session</div>
        </div>
        <div className="usage-top-item">
          <div className="usage-top-value">{topMetrics?.currentStreak || '0 d'}</div>
          <div className="usage-top-label">Current streak</div>
        </div>
        <div className="usage-top-item">
          <div className="usage-top-value">{topMetrics?.longestStreak || '0 d'}</div>
          <div className="usage-top-label">Longest streak</div>
        </div>
      </div>

      <div className="usage-dark-card">
        <div className="usage-card-head">
          <div className="usage-card-title">Token activity</div>
          <div className="usage-tabs">
            {['Daily', 'Weekly', 'Cumulative'].map((t) => (
              <button key={t} type="button" className={`usage-tab ${activityMode === t ? 'active' : ''}`} onClick={() => setActivityMode(t)}>{t}</button>
            ))}
          </div>
        </div>

        <div className="usage-heatmap-grid">
          {heatmap.map((c) => (
            <div
              key={c.key}
              className={`usage-heatmap-cell ${c.level ? `l${c.level}` : ''}`}
              onMouseEnter={(e) => setHeatmapTip({ date: c.date, tokens: c.tokens, x: e.clientX, y: e.clientY, level: c.level })}
              onMouseMove={(e) => setHeatmapTip({ date: c.date, tokens: c.tokens, x: e.clientX, y: e.clientY, level: c.level })}
              onMouseLeave={() => setHeatmapTip(null)}
            />
          ))}
        </div>
        {heatmapTip ? (
          <div className="usage-tooltip" style={{ left: clampTooltipX(heatmapTip.x), top: heatmapTip.y - 56, position: 'fixed' }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{heatmapTip.date}</div>
            <div className="usage-tooltip-line">{formatFull(heatmapTip.tokens)} tokens {heatmapTip.level ? `· level ${heatmapTip.level}` : '· no activity'}</div>
          </div>
        ) : null}
        <div className="usage-heatmap-months" style={heatmapMonths.length ? { gridTemplateColumns: `repeat(${heatmapMonths.length}, 1fr)` } : undefined}>
          {heatmapMonths.map((m, i) => <span key={`${m}-${i}`}>{m}</span>)}
        </div>
        {!hasHeatmapData && !loading ? <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 10 }}>No activity in this period — chat with Eve to generate usage.</div> : null}
        {error ? <div style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 8 }}>{error}</div> : null}
      </div>

      <div className="usage-time-row">
        <div className="usage-time-label">Time range</div>
        <div className="usage-tabs">
          <button type="button" className={`usage-tab ${days === 7 ? 'active' : ''}`} onClick={() => setDays(7)}>Last 7 days</button>
          <button type="button" className={`usage-tab ${days === 30 ? 'active' : ''}`} onClick={() => setDays(30)}>Last 30 days</button>
        </div>
      </div>

      <div className="usage-trend-wrap" style={{ position: 'relative' }}>
        <div className="usage-card-title" style={{ marginBottom: 10 }}>Daily token trend chart</div>
        {hasTrendData ? (
          <>
            <div className="usage-legend">
              {trend.series.map((s) => (
                <span key={s.name} className="usage-legend-item"><span className="usage-legend-dot" style={{ background: s.color }} />{s.name}</span>
              ))}
            </div>
            <div
              style={{ position: 'relative' }}
              onMouseLeave={() => setTrendTip(null)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const idx = Math.round((x / rect.width) * (trend.labels.length - 1))
                const clamped = Math.max(0, Math.min(trend.labels.length - 1, idx))
                const label = trend.labels[clamped]
                if (!label) return
                const values = trend.series.map((s) => ({ name: s.name, color: s.color, value: s.points[clamped] || 0 }))
                setTrendTip({ x: e.clientX, y: e.clientY, date: label.label, key: label.key, values })
              }}
            >
              <svg className="usage-trend-svg" viewBox="0 0 700 160" preserveAspectRatio="none">
                {[0, 1, 2, 3].map((i) => (
                  <line key={i} x1="0" x2="700" y1={20 + i * 35} y2={20 + i * 35} className="usage-grid-line" />
                ))}
                {trend.series.map((s) => {
                  const pts = s.points
                  const smooth = pts.map((v, i) => {
                    const x = (i / Math.max(1, pts.length - 1)) * 700
                    const y = 130 - (v / maxTrend) * 100
                    if (i === 0) return `M ${x} ${y}`
                    const prevX = ((i - 1) / Math.max(1, pts.length - 1)) * 700
                    const prevY = 130 - (pts[i - 1] / maxTrend) * 100
                    const cx = (prevX + x) / 2
                    return `C ${cx} ${prevY}, ${cx} ${y}, ${x} ${y}`
                  }).join(' ')
                  return <path key={s.name} d={smooth} fill="none" style={{ stroke: s.color }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                })}
                {trendTip ? (
                  <line x1={(trend.labels.findIndex((l) => l.key === trendTip.key) / Math.max(1, trend.labels.length - 1)) * 700} x2={(trend.labels.findIndex((l) => l.key === trendTip.key) / Math.max(1, trend.labels.length - 1)) * 700} y1="10" y2="140" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
                ) : null}
              </svg>
              {trendTip ? (
                <div
                  className="usage-tooltip"
                  style={{ left: clampTooltipX(trendTip.x), top: getTrendTooltipTop(trendTip.y), position: 'fixed' }}
                >
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{trendTip.date}</div>
                  {trendTip.values.map((v) => (
                    <div key={v.name} className="usage-tooltip-title" style={{ fontWeight: 600, fontSize: 12 }}>
                      <span className="usage-tooltip-dot" style={{ background: v.color }} />
                      {v.name}: <span className="usage-tooltip-value">{formatFull(v.value)} tokens</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{formatFull(trendTip.values.reduce((a, b) => a + b.value, 0))} total</div>
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {trend.labels.filter((_, i) => i % Math.ceil(trend.labels.length / 6) === 0).map((l) => (
                <span key={l.key} className="usage-trend-axis">{l.label}</span>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title="No trend data" description="Daily token totals will appear here once you have usage in the selected time range." />
        )}
      </div>

      <div className="usage-dark-card">
        <div className="usage-card-title" style={{ marginBottom: 14 }}>Model usage</div>
        {donut.segments.length ? (
          <div className="usage-donut-wrap">
            <div
              style={{ position: 'relative', width: 180, height: 180, margin: '0 auto' }}
              onMouseLeave={() => { setDonutTip(null); setActiveDonut(null) }}
            >
              <svg width="180" height="180" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="60" fill="none" stroke="var(--border-color)" strokeWidth="20" />
                {donut.segments.map((seg) => {
                  const len = (seg.pct / 100) * donutCirc
                  const isActive = activeDonut === seg.name
                  const isDimmed = activeDonut && !isActive
                  const el = (
                    <circle
                      key={seg.name}
                      cx="80"
                      cy="80"
                      r="60"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="20"
                      strokeDasharray={`${len} ${donutCirc - len}`}
                      strokeDashoffset={-donutOffset}
                      strokeLinecap="butt"
                      transform="rotate(-90 80 80)"
                      className={`usage-donut-segment ${isDimmed ? 'dimmed' : ''}`}
                      onMouseEnter={(e) => {
                        setActiveDonut(seg.name)
                        setDonutTip({ name: seg.name, tokens: seg.tokens, pct: seg.pct, color: seg.color, x: e.clientX, y: e.clientY })
                      }}
                      onMouseMove={(e) => setDonutTip({ name: seg.name, tokens: seg.tokens, pct: seg.pct, color: seg.color, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => { setDonutTip(null); setActiveDonut(null) }}
                    />
                  )
                  donutOffset += len
                  return el
                })}
              </svg>
              <div className="usage-donut-center">
                <div className="usage-donut-total">{formatTokens(donut.total)}</div>
                <div className="usage-donut-sub">tokens</div>
              </div>
              {donutTip ? (
                <div className="usage-tooltip" style={{ left: clampTooltipX(donutTip.x), top: donutTip.y - 56, position: 'fixed' }}>
                  <div className="usage-tooltip-title">
                    <span className="usage-tooltip-dot" style={{ background: donutTip.color }} />
                    {donutTip.name}
                  </div>
                  <div className="usage-tooltip-line">{formatFull(donutTip.tokens)} tokens <span className="usage-tooltip-value">{donutTip.pct}%</span></div>
                </div>
              ) : null}
            </div>

            <div>
              {donut.segments.map((seg) => (
                <div key={seg.name} className="usage-model-row">
                  <div className="usage-model-left">
                    <span className="usage-model-dot" style={{ background: seg.color }} />
                    <div>
                      <div className="usage-model-name">{seg.name}</div>
                      <div className="usage-model-tokens">{formatTokens(seg.tokens)} tokens</div>
                    </div>
                  </div>
                  <div className="usage-model-pct">{seg.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="No model data" description="Model breakdown appears after your first AI request." />
        )}
      </div>

      <div className="usage-refresh">
        <button type="button" className="usage-refresh-btn" onClick={load}><RefreshCw size={12} /> Refresh</button>
      </div>
    </div>
  )
}
