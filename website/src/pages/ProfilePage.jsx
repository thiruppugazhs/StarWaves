import { PageHeader } from '../components/ui'
import { ProfileCard } from '../components/ProfileCard'

export function ProfilePage({ user, onProfileUpdated, onSignOut }) {
  return (
    <section className="profile-page">
      <PageHeader eyebrow="Account" title="Profile" />

      <div className="profile-page-content">
        <ProfileCard user={user} onProfileUpdated={onProfileUpdated} onSignOut={onSignOut} />
      </div>
    </section>
  )
}
