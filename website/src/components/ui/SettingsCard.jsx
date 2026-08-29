/**
 * SettingsCard — card with an icon + title + description header and optional action button.
 * Unifies the coding-settings-header, workspace-settings-header, and
 * hackathon-source-heading patterns across all settings sections.
 *
 * Props:
 *   icon        - ReactNode (optional) — e.g. <Bot size={18} />
 *   title       - string (required) — h3 text
 *   description - string (optional) — subtext below h3
 *   action      - ReactNode (optional) — right-side button / badge
 *   children    - ReactNode (optional) — card body content
 *   className   - string (optional) — extra class on the outer <section>
 *   as          - element type for the outer wrapper (default 'section', use 'form' when needed)
 *   formProps   - extra props forwarded to the outer element (e.g. onSubmit)
 */
export function SettingsCard({
  icon,
  title,
  description,
  action,
  children,
  className = '',
  as: Tag = 'section',
  ...rest
}) {
  return (
    <Tag className={`settings-card ${className}`.trim()} {...rest}>
      <div className="settings-card-header">
        {icon && <span className="settings-card-icon">{icon}</span>}
        <div className="settings-card-copy">
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {action && <div className="settings-card-action">{action}</div>}
      </div>
      {children && <div className="settings-card-body">{children}</div>}
    </Tag>
  )
}
