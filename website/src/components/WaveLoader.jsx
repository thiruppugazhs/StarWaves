import { StarWavesLogo } from './StarWavesLogo'

export function WaveLoader({ label = 'Loading StarWaves…' }) {
  return (
    <div className="wave-loader" role="status" aria-live="polite">
      <div className="wave-loader-inner">
        <StarWavesLogo size={64} />
        <div className="wave-loader-title">StarWaves</div>
        <div className="wave-loader-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}>
          <div className="wave-loader-progress-bar" />
        </div>
        <span className="wave-loader-label">{label}</span>
      </div>
    </div>
  )
}
