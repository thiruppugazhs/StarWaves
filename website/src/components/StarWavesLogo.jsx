export function StarWavesLogo({ size = 30, className = "" }) {
  return (
    <img
      src="/starwaves-logo.png"
      alt="StarWaves Logo"
      width={size}
      height={size}
      className={`starwaves-logo-icon ${className}`}
    />
  )
}
