import { ArrowLeft } from 'lucide-react'
import { StarWavesLogo } from '../components/StarWavesLogo'

export function TermsOfServicePage({ onNavigate }) {
  return (
    <main id="main-content" className="public-page" tabIndex={-1}>
      <nav className="public-nav" aria-label="Public navigation">
        <button className="public-brand" onClick={() => onNavigate('/')}>
          <StarWavesLogo size={28} /> StarWaves
        </button>
        <div className="public-nav-actions">
          <button className="public-login-link" onClick={() => onNavigate('/login')}>
            Log in
          </button>
          <button className="public-nav-cta" onClick={() => onNavigate('/signup')}>
            Get started
          </button>
        </div>
      </nav>

      <section className="legal-document">
        <button
          className="legal-back-button"
          onClick={() => onNavigate('/')}
        >
          <ArrowLeft size={16} /> Back to Home
        </button>

        <h1>
          Terms of Service
        </h1>
        <p className="legal-effective-date">
          Last updated: July 25, 2026 | Effective Date: July 25, 2026
        </p>

        <article>
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using <strong>StarWaves</strong> (accessible via <strong>starwaves.susindran.in</strong>), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, please do not access or use the application.
            </p>
          </section>

          <section>
            <h2>2. Account Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use or security breach.
            </p>
          </section>

          <section>
            <h2>3. Third-Party Integrations & Google Services</h2>
            <p>
              StarWaves integrates with third-party services including Google Calendar, Google Drive, Gmail, and GitHub. By connecting these services, you grant StarWaves authorization to access data specified during the OAuth authorization flow in accordance with our <button className="inline-link" type="button" onClick={() => onNavigate('/privacy')}>Privacy Policy</button>.
            </p>
            <p>
              You remain subject to the respective terms and conditions of third-party providers (e.g., Google Terms of Service). StarWaves is not responsible for third-party outage or changes in third-party API availability.
            </p>
          </section>

          <section>
            <h2>4. Acceptable Use Policy</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use StarWaves for any illegal, harmful, or unauthorized purpose.</li>
              <li>Attempt to gain unauthorized access to our servers, user accounts, or databases.</li>
              <li>Interfere with or disrupt the integrity or performance of the workspace platform.</li>
              <li>Reverse engineer, decompile, or copy the proprietary application code.</li>
            </ul>
          </section>

          <section>
            <h2>5. Intellectual Property</h2>
            <p>
              StarWaves, its original content, design system, and features remain the exclusive property of StarWaves and its creators. Content you create or upload to your workspace remains exclusively your property.
            </p>
          </section>

          <section>
            <h2>6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, StarWaves shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the service.
            </p>
          </section>

          <section>
            <h2>7. Termination & Changes to Terms</h2>
            <p>
              We reserve the right to modify or terminate access to StarWaves at any time. We may update these Terms periodically, and your continued use of the platform constitutes acceptance of updated terms.
            </p>
          </section>

          <section>
            <h2>8. Contact Information</h2>
            <p>
              For questions regarding these Terms of Service, please contact:
            </p>
            <p className="legal-contact">
              Email: <a href="mailto:dev@susindran.in" className="legal-link">dev@susindran.in</a><br />
              Domain: starwaves.susindran.in
            </p>
          </section>
        </article>
      </section>

      <footer className="public-footer">
        <span className="public-footer-brand">
          <StarWavesLogo size={22} /> StarWaves
        </span>
        <p>Plan clearly. Build consistently.</p>
        <small>© 2026 StarWaves. All rights reserved.</small>
      </footer>
    </main>
  )
}
