/**
 * SectionHeading — reusable h2 + description block used throughout
 * settings sections and themed content areas.
 *
 * Props:
 *   title       - string  (required) — h2 text
 *   description - node    (optional) — paragraph below the title
 *   className   - string  (optional) — extra class on the wrapper
 */
export function SectionHeading({ title, description, className = '' }) {
  return (
    <div className={`section-heading ${className}`.trim()}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  )
}
