export function Avatar({ name = 'User', src = null, className = '', size = 'md' }) {
  const initial = name.trim().charAt(0).toUpperCase() || 'U'

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`avatar avatar-${size} ${className}`}
      />
    )
  }

  return (
    <span className={`avatar avatar-${size} ${className}`}>
      {initial}
    </span>
  )
}
