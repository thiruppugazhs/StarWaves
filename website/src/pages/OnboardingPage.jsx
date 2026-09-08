import { ArrowRight, UserRound } from 'lucide-react'
import { useState } from 'react'
import { updateUserProfile } from '../lib/authApi'
import { StarWavesLogo } from '../components/StarWavesLogo'

export function OnboardingPage({ user, onComplete }) {
  const [name, setName] = useState(user?.displayName ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const cleanName = name.trim().replace(/\s+/g, ' ')
    if (cleanName.length < 2) {
      setError('Enter your name to continue.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const updatedUser = await updateUserProfile(cleanName)
      onComplete(updatedUser, cleanName)
    } catch {
      setError('Your name could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main id="main-content" className="onboarding-page" tabIndex={-1}>
      <section className="onboarding-card">
        <StarWavesLogo size={36} />
        <div className="onboarding-icon"><UserRound size={23} /></div>
        <p className="onboarding-eyebrow">One last step</p>
        <h1 className="onboarding-title">What should we call you?</h1>
        <span className="onboarding-copy">
          This name will appear in your StarWaves header and profile.
        </span>
        <form className="onboarding-form" onSubmit={submit}>
          <label htmlFor="onboarding-name">
            Your name
            <input
              id="onboarding-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your full name"
              minLength="2"
              maxLength="100"
              autoComplete="name"
              autoFocus
              required
            />
          </label>
          {error && <span className="auth-error" role="alert">{error}</span>}
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Continue to workspace'}
            {!saving && <ArrowRight size={17} />}
          </button>
        </form>
        <small className="onboarding-footer-text">Signed in as {user?.email}</small>
      </section>
    </main>
  )
}
