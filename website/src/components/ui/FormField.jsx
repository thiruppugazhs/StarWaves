export function FormField({ label, htmlFor, hint, error, children }) {
  return (
    <label className="form-field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <small className="form-field-error">{error}</small>}
    </label>
  )
}
