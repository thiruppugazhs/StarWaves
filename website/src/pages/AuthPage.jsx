import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  beginGoogleOAuth,
  loginWithEmail,
  resendEmailOtp,
  resetPassword,
  signupWithEmail,
  verifyEmailOtp,
} from '../lib/authApi'
import { StarWavesLogo } from '../components/StarWavesLogo'

export function AuthPage({ mode, onNavigate, onAuthenticate, resetToken }) {
  const signup = mode === 'signup'
  const resetting = mode === 'reset'
  const [showPassword, setShowPassword] = useState(false)
  const [emailValue, setEmailValue] = useState('')
  const [nameValue, setNameValue] = useState('')
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // OTP Verification state
  const [awaitingOtp, setAwaitingOtp] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')
  const [otpValue, setOtpValue] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

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
      const name = signup ? form.get('name') : ''

      if (signup) {
        const result = await signupWithEmail(email, password, name)
        if (result.status === 'otp_required') {
          setAwaitingOtp(true)
          setOtpEmail(email)
          setResendCooldown(60)
          if (result.dev_otp) {
            setOtpValue(result.dev_otp)
            setInfoMessage(`Verification code: ${result.dev_otp}`)
          } else {
            setInfoMessage(result.message || 'A 6-digit verification code has been sent to your email.')
          }
        } else if (result.user) {
          finishAuthentication(result.user)
        }
      } else {
        const result = await loginWithEmail(email, password)
        if (result.status === 'otp_required') {
          setAwaitingOtp(true)
          setOtpEmail(email)
          setResendCooldown(60)
          if (result.dev_otp) {
            setOtpValue(result.dev_otp)
            setInfoMessage(`Verification code: ${result.dev_otp}`)
          } else {
            setInfoMessage(result.message || 'Please verify your email address. A 6-digit code has been sent to your email.')
          }
        } else if (result.user) {
          finishAuthentication(result.user)
        }
      }
    } catch (authError) {
      setError(authError.message || 'Unable to continue. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOtpSubmit = async (event) => {
    event.preventDefault()
    const cleanOtp = otpValue.trim()
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setError('Enter a valid 6-digit numeric verification code.')
      return
    }
    setError('')
    setInfoMessage('')
    setSubmitting(true)
    try {
      const user = await verifyEmailOtp(otpEmail, cleanOtp)
      finishAuthentication(user)
    } catch (authError) {
      setError(authError.message || 'Invalid or expired verification code.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || submitting) return
    setError('')
    setInfoMessage('')
    setSubmitting(true)
    try {
      const result = await resendEmailOtp(otpEmail)
      setResendCooldown(60)
      if (result?.dev_otp) {
        setOtpValue(result.dev_otp)
        setInfoMessage(`New verification code: ${result.dev_otp}`)
      } else {
        setInfoMessage(result.message || 'A new verification code has been sent to your email.')
      }
    } catch (authError) {
      setError(authError.message || 'Could not resend verification code. Please try again.')
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

  return (
    <main id="main-content" className="auth-page" tabIndex={-1}>
      <section className="auth-brand-panel">
        <button className="public-brand auth-brand" onClick={() => onNavigate('/')}>
          <StarWavesLogo size={28} /> StarWaves
        </button>
        <div>
          <p>YOUR WORKSPACE</p>
          <h1>{awaitingOtp ? 'Verify your identity.' : resetting ? 'Set a new password.' : signup ? 'Start with a clear view of what matters.' : 'Welcome back to your momentum.'}</h1>
          <span>{awaitingOtp ? 'Confirm your email to unlock your personal workspace and customizable AI companion.' : resetting ? 'Choose a strong password to secure your account.' : 'Tasks. Opportunities. Progress. One focused place.'}</span>
        </div>
        <small>Plan clearly. Build consistently.</small>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-shell">
          <button className="auth-back" onClick={() => {
            if (awaitingOtp) {
              setAwaitingOtp(false)
              setOtpValue('')
              setError('')
              setInfoMessage('')
            } else {
              onNavigate('/')
            }
          }}>
            <ArrowLeft size={16} /> {awaitingOtp ? 'Change email' : 'Back home'}
          </button>

          <div className="auth-heading">
            <p>{awaitingOtp ? 'Email Verification' : resetting ? 'Reset your password' : signup ? 'Create an account' : 'Welcome back'}</p>
            <h2>{awaitingOtp ? 'Enter verification code' : resetting ? 'Set a new password' : signup ? 'Build your workspace' : 'Log in to StarWaves'}</h2>
            <span>
              {awaitingOtp
                ? `Enter the 6-digit code sent to ${otpEmail}`
                : resetting
                  ? 'Enter a new password for your account.'
                  : signup
                    ? 'Set up your account in a few seconds.'
                    : 'Enter your details to continue.'}
            </span>
          </div>

          {awaitingOtp ? (
            <form className="auth-form" onSubmit={handleOtpSubmit}>
              <label>
                6-Digit Verification Code
                <span>
                  <KeyRound size={17} />
                  <input
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength="6"
                    placeholder="123456"
                    value={otpValue}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setOtpValue(val)
                    }}
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    style={{ letterSpacing: '4px', fontSize: '16px', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </span>
              </label>

              {infoMessage && <p className="auth-info" role="status">{infoMessage}</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}

              <button className="auth-submit" type="submit" disabled={submitting || otpValue.trim().length !== 6}>
                {submitting ? 'Verifying…' : 'Verify & continue'}
                {!submitting && <ArrowRight size={17} />}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || submitting}
                  className="auth-forgot"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={13} className={submitting ? 'animate-spin' : ''} />
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAwaitingOtp(false)
                    setOtpValue('')
                    setError('')
                    setInfoMessage('')
                  }}
                  className="auth-forgot"
                >
                  Use a different email
                </button>
              </div>
            </form>
          ) : resetting ? (
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
                {signup && (
                  <label>
                    Full Name
                    <span>
                      <input
                        name="name"
                        type="text"
                        placeholder="Alex Doe"
                        autoComplete="name"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        required
                      />
                    </span>
                  </label>
                )}
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
                  {submitting ? 'Please wait…' : signup ? 'Continue with verification' : 'Log in'}
                  {!submitting && <ArrowRight size={17} />}
                </button>
              </form>
            </>
          )}

          {!awaitingOtp && (
            <p className="auth-switch">
              {resetting
                ? 'Ready to log in?'
                : signup ? 'Already have an account?' : 'New to StarWaves?'}
              <button onClick={() => onNavigate(resetting ? '/login' : signup ? '/login' : '/signup')}>
                {resetting ? 'Log in' : signup ? 'Log in' : 'Create an account'}
              </button>
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
