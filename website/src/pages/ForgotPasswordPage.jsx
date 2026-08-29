import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { requestPasswordReset, resetPassword, verifyResetCode } from '../lib/authApi'
import { StarWavesLogo } from '../components/StarWavesLogo'

export function ForgotPasswordPage({ onNavigate }) {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', ''])
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)

  const otpRefs = useRef([])

  // Resend timer countdown effect
  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCountdown])

  // Step 1: Submit email to request code
  const handleRequestCode = async (event) => {
    event.preventDefault()
    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setError('Please enter a valid email address.')
      return
    }

    setError('')
    setInfoMessage('')
    setSubmitting(true)
    try {
      const response = await requestPasswordReset(cleanEmail)
      if (response?.token) {
        setResetToken(response.token)
      }
      setInfoMessage(
        response?.message || 'Verification code sent! Please check your email.',
      )
      setResendCountdown(30)
      setStep(2)
    } catch (err) {
      setError(err.message || 'Unable to request password reset code.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle OTP individual input change
  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const nextDigits = [...codeDigits]
    nextDigits[index] = value.slice(-1)
    setCodeDigits(nextDigits)

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleDigitKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !codeDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleDigitPaste = (event) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return

    const nextDigits = [...codeDigits]
    for (let i = 0; i < pasted.length; i++) {
      nextDigits[i] = pasted[i]
    }
    setCodeDigits(nextDigits)
    const focusIndex = Math.min(pasted.length, 5)
    otpRefs.current[focusIndex]?.focus()
  }

  // Step 2: Submit OTP code for verification
  const handleVerifyCode = async (event) => {
    event.preventDefault()
    const fullCode = codeDigits.join('')
    if (fullCode.length !== 6) {
      setError('Please enter the full 6-digit verification code.')
      return
    }

    setError('')
    setInfoMessage('')
    setSubmitting(true)
    try {
      const response = await verifyResetCode(email.trim(), fullCode, resetToken)
      if (response?.reset_token) {
        setResetToken(response.reset_token)
      }
      setInfoMessage('Code verified successfully! Please set your new password.')
      setStep(3)
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Resend Code
  const handleResendCode = async () => {
    if (resendCountdown > 0 || submitting) return
    setError('')
    setInfoMessage('')
    setSubmitting(true)
    try {
      const response = await requestPasswordReset(email.trim())
      if (response?.token) {
        setResetToken(response.token)
      }
      setInfoMessage('A new verification code has been sent to your email.')
      setResendCountdown(30)
      setCodeDigits(['', '', '', '', '', ''])
    } catch (err) {
      setError(err.message || 'Could not resend verification code.')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 3: Submit New Password
  const handleResetPassword = async (event) => {
    event.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setInfoMessage('')
    setSubmitting(true)
    try {
      const activeToken = resetToken || 'verified-reset-token'
      const response = await resetPassword(activeToken, password)
      setInfoMessage(
        response?.message ||
          'Your password has been reset successfully. You can now log in with your new password.',
      )
      setStep(4)
    } catch (err) {
      setError(err.message || 'Unable to reset password. Please try again.')
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
          <p>SECURITY & ACCESS</p>
          <h1>
            {step === 1
              ? 'Identify your account.'
              : step === 2
                ? 'Verify your identity.'
                : step === 3
                  ? 'Set a strong password.'
                  : 'Access restored.'}
          </h1>
          <span>
            {step === 1
              ? 'Step 1 of 3: Enter your registered email address to receive a secure verification code.'
              : step === 2
                ? `Step 2 of 3: Enter the 6-digit code sent to ${email}.`
                : step === 3
                  ? 'Step 3 of 3: Choose a strong, memorable password for your workspace account.'
                  : 'Your password has been reset successfully. Return to log in.'}
          </span>
        </div>

        <small>Plan clearly. Build consistently.</small>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-shell">
          <button className="auth-back" onClick={() => onNavigate('/login')}>
            <ArrowLeft size={16} /> Back to log in
          </button>

          {/* Stepper Progress Bar */}
          <div className="auth-stepper" aria-label="Password recovery steps">
            <div className={`auth-step-pill ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
              <span className="step-num">1</span>
              <span className="step-label">Identify</span>
            </div>
            <div className={`auth-step-line ${step > 1 ? 'active' : ''}`} />
            <div className={`auth-step-pill ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
              <span className="step-num">2</span>
              <span className="step-label">Verify</span>
            </div>
            <div className={`auth-step-line ${step > 2 ? 'active' : ''}`} />
            <div className={`auth-step-pill ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
              <span className="step-num">3</span>
              <span className="step-label">Reset</span>
            </div>
          </div>

          <div className="auth-heading">
            <p>
              {step === 1
                ? 'Step 1 of 3 • Identify Account'
                : step === 2
                  ? 'Step 2 of 3 • Security Pin'
                  : step === 3
                    ? 'Step 3 of 3 • New Password'
                    : 'Security Complete'}
            </p>
            <h2>
              {step === 1
                ? 'Forgot your password?'
                : step === 2
                  ? 'Enter 6-digit code'
                  : step === 3
                    ? 'Create a new password'
                    : 'Password updated'}
            </h2>
            <span>
              {step === 1
                ? 'Enter the email address associated with your StarWaves account.'
                : step === 2
                  ? 'Enter the verification code sent to your inbox to continue.'
                  : step === 3
                    ? 'Your code was verified. Create a strong new password.'
                    : 'Your account is secured with your new password.'}
            </span>
          </div>

          {/* STEP 1: Enter Email */}
          {step === 1 && (
            <form className="auth-form" onSubmit={handleRequestCode}>
              <label>
                Account Email Address
                <span>
                  <Mail size={17} />
                  <input
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </span>
              </label>

              {infoMessage && <p className="auth-info" role="status">{infoMessage}</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}

              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting ? 'Sending code…' : 'Send verification code'}
                {!submitting && <ArrowRight size={17} />}
              </button>
            </form>
          )}

          {/* STEP 2: Enter OTP Code */}
          {step === 2 && (
            <form className="auth-form" onSubmit={handleVerifyCode}>
              <div className="auth-email-badge">
                <span>Verification code sent to <strong>{email}</strong></span>
                <button type="button" onClick={() => setStep(1)} className="auth-change-email-btn">
                  Edit
                </button>
              </div>

              <label>
                6-Digit Security Code
                <div className="auth-otp-group" onPaste={handleDigitPaste}>
                  {codeDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      className="auth-otp-field"
                      aria-label={`Digit ${idx + 1}`}
                      required
                      autoFocus={idx === 0}
                    />
                  ))}
                </div>
              </label>

              <div className="auth-resend-row">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCountdown > 0 || submitting}
                  className="auth-resend-btn"
                >
                  <RefreshCw size={14} className={submitting ? 'spin' : ''} />
                  {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
                </button>
              </div>

              {infoMessage && <p className="auth-info" role="status">{infoMessage}</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}

              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting ? 'Verifying code…' : 'Verify code'}
                {!submitting && <ArrowRight size={17} />}
              </button>
            </form>
          )}

          {/* STEP 3: Reset Password */}
          {step === 3 && (
            <form className="auth-form" onSubmit={handleResetPassword}>
              <label>
                New Password
                <span>
                  <LockKeyhole size={17} />
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              <label>
                Confirm New Password
                <span>
                  <LockKeyhole size={17} />
                  <input
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repeat your new password"
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </span>
              </label>

              <div className="auth-password-rules">
                <span className={password.length >= 8 ? 'valid' : ''}>
                  • Must be at least 8 characters
                </span>
                <span className={password && password === confirmPassword ? 'valid' : ''}>
                  • Passwords must match
                </span>
              </div>

              {infoMessage && <p className="auth-info" role="status">{infoMessage}</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}

              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting ? 'Updating password…' : 'Reset password'}
                {!submitting && <ArrowRight size={17} />}
              </button>
            </form>
          )}

          {/* STEP 4: Success Completion */}
          {step === 4 && (
            <div className="auth-success-card">
              <div className="auth-success-icon">
                <CheckCircle2 size={40} />
              </div>
              <h3>Password Reset Successfully</h3>
              <p>Your StarWaves workspace account password has been updated.</p>
              <button
                className="auth-submit"
                type="button"
                onClick={() => onNavigate('/login')}
              >
                Log in to StarWaves
                <ArrowRight size={17} />
              </button>
            </div>
          )}

          <p className="auth-switch">
            Remembered your password?
            <button onClick={() => onNavigate('/login')}>Log in</button>
          </p>
        </div>
      </section>
    </main>
  )
}
