import "../styles/pages/public-shell.css"
import "../styles/pages/auth-forms.css"
import "../styles/pages/auth-onboarding.css"
import "../styles/pages/auth-recovery.css"
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import {
  beginGoogleOAuth,
  loginWithEmail,
  resetPassword,
  signupWithEmail,
} from '../lib/authApi'
import { AuthShell } from '../components/auth/AuthShell'

export function AuthPage({ mode, onNavigate, onAuthenticate, resetToken }) {
  const signup = mode === 'signup'
  const resetting = mode === 'reset'
  const [showPassword, setShowPassword] = useState(false)
  const [emailValue, setEmailValue] = useState('')
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const finishAuthentication = (user) => {
    onAuthenticate(user)
  }

  const handleResetSubmit = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = form.get('password')
    if (password !== form.get('confirmPassword')) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setInfoMessage('')
    setSubmitting(true)
    try {
      const result = await resetPassword(resetToken, password)
      window.history.replaceState({}, '', window.location.pathname + window.location.search)
      setInfoMessage(result.message || 'Your password has been reset. You can now log in with your new password.')
    } catch (authError) {
      setError(authError.message || 'Unable to reset your password. The link may be invalid or expired.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (signup && form.get('password') !== form.get('confirmPassword')) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setInfoMessage('')
    setSubmitting(true)
    try {
      const email = form.get('email')
      const password = form.get('password')
      let user
      if (signup) {
        user = await signupWithEmail(email, password)
      } else {
        user = await loginWithEmail(email, password)
      }
      finishAuthentication(user)
    } catch (authError) {
      setError(authError.message || 'Unable to continue. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const signInWithGoogle = async () => {
    setError('')
    setInfoMessage('')
    setSubmitting(true)
    try {
      const user = await beginGoogleOAuth()
      finishAuthentication(user)
    } catch (authError) {
      setError(authError.message || 'Google sign-in could not be completed.')
    } finally {
      setSubmitting(false)
    }
  }

  const panel = resetting
    ? {
        kicker: 'Reset password',
        title: 'Choose a fresh password.',
        body: 'Set a new password to get back into your workspace.',
      }
    : signup
      ? {
          kicker: 'Create an account',
          title: 'Build your workspace.',
          body: 'Tasks, calendar, code, contests and Eve AI on one canvas — free to start.',
        }
      : {
          kicker: 'Welcome back',
          title: 'Pick up where you left off.',
          body: 'Your tasks, calendar, code and Eve — exactly as you left them.',
        }

  return (
    <AuthShell backLabel="Back home" onBack={() => onNavigate('/')} onHome={() => onNavigate('/')} panel={panel}>
          <div className="auth-heading">
            <p>{resetting ? 'Reset your password' : signup ? 'Create an account' : 'Welcome back'}</p>
            <h2>{resetting ? 'Set a new password' : signup ? 'Build your workspace' : 'Log in to StarWaves'}</h2>
            <span>{resetting ? 'Enter a new password for your account.' : signup ? 'Set up your account in a few seconds.' : 'Enter your details to continue.'}</span>
          </div>

          {resetting ? (
            <form className="auth-form" onSubmit={handleResetSubmit}>
              <label>
                New password
                <span>
                  <LockKeyhole size={17} />
                  <input name="password" type={showPassword ? 'text' : 'password'} placeholder="At least 8 characters" minLength="8" autoComplete="new-password" required />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
              <label>
                Confirm new password
                <span><LockKeyhole size={17} /><input name="confirmPassword" type={showPassword ? 'text' : 'password'} placeholder="Repeat your new password" minLength="8" autoComplete="new-password" required /></span>
              </label>
              {infoMessage && <p className="auth-info" role="status">{infoMessage}</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting ? 'Please wait…' : 'Reset password'}
                {!submitting && <ArrowRight size={17} />}
              </button>
            </form>
          ) : (
            <>
              <button className="auth-google" type="button" onClick={signInWithGoogle} disabled={submitting}>
                <span>G</span> Continue with Google
              </button>
              <div className="auth-divider"><span>or continue with email</span></div>

              <form className="auth-form" onSubmit={handleAuthSubmit}>
                <label>
                  Email
                  <span>
                    <Mail size={17} />
                    <input
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      required
                    />
                  </span>
                </label>
                <label>
                  Password
                  <span>
                    <LockKeyhole size={17} />
                    <input name="password" type={showPassword ? 'text' : 'password'} placeholder="At least 8 characters" minLength="8" autoComplete={signup ? 'new-password' : 'current-password'} required />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </span>
                </label>
                {signup && (
                  <label>
                    Confirm password
                    <span><LockKeyhole size={17} /><input name="confirmPassword" type={showPassword ? 'text' : 'password'} placeholder="Repeat your password" minLength="8" autoComplete="new-password" required /></span>
                  </label>
                )}
                {!signup && (
                  <button className="auth-forgot" type="button" onClick={() => onNavigate('/forgot-password')} disabled={submitting}>
                    Forgot password?
                  </button>
                )}
                {infoMessage && <p className="auth-info" role="status">{infoMessage}</p>}
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button className="auth-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Please wait…' : signup ? 'Create account' : 'Log in'}
                  {!submitting && <ArrowRight size={17} />}
                </button>
              </form>
            </>
          )}

          <p className="auth-switch">
            {resetting
              ? 'Ready to log in?'
              : signup ? 'Already have an account?' : 'New to StarWaves?'}
            <button onClick={() => onNavigate(resetting ? '/login' : signup ? '/login' : '/signup')}>
              {resetting ? 'Log in' : signup ? 'Log in' : 'Create an account'}
            </button>
          </p>
    </AuthShell>
  )
}
