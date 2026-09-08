export function StarWavesLogo({ size = 30, className = "" }) {
  return (
    <img
      src="/logo.png"
      alt="StarWaves Logo"
      width={size}
      height={size}
      className={`starwaves-logo-icon ${className}`}
    />
  )
}
