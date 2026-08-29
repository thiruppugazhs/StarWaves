/**
 * MetricCard — icon + label + value + optional detail.
 * Used in StatsPage metric grid and insight grids in Hackathons/Dashboard.
 *
 * Props:
 *   icon      - LucideIcon component (optional)
 *   label     - string
 *   value     - string | number
 *   detail    - string (optional, small subtext)
 *   className - string (optional)
 */
export function MetricCard({ icon: Icon, label, value, detail, className = '' }) {
  return (
    <article className={`metric-card ${className}`.trim()}>
      {Icon && <span><Icon size={18} /></span>}
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  )
}
