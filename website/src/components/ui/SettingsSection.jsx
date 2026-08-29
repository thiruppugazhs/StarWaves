import { SectionHeading } from './SectionHeading'

/**
 * SettingsSection — layout primitive for Settings page sections.
 * Generates the two-column settings row: heading (left) + card stack (right).
 *
 * Props:
 *   id          - string (required) — section anchor for TabNav / scroll spy
 *   heading     - string (required) — h2 text (left column)
 *   description - string|node (optional) — subtext below heading
 *   children    - ReactNode (required) — one or more cards / content blocks (right column)
 *   className   - string (optional) — extra class on the outer section
 */
export function SettingsSection({ id, heading, description, children, className = '' }) {
  return (
    <section id={id} className={`setting-section ${className}`.trim()}>
      <SectionHeading title={heading} description={description} />
      <div className="setting-content-stack">{children}</div>
    </section>
  )
}
